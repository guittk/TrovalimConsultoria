export const environment = {
  production: true,
  useEmulators: false,
  // Chave VAPID pública (Web Push) — ver environment.ts. Cole aqui a chave
  // gerada no Console do Firebase pra habilitar o "Ativar Notificações".
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
