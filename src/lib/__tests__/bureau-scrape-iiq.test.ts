import { describe, it, expect } from "vitest"
import { normalizeIdentityIQExtract } from "../bureau-scrape"
import type { CrcRawExtract } from "../bureau-crc"

// IdentityIQ renders columns in TransUnion → Experian → Equifax order.
const TU_EXP_EQ = ["transunion", "experian", "equifax"]

describe("normalizeIdentityIQExtract", () => {
  const raw: CrcRawExtract = {
    accounts: [
      {
        // Open mortgage reporting on all three bureaus. "Account Type" (the bare
        // industry bucket, "Mortgage") must NOT be what drives classification.
        creditorName: "CENTRAL LOAN",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["300478914****", "300478914****", "300478914****"],
          "Account Type": ["Mortgage", "Mortgage", "Mortgage"],
          "Account Type - Detail": [
            "Conventional real estate mortgage",
            "Conventional real estate mortgage",
            "Conventional real estate mortgage",
          ],
          "Account Status": ["Open", "Open", "Open"],
          "Payment Status": ["Current", "Current", "Current"],
          Balance: ["$210,000", "$210,000", "$210,000"],
          "Date Opened": ["06/01/2019", "06/01/2019", "06/01/2019"],
          "Past Due": ["--", "--", "--"],
        },
      },
      {
        // Charged-off collection reporting only on TransUnion; Experian/Equifax
        // columns are empty ("" / "--" / lone "-").
        creditorName: "CAPITAL ONE",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["517805******", "", "-"],
          "Account Type": ["Credit Card", "--", "--"],
          "Account Type - Detail": ["Credit card", "", ""],
          "Account Status": ["Closed", "--", "--"],
          "Payment Status": ["Collection/Chargeoff", "", ""],
          Balance: ["$1,240", "--", "--"],
          "Date Opened": ["03/10/2016", "", "-"],
          "Past Due": ["$1,240", "--", "--"],
        },
      },
    ],
    score: { bureaus: TU_EXP_EQ, values: ["749", "745", "749"] },
  }

  const { accounts, scores } = normalizeIdentityIQExtract(raw)

  it("classifies a current mortgage as OTHER (no derogatory status, type fields ignored)", () => {
    // mapAccountType returns a dispute category, not a product type. A current
    // open account has no derogatory signal → OTHER. The "personal"-containing
    // type/detail fields must NOT drag it to PERSONAL_INFO.
    expect(accounts[0].type).toBe("OTHER")
  })

  it("classifies Collection/Chargeoff (from Payment Status alone) as a collection item", () => {
    expect(accounts[1].type).toBe("COLLECTION")
  })

  it("derives per-bureau presence from non-empty/non-dash columns", () => {
    expect([accounts[0].onTransunion, accounts[0].onExperian, accounts[0].onEquifax]).toEqual([true, true, true])
    expect([accounts[1].onTransunion, accounts[1].onExperian, accounts[1].onEquifax]).toEqual([true, false, false])
  })

  it("normalizes balance, date, and masked account number from the first reporting bureau", () => {
    expect(accounts[0]).toMatchObject({
      creditorName: "CENTRAL LOAN",
      accountNumberMasked: "300478914****",
      balance: "210000",
      dateOpened: "2019-06-01",
    })
    expect(accounts[1]).toMatchObject({
      accountNumberMasked: "517805******",
      balance: "1240",
      dateOpened: "2016-03-10",
    })
  })

  it("maps scores to bureaus by the report's column order", () => {
    expect(scores).toEqual({ transunion: 749, experian: 745, equifax: 749 })
  })

  it("respects a different column order and drops out-of-range scores", () => {
    const out = normalizeIdentityIQExtract({
      accounts: [],
      score: { bureaus: ["experian", "equifax", "transunion"], values: ["700", "999", "640"] },
    })
    // 999 is out of the 300–850 range and must be dropped (→ null).
    expect(out.scores).toEqual({ experian: 700, equifax: null, transunion: 640 })
  })
})
