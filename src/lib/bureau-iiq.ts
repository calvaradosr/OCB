/**
 * Parser for IdentityIQ 3-bureau credit reports (the AngularJS member portal at
 * member.identityiq.com, saved AFTER render so the data lives in real DOM text).
 *
 * IdentityIQ uses the SAME column-positional model as the CreditRepairCloud
 * export (see @/lib/bureau-crc), not the per-account-row model the old heuristic
 * scraper assumed. Each tradeline is:
 *
 *   <div class="sub_header">CREDITOR NAME</div>
 *   <table class="... rpt_table4column">
 *     <tr><th></th><th class="headerTUC">TransUnion</th>
 *                  <th class="headerEXP">Experian</th>
 *                  <th class="headerEQF">Equifax</th></tr>
 *     <tr><td class="label">Account #:</td>
 *         <td class="info">…TU…</td><td class="info">…EXP…</td><td class="info">…EQF…</td></tr>
 *     … one row per attribute …
 *   </table>
 *
 * The header `th` classes (headerTUC/headerEXP/headerEQF) define the left→right
 * column order; a lone "-" in a column means the account is not reporting on
 * that bureau. Credit scores live in the same shape inside `#CreditScore`, in a
 * row labelled "Credit Score:".
 *
 * DOM extraction (extractIdentityIQReport) and normalization
 * (normalizeIdentityIQExtract) are split so the normalization can be unit-tested
 * against fixtures without a browser — mirroring bureau-crc.ts.
 */

import type { Page } from "playwright"
import { mapAccountType, parseBalance, parseDateString } from "@/lib/bureau-parse"
import { type ParsedAccount, type ParsedScores, EMPTY_SCORES } from "@/lib/bureau-scrape"

export interface IiqRawAccount {
  creditorName: string
  /** Column order from the header row, e.g. ["transunion","experian","equifax"]. */
  bureaus: string[]
  /** Row label (sans trailing colon) → per-column raw cell text. */
  fields: Record<string, string[]>
}

export interface IiqRawExtract {
  accounts: IiqRawAccount[]
  score: { bureaus: string[]; values: string[] } | null
}

/**
 * Pull raw strings out of the IdentityIQ report DOM. Normalization is left to
 * normalizeIdentityIQExtract so it can be unit-tested without a browser.
 */
export async function extractIdentityIQReport(page: Page): Promise<IiqRawExtract> {
  return page.evaluate(() => {
    const norm = (s: string | null) => (s || "").replace(/\s+/g, " ").trim()
    const bureauFromHeaderClass = (cls: string | null) => {
      const c = (cls || "").toLowerCase()
      if (c.includes("headertuc")) return "transunion"
      if (c.includes("headerexp")) return "experian"
      if (c.includes("headereqf")) return "equifax"
      return ""
    }
    const colOrder = (table: Element): string[] => {
      for (const r of Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"))) {
        const b = Array.from(r.querySelectorAll(":scope > th"))
          .map(th => bureauFromHeaderClass(th.getAttribute("class")))
          .filter(Boolean) as string[]
        if (b.length >= 2) return b
      }
      return []
    }
    // The creditor name sits in a `.sub_header` div just before the table.
    const creditorBefore = (table: Element): string => {
      let node: Element | null = table.previousElementSibling
      for (let i = 0; node && i < 4; i++) {
        if (node.classList.contains("sub_header")) return norm(node.textContent)
        node = node.previousElementSibling
      }
      return ""
    }

    const accounts: Array<{ creditorName: string; bureaus: string[]; fields: Record<string, string[]> }> = []
    let score: { bureaus: string[]; values: string[] } | null = null

    for (const table of Array.from(document.querySelectorAll("table"))) {
      const bureaus = colOrder(table)
      if (bureaus.length < 2) continue

      const fields: Record<string, string[]> = {}
      for (const r of Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"))) {
        const labelCell = r.querySelector(":scope > td.label")
        if (!labelCell) continue
        const label = norm(labelCell.textContent).replace(/:$/, "")
        const infos = Array.from(r.querySelectorAll(":scope > td.info")).map(td => norm(td.textContent))
        if (label) fields[label] = infos
      }

      const creditorName = creditorBefore(table)
      if (creditorName) {
        accounts.push({ creditorName, bureaus, fields })
        continue
      }
      // No creditor → the only other column-positional table is the score table.
      const scoreKey = Object.keys(fields).find(k => /credit score/i.test(k))
      if (scoreKey && !score) score = { bureaus, values: fields[scoreKey] }
    }
    return { accounts, score }
  })
}

const IIQ_BUREAU_KEYS: Array<keyof ParsedScores> = ["transunion", "experian", "equifax"]

const notReporting = (v: string | undefined): boolean => !v || v === "-" || v === "--"

/**
 * Turn a raw IdentityIQ extract into ParsedAccount[] + ParsedScores. Pure and
 * browser-free so it can be unit-tested against fixtures.
 */
export function normalizeIdentityIQExtract(raw: IiqRawExtract): {
  accounts: ParsedAccount[]
  scores: ParsedScores
} {
  const firstReal = (vals: string[]): string => vals.find(v => !notReporting(v)) ?? ""

  const accounts: ParsedAccount[] = raw.accounts.map(a => {
    const get = (label: string): string[] => a.fields[label] ?? []
    const reporting = (bureau: keyof ParsedScores): boolean => {
      const i = a.bureaus.indexOf(bureau)
      if (i < 0) return false
      // Reporting if any identifying cell in this bureau's column has real data.
      return ["Account #", "Balance", "Account Status", "Date Opened"].some(
        l => !notReporting(get(l)[i])
      )
    }

    // Classify from status fields only. "Account Type"/"Account Type - Detail"
    // carry the lender's product name (e.g. "Personal Loan") which would
    // false-match PERSONAL_INFO — mirror bureau-crc and exclude them.
    const typeText = [
      firstReal(get("Payment Status")),
      firstReal(get("Account Status")),
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
export async function parseIdentityIQ(
  page: Page
): Promise<{ accounts: ParsedAccount[]; scores: ParsedScores }> {
  return normalizeIdentityIQExtract(await extractIdentityIQReport(page))
}
