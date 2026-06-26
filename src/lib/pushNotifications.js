import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('[push] service worker or PushManager not supported in this browser')
    return null
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (err) {
    console.error('[push] service worker registration failed', err)
    throw err
  }
}

export async function subscribeToPush(userId) {
  if (!VAPID_PUBLIC_KEY) {
    console.error('[push] VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe')
    throw new Error('VAPID public key not configured')
  }

  let reg
  try {
    reg = await navigator.serviceWorker.ready
  } catch (err) {
    console.error('[push] service worker not ready', err)
    throw err
  }

  try {
    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()
  } catch (err) {
    console.error('[push] failed to clear existing subscription', err)
  }

  let sub
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  } catch (err) {
    console.error('[push] pushManager.subscribe failed', err)
    throw err
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  }, { onConflict: 'user_id,endpoint' })

  if (error) {
    console.error('[push] failed to save subscription to Supabase', error)
    throw error
  }

  return sub
}

export async function unsubscribeFromPush(userId) {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
      if (error) console.error('[push] failed to delete subscription from Supabase', error)
    }
  } catch (err) {
    console.error('[push] unsubscribe failed', err)
    throw err
  }
}

export async function isSubscribed() {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}
