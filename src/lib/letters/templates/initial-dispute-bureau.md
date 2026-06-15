{{date}}

{{bureau.name}}
{{bureau.address}}

Re: Request for investigation of inaccurate information
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

I am writing to dispute the following information that appears on my credit report maintained by your agency. After reviewing my report, I have identified the items below as inaccurate or unverifiable. Under the Fair Credit Reporting Act, 15 U.S.C. § 1681i, I request that you conduct a reasonable reinvestigation of each item and delete or correct any information that cannot be verified as accurate and complete.

Items in dispute:
{{#each items}}
- Creditor: {{creditorName}} | Account: {{accountNumberMasked}} | Reason: {{reason}}
{{/each}}

Please complete your reinvestigation within the time required by law and send me written results, along with a free updated copy of my report if any changes are made. If you rely on the furnisher's verification, I request the method of verification used.

Enclosed: copy of government-issued ID and proof of address.

Sincerely,

{{client.firstName}} {{client.lastName}}
