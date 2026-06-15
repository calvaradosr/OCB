import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import SendAgreementForm from "./SendAgreementForm"

export default async function ClientAgreementsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "clients:read")) redirect("/dashboard")

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
      agreements: {
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!client) redirect("/clients")

  const STATUS_LABEL: Record<string, string> = {
    PENDING: "Pending signature",
    SIGNED: "Signed",
    DECLINED: "Declined",
    EXPIRED: "Expired",
  }

  const STATUS_COLOR: Record<string, string> = {
    PENDING: "text-warning",
    SIGNED: "text-success",
    DECLINED: "text-danger",
    EXPIRED: "text-muted",
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">
        Agreements — {client.firstName} {client.lastName}
      </h2>

      {can(session.user.role, "clients:write") && (
        <div className="bg-white rounded-lg border border-secondary-soft p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Send Agreement</h3>
          <SendAgreementForm
            clientId={clientId}
            clientName={`${client.firstName} ${client.lastName}`}
            clientAddress={[client.addressLine1, client.city, client.state, client.zip]
              .filter(Boolean)
              .join(", ")}
            agentName={session.user.name ?? ""}
          />
        </div>
      )}

      {client.agreements.length > 0 && (
        <div className="bg-white rounded-lg border border-secondary-soft divide-y divide-secondary-soft">
          {client.agreements.map(a => (
            <div key={a.id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">
                  {a.type.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Sent {a.sentAt.toLocaleDateString()}
                  {a.signedAt && ` · Signed ${a.signedAt.toLocaleDateString()}`}
                </p>
              </div>
              <span className={`text-xs font-medium ${STATUS_COLOR[a.status] ?? "text-muted"}`}>
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {client.agreements.length === 0 && (
        <p className="text-sm text-muted">No agreements sent yet.</p>
      )}
    </div>
  )
}
