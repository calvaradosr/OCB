import { describe, it, expect } from "vitest"
import {
  isValidStatus,
  buildCSV,
  formatFileSize,
  CLIENT_STATUSES,
  STATUS_LABELS,
} from "../client-utils"

describe("isValidStatus", () => {
  it("accepts all defined statuses", () => {
    CLIENT_STATUSES.forEach(s => expect(isValidStatus(s)).toBe(true))
  })

  it("rejects unknown strings", () => {
    expect(isValidStatus("INVALID")).toBe(false)
    expect(isValidStatus("")).toBe(false)
    expect(isValidStatus("active")).toBe(false) // case-sensitive
  })
})

describe("STATUS_LABELS", () => {
  it("has a label for every status", () => {
    CLIENT_STATUSES.forEach(s => expect(STATUS_LABELS[s]).toBeTruthy())
  })
})

describe("buildCSV", () => {
  it("returns empty string for empty input", () => {
    expect(buildCSV([])).toBe("")
  })

  it("produces a header row and data rows", () => {
    const rows = [{ name: "John", status: "LEAD" }]
    const csv = buildCSV(rows)
    const lines = csv.split("\n")
    expect(lines[0]).toBe("name,status")
    expect(lines[1]).toBe('"John","LEAD"')
  })

  it("escapes commas and double-quotes", () => {
    const rows = [{ name: 'O"Brien, Jr.' }]
    const csv = buildCSV(rows)
    expect(csv).toContain('"O""Brien, Jr."')
  })

  it("handles null and undefined gracefully", () => {
    const rows = [{ name: null, phone: undefined }] as unknown as Record<string, unknown>[]
    expect(() => buildCSV(rows)).not.toThrow()
  })
})

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(512)).toBe("512 B")
  })
  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB")
  })
  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})
