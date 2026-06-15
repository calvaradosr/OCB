import { LoanStatus, LoanType } from "@prisma/client"

export const LOAN_STATUSES: LoanStatus[] = [
  "INTAKE",
  "PRE_QUAL",
  "DOCS_COLLECTION",
  "PROCESSING",
  "SUBMITTED",
  "CONDITIONAL_APPROVAL",
  "CLEAR_TO_CLOSE",
  "FUNDED",
  "DECLINED",
  "WITHDRAWN",
]

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  INTAKE: "Intake",
  PRE_QUAL: "Pre-Qual",
  DOCS_COLLECTION: "Docs Collection",
  PROCESSING: "Processing",
  SUBMITTED: "Submitted to Lender",
  CONDITIONAL_APPROVAL: "Conditional Approval",
  CLEAR_TO_CLOSE: "Clear to Close",
  FUNDED: "Funded",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
}

export const LOAN_STATUS_COLORS: Record<LoanStatus, { bg: string; text: string }> = {
  INTAKE: { bg: "bg-secondary-soft", text: "text-ink" },
  PRE_QUAL: { bg: "bg-blue-50", text: "text-blue-700" },
  DOCS_COLLECTION: { bg: "bg-purple-50", text: "text-purple-700" },
  PROCESSING: { bg: "bg-yellow-50", text: "text-warning" },
  SUBMITTED: { bg: "bg-orange-50", text: "text-orange-700" },
  CONDITIONAL_APPROVAL: { bg: "bg-amber-50", text: "text-amber-700" },
  CLEAR_TO_CLOSE: { bg: "bg-green-50", text: "text-success" },
  FUNDED: { bg: "bg-primary/10", text: "text-primary-dark" },
  DECLINED: { bg: "bg-danger/10", text: "text-danger" },
  WITHDRAWN: { bg: "bg-gray-100", text: "text-muted" },
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Business",
  AUTO: "Auto",
  MORTGAGE: "Mortgage",
  SBA_7A: "SBA 7(a)",
  SBA_504: "SBA 504",
  OTHER: "Other",
}

// Pipeline stages in forward order (terminal statuses excluded from stepper)
export const PIPELINE_STAGES: LoanStatus[] = [
  "INTAKE",
  "PRE_QUAL",
  "DOCS_COLLECTION",
  "PROCESSING",
  "SUBMITTED",
  "CONDITIONAL_APPROVAL",
  "CLEAR_TO_CLOSE",
  "FUNDED",
]

export const TERMINAL_STATUSES: LoanStatus[] = ["FUNDED", "DECLINED", "WITHDRAWN"]

// Allowed forward/backward transitions
export const VALID_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  INTAKE: ["PRE_QUAL", "WITHDRAWN"],
  PRE_QUAL: ["DOCS_COLLECTION", "DECLINED", "WITHDRAWN", "INTAKE"],
  DOCS_COLLECTION: ["PROCESSING", "PRE_QUAL", "WITHDRAWN"],
  PROCESSING: ["SUBMITTED", "DOCS_COLLECTION", "WITHDRAWN"],
  SUBMITTED: ["CONDITIONAL_APPROVAL", "PROCESSING", "DECLINED", "WITHDRAWN"],
  CONDITIONAL_APPROVAL: ["CLEAR_TO_CLOSE", "SUBMITTED", "DECLINED", "WITHDRAWN"],
  CLEAR_TO_CLOSE: ["FUNDED", "CONDITIONAL_APPROVAL", "WITHDRAWN"],
  FUNDED: [],
  DECLINED: [],
  WITHDRAWN: [],
}

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// Document categories required per loan type
export const LOAN_DOC_CHECKLIST: Record<LoanType, string[]> = {
  PERSONAL: ["PAYSTUB", "BANK_STATEMENT", "TAX_RETURN"],
  BUSINESS: ["BANK_STATEMENT", "TAX_RETURN", "BUSINESS_FINANCIALS", "ARTICLES"],
  AUTO: ["PAYSTUB", "BANK_STATEMENT"],
  MORTGAGE: ["PAYSTUB", "W2", "TAX_RETURN", "BANK_STATEMENT", "PURCHASE_AGREEMENT"],
  SBA_7A: ["BANK_STATEMENT", "TAX_RETURN", "BUSINESS_FINANCIALS", "ARTICLES"],
  SBA_504: ["BANK_STATEMENT", "TAX_RETURN", "BUSINESS_FINANCIALS", "ARTICLES"],
  OTHER: ["BANK_STATEMENT"],
}

export const LOAN_DOC_LABELS: Record<string, string> = {
  PAYSTUB: "Pay Stubs (2 months)",
  BANK_STATEMENT: "Bank Statements (3 months)",
  TAX_RETURN: "Tax Returns (2 years)",
  W2: "W-2s (2 years)",
  BUSINESS_FINANCIALS: "Business Financials (2 years)",
  ARTICLES: "Articles of Incorporation / Formation",
  PURCHASE_AGREEMENT: "Purchase Agreement",
  APPRAISAL: "Property Appraisal",
  OTHER: "Other",
}

// Credit-readiness threshold: suggest loan conversion when scores reach this
export const CREDIT_READINESS_THRESHOLD = 620

export function isCreditReady(
  scores: { experian: number | null; equifax: number | null; transunion: number | null },
  threshold = CREDIT_READINESS_THRESHOLD
): boolean {
  const valid = [scores.experian, scores.equifax, scores.transunion].filter(
    (s): s is number => s != null
  )
  if (valid.length === 0) return false
  return Math.min(...valid) >= threshold
}
