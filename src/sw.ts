
import { precacheAndRoute } from 'workbox-precaching';

const sw = globalThis as any;

precacheAndRoute(sw.__WB_MANIFEST);

sw.addEventListener('push', (event: any) => {
  let payload: any = {};

  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {
      title: 'ELITE MATCH AI',
      body: event.data?.text() || 'You have a new notification.'
    };
  }

  const title = payload.title || 'ELITE MATCH AI';

  const options = {
    body: payload.body || 'Open the app for details.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: payload.url || '/'
    }
  };

  event.waitUntil(
    sw.registration.showNotification(title, options)
  );
});

sw.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    sw.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clients: any[]) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return sw.clients.openWindow(url);
    })
  );
});
