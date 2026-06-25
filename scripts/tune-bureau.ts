/**
 * Offline bureau-scraper tuning harness.
 *
 * Loads a *saved* bureau report HTML file into a headless Chromium via
 * page.setContent() — no login, no live site, no credentials — and runs the
 * real parsers from @/lib/bureau-scrape against it, printing what was extracted.
 *
 * This makes selector tuning a tight offline loop:
 *   1. Capture a real report once (set BUREAU_DEBUG_CAPTURE=1 on a controlled
 *      run; the HTML lands in debug-artifacts/bureau/).
 *   2. Run this harness against that file.
 *   3. Edit selectors in src/lib/bureau-scrape.ts and re-run until the parsed
 *      accounts + scores are correct.
 *
 * GLBA: captured report HTML contains client PII. Keep fixtures out of git
 * (debug-artifacts/ should be gitignored) and purge them when done.
 *
 * Usage:
 *   npx tsx scripts/tune-bureau.ts <file.html> [--service=IDENTITY_IQ] [--parser=auto]
 *
 *   --service  IDENTITY_IQ | MY_SCORE_360 | EXPERIAN | EQUIFAX | TRANSUNION |
 *              ANNUAL_CREDIT_REPORT   (default: IDENTITY_IQ) — drives score
 *              coverage and the generic parser's bureau flags.
 *   --parser   auto | iiq | generic   (default: auto — iiq for IDENTITY_IQ,
 *              generic otherwise)
 */

import { promises as fs } from "fs"
import path from "path"
import { chromium } from "playwright"
import type { BureauService } from "@prisma/client"
import {
  parseIdentityIQReport,
  parseGenericReport,
  parseScores,
  type BureauFlags,
} from "@/lib/bureau-scrape"

function arg(name: string, fallback: string): string {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

function flagsForService(service: BureauService): BureauFlags {
  switch (service) {
    case "EXPERIAN":
      return { onExperian: true, onEquifax: false, onTransunion: false }
    case "EQUIFAX":
      return { onExperian: false, onEquifax: true, onTransunion: false }
    case "TRANSUNION":
      return { onExperian: false, onEquifax: false, onTransunion: true }
    default:
      return { allThreeBureaus: true }
  }
}

async function main() {
  const file = process.argv[2]
  if (!file || file.startsWith("--")) {
    console.error("Usage: npx tsx scripts/tune-bureau.ts <file.html> [--service=IDENTITY_IQ] [--parser=auto]")
    process.exit(1)
  }

  const service = arg("service", "IDENTITY_IQ") as BureauService
  const parserMode = arg("parser", "auto")
  const useIIQ = parserMode === "iiq" || (parserMode === "auto" && service === "IDENTITY_IQ")

  const abs = path.resolve(file)
  const html = await fs.readFile(abs, "utf8")

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    // tsx transpiles the parsers with esbuild's keepNames, which injects a
    // __name() helper into the functions handed to page.evaluate(). That helper
    // doesn't exist in the browser context, so shim it as a no-op via an inline
    // <script> (setContent runs page scripts; addInitScript does not fire on a
    // setContent document). Next.js's build doesn't keepNames, so the production
    // route needs no such shim.
    const shim = "<script>window.__name=window.__name||function(f){return f}</script>"
    // Render the saved markup exactly as captured. waitUntil:"load" lets inline
    // <script>-driven hydration that doesn't need the network settle.
    await page.setContent(shim + html, { waitUntil: "load" })

    const accounts = useIIQ
      ? await parseIdentityIQReport(page)
      : await parseGenericReport(page, flagsForService(service))
    const scores = await parseScores(page, service)

    console.log(`\n── ${path.basename(abs)} ──`)
    console.log(`service=${service}  parser=${useIIQ ? "identityIQ" : "generic"}`)
    console.log(`\nscores: ${JSON.stringify(scores)}`)
    console.log(`accounts: ${accounts.length}\n`)
    for (const [i, a] of accounts.entries()) {
      const bureaus = [a.onExperian && "EXP", a.onEquifax && "EQF", a.onTransunion && "TU"]
        .filter(Boolean)
        .join("/")
      console.log(
        `  ${String(i + 1).padStart(2)}. ${a.creditorName}` +
          `  [${a.type}]  bal=${a.balance || "—"}  opened=${a.dateOpened || "—"}` +
          `  acct=${a.accountNumberMasked || "—"}  on=${bureaus || "none"}`
      )
    }
    console.log("")

    if (accounts.length === 0) {
      console.warn(
        "⚠  No accounts parsed. The selectors in src/lib/bureau-scrape.ts likely\n" +
          "   don't match this DOM — open the HTML, find the real account container\n" +
          "   class/structure, update the selector lists, and re-run."
      )
    }
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
