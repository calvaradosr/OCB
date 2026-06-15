{{date}}

{{bureau.name}}
{{bureau.address}}

Re: Demand for Reinvestigation — Continued Dispute
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

I previously submitted a dispute regarding the following items on my credit report. I have received your response; however, the information remains inaccurate or unverifiable, and I have reason to believe a proper reinvestigation was not conducted in accordance with the Fair Credit Reporting Act, 15 U.S.C. § 1681i.

Items that require reinvestigation:
{{#each items}}
- Creditor: {{creditorName}} | Account: {{accountNumberMasked}} | Issue: {{reason}}
{{/each}}

Pursuant to FCRA § 1681i(a)(6), I request that you provide me with a written description of the procedure used to determine the accuracy and completeness of the disputed information, including the name, business address, and telephone number of any furnisher contacted.

If you cannot verify these items within the legally required period, they must be promptly deleted from my file.

Sincerely,

{{client.firstName}} {{client.lastName}}
