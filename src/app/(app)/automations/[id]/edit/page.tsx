import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import AutomationForm from "../../AutomationForm"

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/automations")

  const automation = await db.automation.findUnique({ where: { id } })
  if (!automation) notFound()

  const cfg = automation.actionConfig as Record<string, unknown>
  const cond = (automation.conditions ?? {}) as Record<string, string>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/automations" className="text-sm text-muted hover:text-ink transition-colors">← Automations</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Edit Automation</h1>
      </div>
      <AutomationForm
        defaults={{
          id: automation.id,
          name: automation.name,
          trigger: automation.trigger,
          action: automation.action,
          actionSubject: String(cfg.subject ?? ""),
          actionBody: String(cfg.html ?? cfg.body ?? cfg.task ?? ""),
          actionAmountCents: String(cfg.amountCents ?? ""),
          conditionModule: cond.module ?? "",
          active: automation.active,
        }}
      />
    </div>
  )
}
