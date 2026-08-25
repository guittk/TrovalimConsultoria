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
  updateDoc,
} from 'firebase/firestore';
import { Observable, catchError, of } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { CalendarEvent, CalendarEventType } from './models';

export const CALENDAR_EVENT_TYPES: { key: CalendarEventType; label: string; color: string }[] = [
  { key: 'entrevista', label: 'Entrevista', color: '#3D0B12' },
  { key: 'mentoria', label: 'Mentoria', color: '#C9A96E' },
  { key: 'reuniao', label: 'Reunião', color: '#2563EB' },
  { key: 'outro', label: 'Outro', color: '#6B6B6B' },
];

@Injectable({ providedIn: 'root' })
export class CalendarEventsService {
  private readonly db: Firestore = inject(FIRESTORE);

  /** Mesma defesa de tasks.service.ts: regra não implantada não pode travar a tela inteira. */
  listAll$(): Observable<CalendarEvent[]> {
    return (
      collectionData$<DocumentData>(
        query(collection(this.db, 'calendarEvents'), orderBy('date', 'asc')),
      ) as Observable<CalendarEvent[]>
    ).pipe(
      catchError((err) => {
        console.error('[calendarEvents] falha ao carregar — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  create(data: Omit<CalendarEvent, 'id' | 'createdAt'>): Promise<string> {
    return addDoc(collection(this.db, 'calendarEvents'), {
      ...data,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  update(id: string, data: Partial<CalendarEvent>): Promise<void> {
    return updateDoc(doc(this.db, 'calendarEvents', id), data as DocumentData);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'calendarEvents', id));
  }
}
