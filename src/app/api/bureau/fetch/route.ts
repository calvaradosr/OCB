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
 * Max execution time: 90 seconds (Playwright automation on slow bureau sites).
 * This route returns { status: "started" } immediately after launching the
 * browser job; status updates are written directly to BureauCredential.lastStatus.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { AUTO_FLAG_TYPES } from "@/lib/report-utils"
import { verifyPostingForClient } from "@/app/actions/tradelines"
import { autoCreateLoanLead } from "@/app/actions/loans"
import { runAutomations } from "@/lib/automation"
import type { BureauService } from "@prisma/client"

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

interface ParsedAccount {
  creditorName: string
  accountNumberMasked: string
  type: string
  onExperian: boolean
  onEquifax: boolean
  onTransunion: boolean
  balance: string
  dateOpened: string
}

interface ParsedScores {
  experian: number | null
  equifax: number | null
  transunion: number | null
}

const EMPTY_SCORES: ParsedScores = { experian: null, equifax: null, transunion: null }

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
      // No accounts found — treat as a parse failure, not a login failure
      await db.bureauCredential.update({
        where: { id: params.credentialId },
        data: {
          lastStatus: "failed",
          lastFetchAt: new Date(),
          lastError: "No accounts found on report page — the page structure may have changed",
        },
      })
    } else {
      await db.bureauCredential.update({
        where: { id: params.credentialId },
        data: {
          lastStatus: fetchStatus,
          lastFetchAt: new Date(),
          lastError: fetchError,
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

// ─── CAPTCHA / MFA detection helpers ─────────────────────────────────────────

import type { Page } from "playwright"

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

async function parseIdentityIQReport(page: Page): Promise<ParsedAccount[]> {
  const accounts: ParsedAccount[] = []

  // IdentityIQ renders account rows — we attempt multiple selector strategies
  // as the site's class names change periodically
  const rows = await page.$$(
    [
      ".account-row",
      "[class*='AccountRow']",
      "[class*='account-row']",
      ".tradeline-row",
      "[data-account-name]",
      "tr[class*='account']",
    ].join(", ")
  )

  for (const row of rows) {
    try {
      // Creditor name
      const nameEl = await row.$(
        ".account-name, [data-account-name], [class*='creditor-name'], [class*='account-name'], td:first-child"
      )
      const creditorName = (await nameEl?.textContent())?.trim() ?? ""
      if (!creditorName) continue

      // Account number
      const acctEl = await row.$(
        ".account-number, [data-account-number], [class*='account-number']"
      )
      const accountNumberMasked = (await acctEl?.textContent())?.trim() ?? ""

      // Account type
      const typeEl = await row.$(
        ".account-type, [data-account-type], [class*='account-type']"
      )
      const typeText = (await typeEl?.textContent())?.trim().toUpperCase() ?? ""
      const accountType = mapAccountType(typeText)

      // Balance
      const balEl = await row.$(".balance, [data-balance], [class*='balance']")
      const balanceText = (await balEl?.textContent())?.trim() ?? ""
      const balance = balanceText.replace(/[^0-9.]/g, "")

      // Date opened
      const dateEl = await row.$(
        ".date-opened, [data-date-opened], [class*='date-opened']"
      )
      const dateText = (await dateEl?.textContent())?.trim() ?? ""
      const dateOpened = parseDateString(dateText)

      // Bureau presence — look for per-bureau sections or indicators
      // IIQ often uses classes like .exp, .eqf, .tu or .experian, .equifax, .transunion
      const expEl = await row.$(".exp, .experian, [class*='exp-'], [data-bureau='experian']")
      const eqEl = await row.$(".eq, .eqf, .equifax, [class*='eq-'], [data-bureau='equifax']")
      const tuEl = await row.$(".tu, .transunion, [class*='tu-'], [data-bureau='transunion']")

      // If no bureau-specific elements, check for "negative" or "reporting" indicators
      // Fall back to checking if the account has any negative status text
      const rowText = (await row.textContent()) ?? ""
      const hasNegative = /negative|collection|charge.?off|derogatory|past due/i.test(rowText)

      const onExperian = expEl ? await isBureauReporting(expEl) : hasNegative
      const onEquifax = eqEl ? await isBureauReporting(eqEl) : hasNegative
      const onTransunion = tuEl ? await isBureauReporting(tuEl) : hasNegative

      accounts.push({
        creditorName,
        accountNumberMasked,
        type: accountType,
        onExperian,
        onEquifax,
        onTransunion,
        balance,
        dateOpened,
      })
    } catch {
      // Skip malformed rows
    }
  }

  // If the row-based approach found nothing, try a table-based fallback
  if (accounts.length === 0) {
    return parseIdentityIQTable(page)
  }

  return accounts
}

async function parseIdentityIQTable(page: Page): Promise<ParsedAccount[]> {
  const accounts: ParsedAccount[] = []

  // Fallback: look for any table with account data
  const tables = await page.$$("table")
  for (const table of tables) {
    const headers = await table.$$eval("th", els => els.map(el => el.textContent?.trim().toLowerCase() ?? ""))
    const hasCreditorCol = headers.some(h => h.includes("creditor") || h.includes("account") || h.includes("company"))
    if (!hasCreditorCol) continue

    const trs = await table.$$("tbody tr")
    for (const tr of trs) {
      try {
        const cells = await tr.$$eval("td", els => els.map(el => el.textContent?.trim() ?? ""))
        if (cells.length < 2) continue

        const creditorName = cells[0] ?? ""
        if (!creditorName) continue

        const accountNumberMasked = cells[1] ?? ""
        const typeText = (cells[2] ?? "").toUpperCase()
        const balance = (cells[3] ?? "").replace(/[^0-9.]/g, "")
        const dateOpened = parseDateString(cells[4] ?? "")

        accounts.push({
          creditorName,
          accountNumberMasked,
          type: mapAccountType(typeText),
          onExperian: true,
          onEquifax: true,
          onTransunion: true,
          balance,
          dateOpened,
        })
      } catch {
        // skip
      }
    }
    if (accounts.length > 0) break
  }

  return accounts
}

async function isBureauReporting(el: import("playwright").ElementHandle): Promise<boolean> {
  // Check if the bureau section indicates the item is reporting there
  const text = (await el.textContent()) ?? ""
  const cls = (await el.getAttribute("class")) ?? ""
  // "N/A", "—", "not reporting" typically means not on that bureau
  if (/not reporting|n\/a|—|does not appear/i.test(text)) return false
  // If it has content (a status, amount, date) — it's reporting
  if (text.trim().length > 2 && !/^\s*$/.test(text)) return true
  // Class-based "active" / "reporting" indicators
  if (/reporting|active|open/i.test(cls)) return true
  return false
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

// ─── Generic report parser ────────────────────────────────────────────────────

interface BureauFlags {
  allThreeBureaus?: boolean
  onExperian?: boolean
  onEquifax?: boolean
  onTransunion?: boolean
}

async function parseGenericReport(
  page: Page,
  flags: BureauFlags
): Promise<ParsedAccount[]> {
  const accounts: ParsedAccount[] = []

  const onExperian = flags.allThreeBureaus ? true : (flags.onExperian ?? false)
  const onEquifax = flags.allThreeBureaus ? true : (flags.onEquifax ?? false)
  const onTransunion = flags.allThreeBureaus ? true : (flags.onTransunion ?? false)

  // Try multiple account selector strategies
  const accountContainers = await page.$$(
    [
      ".account-row",
      ".tradeline",
      "[class*='account-row']",
      "[class*='AccountRow']",
      "[class*='tradeline']",
      ".credit-account",
      "[data-account]",
    ].join(", ")
  )

  for (const container of accountContainers) {
    try {
      const nameEl = await container.$(
        ".creditor-name, .account-name, .company-name, [class*='creditor'], h3, h4, strong"
      )
      const creditorName = (await nameEl?.textContent())?.trim() ?? ""
      if (!creditorName || creditorName.length < 2) continue

      const acctEl = await container.$(
        ".account-number, [class*='account-number'], .acct-number"
      )
      const accountNumberMasked = (await acctEl?.textContent())?.trim() ?? ""

      const typeEl = await container.$(
        ".account-type, [class*='account-type'], .type"
      )
      const typeText = ((await typeEl?.textContent())?.trim() ?? "").toUpperCase()

      const balEl = await container.$(".balance, .amount, [class*='balance']")
      const balance = ((await balEl?.textContent())?.trim() ?? "").replace(/[^0-9.]/g, "")

      const dateEl = await container.$(
        ".date-opened, [class*='date-opened'], .open-date"
      )
      const dateOpened = parseDateString((await dateEl?.textContent())?.trim() ?? "")

      accounts.push({
        creditorName,
        accountNumberMasked,
        type: mapAccountType(typeText),
        onExperian,
        onEquifax,
        onTransunion,
        balance,
        dateOpened,
      })
    } catch {
      // skip malformed rows
    }
  }

  // Fallback: table rows
  if (accounts.length === 0) {
    const tables = await page.$$("table")
    for (const table of tables) {
      const trs = await table.$$("tbody tr")
      for (const tr of trs) {
        try {
          const cells = await tr.$$eval("td", els => els.map(el => el.textContent?.trim() ?? ""))
          if (cells.length < 2) continue
          const creditorName = cells[0] ?? ""
          if (!creditorName || creditorName.length < 2) continue

          accounts.push({
            creditorName,
            accountNumberMasked: cells[1] ?? "",
            type: mapAccountType((cells[2] ?? "").toUpperCase()),
            onExperian,
            onEquifax,
            onTransunion,
            balance: (cells[3] ?? "").replace(/[^0-9.]/g, ""),
            dateOpened: parseDateString(cells[4] ?? ""),
          })
        } catch {
          // skip
        }
      }
      if (accounts.length > 0) break
    }
  }

  return accounts
}

// ─── Score scraper ────────────────────────────────────────────────────────────

// Which bureaus a given monitoring service exposes scores for. Single-bureau
// services must not attribute a stray number to the other two bureaus.
const SCORE_COVERAGE: Record<BureauService, Array<keyof ParsedScores>> = {
  IDENTITY_IQ: ["experian", "equifax", "transunion"],
  MY_SCORE_360: ["experian", "equifax", "transunion"],
  ANNUAL_CREDIT_REPORT: ["experian", "equifax", "transunion"],
  EXPERIAN: ["experian"],
  EQUIFAX: ["equifax"],
  TRANSUNION: ["transunion"],
}

async function parseScores(page: Page, service: BureauService): Promise<ParsedScores> {
  const wanted = SCORE_COVERAGE[service] ?? []
  if (wanted.length === 0) return { ...EMPTY_SCORES }

  // Run entirely in the page context — no TS types available inside evaluate().
  const found = await page.evaluate(() => {
    const aliases: Record<string, string[]> = {
      experian: ["experian"],
      equifax: ["equifax"],
      transunion: ["transunion", "trans union"],
    }
    const inRange = (n: number) => Number.isFinite(n) && n >= 300 && n <= 850
    const firstScore = (text: string): number | null => {
      const matches = (text.match(/\b\d{3}\b/g) ?? []).map(Number).filter(inRange)
      return matches.length > 0 ? matches[0] : null
    }
    const attrHay = (el: Element): string =>
      `${el.getAttribute("class") ?? ""} ${el.id} ${el.getAttribute("data-bureau") ?? ""}`.toLowerCase()
    const bureauOf = (hay: string): string | null => {
      for (const bureau of Object.keys(aliases)) {
        if (aliases[bureau].some(a => hay.includes(a))) return bureau
      }
      return null
    }

    const result: Record<string, number | null> = {
      experian: null,
      equifax: null,
      transunion: null,
    }

    // Strategy 1: elements that explicitly look like a score, attributed to a
    // bureau by walking up a few ancestors.
    const scoreEls = Array.from(
      document.querySelectorAll('[class*="score" i], [id*="score" i], [data-score]')
    )
    for (const el of scoreEls) {
      const score = firstScore(el.textContent ?? "")
      if (score == null) continue
      let node: Element | null = el
      for (let depth = 0; node && depth < 5; depth++) {
        const bureau = bureauOf(attrHay(node))
        if (bureau && result[bureau] == null) {
          result[bureau] = score
          break
        }
        node = node.parentElement
      }
    }

    // Strategy 2: for any bureau still missing, scan a container whose own
    // attributes name that bureau and take its first in-range number.
    for (const bureau of Object.keys(aliases)) {
      if (result[bureau] != null) continue
      const selector = aliases[bureau]
        .map(a => a.replace(/\s+/g, ""))
        .flatMap(slug => [`[class*="${slug}" i]`, `[id*="${slug}" i]`, `[data-bureau*="${slug}" i]`])
        .join(", ")
      let containers: Element[] = []
      try {
        containers = Array.from(document.querySelectorAll(selector))
      } catch {
        containers = []
      }
      for (const el of containers) {
        const score = firstScore(el.textContent ?? "")
        if (score != null) {
          result[bureau] = score
          break
        }
      }
    }

    return result
  })

  // Only surface scores for bureaus this service actually covers.
  return {
    experian: wanted.includes("experian") ? found.experian : null,
    equifax: wanted.includes("equifax") ? found.equifax : null,
    transunion: wanted.includes("transunion") ? found.transunion : null,
  }
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapAccountType(raw: string): string {
  if (/collection/i.test(raw)) return "COLLECTION"
  if (/charge.?off|chargeoff/i.test(raw)) return "CHARGE_OFF"
  if (/late|30 day|60 day|90 day/i.test(raw)) return "LATE_PAYMENT"
  if (/inquiry/i.test(raw)) return "INQUIRY"
  if (/repossess/i.test(raw)) return "REPOSSESSION"
  if (/bankrupt/i.test(raw)) return "BANKRUPTCY"
  if (/judgment/i.test(raw)) return "JUDGMENT"
  if (/tax.?lien|lien/i.test(raw)) return "TAX_LIEN"
  if (/personal|name|address|employment|ssn/i.test(raw)) return "PERSONAL_INFO"
  return "OTHER"
}

function parseDateString(raw: string): string {
  if (!raw) return ""
  // Try common date formats: MM/YYYY, MM/DD/YYYY, Month YYYY, etc.
  const monthYear = raw.match(/(\w+)\s+(\d{4})/)
  if (monthYear) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
      jan: "01", feb: "02", mar: "03", apr: "04",
      jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    }
    const month = months[monthYear[1].toLowerCase()]
    const year = monthYear[2]
    if (month && year) return `${year}-${month}-01`
  }
  // Try MM/DD/YYYY or MM/YYYY
  const slashDate = raw.match(/(\d{1,2})\/(\d{1,2}|\d{4})(?:\/(\d{4}))?/)
  if (slashDate) {
    const [, m, d, y] = slashDate
    if (y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    if (d.length === 4) return `${d}-${m.padStart(2, "0")}-01`
  }
  // Try ISO-ish
  const isoDate = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`
  return ""
}
