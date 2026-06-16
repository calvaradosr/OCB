import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SetupForm from "./SetupForm"

export default async function SetupPage() {
  const adminCount = await db.user.count({ where: { role: "ADMIN" } })
  if (adminCount > 0) redirect("/login")

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-secondary-soft p-8">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-primary">one</span>
          <span className="text-3xl font-semibold text-ink"> Consulting</span>
          <div className="text-sm tracking-[0.3em] text-secondary uppercase">Business</div>
        </div>

        <h2 className="text-lg font-semibold text-ink mb-1">First-time setup</h2>
        <p className="text-sm text-muted mb-6">
          Create the initial administrator account to get started.
        </p>

        <SetupForm />

        <p className="mt-4 text-xs text-center text-muted">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline">Sign in</a>
        </p>
      </div>
    </main>
  )
}
