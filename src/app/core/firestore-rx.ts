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
export function retryOnPermissionDenied<T>(maxRetries = 3, baseDelayMs = 700) {
  return (source: Observable<T>) =>
    source.pipe(
      retry({
        count: maxRetries,
        delay: (error: FirestoreError, retryCount: number) => {
          if (error?.code !== 'permission-denied') throw error;
          return timer(baseDelayMs * Math.pow(1.5, retryCount - 1));
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
  maxRetries = 3,
  baseDelayMs = 700,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as FirestoreError)?.code;
    if (maxRetries > 0 && code === 'permission-denied') {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs));
      return retryPromiseOnPermissionDenied(fn, maxRetries - 1, baseDelayMs * 1.5);
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
