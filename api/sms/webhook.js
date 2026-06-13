// /api/sms/webhook — Twilio incoming SMS webhook
// Configure this URL in the Twilio console as the "A message comes in" webhook
// for your Twilio phone number (HTTP POST).
import { supabaseAdmin, getPrimaryUserId } from '../_lib/db.js'
import { escapeXml } from '../_lib/twilio.js'
import { routeMessage } from '../_lib/smsRouter.js'
import { answerSmsQuestion } from '../_lib/aiQuestion.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { From, Body } = req.body || {}

  // Only ever process messages from the configured personal number.
  if (!From || From !== process.env.MY_PHONE_NUMBER) {
    res.setHeader('Content-Type', 'text/xml')
    return res.status(200).send('<Response></Response>')
  }

  const text = (Body || '').trim()
  const userId = await getPrimaryUserId()

  let reply
  try {
    reply = await routeMessage(userId, text, { handleQuestion: answerSmsQuestion })
  } catch (e) {
    reply = `Sorry, something went wrong: ${e.message}`
  }

  await supabaseAdmin.from('ai_log').insert({
    user_id: userId,
    type: 'sms',
    title: `SMS: ${text.slice(0, 40) || '(empty)'}`,
    response: `> ${text}\n\n${reply}`,
  })

  res.setHeader('Content-Type', 'text/xml')
  return res.status(200).send(`<Response><Message>${escapeXml(reply)}</Message></Response>`)
}
