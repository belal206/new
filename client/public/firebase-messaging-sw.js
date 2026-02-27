/* global importScripts, firebase, self, clients */

const parseConfig = () => {
  const search = self.location && typeof self.location.search === 'string' ? self.location.search : '';
  const params = new URLSearchParams(search);
  const config = {
    apiKey: params.get('apiKey') || '',
    authDomain: params.get('authDomain') || '',
    projectId: params.get('projectId') || '',
    storageBucket: params.get('storageBucket') || '',
    messagingSenderId: params.get('messagingSenderId') || '',
    appId: params.get('appId') || '',
  };

  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const isValid = required.every((key) => Boolean(config[key]));
  return isValid ? config : null;
};

const firebaseConfig = parseConfig();
if (firebaseConfig) {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'Boss Battle';
    const body = payload?.notification?.body || 'Your partner made progress.';
    const notificationOptions = {
      body,
      icon: '/vite.svg',
      data: {
        url: '/',
      },
    };
    self.registration.showNotification(title, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of allClients) {
      if ('focus' in client) {
        client.focus();
        if ('navigate' in client) {
          client.navigate(targetUrl);
        }
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
