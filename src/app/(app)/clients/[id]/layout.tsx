import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { ClientTabBar } from "@/components/ClientTabBar"

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "clients:read")) redirect("/dashboard")

  const { id } = await params

  const exists = await db.client.count({ where: { id } })
  if (!exists) notFound()

  return (
    <div>
      {/* Horizontal sub-navigation — CRC-style tab bar */}
      <div className="mb-6">
        <ClientTabBar clientId={id} />
      </div>

      {children}
    </div>
  )
}
