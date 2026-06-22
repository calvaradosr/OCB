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
  const { orgId } = session.user

  const automations = await db.automation.findMany({
    where: { orgId },
    include: {
      _count: { select: { logs: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, result: true } },
    },
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

      {/* Quick-start templates */}
      {automations.length === 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest">Quick-start templates</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                title: "Welcome email",
                desc: "Send a welcome email when a new client is created",
                params: "trigger=CLIENT_CREATED&action=SEND_EMAIL",
              },
              {
                title: "FCRA 30-day reminder",
                desc: "Create a task when the 30-day reinvestigation clock expires",
                params: "trigger=FCRA_CLOCK_30_DAYS&action=CREATE_TASK",
              },
              {
                title: "Per-deletion invoice",
                desc: "Automatically invoice clients for each deleted dispute item (CROA compliant)",
                params: "trigger=DISPUTE_OUTCOME_DELETED&action=CHARGE_PER_DELETE",
              },
              {
                title: "FCRA 45-day reminder",
                desc: "Notify client via portal when the 45-day clock expires",
                params: "trigger=FCRA_CLOCK_45_DAYS&action=NOTIFY_CLIENT",
              },
              {
                title: "Overdue invoice alert",
                desc: "Send SMS when a client invoice becomes overdue",
                params: "trigger=INVOICE_OVERDUE&action=SEND_SMS",
              },
              {
                title: "Dispute outcome email",
                desc: "Email clients when any dispute outcome is recorded",
                params: "trigger=DISPUTE_OUTCOME_ANY&action=SEND_EMAIL",
              },
            ].map(t => (
              <Link
                key={t.title}
                href={`/automations/new?${t.params}`}
                className="bg-white rounded-xl border border-secondary-soft p-4 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-medium text-ink">{t.title}</p>
                <p className="text-xs text-muted mt-1">{t.desc}</p>
                <p className="text-xs text-primary mt-2 font-medium">Use template →</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-secondary-soft p-12 text-center">
          <p className="font-semibold text-ink mb-1">No automations yet</p>
          <p className="text-sm text-muted mb-4">Use a template above or create one from scratch.</p>
          <Link href="/automations/new" className="inline-flex px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
            Create from scratch
          </Link>
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
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Last run</th>
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
                  <td className="px-5 py-3 text-xs text-muted">
                    {a.logs[0] ? (
                      <span className={a.logs[0].result === "SUCCESS" ? "text-success" : "text-danger"}>
                        {a.logs[0].createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ) : "Never"}
                  </td>
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
