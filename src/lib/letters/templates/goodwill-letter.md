{{date}}

{{bureau.name}}
{{bureau.address}}

Re: Goodwill Adjustment Request
Name: {{client.firstName}} {{client.lastName}}
Address: {{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}

To Whom It May Concern:

I am writing to respectfully request a goodwill adjustment to remove the following negative item(s) from my credit report. I acknowledge that this account reflects a period of financial difficulty; however, I have since worked to resolve my obligations and rebuild my financial standing.

Account(s):
{{#each items}}
- Creditor: {{creditorName}} | Account: {{accountNumberMasked}} | Reason: {{reason}}
{{/each}}

I am otherwise a responsible consumer and this mark does not accurately represent my current creditworthiness. Many creditors and reporting agencies extend goodwill adjustments in recognition of an otherwise positive payment history and demonstrated commitment to financial responsibility.

I respectfully ask that you consider removing this derogatory mark as a gesture of goodwill. I would greatly appreciate any assistance you can provide. I remain committed to maintaining a positive credit profile going forward.

Thank you for your time and consideration.

Sincerely,

{{client.firstName}} {{client.lastName}}
