import { describe, expect, it } from "vitest"
import { renderTemplate } from "@/lib/email"

// ─── Template rendering ────────────────────────────────────────────────────────

describe("renderTemplate", () => {
  it("replaces {{key}} with the corresponding value", () => {
    const result = renderTemplate("Hello {{firstName}}!", { firstName: "Maria" })
    expect(result).toBe("Hello Maria!")
  })

  it("replaces multiple occurrences of the same variable", () => {
    const result = renderTemplate("Hi {{firstName}}, {{firstName}}!", { firstName: "John" })
    expect(result).toBe("Hi John, John!")
  })

  it("replaces multiple different variables", () => {
    const result = renderTemplate("Hi {{firstName}} {{lastName}}", {
      firstName: "Maria",
      lastName: "Garcia",
    })
    expect(result).toBe("Hi Maria Garcia")
  })

  it("leaves unknown variables as empty string", () => {
    const result = renderTemplate("Hi {{unknown}}", {})
    expect(result).toBe("Hi ")
  })

  it("handles template with no variables", () => {
    const result = renderTemplate("No variables here", { firstName: "Test" })
    expect(result).toBe("No variables here")
  })

  it("handles empty template", () => {
    expect(renderTemplate("", { firstName: "Test" })).toBe("")
  })
})

// ─── Affiliate commission math ────────────────────────────────────────────────

describe("affiliate commission calculation", () => {
  function calcCommission(invoiceCents: number, pct: number): number {
    return Math.round((invoiceCents * pct) / 100)
  }

  it("calculates 10% of $300 = $30", () => {
    expect(calcCommission(30000, 10)).toBe(3000)
  })

  it("calculates 20% of $500 = $100", () => {
    expect(calcCommission(50000, 20)).toBe(10000)
  })

  it("rounds fractional cents", () => {
    expect(calcCommission(9999, 10)).toBe(1000) // 999.9 → 1000
  })

  it("returns 0 for 0% commission", () => {
    expect(calcCommission(50000, 0)).toBe(0)
  })

  it("returns full amount for 100% commission", () => {
    expect(calcCommission(50000, 100)).toBe(50000)
  })
})

// ─── Automation trigger guard ─────────────────────────────────────────────────

describe("automation condition matching", () => {
  type Client = { modules: string[]; status: string }

  function matchesCondition(client: Client, cond: Record<string, string>): boolean {
    if (cond.module && !client.modules.includes(cond.module)) return false
    if (cond.status && client.status !== cond.status) return false
    return true
  }

  it("matches when no conditions set", () => {
    expect(matchesCondition({ modules: ["CREDIT_REPAIR"], status: "ACTIVE" }, {})).toBe(true)
  })

  it("matches client with matching module", () => {
    expect(matchesCondition(
      { modules: ["CREDIT_REPAIR", "LOAN"], status: "ACTIVE" },
      { module: "LOAN" }
    )).toBe(true)
  })

  it("rejects client without matching module", () => {
    expect(matchesCondition(
      { modules: ["CREDIT_REPAIR"], status: "ACTIVE" },
      { module: "TRADELINE" }
    )).toBe(false)
  })

  it("matches client with matching status", () => {
    expect(matchesCondition(
      { modules: ["CREDIT_REPAIR"], status: "ACTIVE" },
      { status: "ACTIVE" }
    )).toBe(true)
  })

  it("rejects client with non-matching status", () => {
    expect(matchesCondition(
      { modules: ["CREDIT_REPAIR"], status: "LEAD" },
      { status: "ACTIVE" }
    )).toBe(false)
  })

  it("requires both module and status to match when both set", () => {
    expect(matchesCondition(
      { modules: ["CREDIT_REPAIR"], status: "ACTIVE" },
      { module: "CREDIT_REPAIR", status: "ACTIVE" }
    )).toBe(true)

    expect(matchesCondition(
      { modules: ["CREDIT_REPAIR"], status: "LEAD" },
      { module: "CREDIT_REPAIR", status: "ACTIVE" }
    )).toBe(false)
  })
})
