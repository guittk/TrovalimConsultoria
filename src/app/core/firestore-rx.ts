import { Observable, retry, timer } from 'rxjs';
import {
  DocumentData,
  DocumentReference,
  FirestoreError,
  Query,
  onSnapshot,
} from 'firebase/firestore';

/**
 * Logo após restaurar a sessão (login ou reload), o primeiro onSnapshot às
 * vezes esbarra numa corrida do token de auth e volta "permission-denied"
 * mesmo com as regras corretas — validado ao vivo nesta sessão. O Firestore
 * não tenta de novo sozinho depois de um erro de permissão, então este
 * operador reassina a fonte (o que recria o onSnapshot) algumas vezes com
 * backoff antes de desistir.
 */
export function retryOnPermissionDenied<T>(maxRetries = 7, baseDelayMs = 600) {
  return (source: Observable<T>) =>
    source.pipe(
      retry({
        count: maxRetries,
        delay: (error: FirestoreError, retryCount: number) => {
          if (error?.code !== 'permission-denied') throw error;
          if (retryCount >= maxRetries) {
            console.error(
              `[firestore] permission-denied não resolveu após ${maxRetries} tentativas — provavelmente não é uma corrida transitória, é uma regra realmente negando (ex: doc /users/{uid} com ID diferente do UID de auth, ou projectAccess/companyAccess sem o projeto/empresa esperado).`,
              error,
            );
          } else {
            console.warn(`[firestore] permission-denied, tentativa ${retryCount}/${maxRetries}...`, error.message);
          }
          return timer(Math.min(baseDelayMs * Math.pow(1.4, retryCount - 1), 4000));
        },
      }),
    );
}

/**
 * Mesma corrida de "permission-denied" transitório, mas para leituras
 * avulsas (getDoc/getDocs) em vez de listeners em tempo real.
 */
export async function retryPromiseOnPermissionDenied<T>(
  fn: () => Promise<T>,
  maxRetries = 7,
  baseDelayMs = 600,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as FirestoreError)?.code;
    if (maxRetries > 0 && code === 'permission-denied') {
      console.warn(`[firestore] permission-denied, ${maxRetries} tentativa(s) restante(s)...`, (e as FirestoreError).message);
      await new Promise((resolve) => setTimeout(resolve, Math.min(baseDelayMs, 4000)));
      return retryPromiseOnPermissionDenied(fn, maxRetries - 1, baseDelayMs * 1.4);
    }
    if (code === 'permission-denied') {
      console.error('[firestore] permission-denied não resolveu após todas as tentativas.', e);
    }
    throw e;
  }
}

export function docData$<T extends DocumentData>(
  ref: DocumentReference<T>,
): Observable<(T & { id: string }) | null> {
  return new Observable<(T & { id: string }) | null>((subscriber) => {
    const unsub = onSnapshot(
      ref,
      (snap) => subscriber.next(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (err) => subscriber.error(err),
    );
    return unsub;
  }).pipe(retryOnPermissionDenied());
}

export function collectionData$<T extends DocumentData>(
  query: Query<T>,
): Observable<(T & { id: string })[]> {
  return new Observable<(T & { id: string })[]>((subscriber) => {
    const unsub = onSnapshot(
      query,
      (snap) => subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => subscriber.error(err),
    );
    return unsub;
  }).pipe(retryOnPermissionDenied());
}
