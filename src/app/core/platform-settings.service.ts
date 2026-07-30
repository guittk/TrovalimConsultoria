import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { PlatformSettings } from './models';

export const DEFAULT_PLATFORM_COLOR = '#3D0B12';

@Injectable({ providedIn: 'root' })
export class PlatformSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<PlatformSettings> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'platform')).pipe(
      map((d) => ({ primaryColor: (d?.['primaryColor'] as string) || DEFAULT_PLATFORM_COLOR })),
    );
  }

  updateColor(primaryColor: string): Promise<void> {
    return setDoc(doc(this.db, 'settings', 'platform'), { primaryColor }, { merge: true });
  }
}
