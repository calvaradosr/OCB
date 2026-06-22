import { describe, it, expect } from "vitest"
import {
  mapAccountType,
  parseBalance,
  parseDateString,
  extractScore,
} from "../bureau-parse"

describe("mapAccountType", () => {
  it("classifies collections and charge-offs", () => {
    expect(mapAccountType("Collection Account")).toBe("COLLECTION")
    expect(mapAccountType("Charge-Off")).toBe("CHARGE_OFF")
    expect(mapAccountType("chargeoff")).toBe("CHARGE_OFF")
  })

  it("classifies public records", () => {
    expect(mapAccountType("Chapter 7 Bankruptcy")).toBe("BANKRUPTCY")
    expect(mapAccountType("Civil Judgment")).toBe("JUDGMENT")
    expect(mapAccountType("Civil Judgement")).toBe("JUDGMENT") // common misspelling
    expect(mapAccountType("Federal Tax Lien")).toBe("TAX_LIEN")
    expect(mapAccountType("Auto Repossession")).toBe("REPOSSESSION")
  })

  it("classifies late payments and inquiries", () => {
    expect(mapAccountType("30 days late")).toBe("LATE_PAYMENT")
    expect(mapAccountType("90 Day Late")).toBe("LATE_PAYMENT")
    expect(mapAccountType("Past Due")).toBe("LATE_PAYMENT")
    expect(mapAccountType("Hard Inquiry")).toBe("INQUIRY")
    expect(mapAccountType("Inquiries")).toBe("INQUIRY")
  })

  it("classifies personal info and falls back to OTHER", () => {
    expect(mapAccountType("Personal Information")).toBe("PERSONAL_INFO")
    expect(mapAccountType("Employment")).toBe("PERSONAL_INFO")
    expect(mapAccountType("Revolving Credit Card")).toBe("OTHER")
    expect(mapAccountType("")).toBe("OTHER")
  })

  it("prefers the more specific charge-off over the late-payment pattern", () => {
    // "Charge-off, 120 days past due" matches both — must resolve to CHARGE_OFF
    expect(mapAccountType("Charge-off, 120 days past due")).toBe("CHARGE_OFF")
  })
})

describe("parseBalance", () => {
  it("strips currency formatting", () => {
    expect(parseBalance("$1,234.56")).toBe("1234.56")
    expect(parseBalance("USD 0")).toBe("0")
  })

  it("returns empty string for non-numeric input", () => {
    expect(parseBalance("N/A")).toBe("")
    expect(parseBalance("")).toBe("")
  })
})

describe("parseDateString", () => {
  it("parses month-name + year", () => {
    expect(parseDateString("January 2022")).toBe("2022-01-01")
    expect(parseDateString("Sep 2019")).toBe("2019-09-01")
    expect(parseDateString("Sept 2019")).toBe("2019-09-01")
  })

  it("parses MM/DD/YYYY and MM/DD/YY", () => {
    expect(parseDateString("3/15/2022")).toBe("2022-03-15")
    expect(parseDateString("03/05/2022")).toBe("2022-03-05")
    expect(parseDateString("12/5/22")).toBe("2022-12-05") // 2-digit year
  })

  it("parses MM/YYYY", () => {
    expect(parseDateString("03/2022")).toBe("2022-03-01")
  })

  it("parses ISO dates", () => {
    expect(parseDateString("2021-07-09")).toBe("2021-07-09")
  })

  it("returns empty string when unparseable", () => {
    expect(parseDateString("")).toBe("")
    expect(parseDateString("sometime last year")).toBe("")
  })
})

describe("extractScore", () => {
  it("returns the first in-range 3-digit score", () => {
    expect(extractScore("Your score is 712")).toBe(712)
    expect(extractScore("Experian: 689 (Good)")).toBe(689)
  })

  it("ignores numbers outside the 300–850 range", () => {
    expect(extractScore("Account #123 balance 250")).toBeNull()
    expect(extractScore("999")).toBeNull()
  })

  it("returns null when no score present", () => {
    expect(extractScore("No data available")).toBeNull()
    expect(extractScore("")).toBeNull()
  })
})
