import { describe, it, expect } from "vitest"
import { normalizeCrcExtract, type CrcRawExtract } from "../bureau-crc"

const TU_EXP_EQ = ["transunion", "experian", "equifax"]

describe("normalizeCrcExtract", () => {
  const raw: CrcRawExtract = {
    accounts: [
      {
        // Clean paid account reporting only on Experian. Its "Creditor Type" is
        // "Personal Loan Companies" — must NOT classify as PERSONAL_INFO.
        creditorName: "AFFIRM INC",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["--", "Z9T6****", "--"],
          "Balance Owed": ["--", "$0", "--"],
          "Date Opened": ["--", "03/01/2024", "--"],
          "Account Status": ["--", "Closed", "--"],
          "Payment Status": ["--", "Current", "--"],
          "Account Rating": ["--", "Paid", "--"],
          "Creditor Type": ["--", "Personal Loan Companies", "--"],
          "Past Due Amount": ["--", "$0", "--"],
        },
      },
      {
        // Charged-off collection reporting only on TransUnion.
        creditorName: "CAPITAL ONE",
        bureaus: TU_EXP_EQ,
        fields: {
          "Account #": ["466309******", "--", "--"],
          "Balance Owed": ["$3,105", "--", "--"],
          "Date Opened": ["03/10/2006", "--", "--"],
          "Account Status": ["Closed", "--", "--"],
          "Payment Status": ["Collection/Chargeoff", "--", "--"],
          "Account Rating": ["Derogatory", "--", "--"],
          "Past Due Amount": ["$3,105", "--", "--"],
        },
      },
    ],
    score: { bureaus: TU_EXP_EQ, values: ["592", "606", "629"] },
  }

  const { accounts, scores } = normalizeCrcExtract(raw)

  it("does not misclassify a 'Personal Loan Companies' account as PERSONAL_INFO", () => {
    expect(accounts[0].type).toBe("OTHER")
  })

  it("classifies Collection/Chargeoff as a derogatory item", () => {
    expect(accounts[1].type).toBe("COLLECTION")
  })

  it("derives per-bureau presence from non-'--' columns", () => {
    expect([accounts[0].onTransunion, accounts[0].onExperian, accounts[0].onEquifax]).toEqual([false, true, false])
    expect([accounts[1].onTransunion, accounts[1].onExperian, accounts[1].onEquifax]).toEqual([true, false, false])
  })

  it("normalizes balance, date, and masked account number from the first reporting bureau", () => {
    expect(accounts[0]).toMatchObject({
      creditorName: "AFFIRM INC",
      accountNumberMasked: "Z9T6****",
      balance: "0",
      dateOpened: "2024-03-01",
    })
    expect(accounts[1]).toMatchObject({ balance: "3105", dateOpened: "2006-03-10" })
  })

  it("maps scores to bureaus by the report's column order", () => {
    expect(scores).toEqual({ transunion: 592, experian: 606, equifax: 629 })
  })

  it("respects a different column order and drops out-of-range scores", () => {
    const out = normalizeCrcExtract({
      accounts: [],
      score: { bureaus: ["experian", "equifax", "transunion"], values: ["700", "999", "640"] },
    })
    // 999 is out of the 300–850 range and must be dropped (→ null).
    expect(out.scores).toEqual({ experian: 700, equifax: null, transunion: 640 })
  })
})
