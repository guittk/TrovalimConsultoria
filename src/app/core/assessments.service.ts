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
import { AppliedAssessment, AssessmentAnswer, AssessmentTargetType, AssessmentTemplate } from './models';

@Injectable({ providedIn: 'root' })
export class AssessmentsService {
  private readonly db: Firestore = inject(FIRESTORE);

  /* ── MODELOS ── */
  templates$(): Observable<AssessmentTemplate[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'assessmentTemplates'), orderBy('createdAt', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as AssessmentTemplate)));
  }

  createTemplate(data: Omit<AssessmentTemplate, 'id' | 'createdAt'>): Promise<string> {
    return addDoc(collection(this.db, 'assessmentTemplates'), { ...data, createdAt: serverTimestamp() }).then(
      (ref) => ref.id,
    );
  }

  updateTemplate(id: string, data: Partial<Omit<AssessmentTemplate, 'id'>>): Promise<void> {
    return updateDoc(doc(this.db, 'assessmentTemplates', id), data as DocumentData);
  }

  deleteTemplate(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'assessmentTemplates', id));
  }

  /* ── APLICADAS ── */
  applied$(): Observable<AppliedAssessment[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'assessments'), orderBy('createdAt', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as AppliedAssessment)));
  }

  applyAssessment(data: {
    templateId: string;
    templateName: string;
    targetType: AssessmentTargetType;
    targetId: string;
    targetName: string;
    answers: AssessmentAnswer[];
    appliedByName: string;
  }): Promise<string> {
    const scaleAnswers = data.answers.filter((a) => a.type === 'escala');
    const totalScore = scaleAnswers.reduce((sum, a) => sum + (typeof a.value === 'number' ? a.value : 0), 0);
    const maxScore = scaleAnswers.length * 5;
    return addDoc(collection(this.db, 'assessments'), {
      ...data,
      totalScore,
      maxScore,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  deleteApplied(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'assessments', id));
  }
}
