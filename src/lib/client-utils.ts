// Pure utilities for client/lead business logic — tested without Prisma.

export const CLIENT_STATUSES = [
  "LEAD",
  "CONTACTED",
  "CONSULT_SCHEDULED",
  "SIGNED",
  "ACTIVE",
  "PAUSED",
  "COMPLETE",
] as const

export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacted",
  CONSULT_SCHEDULED: "Consult Scheduled",
  SIGNED: "Signed",
  ACTIVE: "Active Client",
  PAUSED: "Paused",
  COMPLETE: "Complete",
}

export const STATUS_COLORS: Record<
  ClientStatus,
  { bg: string; text: string }
> = {
  LEAD: { bg: "bg-secondary-soft", text: "text-ink" },
  CONTACTED: { bg: "bg-blue-50", text: "text-blue-700" },
  CONSULT_SCHEDULED: { bg: "bg-purple-50", text: "text-purple-700" },
  SIGNED: { bg: "bg-yellow-50", text: "text-warning" },
  ACTIVE: { bg: "bg-green-50", text: "text-success" },
  PAUSED: { bg: "bg-gray-100", text: "text-muted" },
  COMPLETE: { bg: "bg-primary/10", text: "text-primary-dark" },
}

export const DOCUMENT_CATEGORIES = [
  "ID",
  "PROOF_OF_ADDRESS",
  "AGREEMENT",
  "UTILITY_BILL",
  "OTHER",
] as const

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  ID: "Government ID",
  PROOF_OF_ADDRESS: "Proof of Address",
  AGREEMENT: "Service Agreement",
  UTILITY_BILL: "Utility Bill",
  OTHER: "Other",
}

export function isValidStatus(s: string): s is ClientStatus {
  return CLIENT_STATUSES.includes(s as ClientStatus)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Generates a CSV string from an array of plain objects (no PII).
export function buildCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`
  return [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ].join("\n")
}
