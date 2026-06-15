import { describe, it, expect } from "vitest"
import { generateBureauLetters, type SelectedItem } from "../letters/generate"
import fs from "fs"
import path from "path"

const TEMPLATES_DIR = path.join(__dirname, "../letters/templates")

function loadTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.md`), "utf8")
}

const CLIENT = {
  firstName: "Maria",
  lastName: "Garcia",
  addressLine1: "742 Evergreen Terrace",
  city: "Springfield",
  state: "IL",
  zip: "62701",
}

const ITEMS: SelectedItem[] = [
  {
    creditorName: "Portfolio Recovery Associates",
    accountNumberMasked: "****1234",
    type: "COLLECTION",
    reason: "Account is not mine",
    bureaus: ["EXPERIAN", "EQUIFAX"],
  },
  {
    creditorName: "Capital One",
    accountNumberMasked: "****5678",
    type: "CHARGE_OFF",
    reason: "Balance is inaccurate",
    bureaus: ["TRANSUNION"],
  },
]

describe("generateBureauLetters", () => {
  it("produces one letter per bureau that has items", () => {
    const template = loadTemplate("initial-dispute-bureau")
    const letters = generateBureauLetters(template, CLIENT, ITEMS)
    const bureauLetters = letters.filter(l => l.target === "BUREAU")
    // EXPERIAN (Portfolio), EQUIFAX (Portfolio), TRANSUNION (Capital One)
    expect(bureauLetters.length).toBe(3)
    const bureaus = bureauLetters.map(l => l.bureau)
    expect(bureaus).toContain("EXPERIAN")
    expect(bureaus).toContain("EQUIFAX")
    expect(bureaus).toContain("TRANSUNION")
  })

  it("does not include the other bureau's items in each letter", () => {
    const template = loadTemplate("initial-dispute-bureau")
    const letters = generateBureauLetters(template, CLIENT, ITEMS)
    const exp = letters.find(l => l.bureau === "EXPERIAN")!
    const tu = letters.find(l => l.bureau === "TRANSUNION")!
    expect(exp.body).toContain("Portfolio Recovery")
    expect(exp.body).not.toContain("Capital One")
    expect(tu.body).toContain("Capital One")
    expect(tu.body).not.toContain("Portfolio Recovery")
  })

  it("merges client fields into the letter body", () => {
    const template = loadTemplate("initial-dispute-bureau")
    const letters = generateBureauLetters(template, CLIENT, ITEMS)
    const exp = letters.find(l => l.bureau === "EXPERIAN")!
    expect(exp.body).toContain("Maria Garcia")
    expect(exp.body).toContain("742 Evergreen Terrace")
    expect(exp.body).toContain("Springfield")
  })

  it("inserts item reasons into the letter", () => {
    const template = loadTemplate("initial-dispute-bureau")
    const letters = generateBureauLetters(template, CLIENT, ITEMS)
    const exp = letters.find(l => l.bureau === "EXPERIAN")!
    expect(exp.body).toContain("Account is not mine")
  })

  it("skips bureaus with no items", () => {
    const singleBureauItems: SelectedItem[] = [
      { ...ITEMS[0], bureaus: ["EXPERIAN"] },
    ]
    const template = loadTemplate("initial-dispute-bureau")
    const letters = generateBureauLetters(template, CLIENT, singleBureauItems)
    expect(letters.length).toBe(1)
    expect(letters[0].bureau).toBe("EXPERIAN")
  })

  it("appends CFPB letter when includeCFPB is true", () => {
    const template = loadTemplate("initial-dispute-bureau")
    const cfpbTemplate = loadTemplate("cfpb-complaint")
    const letters = generateBureauLetters(template, CLIENT, ITEMS, {
      includeCFPB: true,
      cfpbTemplate,
    })
    const cfpb = letters.find(l => l.target === "CFPB")
    expect(cfpb).toBeDefined()
    expect(cfpb!.body).toContain("Maria Garcia")
    expect(cfpb!.body).toContain("Portfolio Recovery")
    expect(cfpb!.body).toContain("Capital One")
  })

  it("does not add CFPB letter when template is not provided", () => {
    const template = loadTemplate("initial-dispute-bureau")
    const letters = generateBureauLetters(template, CLIENT, ITEMS, {
      includeCFPB: true,
      // cfpbTemplate intentionally omitted
    })
    expect(letters.find(l => l.target === "CFPB")).toBeUndefined()
  })

  it("produces reinvestigation letters with correct merge fields", () => {
    const template = loadTemplate("reinvestigation")
    const letters = generateBureauLetters(template, CLIENT, ITEMS)
    const exp = letters.find(l => l.bureau === "EXPERIAN")!
    expect(exp.body).toContain("§ 1681i")
    expect(exp.body).toContain("Maria Garcia")
    expect(exp.body).toContain("Portfolio Recovery")
  })
})
