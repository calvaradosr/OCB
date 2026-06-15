import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/Sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  // Defense-in-depth: middleware handles this, but guard here too
  if (!session) redirect("/login")
  if (session.user.mfaEnabled && !session.user.mfaVerified) redirect("/auth/mfa-verify")

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar userName={session.user.name ?? ""} userRole={session.user.role} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
