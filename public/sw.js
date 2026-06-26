self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (err) {
    console.error('[sw] failed to parse push payload', err)
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Life OS', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: data.url ? { url: data.url } : {},
    }).catch(err => console.error('[sw] showNotification failed', err))
  )
})

self.addEventListener('pushsubscriptionchange', event => {
  console.error('[sw] push subscription changed/expired', event)
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url))
  }
})
