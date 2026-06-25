/**
 * Pure, side-effect-free parsing helpers shared by the bureau scraper
 * (src/app/api/bureau/fetch/route.ts).
 *
 * These are deliberately kept free of Playwright / DOM dependencies so they can
 * be unit-tested against captured strings and HTML fixtures. When tuning the
 * scraper against a real bureau DOM, normalize the raw text here and add a
 * regression test in __tests__/bureau-parse.test.ts rather than editing the
 * route by hand.
 */

import type { ItemTypeValue } from "@/lib/report-utils"

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09", sept: "09",
  oct: "10", nov: "11", dec: "12",
}

/**
 * Map a bureau's free-text account/status description to one of our ItemType
 * enum values. Order matters: more specific patterns are checked first.
 */
export function mapAccountType(raw: string): ItemTypeValue {
  if (/collection/i.test(raw)) return "COLLECTION"
  if (/charge.?off|chargeoff/i.test(raw)) return "CHARGE_OFF"
  if (/repossess/i.test(raw)) return "REPOSSESSION"
  if (/bankrupt/i.test(raw)) return "BANKRUPTCY"
  if (/judg(?:e)?ment/i.test(raw)) return "JUDGMENT"
  if (/tax.?lien|\blien\b/i.test(raw)) return "TAX_LIEN"
  if (/late|past due|\d+\s*day/i.test(raw)) return "LATE_PAYMENT"
  if (/inquiry|inquiries/i.test(raw)) return "INQUIRY"
  if (/personal|\bname\b|address|employment|ssn/i.test(raw)) return "PERSONAL_INFO"
  return "OTHER"
}

/**
 * Strip currency formatting from a balance string, leaving digits and a decimal
 * point. Returns "" when there is no numeric content.
 */
export function parseBalance(raw: string): string {
  return (raw ?? "").replace(/[^0-9.]/g, "")
}

/**
 * Normalize a bureau date string to ISO `YYYY-MM-DD`. Handles month-name+year,
 * MM/DD/YYYY, MM/DD/YY, MM/YYYY, and ISO inputs. Returns "" when unparseable.
 */
export function parseDateString(raw: string): string {
  if (!raw) return ""
  const s = raw.trim()

  // "January 2022" / "Jan 2022"
  const monthYear = s.match(/([A-Za-z]+)\s+(\d{4})/)
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()]
    if (month) return `${monthYear[2]}-${month}-01`
  }

  // MM/DD/YYYY or MM/DD/YY
  const full = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (full) {
    const [, m, d, y] = full
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // MM/YYYY
  const monthSlashYear = s.match(/(\d{1,2})\/(\d{4})/)
  if (monthSlashYear) {
    const [, m, y] = monthSlashYear
    return `${y}-${m.padStart(2, "0")}-01`
  }

  // ISO
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  return ""
}

/**
 * Extract the first plausible FICO/Vantage score (a 3-digit number in 300–850)
 * from a blob of text. Returns null when none is present.
 *
 * NOTE: parseScores() in the scraper runs an equivalent of this inside
 * page.evaluate() (it cannot import this module across the browser boundary).
 * Keep the two in sync — this copy is the tested source of truth.
 */
export function extractScore(text: string): number | null {
  const matches = (text.match(/\b\d{3}\b/g) ?? [])
    .map(Number)
    .filter(n => Number.isFinite(n) && n >= 300 && n <= 850)
  return matches.length > 0 ? matches[0] : null
}
