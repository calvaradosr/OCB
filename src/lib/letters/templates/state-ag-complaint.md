{{date}}

Office of the Attorney General — Consumer Protection Division
State of {{client.state}}

Re: Complaint regarding credit reporting / debt collection practices

Dear Attorney General:

I am a resident of {{client.state}} and am filing this complaint regarding the following companies' handling of inaccurate information on my credit reports. Despite my written disputes, the items below remain inaccurate or unverified:

{{#each items}}
- Company: {{creditorName}} | Account: {{accountNumberMasked}} | Issue: {{reason}}
{{/each}}

I respectfully request that your office review these practices. I am available to provide copies of my dispute correspondence.

Sincerely,

{{client.firstName}} {{client.lastName}}
{{client.addressLine1}}, {{client.city}}, {{client.state}} {{client.zip}}
