import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { FileTypeLimit, StorageSettings } from './models';

export const DEFAULT_TYPE_LIMITS: FileTypeLimit[] = [
  { key: 'image', label: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'], maxSizeMb: 10 },
  { key: 'document', label: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'], maxSizeMb: 20 },
  { key: 'video', label: 'Vídeos', extensions: ['mp4', 'mov', 'avi', 'webm'], maxSizeMb: 100 },
  { key: 'other', label: 'Outros', extensions: [], maxSizeMb: 15 },
];

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  totalLimitMb: 4500,
  defaultClientLimitMb: 500,
  typeLimits: DEFAULT_TYPE_LIMITS,
};

@Injectable({ providedIn: 'root' })
export class StorageSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<StorageSettings> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'storageConfig')).pipe(
      map((d) => this.normalize(d)),
    );
  }

  update(settings: StorageSettings): Promise<void> {
    return setDoc(doc(this.db, 'settings', 'storageConfig'), settings, { merge: true });
  }

  private normalize(d: DocumentData | null): StorageSettings {
    if (!d) return DEFAULT_STORAGE_SETTINGS;
    return {
      totalLimitMb: typeof d['totalLimitMb'] === 'number' ? d['totalLimitMb'] : DEFAULT_STORAGE_SETTINGS.totalLimitMb,
      defaultClientLimitMb:
        typeof d['defaultClientLimitMb'] === 'number'
          ? d['defaultClientLimitMb']
          : DEFAULT_STORAGE_SETTINGS.defaultClientLimitMb,
      typeLimits: Array.isArray(d['typeLimits']) && d['typeLimits'].length ? d['typeLimits'] : DEFAULT_TYPE_LIMITS,
    };
  }

  limitForFile(settings: StorageSettings, fileName: string): FileTypeLimit {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return (
      settings.typeLimits.find((t) => t.extensions.includes(ext)) ||
      settings.typeLimits.find((t) => t.key === 'other') ||
      DEFAULT_TYPE_LIMITS[DEFAULT_TYPE_LIMITS.length - 1]
    );
  }

  /**
   * Verifica se um upload respeita o limite do tipo de arquivo, o limite do
   * cliente e o limite total da plataforma. Retorna null se estiver tudo ok,
   * ou uma mensagem de erro pronta para exibir ao usuário.
   */
  checkUpload(
    file: File,
    settings: StorageSettings,
    ownerUsageBytes: number,
    ownerLimitMb: number | null | undefined,
    totalUsageBytes: number,
  ): string | null {
    const typeLimit = this.limitForFile(settings, file.name);
    if (file.size > typeLimit.maxSizeMb * 1024 * 1024) {
      return `Arquivos do tipo "${typeLimit.label}" têm limite de ${typeLimit.maxSizeMb} MB.`;
    }
    const effectiveOwnerLimitMb = ownerLimitMb ?? settings.defaultClientLimitMb;
    if (ownerUsageBytes + file.size > effectiveOwnerLimitMb * 1024 * 1024) {
      return `O limite de armazenamento deste cliente (${effectiveOwnerLimitMb} MB) seria ultrapassado.`;
    }
    if (totalUsageBytes + file.size > settings.totalLimitMb * 1024 * 1024) {
      return `O limite total de armazenamento da plataforma (${settings.totalLimitMb} MB) seria ultrapassado.`;
    }
    return null;
  }
}
