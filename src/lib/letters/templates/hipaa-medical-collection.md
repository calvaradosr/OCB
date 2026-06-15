{{date}}

{{bureau.name}}
{{bureau.address}}

Re: HIPAA Violation — Medical Collection Dispute
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

I am disputing the following medical collection(s) on my credit report on the basis of HIPAA violations and inaccurate reporting:

Items in dispute:
{{#each items}}
- Creditor/Provider: {{creditorName}} | Account: {{accountNumberMasked}} | Issue: {{reason}}
{{/each}}

Medical information is protected health information (PHI) under the Health Insurance Portability and Accountability Act (HIPAA) of 1996. The reporting of my medical debt by a third-party collector requires my written authorization. I did not authorize the disclosure of my protected health information for credit reporting purposes.

I request:
1. Immediate deletion of the above medical collection account(s) from my credit report.
2. Written verification that you have obtained my HIPAA-compliant written authorization prior to reporting this information.
3. If you cannot provide written authorization, deletion of these entries within 30 days.

Additionally, under the Fair Credit Reporting Act § 1681i, these accounts are disputed. If they cannot be verified as accurate, complete, and properly authorized, they must be deleted.

Sincerely,

{{client.firstName}} {{client.lastName}}
