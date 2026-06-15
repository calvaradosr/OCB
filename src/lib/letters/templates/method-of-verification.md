{{date}}

{{bureau.name}}
{{bureau.address}}

Re: Request for Method of Verification
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

Pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681i(a)(6), I request a full description of the procedure you used to determine the accuracy and completeness of the following disputed items, including the name, address, and telephone number of any furnisher or other person contacted during the reinvestigation:

Items in question:
{{#each items}}
- Creditor: {{creditorName}} | Account: {{accountNumberMasked}} | Dispute basis: {{reason}}
{{/each}}

Specifically, I request:
1. The name and address of the person or entity that verified these items.
2. The date of verification.
3. The documents or information relied upon to complete the verification.
4. A copy of all documentation provided by the furnisher(s) in response to my dispute.

If you are unable to provide this documentation, the disputed items must be deleted. Please send your response to the address above within 15 days of receipt of this letter.

Sincerely,

{{client.firstName}} {{client.lastName}}
