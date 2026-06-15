// Email via AWS SES. In dev (no AWS creds) logs to console instead of sending.

export type EmailPayload = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = process.env.SES_FROM_ADDRESS ?? "noreply@oneconsultingbusiness.com"

  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.log(`[email:dev] To: ${payload.to} | Subject: ${payload.subject}`)
    return
  }

  // Dynamic import keeps SES out of the edge bundle
  const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses")

  const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-east-1" })

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [payload.to] },
      Message: {
        Subject: { Data: payload.subject },
        Body: {
          Html: { Data: payload.html },
          ...(payload.text ? { Text: { Data: payload.text } } : {}),
        },
      },
    })
  )
}

// Merge template variables into a simple {{key}} template
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}
