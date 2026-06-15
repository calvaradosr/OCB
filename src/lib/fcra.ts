// FCRA §611 reinvestigation timelines. All clock math is pure so it's testable.
export function calculateDueDate(sentAt: Date, foreignBureau = false): Date {
  const days = foreignBureau ? 45 : 30
  const due = new Date(sentAt)
  due.setDate(due.getDate() + days)
  return due
}

export function isOverdue(dueAt: Date, asOf: Date = new Date()): boolean {
  return asOf > dueAt
}

export function daysRemaining(dueAt: Date, asOf: Date = new Date()): number {
  const ms = dueAt.getTime() - asOf.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function clockLabel(sentAt: Date | null, dueAt: Date | null): string {
  if (!sentAt) return "Not sent"
  if (!dueAt) return "Sent"
  const remaining = daysRemaining(dueAt)
  if (remaining <= 0) return `Overdue by ${Math.abs(remaining)} day${Math.abs(remaining) !== 1 ? "s" : ""}`
  return `${remaining} day${remaining !== 1 ? "s" : ""} remaining`
}
