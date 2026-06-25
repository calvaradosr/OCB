/**
 * DOM parsers for the bureau scraper.
 *
 * These read an already-loaded Playwright Page and turn the rendered credit
 * report into structured accounts + per-bureau scores. They are deliberately
 * separated from the login/navigation code in
 * src/app/api/bureau/fetch/route.ts so they can be run against a *static* page
 * (`page.setContent(html)`) with no live login — see scripts/tune-bureau.ts.
 *
 * That makes selector tuning a tight loop: capture a real bureau report's HTML
 * once (BUREAU_DEBUG_CAPTURE=1), then iterate on the selectors here and re-run
 * the harness offline until the parsed output is correct.
 *
 * The pure text-normalization helpers (mapAccountType, parseBalance,
 * parseDateString) live in @/lib/bureau-parse and are unit-tested there.
 */

import type { Page, ElementHandle } from "playwright"
import type { BureauService } from "@prisma/client"
import { mapAccountType, parseBalance, parseDateString } from "@/lib/bureau-parse"

export interface ParsedAccount {
  creditorName: string
  accountNumberMasked: string
  type: string
  onExperian: boolean
  onEquifax: boolean
  onTransunion: boolean
  balance: string
  dateOpened: string
}

export interface ParsedScores {
  experian: number | null
  equifax: number | null
  transunion: number | null
}

export const EMPTY_SCORES: ParsedScores = { experian: null, equifax: null, transunion: null }

// ─── IdentityIQ report parser ────────────────────────────────────────────────

export async function parseIdentityIQReport(page: Page): Promise<ParsedAccount[]> {
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
      const balance = parseBalance((await balEl?.textContent())?.trim() ?? "")

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

      // When per-bureau elements exist, trust their "is reporting" signal.
      // Otherwise default to present on all three: this is IdentityIQ's
      // 3-bureau report, so an account with no per-bureau breakdown should
      // appear under every bureau (not be silently dropped from all of them).
      const onExperian = expEl ? await isBureauReporting(expEl) : true
      const onEquifax = eqEl ? await isBureauReporting(eqEl) : true
      const onTransunion = tuEl ? await isBureauReporting(tuEl) : true

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
        const balance = parseBalance(cells[3] ?? "")
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

async function isBureauReporting(el: ElementHandle): Promise<boolean> {
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

// ─── Generic report parser ────────────────────────────────────────────────────

export interface BureauFlags {
  allThreeBureaus?: boolean
  onExperian?: boolean
  onEquifax?: boolean
  onTransunion?: boolean
}

export async function parseGenericReport(
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
      const balance = parseBalance((await balEl?.textContent())?.trim() ?? "")

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
            balance: parseBalance(cells[3] ?? ""),
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

export async function parseScores(page: Page, service: BureauService): Promise<ParsedScores> {
  const wanted = SCORE_COVERAGE[service] ?? []
  if (wanted.length === 0) return { ...EMPTY_SCORES }

  // Run entirely in the page context — no TS types available inside evaluate().
  // The 3-digit-in-range matching mirrors extractScore() in @/lib/bureau-parse
  // (which cannot be imported across the browser boundary); keep them in sync.
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
