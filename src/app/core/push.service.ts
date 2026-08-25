import { Injectable, inject, signal } from '@angular/core';
import { Firestore, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_APP, FIRESTORE } from './firebase.providers';

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied';

/**
 * Push (FCM) entra por importação dinâmica dentro de try/catch, NUNCA por
 * provider no app.config.ts: getMessaging() estoura em navegador sem
 * suporte (Safari antigo, iPhone fora da tela de início), e um provider que
 * estoura derruba a injeção do app inteiro — ninguém conseguiria abrir a
 * plataforma por causa de um recurso opcional.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly app = inject(FIREBASE_APP);
  private readonly db: Firestore = inject(FIRESTORE);

  readonly status = signal<PushStatus>(this.readInitialStatus());

  private readInitialStatus(): PushStatus {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as PushStatus;
  }

  get supported(): boolean {
    return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
  }

  /**
   * Pede permissão, registra o service worker e grava o token em
   * /pushTokens/{token} — o id do documento É o token, então registrar de
   * novo o mesmo aparelho nunca duplica linha (setDoc com merge).
   */
  async register(uid: string, vapidKey: string): Promise<void> {
    if (!this.supported || !vapidKey) return;
    const permission = await Notification.requestPermission();
    this.status.set(permission as PushStatus);
    if (permission !== 'granted') return;

    const registration = await this.registerServiceWorker();
    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging(this.app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return;

    await setDoc(doc(this.db, 'pushTokens', token), { uid, token, createdAt: serverTimestamp() }, { merge: true });
  }

  /**
   * `register()` do navegador resolve assim que o arquivo é aceito, ainda
   * em "installing" — getToken() estoura com "no active Service Worker" se
   * chamado antes de ficar "active". Espera o estado certo em vez de deixar
   * o clássico "deu erro, cliquei de novo e funcionou" acontecer aqui.
   */
  private async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    if (registration.active) return registration;
    await new Promise<void>((resolve) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) {
        resolve();
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      });
    });
    return registration;
  }

  /** Token sem uso não tem valor de histórico — apaga de verdade, não é dado a preservar. */
  async unregisterToken(token: string): Promise<void> {
    await deleteDoc(doc(this.db, 'pushTokens', token)).catch(() => {});
  }
}
