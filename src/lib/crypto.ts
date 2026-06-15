// Field-level AES-256-GCM encryption for PII (SSN, DOB).
// GLBA Safeguards Rule — brief §4.9. Key in PII_ENCRYPTION_KEY (Secrets Manager in prod).
import crypto from "crypto";

function key(): Buffer {
  const k = process.env.PII_ENCRYPTION_KEY;
  if (!k) throw new Error("PII_ENCRYPTION_KEY is not set");
  return Buffer.from(k, "base64");
}

export function encryptPII(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map(b => b.toString("base64")).join(".");
}

export function decryptPII(stored: string): string {
  const [iv, tag, enc] = stored.split(".").map(s => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
