import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import Link from "next/link"
import AutomationForm from "../AutomationForm"

export default async function NewAutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ trigger?: string; action?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/automations")

  const { trigger, action } = await searchParams

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/automations" className="text-sm text-muted hover:text-ink transition-colors">← Automations</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">New Automation</h1>
      </div>
      <AutomationForm defaults={{ trigger: trigger as never, action: action as never }} />
    </div>
  )
}
