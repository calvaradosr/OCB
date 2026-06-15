// CROA-compliant agreement templates with merge fields.
// IMPORTANT: Do NOT use guaranteed-outcome language in any template (CROA §1679b(b)(2)).

export type AgreementMergeFields = {
  clientName: string
  clientAddress: string
  agentName: string
  companyName: string
  startDate: string
  setupFeeCents: number
  monthlyFeeCents: number
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export function renderClientAgreement(fields: AgreementMergeFields): string {
  return `
ONE CONSULTING BUSINESS — CREDIT REPAIR SERVICES AGREEMENT
(Credit Repair Organizations Act Compliant)

Date: ${fields.startDate}

CLIENT: ${fields.clientName}
Address: ${fields.clientAddress}

SERVICE PROVIDER: ${fields.companyName}

─────────────────────────────────────────────

1. SERVICES

${fields.companyName} ("Company") agrees to provide credit dispute and consulting services on behalf of ${fields.clientName} ("Client"). Services include reviewing credit reports, preparing dispute correspondence to credit reporting agencies and furnishers, and providing guidance on credit improvement strategies.

2. FEES

Setup Fee: ${dollars(fields.setupFeeCents)} (due after initial credit review is completed)
Monthly Service Fee: ${dollars(fields.monthlyFeeCents)} per month (billed in arrears after each month of service is performed)

Pursuant to the Credit Repair Organizations Act (15 U.S.C. § 1679b), no fee is charged until after the contracted services have been fully performed.

3. TERM AND CANCELLATION

This Agreement begins on ${fields.startDate}. Either party may cancel with 30 days' written notice.

RIGHT TO CANCEL: You may cancel this contract, without any penalty or obligation, at any time before midnight of the 3rd business day after the date you sign this contract. To cancel, mail or deliver a signed, dated copy of the cancellation notice (see attached) to: ${fields.companyName}.

4. NO GUARANTEE

IMPORTANT NOTICE: The Company cannot guarantee any particular result. Results vary based on individual credit history and bureau responses. No employee or agent of the Company is authorized to make any guarantee of credit score improvement or item removal.

5. CLIENT RESPONSIBILITIES

Client agrees to: (a) provide accurate personal information, (b) supply required identification documents, (c) notify Company of any direct bureau communications received.

6. DISPUTE RESOLUTION

Any dispute arising under this Agreement shall be resolved by binding arbitration in accordance with the American Arbitration Association rules.

Signed by: ${fields.clientName}
Date: __________________   Signature: _______________________
`.trim()
}

export function renderCancellationNotice(fields: Pick<AgreementMergeFields, "clientName" | "companyName" | "startDate">): string {
  return `
ONE CONSULTING BUSINESS — NOTICE OF RIGHT TO CANCEL

Date of Contract: ${fields.startDate}
Client: ${fields.clientName}
Company: ${fields.companyName}

─────────────────────────────────────────────

NOTICE OF CANCELLATION

You may cancel this contract, without any penalty or obligation, within THREE (3) BUSINESS DAYS from the date of this contract.

If you cancel, any payment made by you under this contract will be returned within 10 days of the date on which we receive your cancellation notice.

To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice, or any other written notice, to:

${fields.companyName}
[Company Address]

Not later than midnight of the 3rd business day after the contract date.

─────────────────────────────────────────────

I hereby cancel this transaction.

Name: ${fields.clientName}
Date: __________________   Signature: _______________________
`.trim()
}

export function renderPOA(fields: Pick<AgreementMergeFields, "clientName" | "agentName" | "companyName" | "startDate">): string {
  return `
ONE CONSULTING BUSINESS — LIMITED POWER OF ATTORNEY

Date: ${fields.startDate}
Grantor: ${fields.clientName}
Attorney-in-Fact: ${fields.companyName}

─────────────────────────────────────────────

I, ${fields.clientName}, hereby grant limited power of attorney to ${fields.companyName} and its authorized representatives for the limited purpose of:

1. Sending dispute letters to Equifax, Experian, and TransUnion on my behalf.
2. Corresponding with creditors and collection agencies to dispute inaccurate items.
3. Submitting complaints to the Consumer Financial Protection Bureau (CFPB) and Federal Trade Commission (FTC) on my behalf.

This power of attorney does NOT authorize the Attorney-in-Fact to:
- Make any financial decisions or sign financial instruments.
- Access funds, accounts, or assets.
- Obligate me to any contract.

This limited power of attorney is effective as of ${fields.startDate} and remains in effect until either party provides written cancellation.

Name: ${fields.clientName}
Date: __________________   Signature: _______________________
`.trim()
}
