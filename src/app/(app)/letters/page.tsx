import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import Link from "next/link"
import { BUREAU_LABELS, LETTER_TARGET_LABELS } from "@/lib/report-utils"
import type { Prisma } from "@prisma/client"
import MarkSentButton from "./MarkSentButton"
import TrackingEditor from "./TrackingEditor"

const TARGET_FILTERS = [
  { value: "", label: "All types" },
  { value: "BUREAU", label: "Bureau" },
  { value: "FURNISHER", label: "Furnisher" },
  { value: "COLLECTOR", label: "Collector" },
  { value: "CFPB", label: "CFPB" },
  { value: "FTC", label: "FTC" },
  { value: "STATE_AG", label: "State AG" },
]

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "unsent", label: "Unsent" },
  { value: "sent", label: "Sent" },
]

const TARGET_COLORS: Record<string, string> = {
  BUREAU: "bg-primary/10 text-primary",
  FURNISHER: "bg-secondary/20 text-ink",
  COLLECTOR: "bg-secondary/20 text-ink",
  CFPB: "bg-success/10 text-success",
  FTC: "bg-success/10 text-success",
  STATE_AG: "bg-warning/10 text-warning",
}

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; target?: string; q?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!can(session.user.role, "disputes:read")) redirect("/dashboard")

  const { status = "", target = "", q = "" } = await searchParams

  const where: Prisma.LetterWhereInput = {}

  if (status === "unsent") where.sentAt = null
  if (status === "sent") where.sentAt = { not: null }
  if (target) where.target = target as never

  if (q) {
    where.client = {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    }
  }

  const letters = await db.letter.findMany({
    where,
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      dispute: { select: { id: true, round: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const totalUnsent = await db.letter.count({ where: { sentAt: null } })

  const canWrite = can(session.user.role, "disputes:write")

  function filterHref(overrides: Record<string, string>) {
    const params = new URLSearchParams()
    const merged = { status, target, q, ...overrides }
    if (merged.status) params.set("status", merged.status)
    if (merged.target) params.set("target", merged.target)
    if (merged.q) params.set("q", merged.q)
    const s = params.toString()
    return `/letters${s ? `?${s}` : ""}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Letters</h1>
          <p className="text-sm text-muted mt-0.5">Print queue — view, print, and track delivery of all dispute letters.</p>
        </div>
        {totalUnsent > 0 && (
          <span className="px-3 py-1.5 bg-warning/10 text-warning text-sm font-semibold rounded-full">
            {totalUnsent} unsent
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-secondary-soft overflow-hidden text-sm">
          {STATUS_FILTERS.map(f => (
            <Link
              key={f.value}
              href={filterHref({ status: f.value })}
              className={`px-3 py-1.5 ${status === f.value ? "bg-primary text-white font-medium" : "bg-white text-muted hover:text-ink"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Target filter */}
        <div className="flex rounded-lg border border-secondary-soft overflow-hidden text-sm">
          {TARGET_FILTERS.map(f => (
            <Link
              key={f.value}
              href={filterHref({ target: f.value })}
              className={`px-3 py-1.5 ${target === f.value ? "bg-primary text-white font-medium" : "bg-white text-muted hover:text-ink"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Client search */}
        <form method="get" action="/letters" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {target && <input type="hidden" name="target" value={target} />}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search client…"
            className="rounded-lg border border-secondary-soft px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary w-48"
          />
          <button type="submit" className="text-sm px-3 py-1.5 rounded-lg bg-secondary-soft text-ink hover:bg-secondary/30">
            Search
          </button>
          {q && (
            <Link href={filterHref({ q: "" })} className="text-sm text-muted hover:text-ink">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted">{letters.length} letter{letters.length !== 1 ? "s" : ""} shown</p>

      {/* Table */}
      {letters.length === 0 ? (
        <div className="border border-dashed border-secondary-soft rounded-xl p-16 text-center">
          <p className="text-muted text-sm">No letters match the current filters.</p>
          <p className="text-muted text-xs mt-1">Letters are generated when staff runs the dispute wizard on a client profile.</p>
        </div>
      ) : (
        <div className="border border-secondary-soft rounded-xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary-soft/30">
              <tr className="text-xs text-muted uppercase tracking-wide">
                <th className="py-3 px-4 text-left">Client</th>
                <th className="py-3 px-4 text-left">Type</th>
                <th className="py-3 px-4 text-left">Bureau</th>
                <th className="py-3 px-4 text-left">Dispute</th>
                <th className="py-3 px-4 text-left">Created</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-left">Tracking / #</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {letters.map(letter => {
                const isCFPBorFTC = letter.target === "CFPB" || letter.target === "FTC"
                const trackingValue = isCFPBorFTC ? letter.complaintNumber : letter.trackingNumber
                const trackingLabel = isCFPBorFTC ? "complaint #" : "tracking #"

                return (
                  <tr key={letter.id} className="hover:bg-secondary-soft/10">
                    <td className="py-3 px-4 font-medium text-ink">
                      <Link href={`/clients/${letter.client.id}`} className="hover:text-primary">
                        {letter.client.firstName} {letter.client.lastName}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TARGET_COLORS[letter.target] ?? "bg-secondary-soft text-muted"}`}>
                        {LETTER_TARGET_LABELS[letter.target] ?? letter.target}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted text-xs">
                      {letter.bureau ? (BUREAU_LABELS[letter.bureau as keyof typeof BUREAU_LABELS] ?? letter.bureau) : "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted">
                      {letter.dispute ? (
                        <Link
                          href={`/clients/${letter.client.id}/disputes/${letter.dispute.id}`}
                          className="hover:text-primary"
                        >
                          Round {letter.dispute.round}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted">
                      {letter.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4">
                      {letter.sentAt ? (
                        <div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">Sent</span>
                          <p className="text-xs text-muted mt-0.5">
                            {letter.sentAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Unsent</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {letter.sentAt && canWrite ? (
                        <TrackingEditor
                          letterId={letter.id}
                          current={trackingValue ?? null}
                          label={trackingLabel}
                        />
                      ) : (
                        <span className="text-xs text-muted">{trackingValue ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-end">
                        <a
                          href={`/api/letters/${letter.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-md border border-secondary-soft text-ink hover:border-primary/40 hover:text-primary font-medium"
                        >
                          View / Print
                        </a>
                        {!letter.sentAt && canWrite && (
                          <MarkSentButton letterId={letter.id} isCFPBorFTC={isCFPBorFTC} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
