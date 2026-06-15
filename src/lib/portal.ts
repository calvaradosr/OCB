import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

// Returns the Client record associated with the current CLIENT-role session.
// Redirects to /login if unauthenticated or not CLIENT role.
export async function getPortalClient() {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") redirect("/login")

  const client = await db.client.findFirst({
    where: { portalUserId: session.user.id },
  })

  if (!client) redirect("/login")
  return { client, session }
}
