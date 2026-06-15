{{date}}

{{bureau.name}}
{{bureau.address}}

Re: Unauthorized Hard Inquiry — Request for Removal
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

I am writing to dispute the following unauthorized hard inquiry/inquiries that appear on my credit report. I did not authorize any of these inquiries and have no business relationship with these companies. The presence of unauthorized inquiries on my report constitutes a violation of the Fair Credit Reporting Act, 15 U.S.C. § 1681b, which permits access to consumer reports only for permissible purposes.

Unauthorized inquiries:
{{#each items}}
- Creditor: {{creditorName}} | Account: {{accountNumberMasked}} | Reason: {{reason}}
{{/each}}

I request that you immediately remove these unauthorized inquiries from my credit report and notify me in writing once the removal has been completed. If you cannot verify a permissible purpose for these inquiries, they must be deleted pursuant to FCRA § 1681i.

Please provide written confirmation of the removal or, if removal is denied, the basis for your determination and the name and contact information of the company that requested the inquiry.

Sincerely,

{{client.firstName}} {{client.lastName}}
