import { describe, expect, it } from "vitest"
import {
  canOrderTransition,
  checkPostingMatch,
  calcCommission,
  cardAgeYears,
  VALID_ORDER_TRANSITIONS,
} from "@/lib/tradeline-utils"
import { TradelineOrderStatus } from "@prisma/client"

// ─── Order status transitions ─────────────────────────────────────────────────

describe("canOrderTransition", () => {
  it("allows the linear forward path", () => {
    expect(canOrderTransition("PENDING_PAYMENT", "PAID")).toBe(true)
    expect(canOrderTransition("PAID", "INFO_SENT_TO_VENDOR")).toBe(true)
    expect(canOrderTransition("INFO_SENT_TO_VENDOR", "POSTED")).toBe(true)
    expect(canOrderTransition("POSTED", "REMOVED")).toBe(true)
  })

  it("allows cancellation from all non-terminal states", () => {
    const cancellable: TradelineOrderStatus[] = ["PENDING_PAYMENT", "PAID", "INFO_SENT_TO_VENDOR"]
    for (const status of cancellable) {
      expect(canOrderTransition(status, "CANCELLED")).toBe(true)
    }
  })

  it("blocks cancellation from POSTED (already delivered)", () => {
    expect(canOrderTransition("POSTED", "CANCELLED")).toBe(false)
  })

  it("blocks any move from REMOVED (terminal)", () => {
    const allStatuses = Object.keys(VALID_ORDER_TRANSITIONS) as TradelineOrderStatus[]
    for (const to of allStatuses) {
      expect(canOrderTransition("REMOVED", to)).toBe(false)
    }
  })

  it("blocks any move from CANCELLED (terminal)", () => {
    const allStatuses = Object.keys(VALID_ORDER_TRANSITIONS) as TradelineOrderStatus[]
    for (const to of allStatuses) {
      expect(canOrderTransition("CANCELLED", to)).toBe(false)
    }
  })

  it("blocks skipping stages (PENDING_PAYMENT → INFO_SENT_TO_VENDOR)", () => {
    expect(canOrderTransition("PENDING_PAYMENT", "INFO_SENT_TO_VENDOR")).toBe(false)
    expect(canOrderTransition("PENDING_PAYMENT", "POSTED")).toBe(false)
    expect(canOrderTransition("PAID", "POSTED")).toBe(false)
  })

  it("blocks backward moves", () => {
    expect(canOrderTransition("PAID", "PENDING_PAYMENT")).toBe(false)
    expect(canOrderTransition("INFO_SENT_TO_VENDOR", "PAID")).toBe(false)
    expect(canOrderTransition("POSTED", "INFO_SENT_TO_VENDOR")).toBe(false)
  })
})

// ─── Posting match / verification ────────────────────────────────────────────

describe("checkPostingMatch", () => {
  const makeItem = (creditorName: string) => ({
    creditorName,
    onExperian: true,
    onEquifax: true,
    onTransunion: true,
  })

  it("matches when the first word of bank name appears in a creditor name", () => {
    const items = [makeItem("CHASE BANK USA NA"), makeItem("CAPITAL ONE")]
    expect(checkPostingMatch("Chase Sapphire Preferred", items)).toBe(true)
  })

  it("is case-insensitive", () => {
    const items = [makeItem("capital one bank")]
    expect(checkPostingMatch("Capital One Venture", items)).toBe(true)
  })

  it("returns false when no match is found", () => {
    const items = [makeItem("WELLS FARGO"), makeItem("BANK OF AMERICA")]
    expect(checkPostingMatch("Chase Freedom", items)).toBe(false)
  })

  it("returns false for an empty items list", () => {
    expect(checkPostingMatch("Chase Sapphire", [])).toBe(false)
  })

  it("matches partial keyword inside creditor name", () => {
    const items = [makeItem("DISCOVER FINANCIAL SERVICES")]
    expect(checkPostingMatch("Discover It Cash Back", items)).toBe(true)
  })

  it("uses only the first word of the bank name as the keyword", () => {
    // "Bank" is the first word — should not match "Chase"
    const items = [makeItem("CHASE VISA")]
    expect(checkPostingMatch("Bank of America Rewards", items)).toBe(false)
  })
})

// ─── Commission calculation ───────────────────────────────────────────────────

describe("calcCommission", () => {
  it("returns retail minus cost", () => {
    expect(calcCommission(30000, 15000)).toBe(15000) // $300 - $150 = $150
  })

  it("returns 0 when cost equals retail", () => {
    expect(calcCommission(10000, 10000)).toBe(0)
  })

  it("clamps to 0 when cost exceeds retail (guard against negative)", () => {
    expect(calcCommission(10000, 12000)).toBe(0)
  })
})

// ─── Card age calculation ─────────────────────────────────────────────────────

describe("cardAgeYears", () => {
  it("returns 0 for a card opened today", () => {
    expect(cardAgeYears(new Date())).toBe(0)
  })

  it("returns correct whole years (offset to clear leap-year boundary)", () => {
    // setFullYear alone may land just under N*365.25 days due to leap years,
    // so subtract a few extra days to ensure we're clearly past the threshold.
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    fiveYearsAgo.setDate(fiveYearsAgo.getDate() - 5)
    expect(cardAgeYears(fiveYearsAgo)).toBe(5)
  })

  it("floors partial years (not yet completed year is not counted)", () => {
    const almostOneYear = new Date()
    almostOneYear.setMonth(almostOneYear.getMonth() - 11)
    expect(cardAgeYears(almostOneYear)).toBe(0)
  })

  it("handles a 10-year-old card", () => {
    const tenYearsAgo = new Date()
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
    tenYearsAgo.setDate(tenYearsAgo.getDate() - 5)
    expect(cardAgeYears(tenYearsAgo)).toBe(10)
  })
})
