import { describe, it, expect } from "vitest"
import { can, type Permission } from "../rbac"

describe("RBAC permission matrix (brief §3)", () => {
  describe("ADMIN", () => {
    it("has all client and dispute permissions", () => {
      expect(can("ADMIN", "clients:read")).toBe(true)
      expect(can("ADMIN", "clients:write")).toBe(true)
      expect(can("ADMIN", "clients:read_pii")).toBe(true)
      expect(can("ADMIN", "disputes:write")).toBe(true)
    })
    it("has billing and settings access", () => {
      expect(can("ADMIN", "billing:write")).toBe(true)
      expect(can("ADMIN", "settings:write")).toBe(true)
      expect(can("ADMIN", "users:manage")).toBe(true)
    })
  })

  describe("MANAGER", () => {
    it("has full client and dispute access", () => {
      expect(can("MANAGER", "clients:read_pii")).toBe(true)
      expect(can("MANAGER", "disputes:write")).toBe(true)
    })
    it("cannot change settings or manage users", () => {
      expect(can("MANAGER", "settings:write")).toBe(false)
      expect(can("MANAGER", "users:manage")).toBe(false)
    })
  })

  describe("AGENT", () => {
    it("can work disputes and generate letters", () => {
      expect(can("AGENT", "disputes:write")).toBe(true)
      expect(can("AGENT", "letters:generate")).toBe(true)
    })
    it("cannot read PII or touch billing", () => {
      expect(can("AGENT", "clients:read_pii")).toBe(false)
      expect(can("AGENT", "billing:read")).toBe(false)
    })
  })

  describe("LOAN_PROCESSOR", () => {
    it("can access loan pipeline and basic client info", () => {
      expect(can("LOAN_PROCESSOR", "loans:read")).toBe(true)
      expect(can("LOAN_PROCESSOR", "loans:write")).toBe(true)
      expect(can("LOAN_PROCESSOR", "clients:read")).toBe(true)
    })
    it("cannot access disputes or billing", () => {
      expect(can("LOAN_PROCESSOR", "disputes:write")).toBe(false)
      expect(can("LOAN_PROCESSOR", "billing:read")).toBe(false)
    })
  })

  describe("AFFILIATE", () => {
    it("can only access affiliate portal", () => {
      expect(can("AFFILIATE", "portal:affiliate")).toBe(true)
      expect(can("AFFILIATE", "clients:read")).toBe(false)
    })
  })

  describe("CLIENT", () => {
    it("can only access client portal", () => {
      expect(can("CLIENT", "portal:client")).toBe(true)
      expect(can("CLIENT", "clients:read")).toBe(false)
      expect(can("CLIENT", "disputes:read")).toBe(false)
    })
  })

  it("returns false for an unrecognized role", () => {
    expect(can("UNKNOWN" as never, "clients:read" as Permission)).toBe(false)
  })
})
