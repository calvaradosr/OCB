import { describe, expect, it } from "vitest"
import {
  canTransition,
  isCreditReady,
  CREDIT_READINESS_THRESHOLD,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  PIPELINE_STAGES,
  LOAN_DOC_CHECKLIST,
} from "@/lib/loan-utils"
import { LoanStatus } from "@prisma/client"

// ─── Pipeline transition rules ────────────────────────────────────────────────

describe("canTransition", () => {
  it("allows forward steps", () => {
    expect(canTransition("INTAKE", "PRE_QUAL")).toBe(true)
    expect(canTransition("PRE_QUAL", "DOCS_COLLECTION")).toBe(true)
    expect(canTransition("CLEAR_TO_CLOSE", "FUNDED")).toBe(true)
  })

  it("allows backward steps (re-open)", () => {
    expect(canTransition("DOCS_COLLECTION", "PRE_QUAL")).toBe(true)
    expect(canTransition("PROCESSING", "DOCS_COLLECTION")).toBe(true)
  })

  it("allows decline/withdraw from open stages", () => {
    expect(canTransition("SUBMITTED", "DECLINED")).toBe(true)
    expect(canTransition("INTAKE", "WITHDRAWN")).toBe(true)
  })

  it("blocks moves from FUNDED (terminal)", () => {
    const allStatuses = Object.keys(VALID_TRANSITIONS) as LoanStatus[]
    allStatuses.forEach(to => {
      expect(canTransition("FUNDED", to)).toBe(false)
    })
  })

  it("blocks moves from DECLINED (terminal)", () => {
    const allStatuses = Object.keys(VALID_TRANSITIONS) as LoanStatus[]
    allStatuses.forEach(to => {
      expect(canTransition("DECLINED", to)).toBe(false)
    })
  })

  it("blocks skipping multiple stages forward", () => {
    expect(canTransition("INTAKE", "PROCESSING")).toBe(false)
    expect(canTransition("INTAKE", "FUNDED")).toBe(false)
  })
})

// ─── Terminal statuses ────────────────────────────────────────────────────────

describe("TERMINAL_STATUSES", () => {
  it("contains FUNDED, DECLINED, WITHDRAWN", () => {
    expect(TERMINAL_STATUSES).toContain("FUNDED")
    expect(TERMINAL_STATUSES).toContain("DECLINED")
    expect(TERMINAL_STATUSES).toContain("WITHDRAWN")
  })

  it("does not contain active pipeline stages", () => {
    PIPELINE_STAGES.slice(0, -1).forEach(s => {
      expect(TERMINAL_STATUSES).not.toContain(s)
    })
  })
})

// ─── Credit-readiness bridge ─────────────────────────────────────────────────

describe("isCreditReady", () => {
  it("returns true when all bureau scores meet threshold", () => {
    expect(isCreditReady({ experian: 650, equifax: 640, transunion: 630 })).toBe(true)
  })

  it("returns true when scores are exactly at threshold", () => {
    const t = CREDIT_READINESS_THRESHOLD
    expect(isCreditReady({ experian: t, equifax: t, transunion: t })).toBe(true)
  })

  it("returns false when any score is below threshold", () => {
    expect(isCreditReady({ experian: 700, equifax: 619, transunion: 700 })).toBe(false)
  })

  it("returns false when all scores are null", () => {
    expect(isCreditReady({ experian: null, equifax: null, transunion: null })).toBe(false)
  })

  it("uses available scores when some bureaus are missing", () => {
    expect(isCreditReady({ experian: 650, equifax: null, transunion: 630 })).toBe(true)
    expect(isCreditReady({ experian: 610, equifax: null, transunion: 630 })).toBe(false)
  })

  it("respects custom threshold", () => {
    expect(isCreditReady({ experian: 700, equifax: 720, transunion: 710 }, 720)).toBe(false)
    expect(isCreditReady({ experian: 720, equifax: 720, transunion: 720 }, 720)).toBe(true)
  })
})

// ─── Document checklist ───────────────────────────────────────────────────────

describe("LOAN_DOC_CHECKLIST", () => {
  it("personal loan requires paystub, bank statement, tax return", () => {
    expect(LOAN_DOC_CHECKLIST.PERSONAL).toContain("PAYSTUB")
    expect(LOAN_DOC_CHECKLIST.PERSONAL).toContain("BANK_STATEMENT")
    expect(LOAN_DOC_CHECKLIST.PERSONAL).toContain("TAX_RETURN")
  })

  it("mortgage requires W2 and purchase agreement", () => {
    expect(LOAN_DOC_CHECKLIST.MORTGAGE).toContain("W2")
    expect(LOAN_DOC_CHECKLIST.MORTGAGE).toContain("PURCHASE_AGREEMENT")
  })

  it("business loan requires articles of incorporation", () => {
    expect(LOAN_DOC_CHECKLIST.BUSINESS).toContain("ARTICLES")
    expect(LOAN_DOC_CHECKLIST.BUSINESS).toContain("BUSINESS_FINANCIALS")
  })

  it("every loan type has at least one required document", () => {
    const types = Object.keys(LOAN_DOC_CHECKLIST) as (keyof typeof LOAN_DOC_CHECKLIST)[]
    types.forEach(t => {
      expect(LOAN_DOC_CHECKLIST[t].length).toBeGreaterThan(0)
    })
  })
})
