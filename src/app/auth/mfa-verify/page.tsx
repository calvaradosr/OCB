"use client"
import { useFormState, useFormStatus } from "react-dom"
import { verifyMFACode } from "@/app/actions/mfa"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
    >
      {pending ? "Verifying…" : "Verify code"}
    </button>
  )
}

export default function MFAVerifyPage() {
  const [state, action] = useFormState(verifyMFACode, undefined)

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-secondary-soft p-8">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-primary">one</span>
          <span className="text-3xl font-semibold text-ink"> Consulting</span>
          <div className="text-sm tracking-[0.3em] text-secondary uppercase">Business</div>
        </div>

        <h2 className="text-lg font-semibold text-ink mb-1">Two-factor verification</h2>
        <p className="text-sm text-muted mb-6">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form action={action} className="space-y-4">
          {state?.error && (
            <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
          )}
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
          <SubmitButton />
        </form>
      </div>
    </main>
  )
}
