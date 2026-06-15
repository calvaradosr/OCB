import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import { AutomationTrigger, AutomationAction } from "@prisma/client"
import DeleteAutomationButton from "./DeleteAutomationButton"

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  REPORT_IMPORTED: "Report imported",
  DISPUTE_OUTCOME_DELETED: "Dispute item deleted",
  DISPUTE_OUTCOME_ANY: "Any dispute outcome",
  FCRA_CLOCK_30_DAYS: "FCRA 30-day clock",
  FCRA_CLOCK_45_DAYS: "FCRA 45-day clock",
  CLIENT_CREATED: "New client created",
  INVOICE_OVERDUE: "Invoice overdue",
}

const ACTION_LABELS: Record<AutomationAction, string> = {
  SEND_EMAIL: "Send email",
  SEND_SMS: "Send SMS",
  CREATE_TASK: "Create task",
  CHARGE_PER_DELETE: "Per-deletion invoice",
  NOTIFY_CLIENT: "Portal message",
}

export default async function AutomationsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/dashboard")

  const automations = await db.automation.findMany({
    include: { _count: { select: { logs: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Automations</h1>
          <p className="text-sm text-muted mt-1">{automations.filter(a => a.active).length} active rules</p>
        </div>
        <Link href="/automations/new" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
          + New Automation
        </Link>
      </div>

      {automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-soft p-12 text-center">
          <p className="text-muted text-sm">No automations yet.</p>
          <p className="text-xs text-muted mt-1">Create rules to send emails, SMS, or tasks when events happen.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Name</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">When</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Then</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Runs</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {automations.map(a => (
                <tr key={a.id} className={`hover:bg-secondary-soft/20 ${!a.active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 font-medium text-ink">{a.name}</td>
                  <td className="px-5 py-3 text-muted text-xs">{TRIGGER_LABELS[a.trigger]}</td>
                  <td className="px-5 py-3 text-muted text-xs">{ACTION_LABELS[a.action]}</td>
                  <td className="px-5 py-3 text-muted text-xs">{a._count.logs}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.active ? "bg-green-50 text-success" : "bg-secondary-soft text-muted"}`}>
                      {a.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/automations/${a.id}/edit`} className="text-xs text-primary hover:underline">Edit</Link>
                      <DeleteAutomationButton id={a.id} name={a.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
