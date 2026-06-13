// Minimal Twilio REST client — sends SMS via fetch (no SDK dependency).

export function isTwilioConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY &&
    process.env.TWILIO_API_SECRET &&
    process.env.TWILIO_PHONE_NUMBER
  )
}

export async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_PHONE_NUMBER } = process.env
  const auth = Buffer.from(`${TWILIO_API_KEY}:${TWILIO_API_SECRET}`).toString('base64')

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio send failed (${res.status}): ${text}`)
  }
  return res.json()
}

// Escapes text for inclusion in a TwiML <Message> element
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
