// Same Firebase project as environment.prod.ts (geovana-trovalim-prod) — local
// dev no longer talks to a separate cloud "dev" project. `useEmulators` routes
// Auth/Firestore/Storage/Functions calls to the local Emulator Suite instead
// (see firebase.providers.ts), which only kicks in when running on localhost,
// so a deployed build always hits the real prod backend regardless of this flag.
export const environment = {
  production: false,
  useEmulators: true,
  // Chave VAPID pública (Web Push) — Console do Firebase → Configurações do
  // Projeto → Cloud Messaging → Certificados Web Push. É pública, pode ficar
  // no repo. Enquanto estiver vazia, o botão "Ativar Notificações" some.
  vapidPublicKey: '',
  firebase: {
    apiKey: 'AIzaSyCYfcrQ_XqkFodiphe3NCCCylOe6Y8torg',
    authDomain: 'geovana-trovalim-prod.firebaseapp.com',
    projectId: 'geovana-trovalim-prod',
    storageBucket: 'geovana-trovalim-prod.firebasestorage.app',
    messagingSenderId: '906128365375',
    appId: '1:906128365375:web:b4b92616e245cd1158658a',
  },
};
