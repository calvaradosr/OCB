{{date}}

{{bureau.name}}
{{bureau.address}}

Re: Identity Theft — Request to Block Fraudulent Information
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

I am a victim of identity theft. I am writing to request that you block the following fraudulent information from my credit report pursuant to Section 605B of the Fair Credit Reporting Act (15 U.S.C. § 1681c-2), which requires consumer reporting agencies to block the reporting of information that the consumer identifies as information that resulted from an alleged identity theft.

Fraudulent items to be blocked:
{{#each items}}
- Creditor: {{creditorName}} | Account: {{accountNumberMasked}} | Reason: {{reason}}
{{/each}}

Enclosed with this letter you will find (or I am prepared to provide upon request):
1. A copy of my valid government-issued identification.
2. Proof of my current address.
3. A copy of my identity theft report (FTC Report or police report).

Under 15 U.S.C. § 1681c-2(a), you are required to block this information within four business days of receiving this request, provided you have received a copy of the identity theft report. Please confirm in writing that the block has been applied.

Sincerely,

{{client.firstName}} {{client.lastName}}
