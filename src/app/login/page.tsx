"use client"
import { useState, useTransition } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await signIn("credentials", {
        redirect: false,
        email: data.get("email"),
        password: data.get("password"),
      })

      if (result?.error) {
        setError("Invalid email or password.")
        return
      }

      // Middleware will redirect to /auth/mfa-verify (if MFA pending),
      // /auth/mfa-setup (if MFA not enrolled), or /dashboard.
      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-secondary-soft p-8">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-primary">one</span>
          <span className="text-3xl font-semibold text-ink"> Consulting</span>
          <div className="text-sm tracking-[0.3em] text-secondary uppercase">Business</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-lg border border-secondary-soft px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full rounded-lg border border-secondary-soft px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  )
}
