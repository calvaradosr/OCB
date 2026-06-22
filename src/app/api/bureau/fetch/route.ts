/**
 * POST /api/bureau/fetch
 *
 * Internal-only route that uses Playwright to log in to a bureau monitoring
 * service, scrape the 3-bureau credit report (accounts + per-bureau scores),
 * and persist results via persistReport(). Called by the triggerReportFetch()
 * server action.
 *
 * Required environment variables:
 *   INTERNAL_API_SECRET  — shared secret to authenticate internal calls
 *   AUTH_URL             — base URL used by triggerReportFetch to reach this
 *                          route (falls back to NEXTAUTH_URL, then localhost:3001)
 *   PII_ENCRYPTION_KEY   — AES-256-GCM key (already required by crypto.ts)
 *
 * Optional (selector tuning / debugging):
 *   BUREAU_DEBUG_CAPTURE — when "1", dump the page HTML + a screenshot to disk
 *                          whenever parsing fails or finds no accounts, so the
 *                          real bureau DOM can be inspected and selectors tuned.
 *                          OFF by default: captured report HTML contains client
 *                          PII (GLBA), so only enable in a controlled env and
 *                          purge artifacts afterward.
 *   BUREAU_DEBUG_DIR     — directory for those artifacts
 *                          (default: <cwd>/debug-artifacts/bureau).
 *
 * Max execution time: 90 seconds (Playwright automation on slow bureau sites).
 * This route returns { status: "started" } immediately after launching the
 * browser job; status updates are written directly to BureauCredential.lastStatus.
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { db } from "@/lib/db"
import { AUTO_FLAG_TYPES } from "@/lib/report-utils"
import {
  parseIdentityIQReport,
  parseGenericReport,
  parseScores,
  EMPTY_SCORES,
  type ParsedAccount,
  type ParsedScores,
} from "@/lib/bureau-scrape"
import { verifyPostingForClient } from "@/app/actions/tradelines"
import { autoCreateLoanLead } from "@/app/actions/loans"
import { runAutomations } from "@/lib/automation"
import type { BureauService } from "@prisma/client"

// Playwright + fs require the Node runtime (not Edge), and the browser job can
// run close to the 90s budget set by the caller.
export const runtime = "nodejs"
export const maxDuration = 90

// ─── Auth guard ───────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${secret}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FetchBody {
  clientId: string
  credentialId: string
  service: BureauService
  username: string
  password: string
}

// ParsedAccount, ParsedScores, EMPTY_SCORES, and the DOM parsers
// (parseIdentityIQReport, parseGenericReport, parseScores) now live in
// @/lib/bureau-scrape so they can be run against a static page in the offline
// tuning harness (scripts/tune-bureau.ts).

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: FetchBody
  try {
    body = (await req.json()) as FetchBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { clientId, credentialId, service, username, password } = body
  if (!clientId || !credentialId || !service || !username || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Run the browser job asynchronously — do NOT await so the response returns fast
  runBrowserJob({ clientId, credentialId, service, username, password }).catch(
    async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      await db.bureauCredential
        .update({
          where: { id: credentialId },
          data: { lastStatus: "failed", lastError: msg.slice(0, 500) },
        })
        .catch(() => {})
    }
  )

  return NextResponse.json({ status: "started" })
}

// ─── Browser orchestration ────────────────────────────────────────────────────

async function runBrowserJob(params: FetchBody): Promise<void> {
  // Dynamic import so Playwright is only loaded when this route is actually hit
  const { chromium } = await import("playwright")

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    let accounts: ParsedAccount[] = []
    let fetchStatus: string = "success"
    let fetchError: string | null = null

    try {
      switch (params.service) {
        case "IDENTITY_IQ":
          accounts = await fetchIdentityIQ(page, params.username, params.password)
          break
        case "MY_SCORE_360":
          accounts = await fetchMyScore360(page, params.username, params.password)
          break
        case "EXPERIAN":
          accounts = await fetchExperian(page, params.username, params.password)
          break
        case "EQUIFAX":
          accounts = await fetchEquifax(page, params.username, params.password)
          break
        case "TRANSUNION":
          accounts = await fetchTransUnion(page, params.username, params.password)
          break
        case "ANNUAL_CREDIT_REPORT":
          accounts = await fetchAnnualCreditReport(page, params.username, params.password)
          break
        default:
          throw new Error(`Unsupported service: ${params.service}`)
      }
    } catch (err: unknown) {
      if (err instanceof CaptchaDetectedError) {
        fetchStatus = "captcha"
        fetchError = "CAPTCHA detected — manual intervention required"
      } else if (err instanceof MfaRequiredError) {
        fetchStatus = "mfa_required"
        fetchError = "MFA/2FA required — automated login not supported"
      } else {
        fetchStatus = "failed"
        fetchError = err instanceof Error ? err.message.slice(0, 500) : String(err)
      }
    }

    if (fetchStatus === "success" && accounts.length > 0) {
      // Scrape scores while still on the report page — best-effort, never fatal
      const scores = await parseScores(page, params.service).catch(() => EMPTY_SCORES)
      await persistReport(params.clientId, params.service, accounts, scores)
      await db.bureauCredential.update({
        where: { id: params.credentialId },
        data: {
          lastStatus: "success",
          lastFetchAt: new Date(),
          lastError: null,
        },
      })
    } else if (fetchStatus === "success" && accounts.length === 0) {
      // No accounts found — treat as a parse failure, not a login failure.
      // Capture the DOM so the selectors can be tuned against the real page.
      const artifact = await captureDebugArtifacts(page, params.service, "no-accounts")
      await db.bureauCredential.update({
        where: { id: params.credentialId },
        data: {
          lastStatus: "failed",
          lastFetchAt: new Date(),
          lastError:
            "No accounts found on report page — the page structure may have changed" +
            (artifact ? ` (debug: ${artifact})` : ""),
        },
      })
    } else {
      // A login/CAPTCHA/MFA/other failure — capture the DOM when it's a generic
      // failure (CAPTCHA/MFA pages are expected and self-explanatory).
      const artifact =
        fetchStatus === "failed"
          ? await captureDebugArtifacts(page, params.service, fetchStatus)
          : null
      await db.bureauCredential.update({
        where: { id: params.credentialId },
        data: {
          lastStatus: fetchStatus,
          lastFetchAt: new Date(),
          lastError: artifact ? `${fetchError ?? "Fetch failed"} (debug: ${artifact})` : fetchError,
        },
      })
    }
  } finally {
    await browser.close()
  }
}

// ─── Sentinel error types ─────────────────────────────────────────────────────

class CaptchaDetectedError extends Error {
  constructor() {
    super("CAPTCHA detected")
    this.name = "CaptchaDetectedError"
  }
}

class MfaRequiredError extends Error {
  constructor() {
    super("MFA required")
    this.name = "MfaRequiredError"
  }
}

// ─── Debug artifact capture (selector tuning) ────────────────────────────────

import type { Page } from "playwright"

/**
 * When BUREAU_DEBUG_CAPTURE=1, dump the current page's HTML + a full-page
 * screenshot to disk so the real bureau DOM can be inspected and the parser's
 * selectors tuned against it. Returns a short relative path for the lastError
 * message, or null when capture is disabled or fails.
 *
 * Disabled by default: the report HTML contains client PII (GLBA), so this must
 * only be turned on in a controlled environment and the artifacts purged after.
 */
async function captureDebugArtifacts(
  page: Page,
  service: BureauService,
  reason: string
): Promise<string | null> {
  if (process.env.BUREAU_DEBUG_CAPTURE !== "1") return null
  try {
    const dir =
      process.env.BUREAU_DEBUG_DIR ?? path.join(process.cwd(), "debug-artifacts", "bureau")
    await fs.mkdir(dir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const base = `${service}-${reason}-${stamp}`

    const html = await page.content()
    await fs.writeFile(path.join(dir, `${base}.html`), html, "utf8")
    await page.screenshot({ path: path.join(dir, `${base}.png`), fullPage: true }).catch(() => {})

    return path.join("debug-artifacts", "bureau", `${base}.html`)
  } catch {
    return null
  }
}

// ─── CAPTCHA / MFA detection helpers ─────────────────────────────────────────

async function checkForCaptchaOrMfa(page: Page): Promise<void> {
  const title = (await page.title()).toLowerCase()
  const url = page.url().toLowerCase()

  // CAPTCHA indicators
  const captchaIndicators = [
    "recaptcha",
    "hcaptcha",
    "verify you are human",
    "are you a robot",
    "security check",
    "please verify",
    "captcha",
  ]
  for (const indicator of captchaIndicators) {
    if (title.includes(indicator) || url.includes(indicator)) {
      throw new CaptchaDetectedError()
    }
  }

  // Check for reCAPTCHA iframe in DOM
  const recaptchaFrame = await page.$("iframe[src*='recaptcha'], iframe[src*='hcaptcha']")
  if (recaptchaFrame) throw new CaptchaDetectedError()

  // MFA indicators — common patterns for OTP/2FA input fields
  const mfaSelectors = [
    "input[name*='otp']",
    "input[name*='mfa']",
    "input[name*='code']",
    "input[placeholder*='verification code' i]",
    "input[placeholder*='one-time' i]",
    "#verification-code",
    "#mfa-code",
    "[data-testid*='mfa']",
  ]
  for (const selector of mfaSelectors) {
    const el = await page.$(selector)
    if (el) throw new MfaRequiredError()
  }
}

// ─── IdentityIQ fetcher ───────────────────────────────────────────────────────

async function fetchIdentityIQ(
  page: Page,
  username: string,
  password: string
): Promise<ParsedAccount[]> {
  await page.goto("https://www.identityiq.com/sc/login.aspx", {
    waitUntil: "networkidle",
    timeout: 30_000,
  })

  await checkForCaptchaOrMfa(page)

  // Fill login form — IdentityIQ uses username/password fields
  await page.fill("input[name='username'], input[id*='username' i], input[type='email']", username)
  await page.fill("input[name='password'], input[type='password']", password)
  await page.click("button[type='submit'], input[type='submit'], .btn-login, #loginButton")

  // Wait for navigation
  await page.waitForLoadState("networkidle", { timeout: 30_000 })
  await checkForCaptchaOrMfa(page)

  // Check for login failure
  const errorEl = await page.$(".error-message, .alert-danger, [class*='error'], [class*='alert']")
  if (errorEl) {
    const errorText = await errorEl.textContent()
    if (errorText?.toLowerCase().includes("invalid") || errorText?.toLowerCase().includes("incorrect")) {
      throw new Error(`Login failed: ${errorText?.trim().slice(0, 200)}`)
    }
  }

  // Navigate to 3-bureau report
  await page.goto("https://www.identityiq.com/credit-report/3-bureau", {
    waitUntil: "networkidle",
    timeout: 30_000,
  })

  // Wait for the report content to load
  try {
    await page.waitForSelector(
      "[class*='account'], .account-row, [data-account], .credit-account",
      { timeout: 30_000 }
    )
  } catch {
    // Try alternate URL path
    await page.goto("https://www.identityiq.com/credit-report/3-bureau-report", {
      waitUntil: "networkidle",
      timeout: 30_000,
    })
    await page.waitForTimeout(5_000)
  }

  await checkForCaptchaOrMfa(page)

  return parseIdentityIQReport(page)
}

// ─── MyScore360 fetcher ───────────────────────────────────────────────────────

async function fetchMyScore360(
  page: Page,
  username: string,
  password: string
): Promise<ParsedAccount[]> {
  // MyScore360 redirects to MyScoreIQ
  await page.goto("https://app.myscoreiq.com/login", {
    waitUntil: "networkidle",
    timeout: 30_000,
  })

  await checkForCaptchaOrMfa(page)

  await page.fill(
    "input[name='email'], input[type='email'], input[name='username'], input[id*='email' i]",
    username
  )
  await page.fill("input[type='password']", password)
  await page.click("button[type='submit'], .btn-primary, input[type='submit']")

  await page.waitForLoadState("networkidle", { timeout: 30_000 })
  await checkForCaptchaOrMfa(page)

  // Check for login error
  const errorEl = await page.$(".error, .alert-error, [class*='error']")
  if (errorEl) {
    const msg = await errorEl.textContent()
    if (msg?.toLowerCase().includes("invalid") || msg?.toLowerCase().includes("incorrect")) {
      throw new Error(`Login failed: ${msg.trim().slice(0, 200)}`)
    }
  }

  // Navigate to credit report section
  await page.waitForTimeout(2_000)
  const reportLink = await page.$(
    "a[href*='credit-report'], a[href*='report'], a[href*='3-bureau']"
  )
  if (reportLink) {
    await reportLink.click()
    await page.waitForLoadState("networkidle", { timeout: 20_000 })
  }

  await page.waitForTimeout(3_000)
  await checkForCaptchaOrMfa(page)

  return parseGenericReport(page, { allThreeBureaus: true })
}

// ─── Experian fetcher ─────────────────────────────────────────────────────────

async function fetchExperian(
  page: Page,
  username: string,
  password: string
): Promise<ParsedAccount[]> {
  await page.goto("https://usa.experian.com/login", {
    waitUntil: "networkidle",
    timeout: 30_000,
  })

  await checkForCaptchaOrMfa(page)

  await page.fill(
    "input[name='username'], input[id*='username' i], input[type='email']",
    username
  )
  await page.fill("input[type='password']", password)
  await page.click("button[type='submit'], .primary-btn, #btnSignIn")

  await page.waitForLoadState("networkidle", { timeout: 30_000 })
  await checkForCaptchaOrMfa(page)

  // Navigate to credit report
  try {
    await page.goto("https://usa.experian.com/member/dashboard", {
      waitUntil: "networkidle",
      timeout: 30_000,
    })
  } catch {
    // ignore redirect errors
  }

  const reportLink = await page.$(
    "a[href*='credit-report'], a[href*='report'], a[href*='accounts']"
  )
  if (reportLink) {
    await reportLink.click()
    await page.waitForLoadState("networkidle", { timeout: 20_000 })
  }

  await page.waitForTimeout(3_000)
  await checkForCaptchaOrMfa(page)

  // Experian only shows its own bureau data
  return parseGenericReport(page, { onExperian: true, onEquifax: false, onTransunion: false })
}

// ─── Equifax fetcher ──────────────────────────────────────────────────────────

async function fetchEquifax(
  page: Page,
  username: string,
  password: string
): Promise<ParsedAccount[]> {
  await page.goto(
    "https://my.equifax.com/consumer-registration/UCSC/#/login",
    { waitUntil: "networkidle", timeout: 30_000 }
  )

  await checkForCaptchaOrMfa(page)

  await page.fill("input[name='username'], input[id*='username' i]", username)
  await page.fill("input[type='password']", password)
  await page.click("button[type='submit'], .eq-button--primary, #loginBtn")

  await page.waitForLoadState("networkidle", { timeout: 30_000 })
  await page.waitForTimeout(3_000)
  await checkForCaptchaOrMfa(page)

  const reportLink = await page.$(
    "a[href*='credit-report'], a[href*='report'], a[href*='credit-score']"
  )
  if (reportLink) {
    await reportLink.click()
    await page.waitForLoadState("networkidle", { timeout: 20_000 })
  }

  await page.waitForTimeout(3_000)
  await checkForCaptchaOrMfa(page)

  // Equifax only shows its own bureau data
  return parseGenericReport(page, { onExperian: false, onEquifax: true, onTransunion: false })
}

// ─── TransUnion fetcher ───────────────────────────────────────────────────────

async function fetchTransUnion(
  page: Page,
  username: string,
  password: string
): Promise<ParsedAccount[]> {
  await page.goto("https://www.transunion.com/credit-monitoring", {
    waitUntil: "networkidle",
    timeout: 30_000,
  })

  await checkForCaptchaOrMfa(page)

  // Find sign-in link/button
  const signInBtn = await page.$(
    "a[href*='login'], a[href*='sign-in'], button:has-text('Sign In'), a:has-text('Sign In')"
  )
  if (signInBtn) {
    await signInBtn.click()
    await page.waitForLoadState("networkidle", { timeout: 20_000 })
  }

  await page.fill("input[name='username'], input[id*='username' i], input[type='email']", username)
  await page.fill("input[type='password']", password)
  await page.click("button[type='submit'], .btn-primary, #loginSubmit")

  await page.waitForLoadState("networkidle", { timeout: 30_000 })
  await page.waitForTimeout(3_000)
  await checkForCaptchaOrMfa(page)

  const reportLink = await page.$(
    "a[href*='credit-report'], a[href*='report'], a[href*='credit-score']"
  )
  if (reportLink) {
    await reportLink.click()
    await page.waitForLoadState("networkidle", { timeout: 20_000 })
  }

  await page.waitForTimeout(3_000)
  await checkForCaptchaOrMfa(page)

  // TransUnion only shows its own bureau data
  return parseGenericReport(page, { onExperian: false, onEquifax: false, onTransunion: true })
}

// ─── AnnualCreditReport fetcher ───────────────────────────────────────────────

async function fetchAnnualCreditReport(
  page: Page,
  username: string,
  password: string
): Promise<ParsedAccount[]> {
  await page.goto(
    "https://www.annualcreditreport.com/requestReport/landingPage.action",
    { waitUntil: "networkidle", timeout: 30_000 }
  )

  await checkForCaptchaOrMfa(page)

  // AnnualCreditReport uses a multi-step identity verification flow
  // Try to find a login form first
  const emailInput = await page.$(
    "input[type='email'], input[name='email'], input[name='username']"
  )
  if (emailInput) {
    await emailInput.fill(username)
    const passInput = await page.$("input[type='password']")
    if (passInput) {
      await passInput.fill(password)
      await page.click("button[type='submit'], input[type='submit']")
      await page.waitForLoadState("networkidle", { timeout: 30_000 })
    }
  } else {
    // AnnualCreditReport.com requires identity verification steps — not automatable
    throw new Error(
      "AnnualCreditReport.com requires identity verification steps that cannot be automated. Use IdentityIQ or MyScore360 for automated 3-bureau reports."
    )
  }

  await checkForCaptchaOrMfa(page)
  await page.waitForTimeout(3_000)

  return parseGenericReport(page, { allThreeBureaus: true })
}

// ─── Persist parsed report to DB ─────────────────────────────────────────────

async function persistReport(
  clientId: string,
  service: BureauService,
  accounts: ParsedAccount[],
  scores: ParsedScores
): Promise<void> {
  const sourceMap: Record<BureauService, string> = {
    IDENTITY_IQ: "IDENTITYIQ",
    MY_SCORE_360: "MY_SCORE_360",
    EXPERIAN: "EXPERIAN",
    EQUIFAX: "EQUIFAX",
    TRANSUNION: "TRANSUNION",
    ANNUAL_CREDIT_REPORT: "ANNUAL_CREDIT_REPORT",
  }

  const report = await db.creditReport.create({
    data: {
      clientId,
      source: sourceMap[service],
      scoreExperian: scores.experian,
      scoreEquifax: scores.equifax,
      scoreTransunion: scores.transunion,
      items: {
        create: accounts.map(acc => ({
          clientId,
          type: acc.type as never,
          creditorName: acc.creditorName,
          accountNumberMasked: acc.accountNumberMasked || null,
          onExperian: acc.onExperian,
          onEquifax: acc.onEquifax,
          onTransunion: acc.onTransunion,
          balance: acc.balance ? parseFloat(acc.balance) : null,
          dateOpened: acc.dateOpened ? new Date(acc.dateOpened) : null,
          flagged: AUTO_FLAG_TYPES.has(acc.type),
        })),
      },
    },
  })

  // Non-blocking post-import hooks (same as manual import)
  verifyPostingForClient(clientId, report.id).catch(() => {})
  autoCreateLoanLead(clientId, {
    experian: null,
    equifax: null,
    transunion: null,
  }).catch(() => {})
  runAutomations({ trigger: "REPORT_IMPORTED", clientId, triggeredBy: report.id }).catch(() => {})
}

// mapAccountType, parseBalance, and parseDateString now live in
// @/lib/bureau-parse (pure + unit-tested).
