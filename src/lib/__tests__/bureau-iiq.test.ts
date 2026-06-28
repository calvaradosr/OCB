import { describe, it, expect } from "vitest"
import { normalizeIdentityIQExtract, type IiqRawExtract } from "../bureau-iiq"

// IdentityIQ's header row is TransUnion → Experian → Equifax.
const TU_EXP_EQ = ["transunion", "experian", "equifax"]

describe("normalizeIdentityIQExtract", () => {
  const raw: IiqRawExtract = {
    accounts: [
      {
        // Clean mortgage reporting on all three bureaus. "Account Type" is
        // "Mortgage" — classification must come from status fields, not type.
        creditorName: "CENTRAL LOAN",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["300478914****", "300478914****", "300478914****"],
          "Account Type": ["Mortgage", "Mortgage", "Mortgage"],
          "Account Status": ["Open", "Open", "Open"],
          "Payment Status": ["Current", "Current", "Current"],
          Balance: ["$316,522.00", "$316,522.00", "$316,522.00"],
          "Date Opened": ["11/30/2021", "11/30/2021", "11/30/2021"],
        },
      },
      {
        // Reports only on TransUnion — Experian/Equifax columns are "-".
        creditorName: "ANCHOREDFIN",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["JCKD**", "-", "-"],
          "Account Type": ["Personal Loan", "-", "-"],
          "Account Status": ["Open", "-", "-"],
          "Payment Status": ["Current", "-", "-"],
          Balance: ["$0.00", "-", "-"],
          "Date Opened": ["01/27/2022", "-", "-"],
        },
      },
      {
        // Derogatory collection reporting only on Equifax.
        creditorName: "MIDLAND FUNDING",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["-", "-", "529921******"],
          "Account Status": ["-", "-", "Closed"],
          "Payment Status": ["-", "-", "Collection/Chargeoff"],
          Balance: ["-", "-", "$1,204.00"],
          "Date Opened": ["-", "-", "06/15/2020"],
        },
      },
    ],
    score: { bureaus: TU_EXP_EQ, values: ["749", "745", "749"] },
  }

  const { accounts, scores } = normalizeIdentityIQExtract(raw)

  it("does not misclassify a 'Personal Loan' account type as PERSONAL_INFO", () => {
    expect(accounts[1].type).toBe("OTHER")
  })

  it("classifies Collection/Chargeoff from the status field as a derogatory item", () => {
    expect(accounts[2].type).toBe("COLLECTION")
  })

  it("derives per-bureau presence from non-'-' columns", () => {
    expect([accounts[0].onTransunion, accounts[0].onExperian, accounts[0].onEquifax]).toEqual([true, true, true])
    expect([accounts[1].onTransunion, accounts[1].onExperian, accounts[1].onEquifax]).toEqual([true, false, false])
    expect([accounts[2].onTransunion, accounts[2].onExperian, accounts[2].onEquifax]).toEqual([false, false, true])
  })

  it("normalizes balance, date, and masked account number from the first reporting bureau", () => {
    expect(accounts[0]).toMatchObject({
      creditorName: "CENTRAL LOAN",
      accountNumberMasked: "300478914****",
      balance: "316522.00",
      dateOpened: "2021-11-30",
    })
    expect(accounts[2]).toMatchObject({ accountNumberMasked: "529921******", balance: "1204.00", dateOpened: "2020-06-15" })
  })

  it("maps scores to bureaus by the report's column order (ground truth 749/745/749)", () => {
    expect(scores).toEqual({ transunion: 749, experian: 745, equifax: 749 })
  })

  it("respects a different column order and drops out-of-range scores", () => {
    const out = normalizeIdentityIQExtract({
      accounts: [],
      score: { bureaus: ["experian", "equifax", "transunion"], values: ["745", "999", "749"] },
    })
    expect(out.scores).toEqual({ experian: 745, equifax: null, transunion: 749 })
  })
})
