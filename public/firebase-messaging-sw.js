// Service worker do Firebase Cloud Messaging — na RAIZ do site de propósito
// (o escopo de um service worker não pode ser mais amplo que a pasta que o
// serve). SDK "compat" via importScripts porque service workers não
// suportam ES modules do jeito que o resto do app usa; a versão abaixo tem
// que acompanhar a do pacote "firebase" no package.json (hoje ^12.4.0).
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

// Config do projeto de PRODUÇÃO — este arquivo é copiado cru (nunca passa
// pelo bundler/environment.ts), então o valor vem direto daqui. É a mesma
// firebaseConfig pública de src/environments/environment.prod.ts.
firebase.initializeApp({
  apiKey: 'AIzaSyCYfcrQ_XqkFodiphe3NCCCylOe6Y8torg',
  authDomain: 'geovana-trovalim-prod.firebaseapp.com',
  projectId: 'geovana-trovalim-prod',
  storageBucket: 'geovana-trovalim-prod.firebasestorage.app',
  messagingSenderId: '906128365375',
  appId: '1:906128365375:web:b4b92616e245cd1158658a',
});

const messaging = firebase.messaging();

// Notificação chegando com o app em background/fechado.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Trovalim';
  const options = {
    body: payload.notification?.body || '',
    icon: '/favicon.png',
    data: { url: payload.fcmOptions?.link || payload.data?.url || '/admin/painel' },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin/painel';
  event.waitUntil(self.clients.openWindow(url));
});
