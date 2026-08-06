import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

declare const google: any;

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const STORAGE_KEY = 'googleCalendarToken';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

export interface CalendarEventInput {
  title: string;
  description: string;
  /** Data no formato yyyy-mm-dd (evento de dia inteiro). */
  date: string;
  /** E-mails de todos que têm acesso ao projeto (dono, gerentes, cliente). */
  attendeeEmails?: string[];
}

/**
 * Integração client-side com o Google Calendar via Google Identity Services
 * (OAuth feito no navegador do staff, sem servidor próprio). O token de
 * acesso fica só em memória/localStorage deste navegador — cada staff
 * autoriza com a própria conta Google.
 */
@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  readonly enabled = !!environment.googleClientId;
  readonly connected = signal(this.readStoredToken() !== null);

  private tokenClient: any = null;

  private readStoredToken(): StoredToken | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredToken;
      if (!parsed.accessToken || parsed.expiresAt < Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private storeToken(accessToken: string, expiresInSec: number): void {
    const stored: StoredToken = { accessToken, expiresAt: Date.now() + (expiresInSec - 60) * 1000 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    this.connected.set(true);
  }

  disconnect(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.connected.set(false);
  }

  /** Abre o consentimento do Google (popup) para o staff autorizar o Calendar. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.enabled) {
        reject(new Error('Google Calendar não configurado neste ambiente.'));
        return;
      }
      if (!this.tokenClient) {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: environment.googleClientId,
          scope: SCOPE,
          callback: () => {},
        });
      }
      this.tokenClient.error_callback = (err: { type?: string; message?: string }) => {
        reject(new Error(err?.type || err?.message || 'Não foi possível abrir a janela de autorização do Google.'));
      };
      this.tokenClient.callback = (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Falha ao autorizar o Google Calendar.'));
          return;
        }
        this.storeToken(resp.access_token, resp.expires_in || 3600);
        resolve();
      };
      this.tokenClient.requestAccessToken({ prompt: this.connected() ? '' : 'consent' });
    });
  }

  /** Garante um token válido, pedindo novo consentimento se necessário. */
  private async ensureToken(): Promise<string> {
    const stored = this.readStoredToken();
    if (stored) return stored.accessToken;
    await this.connect();
    const refreshed = this.readStoredToken();
    if (!refreshed) throw new Error('Não foi possível obter acesso ao Google Calendar.');
    return refreshed.accessToken;
  }

  private toGoogleEvent(input: CalendarEventInput): Record<string, unknown> {
    const nextDay = new Date(`${input.date}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const event: Record<string, unknown> = {
      summary: input.title,
      description: input.description,
      start: { date: input.date },
      end: { date: nextDay.toISOString().slice(0, 10) },
    };
    if (input.attendeeEmails?.length) {
      event['attendees'] = input.attendeeEmails.map((email) => ({ email }));
    }
    return event;
  }

  async createEvent(input: CalendarEventInput): Promise<string> {
    const token = await this.ensureToken();
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toGoogleEvent(input)),
      },
    );
    if (!res.ok) throw new Error(`Erro ao criar evento no Google Calendar (${res.status}).`);
    const data = await res.json();
    return data.id as string;
  }

  /** Atualiza o evento; se ele não existir mais (404, ex: apagado manualmente), cria um novo. */
  async updateEvent(eventId: string, input: CalendarEventInput): Promise<string> {
    const token = await this.ensureToken();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toGoogleEvent(input)),
      },
    );
    if (res.status === 404 || res.status === 410) return this.createEvent(input);
    if (!res.ok) throw new Error(`Erro ao atualizar evento no Google Calendar (${res.status}).`);
    const data = await res.json();
    return data.id as string;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const token = await this.ensureToken();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Erro ao excluir evento no Google Calendar (${res.status}).`);
    }
  }
}
