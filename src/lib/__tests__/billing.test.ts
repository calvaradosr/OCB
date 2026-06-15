import { describe, expect, it } from "vitest"
import { assertWorkPerformed } from "@/lib/stripe"

// ─── CROA billing rule: assertWorkPerformed ───────────────────────────────────

describe("assertWorkPerformed", () => {
  it("throws when workPerformedAt is null", () => {
    expect(() => assertWorkPerformed(null)).toThrow(/CROA violation/)
  })

  it("does not throw when workPerformedAt is a date", () => {
    expect(() => assertWorkPerformed(new Date())).not.toThrow()
  })

  it("error message mentions workPerformedAt", () => {
    let msg = ""
    try { assertWorkPerformed(null) } catch (e) { msg = (e as Error).message }
    expect(msg).toContain("workPerformedAt")
  })
})

// ─── Invoice state machine (pure logic, no DB) ───────────────────────────────

type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "FAILED" | "VOID"

function canCharge(invoice: { status: InvoiceStatus; workPerformedAt: Date | null }): boolean {
  if (!invoice.workPerformedAt) return false
  return invoice.status === "DRAFT" || invoice.status === "OPEN"
}

describe("canCharge (CROA arrears rule)", () => {
  it("returns false when workPerformedAt is null regardless of status", () => {
    expect(canCharge({ status: "DRAFT", workPerformedAt: null })).toBe(false)
    expect(canCharge({ status: "OPEN", workPerformedAt: null })).toBe(false)
  })

  it("returns true when workPerformedAt is set and status is DRAFT or OPEN", () => {
    const now = new Date()
    expect(canCharge({ status: "DRAFT", workPerformedAt: now })).toBe(true)
    expect(canCharge({ status: "OPEN", workPerformedAt: now })).toBe(true)
  })

  it("returns false for terminal states even when workPerformedAt is set", () => {
    const now = new Date()
    expect(canCharge({ status: "PAID", workPerformedAt: now })).toBe(false)
    expect(canCharge({ status: "VOID", workPerformedAt: now })).toBe(false)
  })
})

// ─── Per-deletion billing: only fire after outcome = DELETED ─────────────────

type DisputeOutcome = "PENDING" | "DELETED" | "REPAIRED" | "VERIFIED" | "NO_RESPONSE"

function shouldCreateDeletionInvoice(outcome: DisputeOutcome): boolean {
  return outcome === "DELETED"
}

describe("per-deletion billing trigger", () => {
  it("fires only on DELETED outcome", () => {
    expect(shouldCreateDeletionInvoice("DELETED")).toBe(true)
  })

  it("does not fire on other outcomes", () => {
    const others: DisputeOutcome[] = ["PENDING", "REPAIRED", "VERIFIED", "NO_RESPONSE"]
    others.forEach(o => expect(shouldCreateDeletionInvoice(o)).toBe(false))
  })
})

// ─── CROA 3-day cancellation window ──────────────────────────────────────────

function isInCancellationWindow(signedAt: Date, now: Date): boolean {
  const THREE_BUSINESS_DAYS_MS = 3 * 24 * 60 * 60 * 1000
  return now.getTime() - signedAt.getTime() <= THREE_BUSINESS_DAYS_MS
}

describe("CROA 3-day cancellation window", () => {
  it("returns true within 3 days of signing", () => {
    const signedAt = new Date()
    const twoDaysLater = new Date(signedAt.getTime() + 2 * 24 * 60 * 60 * 1000)
    expect(isInCancellationWindow(signedAt, twoDaysLater)).toBe(true)
  })

  it("returns false after 3 days", () => {
    const signedAt = new Date()
    const fourDaysLater = new Date(signedAt.getTime() + 4 * 24 * 60 * 60 * 1000)
    expect(isInCancellationWindow(signedAt, fourDaysLater)).toBe(false)
  })

  it("returns true at exactly 3 days", () => {
    const signedAt = new Date()
    const exactly3Days = new Date(signedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
    expect(isInCancellationWindow(signedAt, exactly3Days)).toBe(true)
  })
})
