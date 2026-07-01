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
// Type-only import (erased at build) — reuses the CreditRepairCloud raw-extract
// shape, which the IdentityIQ report shares. No runtime cycle with bureau-crc.
import type { CrcRawExtract } from "@/lib/bureau-crc"

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

/**
 * IdentityIQ renders a saved 3-bureau report in the same column-positional
 * layout as the CreditRepairCloud export (see @/lib/bureau-crc): each account is
 * a `<div class="sub_header">CREDITOR</div>` immediately followed by a
 * `rpt_table4column` table whose header row carries
 * `<th class="headerTUC|headerEXP|headerEQF">` (TransUnion → Experian → Equifax),
 * then `<td class="label">Field:</td>` + one `<td class="info">` per bureau. A
 * missing value in a bureau column renders as "--" (occasionally a lone "-").
 * Credit scores use the same table shape under `#CreditScore` ("Credit Score:").
 *
 * DOM extraction (extractIdentityIQReport) and normalization
 * (normalizeIdentityIQExtract) are split — as with the CRC parser — so the
 * normalization can be unit-tested without a browser. Both reuse CrcRawExtract.
 */
export async function extractIdentityIQReport(page: Page): Promise<CrcRawExtract> {
  return page.evaluate(() => {
    const norm = (s: string | null) => (s || "").replace(/\s+/g, " ").trim()
    const stripColon = (s: string) => s.replace(/:\s*$/, "")
    const bureauFromHeaderClass = (cls: string): string => {
      if (/headerTUC/.test(cls)) return "transunion"
      if (/headerEXP/.test(cls)) return "experian"
      if (/headerEQF/.test(cls)) return "equifax"
      return ""
    }
    // Column → bureau order, read from the header row's th[class^="header"] cells.
    const colOrder = (table: Element): string[] => {
      for (const r of Array.from(table.querySelectorAll("tr"))) {
        const b = Array.from(r.querySelectorAll("th[class*='header']"))
          .map(th => bureauFromHeaderClass(th.getAttribute("class") || ""))
          .filter(Boolean) as string[]
        if (b.length >= 2) return b
      }
      return []
    }
    // Row label (colon stripped) → per-column info-cell text, in column order.
    const readFields = (table: Element): Record<string, string[]> => {
      const fields: Record<string, string[]> = {}
      for (const r of Array.from(table.querySelectorAll("tr"))) {
        const label = r.querySelector(":scope > td.label")
        if (!label) continue
        const infos = Array.from(r.querySelectorAll(":scope > td.info"))
        if (!infos.length) continue
        fields[stripColon(norm(label.textContent))] = infos.map(td => norm(td.textContent))
      }
      return fields
    }
    // The account's data table is the sub_header's next table sibling that
    // actually carries a bureau header (skips any intervening non-data table).
    const dataTableAfter = (sh: Element): Element | null => {
      let el: Element | null = sh.nextElementSibling
      while (el) {
        if (el.classList?.contains("sub_header")) break // next account, no table
        if (el.tagName === "TABLE" && colOrder(el).length >= 2) return el
        el = el.nextElementSibling
      }
      return null
    }

    const accounts: Array<{ creditorName: string; bureaus: string[]; fields: Record<string, string[]> }> = []
    for (const sh of Array.from(document.querySelectorAll("div.sub_header"))) {
      const creditorName = norm(sh.textContent)
      if (!creditorName) continue
      const table = dataTableAfter(sh)
      if (!table) continue
      accounts.push({ creditorName, bureaus: colOrder(table), fields: readFields(table) })
    }

    // Scores: the "Credit Score:" row inside the #CreditScore section.
    let score: { bureaus: string[]; values: string[] } | null = null
    const scoreDiv = document.querySelector("#CreditScore")
    if (scoreDiv) {
      for (const table of Array.from(scoreDiv.querySelectorAll("table"))) {
        const bureaus = colOrder(table)
        if (bureaus.length < 2) continue
        const fields = readFields(table)
        const key = Object.keys(fields).find(k => /credit score/i.test(k))
        if (key) {
          score = { bureaus, values: fields[key] }
          break
        }
      }
    }

    return { accounts, score }
  })
}

const IIQ_BUREAU_KEYS: Array<keyof ParsedScores> = ["transunion", "experian", "equifax"]

/**
 * Turn a raw IdentityIQ extract into ParsedAccount[] + ParsedScores. Pure and
 * browser-free so it can be unit-tested against fixtures. Mirrors
 * normalizeCrcExtract but with IdentityIQ's field labels ("Balance", "Past Due",
 * "Account Type - Detail").
 */
export function normalizeIdentityIQExtract(raw: CrcRawExtract): {
  accounts: ParsedAccount[]
  scores: ParsedScores
} {
  const isReal = (v: string) => !!v && v !== "--" && v !== "-"
  const firstReal = (vals: string[]): string => vals.find(isReal) ?? ""

  const accounts: ParsedAccount[] = raw.accounts.map(a => {
    const get = (label: string): string[] => a.fields[label] ?? []
    const reporting = (bureau: keyof ParsedScores): boolean => {
      const i = a.bureaus.indexOf(bureau)
      if (i < 0) return false
      // Reporting on this bureau if any identifying cell in its column is real.
      return ["Account #", "Balance", "Account Status", "Date Opened"].some(l => isReal(get(l)[i] ?? ""))
    }

    // Classify from account-status fields only (mapAccountType returns a dispute
    // *category* — collection/chargeoff/late/…, not a product type). The type
    // fields are deliberately excluded: "Account Type" ("Mortgage") and
    // "Account Type - Detail" ("Unsecured personal loan") carry no derogatory
    // signal and would false-match PERSONAL_INFO — same guard as the CRC parser.
    const typeText = [
      firstReal(get("Payment Status")),
      firstReal(get("Account Status")),
      firstReal(get("Past Due")),
    ].join(" ")

    return {
      creditorName: a.creditorName,
      accountNumberMasked: firstReal(get("Account #")),
      type: mapAccountType(typeText),
      onTransunion: reporting("transunion"),
      onExperian: reporting("experian"),
      onEquifax: reporting("equifax"),
      balance: parseBalance(firstReal(get("Balance"))),
      dateOpened: parseDateString(firstReal(get("Date Opened"))),
    }
  })

  const scores: ParsedScores = { ...EMPTY_SCORES }
  if (raw.score) {
    raw.score.bureaus.forEach((b, i) => {
      const key = b as keyof ParsedScores
      if (!IIQ_BUREAU_KEYS.includes(key)) return
      const n = parseInt((raw.score!.values[i] || "").replace(/[^0-9]/g, ""), 10)
      if (Number.isFinite(n) && n >= 300 && n <= 850) scores[key] = n
    })
  }

  return { accounts, scores }
}

/** Convenience wrapper: extract + normalize a loaded IdentityIQ report page. */
export async function parseIdentityIQReport(page: Page): Promise<ParsedAccount[]> {
  return normalizeIdentityIQExtract(await extractIdentityIQReport(page)).accounts
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

  // IdentityIQ scores live in a column-positional table (#CreditScore) with no
  // score-named classes, so the generic strategies below miss them. Read them
  // from the same positional extract the account parser uses.
  if (service === "IDENTITY_IQ") {
    return normalizeIdentityIQExtract(await extractIdentityIQReport(page)).scores
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
