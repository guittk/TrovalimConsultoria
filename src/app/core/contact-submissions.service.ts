import { Injectable, inject } from '@angular/core';
import { addDoc, collection, Firestore, serverTimestamp } from 'firebase/firestore';
import { FIRESTORE } from './firebase.providers';
import { ContactSubmission } from './models';

@Injectable({ providedIn: 'root' })
export class ContactSubmissionsService {
  private readonly db: Firestore = inject(FIRESTORE);

  create(data: Omit<ContactSubmission, 'id' | 'createdAt'>): Promise<unknown> {
    const payload: Record<string, unknown> = { createdAt: serverTimestamp() };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) payload[key] = value;
    }
    return addDoc(collection(this.db, 'contactSubmissions'), payload);
  }
}
