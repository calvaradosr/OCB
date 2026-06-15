import { auth } from "@/auth"
import { redirect } from "next/navigation"
import qrcode from "qrcode"
import { ensureMFASecret } from "@/app/actions/mfa"
import { getTOTPKeyUri } from "@/lib/mfa"
import MFASetupForm from "./MFASetupForm"

export default async function MFASetupPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const secret = await ensureMFASecret()
  const uri = getTOTPKeyUri(session.user.email ?? session.user.name ?? "user", secret)
  const qrDataUrl = await qrcode.toDataURL(uri, { width: 200, margin: 1 })

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-secondary-soft p-8">
        <div className="text-center mb-6">
          <span className="text-3xl font-bold text-primary">one</span>
          <span className="text-3xl font-semibold text-ink"> Consulting</span>
          <div className="text-sm tracking-[0.3em] text-secondary uppercase">Business</div>
        </div>

        <h2 className="text-lg font-semibold text-ink mb-1">Set up two-factor authentication</h2>
        <p className="text-sm text-muted mb-6">
          Staff accounts require MFA. This is a one-time setup.
        </p>

        <MFASetupForm qrDataUrl={qrDataUrl} secret={secret} />
      </div>
    </main>
  )
}
