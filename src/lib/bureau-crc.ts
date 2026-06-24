/**
 * Parser for CreditRepairCloud-generated credit reports (the HTML export from
 * app.creditrepaircloud.com).
 *
 * Unlike the live monitoring-site scrapers in @/lib/bureau-scrape (which fight
 * changing markup with heuristic selectors), CRC reports have a fixed layout:
 * each tradeline is a table whose first row is
 * `<th colspan><strong>CREDITOR</strong>`, followed by a header row of bureau
 * logos (`<img alt>`) that defines the left→right column order, then one
 * `<th>Label</th>` + a `<td>` per bureau for each attribute. "--" in a column
 * means the account is not reporting on that bureau. Scores live in a sibling
 * table whose row label contains "Score".
 *
 * DOM extraction (extractCrcReport) and normalization (normalizeCrcExtract) are
 * split so the normalization can be unit-tested without a browser.
 */

import type { Page } from "playwright"
import { mapAccountType, parseBalance, parseDateString } from "@/lib/bureau-parse"
import { type ParsedAccount, type ParsedScores, EMPTY_SCORES } from "@/lib/bureau-scrape"

export interface CrcRawAccount {
  creditorName: string
  /** Column order from the bureau-logo header, e.g. ["transunion","experian","equifax"]. */
  bureaus: string[]
  /** Row label → per-column raw cell text. */
  fields: Record<string, string[]>
}

export interface CrcRawExtract {
  accounts: CrcRawAccount[]
  score: { bureaus: string[]; values: string[] } | null
}

/**
 * Pull raw strings out of the CRC report DOM. Normalization is left to
 * normalizeCrcExtract so it can be unit-tested without a browser.
 */
export async function extractCrcReport(page: Page): Promise<CrcRawExtract> {
  return page.evaluate(() => {
    const norm = (s: string | null) => (s || "").replace(/\s+/g, " ").trim()
    const bureauFromAlt = (alt: string | null) => {
      const a = (alt || "").toLowerCase()
      if (a.includes("trans")) return "transunion"
      if (a.includes("experian")) return "experian"
      if (a.includes("equifax")) return "equifax"
      return ""
    }
    const colOrder = (table: Element): string[] => {
      for (const r of Array.from(table.querySelectorAll("tr"))) {
        const b = Array.from(r.querySelectorAll("img[alt]"))
          .map(i => bureauFromAlt(i.getAttribute("alt")))
          .filter(Boolean) as string[]
        if (b.length >= 2) return b
      }
      return []
    }

    const accounts: Array<{ creditorName: string; bureaus: string[]; fields: Record<string, string[]> }> = []
    let score: { bureaus: string[]; values: string[] } | null = null

    for (const table of Array.from(document.querySelectorAll("table"))) {
      const trs = Array.from(table.querySelectorAll("tr"))
      if (!trs.length) continue
      const bureaus = colOrder(table)
      if (bureaus.length < 2) continue

      const fields: Record<string, string[]> = {}
      for (const r of trs) {
        const th = r.querySelector(":scope > th")
        const tds = Array.from(r.querySelectorAll(":scope > td"))
        if (!th || !tds.length) continue
        fields[norm(th.textContent)] = tds.map(td => norm(td.textContent))
      }

      const nameStrong = trs[0]?.querySelector("th[colspan] strong")
      const creditorName = nameStrong ? norm(nameStrong.textContent) : ""
      if (creditorName) {
        accounts.push({ creditorName, bureaus, fields })
        continue
      }
      const scoreKey = Object.keys(fields).find(k => /score/i.test(k))
      if (scoreKey && !score) score = { bureaus, values: fields[scoreKey] }
    }
    return { accounts, score }
  })
}

const CRC_BUREAU_KEYS: Array<keyof ParsedScores> = ["transunion", "experian", "equifax"]

/**
 * Turn a raw CRC extract into ParsedAccount[] + ParsedScores. Pure and
 * browser-free so it can be unit-tested against fixtures.
 */
export function normalizeCrcExtract(raw: CrcRawExtract): {
  accounts: ParsedAccount[]
  scores: ParsedScores
} {
  const firstReal = (vals: string[]): string => vals.find(v => v && v !== "--") ?? ""

  const accounts: ParsedAccount[] = raw.accounts.map(a => {
    const get = (label: string): string[] => a.fields[label] ?? []
    const reporting = (bureau: keyof ParsedScores): boolean => {
      const i = a.bureaus.indexOf(bureau)
      if (i < 0) return false
      // Reporting on this bureau if any identifying cell in its column isn't "--".
      return ["Account #", "Balance Owed", "Account Status", "Date Opened"].some(l => {
        const v = get(l)[i]
        return !!v && v !== "--"
      })
    }

    // Classify from account-status fields only. "Creditor Type" is the lender's
    // industry (e.g. "Personal Loan Companies") and false-matches PERSONAL_INFO,
    // so it is deliberately excluded.
    const typeText = [
      firstReal(get("Payment Status")),
      firstReal(get("Account Status")),
      firstReal(get("Account Rating")),
      firstReal(get("Past Due Amount")),
    ].join(" ")

    return {
      creditorName: a.creditorName,
      accountNumberMasked: firstReal(get("Account #")),
      type: mapAccountType(typeText),
      onTransunion: reporting("transunion"),
      onExperian: reporting("experian"),
      onEquifax: reporting("equifax"),
      balance: parseBalance(firstReal(get("Balance Owed"))),
      dateOpened: parseDateString(firstReal(get("Date Opened"))),
    }
  })

  const scores: ParsedScores = { ...EMPTY_SCORES }
  if (raw.score) {
    raw.score.bureaus.forEach((b, i) => {
      const key = b as keyof ParsedScores
      if (!CRC_BUREAU_KEYS.includes(key)) return
      const n = parseInt((raw.score!.values[i] || "").replace(/[^0-9]/g, ""), 10)
      if (Number.isFinite(n) && n >= 300 && n <= 850) scores[key] = n
    })
  }

  return { accounts, scores }
}

/** Convenience wrapper: extract + normalize a loaded CRC report page. */
export async function parseCreditRepairCloudReport(
  page: Page
): Promise<{ accounts: ParsedAccount[]; scores: ParsedScores }> {
  return normalizeCrcExtract(await extractCrcReport(page))
}
