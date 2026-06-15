export const ITEM_TYPES = [
  "COLLECTION",
  "CHARGE_OFF",
  "LATE_PAYMENT",
  "INQUIRY",
  "REPOSSESSION",
  "BANKRUPTCY",
  "JUDGMENT",
  "TAX_LIEN",
  "PERSONAL_INFO",
  "OTHER",
] as const

export type ItemTypeValue = (typeof ITEM_TYPES)[number]

export const ITEM_TYPE_LABELS: Record<ItemTypeValue, string> = {
  COLLECTION: "Collection",
  CHARGE_OFF: "Charge-Off",
  LATE_PAYMENT: "Late Payment",
  INQUIRY: "Hard Inquiry",
  REPOSSESSION: "Repossession",
  BANKRUPTCY: "Bankruptcy",
  JUDGMENT: "Judgment",
  TAX_LIEN: "Tax Lien",
  PERSONAL_INFO: "Personal Info",
  OTHER: "Other",
}

// These types are auto-flagged when a report is imported
export const AUTO_FLAG_TYPES = new Set<string>([
  "COLLECTION",
  "CHARGE_OFF",
  "LATE_PAYMENT",
  "REPOSSESSION",
  "BANKRUPTCY",
  "JUDGMENT",
  "TAX_LIEN",
  "INQUIRY",
])

export const ITEM_TYPE_SEVERITY: Record<ItemTypeValue, "danger" | "warning" | "info"> = {
  COLLECTION: "danger",
  CHARGE_OFF: "danger",
  REPOSSESSION: "danger",
  BANKRUPTCY: "danger",
  JUDGMENT: "danger",
  TAX_LIEN: "danger",
  LATE_PAYMENT: "warning",
  INQUIRY: "warning",
  PERSONAL_INFO: "info",
  OTHER: "info",
}

export const DISPUTE_STRATEGIES = [
  { value: "NOT_MINE", label: "Not mine / Unauthorized account" },
  { value: "INACCURATE", label: "Inaccurate information" },
  { value: "DEBT_VALIDATION", label: "Debt validation request" },
  { value: "GOODWILL", label: "Goodwill adjustment" },
  { value: "ID_THEFT", label: "Identity theft block" },
  { value: "HIPAA_VIOLATION", label: "HIPAA violation (medical debt)" },
  { value: "INQUIRY_REMOVAL", label: "Unauthorized inquiry removal" },
] as const

export type DisputeStrategy = (typeof DISPUTE_STRATEGIES)[number]["value"]

export const STRATEGY_TEMPLATES: Record<string, string[]> = {
  NOT_MINE: ["initial-dispute-bureau", "identity-theft-block"],
  INACCURATE: ["initial-dispute-bureau", "reinvestigation", "method-of-verification"],
  DEBT_VALIDATION: ["debt-validation-collector"],
  GOODWILL: ["goodwill-letter", "pay-for-delete"],
  ID_THEFT: ["identity-theft-block", "initial-dispute-bureau"],
  HIPAA_VIOLATION: ["hipaa-medical-collection"],
  INQUIRY_REMOVAL: ["inquiry-removal", "initial-dispute-bureau"],
}

export const TEMPLATE_LABELS: Record<string, string> = {
  "initial-dispute-bureau": "Initial Dispute Letter (Bureau)",
  "reinvestigation": "Reinvestigation Demand",
  "method-of-verification": "Method of Verification Request",
  "goodwill-letter": "Goodwill Adjustment Letter",
  "pay-for-delete": "Pay-for-Delete Offer",
  "debt-validation-collector": "Debt Validation (Collector)",
  "identity-theft-block": "Identity Theft Block Notice",
  "inquiry-removal": "Unauthorized Inquiry Removal",
  "hipaa-medical-collection": "HIPAA Medical Collection",
  "cfpb-complaint": "CFPB Complaint",
  "ftc-identity-theft": "FTC Identity Theft Report",
  "state-ag-complaint": "State AG Complaint",
}

export const BUREAUS = ["EXPERIAN", "EQUIFAX", "TRANSUNION"] as const
export type BureauValue = (typeof BUREAUS)[number]

export const BUREAU_LABELS: Record<BureauValue, string> = {
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax",
  TRANSUNION: "TransUnion",
}

export const DISPUTE_OUTCOME_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DELETED: "Deleted",
  REPAIRED: "Repaired",
  VERIFIED: "Verified",
  NO_RESPONSE: "No Response",
}

export const DISPUTE_OUTCOME_COLORS: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  DELETED: "bg-success/10 text-success",
  REPAIRED: "bg-primary/10 text-primary",
  VERIFIED: "bg-danger/10 text-danger",
  NO_RESPONSE: "bg-muted/10 text-muted",
}

export const LETTER_TARGET_LABELS: Record<string, string> = {
  BUREAU: "Bureau",
  FURNISHER: "Furnisher",
  COLLECTOR: "Collector",
  CFPB: "CFPB",
  FTC: "FTC",
  STATE_AG: "State AG",
}
