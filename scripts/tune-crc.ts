/**
 * Offline harness for the CreditRepairCloud report parser (@/lib/bureau-crc).
 *
 * Loads a saved CRC report HTML into headless Chromium via setContent() — no
 * login — and prints the parsed accounts + scores, so the parser can be tuned
 * against real reports offline.
 *
 *   npx tsx scripts/tune-crc.ts <file.html>
 *
 * GLBA: report HTML contains client PII. Keep fixtures in debug-artifacts/
 * (gitignored) and purge when done.
 */
import { readFileSync } from "fs"
import path from "path"
import { chromium } from "playwright"
import { parseCreditRepairCloudReport } from "@/lib/bureau-crc"

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("Usage: npx tsx scripts/tune-crc.ts <file.html>")
    process.exit(1)
  }
  const html = readFileSync(path.resolve(file), "utf8")
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    // Harness-only __name shim for tsx/esbuild keepNames inside page.evaluate
    // (Next's build doesn't need it). Inline <script> because addInitScript does
    // not fire on a setContent document.
    const shim = "<script>window.__name=window.__name||function(f){return f}</script>"
    await page.setContent(shim + html, { waitUntil: "load" })

    const { accounts, scores } = await parseCreditRepairCloudReport(page)
    console.log(`\n── ${path.basename(file)} ──`)
    console.log(`scores: ${JSON.stringify(scores)}`)
    console.log(`accounts: ${accounts.length}\n`)
    for (const [i, a] of accounts.entries()) {
      const on = [a.onTransunion && "TU", a.onExperian && "EXP", a.onEquifax && "EQF"].filter(Boolean).join("/")
      console.log(
        `  ${String(i + 1).padStart(2)}. ${a.creditorName}  [${a.type}]` +
          `  bal=${a.balance || "—"}  opened=${a.dateOpened || "—"}` +
          `  acct=${a.accountNumberMasked || "—"}  on=${on || "none"}`
      )
    }
    console.log("")
    if (accounts.length === 0) {
      console.warn("⚠  No accounts parsed — this may not be a CreditRepairCloud-format report.")
    }
  } finally {
    await browser.close()
  }
}
main().catch(err => { console.error(err); process.exit(1) })
