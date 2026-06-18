import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import Sidebar from "@/components/Sidebar"
import { GlobalSearch } from "@/components/GlobalSearch"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  // Defense-in-depth: middleware handles this, but guard here too
  if (!session) redirect("/login")

  const { orgId } = session.user

  // FCRA overdue count for alert badge
  const overdueCount = can(session.user.role, "disputes:read")
    ? await db.disputeItem.count({
        where: {
          outcome: "PENDING",
          dueAt: { lt: new Date() },
          dispute: { client: { orgId } },
        },
      })
    : 0

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        userName={session.user.name ?? ""}
        userRole={session.user.role}
        overdueCount={overdueCount}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-12 border-b border-secondary-soft bg-white flex items-center px-6 gap-4 shrink-0">
          <div className="flex-1">
            <GlobalSearch />
          </div>
          {overdueCount > 0 && (
            <a href="/disputes" className="flex items-center gap-1.5 text-xs font-medium text-danger bg-danger/10 px-2.5 py-1 rounded-full hover:bg-danger/20 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              {overdueCount} FCRA overdue
            </a>
          )}
        </header>
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  )
}
