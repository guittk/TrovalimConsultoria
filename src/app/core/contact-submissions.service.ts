import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { ContactSubmission } from './models';

@Injectable({ providedIn: 'root' })
export class ContactSubmissionsService {
  private readonly db: Firestore = inject(FIRESTORE);

  listAll$(): Observable<ContactSubmission[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'contactSubmissions'), orderBy('createdAt', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as ContactSubmission)));
  }

  create(data: Omit<ContactSubmission, 'id' | 'createdAt'>): Promise<unknown> {
    const payload: Record<string, unknown> = { createdAt: serverTimestamp() };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) payload[key] = value;
    }
    return addDoc(collection(this.db, 'contactSubmissions'), payload);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'contactSubmissions', id));
  }
}
