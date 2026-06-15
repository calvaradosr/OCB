// SMS via Twilio. In dev (no Twilio creds) logs to console.

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.log(`[sms:dev] To: ${to} | Body: ${body}`)
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio error ${res.status}: ${text}`)
  }
}
