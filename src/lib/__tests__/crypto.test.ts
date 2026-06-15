import { describe, it, expect, beforeAll, afterEach } from "vitest"
import { encryptPII, decryptPII } from "../crypto"

const TEST_KEY = Buffer.alloc(32).toString("base64") // 32 zero-bytes, base64-encoded

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY
})

afterEach(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY
})

describe("PII encryption (GLBA §4.9)", () => {
  it("round-trips SSN correctly", () => {
    const ssn = "123-45-6789"
    expect(decryptPII(encryptPII(ssn))).toBe(ssn)
  })

  it("round-trips DOB correctly", () => {
    const dob = "1985-03-22"
    expect(decryptPII(encryptPII(dob))).toBe(dob)
  })

  it("produces unique ciphertexts for the same plaintext (random IVs)", () => {
    const plain = "123-45-6789"
    expect(encryptPII(plain)).not.toBe(encryptPII(plain))
  })

  it("ciphertext has three dot-separated base64 segments (iv.tag.data)", () => {
    const parts = encryptPII("test").split(".")
    expect(parts).toHaveLength(3)
    parts.forEach(p => expect(p.length).toBeGreaterThan(0))
  })

  it("throws if PII_ENCRYPTION_KEY is not set", () => {
    delete process.env.PII_ENCRYPTION_KEY
    expect(() => encryptPII("test")).toThrow("PII_ENCRYPTION_KEY is not set")
  })

  it("throws on tampered ciphertext (auth tag failure)", () => {
    const stored = encryptPII("sensitive")
    const tampered = stored.slice(0, -2) + "XX"
    expect(() => decryptPII(tampered)).toThrow()
  })
})
