import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import Link from "next/link"

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/dashboard")

  const items = [
    {
      href: "/settings/users",
      title: "Users",
      desc: "Invite staff, assign roles, reset MFA and passwords.",
    },
    {
      href: "/settings/audit-log",
      title: "Audit Log",
      desc: "GLBA-required access trail — every view, create, update, and export.",
    },
    {
      href: "/automations",
      title: "Automations",
      desc: "Trigger-based rules for email, SMS, tasks, and invoices.",
    },
    {
      href: "/affiliates",
      title: "Affiliates",
      desc: "Manage referral partners and commission payouts.",
    },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>

      <div className="space-y-3">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="block bg-white rounded-xl border border-secondary-soft p-5 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="text-sm text-muted mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-secondary-soft bg-secondary-soft/30 p-5">
        <p className="text-xs text-muted font-semibold uppercase tracking-widest mb-2">Environment</p>
        <div className="space-y-1 text-xs text-muted">
          {[
            ["Stripe", process.env.STRIPE_SECRET_KEY ? "Configured" : "Not set"],
            ["Twilio SMS", process.env.TWILIO_ACCOUNT_SID ? "Configured" : "Not set"],
            ["AWS SES", process.env.AWS_ACCESS_KEY_ID ? "Configured" : "Not set"],
            ["S3 Bucket", process.env.S3_DOCUMENTS_BUCKET || "Not set"],
            ["CRON_SECRET", process.env.CRON_SECRET ? "Set" : "Not set"],
          ].map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span>{key}</span>
              <span className={val === "Not set" ? "text-warning" : "text-success"}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
