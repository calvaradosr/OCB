"use client"
import { useFormState, useFormStatus } from "react-dom"
import { confirmMFASetup } from "@/app/actions/mfa"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
    >
      {pending ? "Activating…" : "Activate MFA"}
    </button>
  )
}

export default function MFASetupForm({
  qrDataUrl,
  secret,
}: {
  qrDataUrl: string
  secret: string
}) {
  const [state, action] = useFormState(confirmMFASetup, undefined)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted mb-3">
          Scan this QR code with <strong className="text-ink">Google Authenticator</strong>,{" "}
          <strong className="text-ink">Authy</strong>, or any TOTP app.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="MFA QR code"
          className="mx-auto w-48 h-48 rounded-lg border border-secondary-soft"
        />
      </div>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer hover:text-ink">Can&apos;t scan? Enter code manually</summary>
        <code className="block mt-2 p-2 bg-canvas rounded text-ink tracking-widest break-all">
          {secret}
        </code>
      </details>

      <form action={action} className="space-y-4">
        {state?.error && (
          <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        <div>
          <label className="block text-sm text-muted mb-1">
            Enter the 6-digit code from your app to confirm setup
          </label>
          <input
            name="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            placeholder="000000"
            required
            autoFocus
            className="w-full rounded-lg border border-secondary-soft px-4 py-2.5 text-center text-2xl tracking-[0.5em] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <SubmitButton />
      </form>
    </div>
  )
}
