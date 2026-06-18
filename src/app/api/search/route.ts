import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const { orgId } = session.user
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const contains = { contains: q, mode: "insensitive" as const }

  const [clients, disputes, loanFiles] = await Promise.all([
    db.client.findMany({
      where: {
        orgId,
        OR: [
          { firstName: contains },
          { lastName: contains },
          { email: contains },
          { phone: contains },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true },
      take: 8,
    }),
    db.dispute.findMany({
      where: {
        client: {
          orgId,
          OR: [{ firstName: contains }, { lastName: contains }],
        },
      },
      select: {
        id: true,
        round: true,
        strategy: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.loanFile.findMany({
      where: {
        orgId,
        OR: [{ client: { firstName: contains } }, { client: { lastName: contains } }],
      },
      select: {
        id: true,
        status: true,
        client: { select: { firstName: true, lastName: true } },
      },
      take: 4,
    }),
  ])

  type Result = { id: string; type: string; title: string; sub: string; href: string }

  const results: Result[] = [
    ...clients.map(c => ({
      id: c.id,
      type: "client",
      title: `${c.firstName} ${c.lastName}`,
      sub: c.email ?? c.phone ?? c.status,
      href: `/clients/${c.id}`,
    })),
    ...disputes.map(d => ({
      id: d.id,
      type: "dispute",
      title: `${d.client.firstName} ${d.client.lastName} — Round ${d.round}`,
      sub: d.strategy.replace(/_/g, " ").toLowerCase(),
      href: `/clients/${d.client.id}/disputes/${d.id}`,
    })),
    ...loanFiles.map(l => ({
      id: l.id,
      type: "loan",
      title: `${l.client.firstName} ${l.client.lastName} — Loan`,
      sub: l.status.replace(/_/g, " "),
      href: `/loans/${l.id}`,
    })),
  ]

  return NextResponse.json(results)
}
