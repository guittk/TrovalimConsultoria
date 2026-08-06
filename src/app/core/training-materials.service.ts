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
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { TrainingMaterial } from './models';

@Injectable({ providedIn: 'root' })
export class TrainingMaterialsService {
  private readonly db: Firestore = inject(FIRESTORE);

  listAll$(): Observable<TrainingMaterial[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'trainingMaterials'), orderBy('createdAt', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as TrainingMaterial)));
  }

  create(data: Omit<TrainingMaterial, 'id' | 'createdAt'>): Promise<unknown> {
    return addDoc(collection(this.db, 'trainingMaterials'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }

  update(id: string, data: Partial<TrainingMaterial>): Promise<void> {
    return updateDoc(doc(this.db, 'trainingMaterials', id), data as DocumentData);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'trainingMaterials', id));
  }
}
