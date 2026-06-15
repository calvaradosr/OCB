// TOTP-based MFA helpers — staff-only, brief §3/4.9.
import { OTP } from "otplib"

const otp = new OTP({ strategy: "totp" })

export function generateTOTPSecret(): string {
  return otp.generateSecret()
}

export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  const result = await otp.verify({ token, secret, epochTolerance: 1 })
  return result.valid
}

export function getTOTPKeyUri(email: string, secret: string): string {
  return otp.generateURI({ issuer: "OCB Platform", label: email, secret })
}
