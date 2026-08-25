import { InjectionToken, Provider } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { environment } from '../../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');
export const FIREBASE_STORAGE = new InjectionToken<FirebaseStorage>('FIREBASE_STORAGE');
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('FIREBASE_FUNCTIONS');

// Only ever connect to local emulators when actually running on localhost, so a
// production/preview build with `useEmulators` left on by mistake can't try to
// dial a Firebase backend that doesn't exist for its real users.
function shouldUseEmulators(): boolean {
  return (
    environment.useEmulators &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  );
}

export function provideFirebase(): Provider[] {
  return [
    { provide: FIREBASE_APP, useFactory: () => initializeApp(environment.firebase) },
    {
      provide: FIREBASE_AUTH,
      useFactory: (app: FirebaseApp) => {
        const auth = getAuth(app);
        if (shouldUseEmulators()) {
          connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        }
        return auth;
      },
      deps: [FIREBASE_APP],
    },
    {
      provide: FIRESTORE,
      useFactory: (app: FirebaseApp) => {
        const firestore = getFirestore(app);
        if (shouldUseEmulators()) {
          connectFirestoreEmulator(firestore, '127.0.0.1', 8085);
        }
        return firestore;
      },
      deps: [FIREBASE_APP],
    },
    {
      provide: FIREBASE_STORAGE,
      useFactory: (app: FirebaseApp) => {
        const storage = getStorage(app);
        if (shouldUseEmulators()) {
          connectStorageEmulator(storage, '127.0.0.1', 9199);
        }
        return storage;
      },
      deps: [FIREBASE_APP],
    },
    {
      provide: FIREBASE_FUNCTIONS,
      useFactory: (app: FirebaseApp) => {
        const functionsInstance = getFunctions(app);
        if (shouldUseEmulators()) {
          connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
        }
        return functionsInstance;
      },
      deps: [FIREBASE_APP],
    },
  ];
}
