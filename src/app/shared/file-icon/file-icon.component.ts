import { Component, Input, signal } from '@angular/core';

type FileKind = 'image' | 'pdf' | 'video' | 'spreadsheet' | 'audio' | 'archive' | 'doc' | 'link';

const EXT_MAP: Record<string, FileKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image', webp: 'image', bmp: 'image', heic: 'image',
  pdf: 'pdf',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video', wmv: 'video',
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

function kindFor(filename: string): FileKind {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_MAP[ext] || 'doc';
}

@Component({
  selector: 'app-file-icon',
  standalone: true,
  template: `
    <div class="file-icon">
      @switch (kind()) {
        @case ('image') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        }
        @case ('pdf') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        }
        @case ('video') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        }
        @case ('spreadsheet') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        }
        @case ('audio') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        }
        @case ('archive') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        }
        @case ('link') {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        }
        @default {
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        }
      }
    </div>
  `,
})
export class FileIconComponent {
  readonly kind = signal<FileKind>('doc');
  private isLink = false;
  private lastName = '';

  @Input() set name(value: string) {
    this.lastName = value || '';
    this.kind.set(this.isLink ? 'link' : kindFor(this.lastName));
  }

  @Input() set link(value: boolean | undefined) {
    this.isLink = !!value;
    this.kind.set(this.isLink ? 'link' : kindFor(this.lastName));
  }
}
