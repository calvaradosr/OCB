import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return { session, orgId: session.user.orgId ?? "ocb" }
}
