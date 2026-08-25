import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { NotificationSettings } from './models';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { vapidKey: '' };

@Injectable({ providedIn: 'root' })
export class NotificationSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<NotificationSettings> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'notifications')).pipe(
      map((d) => (d && typeof d['vapidKey'] === 'string' ? { vapidKey: d['vapidKey'] as string } : DEFAULT_NOTIFICATION_SETTINGS)),
    );
  }

  update(vapidKey: string): Promise<void> {
    return setDoc(doc(this.db, 'settings', 'notifications'), { vapidKey }, { merge: true });
  }
}
