import { describe, it, expect } from "vitest"
import { calculateDueDate, isOverdue, daysRemaining, clockLabel } from "../fcra"

describe("calculateDueDate", () => {
  it("returns exactly 30 days later for domestic bureaus", () => {
    const sent = new Date("2026-01-01T00:00:00.000Z")
    const due = calculateDueDate(sent)
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-31")
  })

  it("returns exactly 45 days later for foreign reporting", () => {
    const sent = new Date("2026-01-01T00:00:00.000Z")
    const due = calculateDueDate(sent, true)
    expect(due.toISOString().slice(0, 10)).toBe("2026-02-15")
  })

  it("handles month rollover correctly", () => {
    const sent = new Date("2026-06-12T00:00:00.000Z")
    const due = calculateDueDate(sent)
    expect(due.toISOString().slice(0, 10)).toBe("2026-07-12")
  })

  it("handles year boundary", () => {
    const sent = new Date("2026-12-15T00:00:00.000Z")
    const due = calculateDueDate(sent)
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-14")
  })

  it("does not mutate the input date", () => {
    const sent = new Date("2026-06-01T00:00:00.000Z")
    const original = sent.getTime()
    calculateDueDate(sent)
    expect(sent.getTime()).toBe(original)
  })
})

describe("isOverdue", () => {
  it("returns true when asOf is after dueAt", () => {
    const dueAt = new Date("2026-06-01")
    const asOf = new Date("2026-06-13")
    expect(isOverdue(dueAt, asOf)).toBe(true)
  })

  it("returns false when asOf is before dueAt", () => {
    const dueAt = new Date("2026-07-12")
    const asOf = new Date("2026-06-13")
    expect(isOverdue(dueAt, asOf)).toBe(false)
  })

  it("returns false on the exact due date", () => {
    const dueAt = new Date("2026-06-13T23:59:59.000Z")
    const asOf = new Date("2026-06-13T12:00:00.000Z")
    expect(isOverdue(dueAt, asOf)).toBe(false)
  })
})

describe("daysRemaining", () => {
  it("returns 30 when dueAt is exactly 30 days away", () => {
    const asOf = new Date("2026-06-12T00:00:00.000Z")
    const dueAt = new Date("2026-07-12T00:00:00.000Z")
    expect(daysRemaining(dueAt, asOf)).toBe(30)
  })

  it("returns negative value when overdue", () => {
    const asOf = new Date("2026-07-15T00:00:00.000Z")
    const dueAt = new Date("2026-07-12T00:00:00.000Z")
    expect(daysRemaining(dueAt, asOf)).toBeLessThan(0)
  })

  it("returns 1 for a single day remaining", () => {
    const asOf = new Date("2026-07-11T00:00:00.000Z")
    const dueAt = new Date("2026-07-12T00:00:00.000Z")
    expect(daysRemaining(dueAt, asOf)).toBe(1)
  })
})

describe("clockLabel", () => {
  it('returns "Not sent" when sentAt is null', () => {
    expect(clockLabel(null, null)).toBe("Not sent")
  })

  it('returns "Sent" when sentAt is set but dueAt is null', () => {
    expect(clockLabel(new Date(), null)).toBe("Sent")
  })

  it("shows days remaining when not overdue", () => {
    const sentAt = new Date("2026-06-12T00:00:00.000Z")
    const dueAt = new Date("2026-07-12T00:00:00.000Z")
    const label = clockLabel(sentAt, dueAt)
    // We can't easily pin the exact number without mocking Date, but it should start with a number
    expect(label).toMatch(/\d+ day/)
  })
})
