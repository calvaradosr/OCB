"use client"
import { useState, useTransition } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, LogIn } from "lucide-react"

export default function LoginPage() {
  const [error, setError]     = useState("")
  const [showPw, setShowPw]   = useState(false)
  const [isPending, startTransition] = useTransition()
  const router    = useRouter()
  const params    = useSearchParams()
  const setupDone = params.get("setup") === "done"

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn("credentials", {
        redirect: false,
        email: data.get("email"),
        password: data.get("password"),
      })
      if (result?.error) { setError("Invalid email or password."); return }
      router.push("/dashboard")
      router.refresh()
    })
  }

  const field = "w-full rounded-lg border border-secondary-soft bg-canvas px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #DFC17220 0%, transparent 50%), radial-gradient(circle at 80% 20%, #A8862B15 0%, transparent 50%)" }} />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-secondary-soft/80 px-8 py-9">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
              <span className="text-xl font-bold text-primary">O</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-primary">one</span>
              <span className="text-2xl font-semibold text-ink"> Consulting</span>
            </div>
            <div className="text-[10px] tracking-[0.35em] text-muted uppercase mt-0.5">Business</div>
          </div>

          <h1 className="text-base font-semibold text-ink mb-5 text-center">Sign in to your account</h1>

          {setupDone && (
            <p className="text-sm text-success bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4 text-center">
              Account created — sign in below.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">{error}</p>
            )}

            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Email</label>
              <input name="email" type="email" required placeholder="you@company.com" className={field} />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className={field + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium py-3 text-sm transition-colors mt-2"
            >
              <LogIn size={15} />
              {isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          First time?{" "}
          <a href="/setup" className="text-primary hover:underline">Create the first admin account</a>
        </p>
      </div>
    </main>
  )
}
