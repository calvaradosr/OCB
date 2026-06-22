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

// ─── Dispute Reason Library (mirrors CRC's preset reason list) ───────────────

export type ReasonCategory = {
  category: string
  reasons: string[]
}

export const DISPUTE_REASON_LIBRARY: ReasonCategory[] = [
  {
    category: "Inaccurate Information",
    reasons: [
      "This account information is inaccurate and cannot be verified.",
      "The account balance reported is incorrect.",
      "The account status is being reported incorrectly.",
      "The date of last activity is being reported incorrectly.",
      "The date the account was opened is incorrect.",
      "The credit limit or high credit amount is reported incorrectly.",
      "The payment history contains errors.",
      "The account is listed as a collection account but it is not.",
      "The original creditor information is incorrect.",
      "This account was paid in full but is still showing a balance.",
      "This account was included in a bankruptcy but is not being reported as such.",
    ],
  },
  {
    category: "Not My Account",
    reasons: [
      "I do not recognize this account. It is not mine.",
      "This account was opened fraudulently without my knowledge or consent.",
      "This account belongs to another person with a similar name.",
      "I was an authorized user and am not responsible for this debt.",
      "This is a duplicate account already appearing on my report.",
      "This account was fraudulently opened as a result of identity theft.",
    ],
  },
  {
    category: "Debt Validation",
    reasons: [
      "Pursuant to the FDCPA, I request validation of this debt including: the amount owed, the name and address of the original creditor, and verification that you are licensed to collect in my state.",
      "I dispute this debt in its entirety and request the collector cease collection activities until proper validation is provided.",
      "The debt collector has failed to provide adequate validation of this debt as required by 15 U.S.C. § 1692g.",
      "I have never received notice of assignment of this debt from the original creditor.",
    ],
  },
  {
    category: "Outdated / Statute of Limitations",
    reasons: [
      "This account is past the 7-year reporting period and must be removed per FCRA § 605.",
      "This negative account has exceeded the maximum reportable time frame.",
      "The charge-off date exceeds the FCRA 7-year reporting limit.",
      "This collection account is past the statute of limitations for my state.",
      "This bankruptcy has exceeded the 10-year reporting period.",
    ],
  },
  {
    category: "FCRA Violations",
    reasons: [
      "The furnisher failed to conduct a reasonable reinvestigation of my prior dispute.",
      "This account is being re-aged — the date of first delinquency has been manipulated.",
      "The furnisher continued reporting after being notified of a dispute, in violation of FCRA § 623.",
      "This information was reported without my permissible purpose authorization.",
      "The credit bureau failed to forward my dispute to the data furnisher as required.",
      "I am requesting the method of verification used to substantiate this account.",
    ],
  },
  {
    category: "Identity / Personal Info",
    reasons: [
      "This address has never been associated with me and should be removed.",
      "This employer information is incorrect and should be updated.",
      "My name is spelled incorrectly. Please correct it.",
      "This Social Security Number variation does not belong to me.",
      "This inquiry was made without a permissible purpose. Please remove it immediately.",
      "I did not authorize this inquiry. This is an unauthorized hard inquiry.",
    ],
  },
  {
    category: "Medical Debt",
    reasons: [
      "This medical debt was paid by my health insurance carrier and should be removed.",
      "This medical collection violates HIPAA — the billing entity disclosed protected health information to the credit bureaus without proper authorization.",
      "Under the No Surprises Act, this bill is the subject of a billing dispute and should not be reported.",
      "Medical debt under $500 is exempt from credit reporting under current CFPB guidance.",
    ],
  },
  {
    category: "Goodwill / Paid Accounts",
    reasons: [
      "This account has been paid in full. As a goodwill gesture, I request removal of the negative history.",
      "I had an isolated late payment due to extenuating circumstances (medical emergency / job loss / natural disaster). I am otherwise an excellent customer and request a goodwill adjustment.",
      "This account is paid and closed. I request the negative remarks be removed as a courtesy.",
      "I request a pay-for-delete arrangement: upon payment in full I request this account be removed from all three credit bureaus.",
    ],
  },
]

export const STRATEGY_DEFAULT_REASONS: Record<string, string> = {
  INACCURATE: "This account information is inaccurate and cannot be verified.",
  NOT_MINE: "I do not recognize this account. It is not mine.",
  DEBT_VALIDATION: "Pursuant to the FDCPA, I request validation of this debt including: the amount owed, the name and address of the original creditor, and verification that you are licensed to collect in my state.",
  GOODWILL: "This account has been paid in full. As a goodwill gesture, I request removal of the negative history.",
  ID_THEFT: "This account was opened fraudulently without my knowledge or consent as a result of identity theft.",
  HIPAA_VIOLATION: "This medical debt violates HIPAA — the billing entity disclosed protected health information to the credit bureaus without proper authorization.",
  INQUIRY_REMOVAL: "I did not authorize this inquiry. This is an unauthorized hard inquiry and must be removed immediately.",
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
