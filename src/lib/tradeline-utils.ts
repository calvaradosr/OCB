import { TradelineOrderStatus } from "@prisma/client"

export const ORDER_STATUSES: TradelineOrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "INFO_SENT_TO_VENDOR",
  "POSTED",
  "REMOVED",
  "CANCELLED",
]

export const ORDER_STATUS_LABELS: Record<TradelineOrderStatus, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  INFO_SENT_TO_VENDOR: "Info Sent to Vendor",
  POSTED: "Posted",
  REMOVED: "Removed",
  CANCELLED: "Cancelled",
}

export const ORDER_STATUS_COLORS: Record<TradelineOrderStatus, { bg: string; text: string }> = {
  PENDING_PAYMENT: { bg: "bg-secondary-soft", text: "text-muted" },
  PAID: { bg: "bg-blue-50", text: "text-blue-700" },
  INFO_SENT_TO_VENDOR: { bg: "bg-yellow-50", text: "text-warning" },
  POSTED: { bg: "bg-green-50", text: "text-success" },
  REMOVED: { bg: "bg-gray-100", text: "text-muted" },
  CANCELLED: { bg: "bg-danger/10", text: "text-danger" },
}

// Linear flow plus CANCELLED from any non-terminal state
export const VALID_ORDER_TRANSITIONS: Record<TradelineOrderStatus, TradelineOrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["INFO_SENT_TO_VENDOR", "CANCELLED"],
  INFO_SENT_TO_VENDOR: ["POSTED", "CANCELLED"],
  POSTED: ["REMOVED"],
  REMOVED: [],
  CANCELLED: [],
}

export function canOrderTransition(
  from: TradelineOrderStatus,
  to: TradelineOrderStatus
): boolean {
  return VALID_ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

// Card age in years from opening date to today
export function cardAgeYears(cardOpenedDate: Date): number {
  const ms = Date.now() - cardOpenedDate.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25))
}

// Format credit limit
export function formatLimit(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`
}

// Posting verification: check if a bank keyword appears in any report item's creditorName.
// This is the "differentiator" — we cross-check tradeline bank against imported bureau items.
export function checkPostingMatch(
  bankName: string,
  reportItems: { creditorName: string; onExperian: boolean; onEquifax: boolean; onTransunion: boolean }[]
): boolean {
  const keyword = bankName.toLowerCase().split(/\s+/)[0] // first word, e.g. "chase" from "Chase Sapphire"
  return reportItems.some(item =>
    item.creditorName.toLowerCase().includes(keyword)
  )
}

// Commission = retail price - vendor cost
export function calcCommission(retailPriceCents: number, vendorCostCents: number): number {
  return Math.max(0, retailPriceCents - vendorCostCents)
}
