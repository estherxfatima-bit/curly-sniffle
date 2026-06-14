// Minimal web-push sender for the daily reflection nudge and other push notifications.
import webpush from 'web-push'

export function isWebPushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export async function sendPushToSubscriptions(supabaseAdmin, userId, payload) {
  if (!isWebPushConfigured()) return { sent: 0 }

  webpush.setVapidDetails(
    'mailto:notifications@lifeos.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', userId)
  let sent = 0
  for (const sub of subs || []) {
    const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
      sent++
    } catch (err) {
      // Subscription is no longer valid — remove it.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return { sent }
}
