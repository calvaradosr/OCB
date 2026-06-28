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

import type { Page } from "playwright"
import type { BureauService } from "@prisma/client"
import { mapAccountType, parseBalance, parseDateString } from "@/lib/bureau-parse"
import { parseIdentityIQ } from "@/lib/bureau-iiq"

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

// IdentityIQ uses the same column-positional model as the CreditRepairCloud
// export, so the parser lives in @/lib/bureau-iiq (extract + pure normalize,
// unit-tested there). This thin wrapper keeps the historical call site stable.
export async function parseIdentityIQReport(page: Page): Promise<ParsedAccount[]> {
  const { accounts } = await parseIdentityIQ(page)
  return accounts
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

  // IdentityIQ keeps scores in a column-positional table (#CreditScore) keyed by
  // headerTUC/EXP/EQF, which the attribute heuristic below can't see — read them
  // positionally from the same extractor the account parser uses.
  if (service === "IDENTITY_IQ") {
    const { scores } = await parseIdentityIQ(page)
    return scores
  }

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
