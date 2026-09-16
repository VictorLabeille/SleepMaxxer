/**
 * Client HTTP de l'API du collecteur. L'app ne parle jamais au réveil : tout passe par ici.
 *
 * Deux erreurs à ne jamais confondre (cadrage §3.A) : le collecteur qui ne répond pas
 * (`CollectorUnreachableError`) et le collecteur qui répond que le réveil ne répond pas — ce
 * second cas est une réponse, pas une erreur réseau, et il se lit dans le code HTTP.
 */
import type {
  Aggregate,
  AlarmEdit,
  CatalogResponse,
  CollectorStatus,
  DeviceMirror,
  NightDetail,
  SettingsSnapshot,
  SunsetSettings,
  SyncBeforeResponse,
  SyncSinceResponse,
  WriteBody,
  WriteResult,
} from './types';

export class CollectorUnreachableError extends Error {
  constructor(message = 'collecteur injoignable') {
    super(message);
    this.name = 'CollectorUnreachableError';
  }
}

export class CollectorHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`réponse ${status} du collecteur`);
    this.name = 'CollectorHttpError';
  }
}

const READ_TIMEOUT_MS = 8000;
/** Une écriture traverse le relais : bornes, file sérialisée vers le réveil (≈ 200 ms entre deux
 * requêtes), écriture, relecture. Une édition d'alarme enchaîne une demi-douzaine de requêtes. */
const WRITE_TIMEOUT_MS = 25000;

export interface CollectorApi {
  readonly baseUrl: string;
  status(): Promise<CollectorStatus>;
  device(): Promise<DeviceMirror>;
  catalog(): Promise<CatalogResponse>;
  night(id: number): Promise<NightDetail>;
  syncBefore(before: number, limit: number): Promise<SyncBeforeResponse>;
  syncSince(sinceSeq: number, limit: number): Promise<SyncSinceResponse>;
  bedtime(): Promise<WriteResult>;
  risetime(): Promise<WriteResult>;
  /** `value: null` revient au relevé : la correction en vigueur est levée. */
  correctNight(id: number, field: 'bedtime' | 'risetime', value: number | null): Promise<WriteResult>;
  /** L'instantané des réglages, pour l'export. `null` si le collecteur ne le sert pas encore. */
  settingsSnapshot(): Promise<SettingsSnapshot | null>;
  /** Tous les agrégats d'une période — sert la passe de réparation des types manquants. */
  aggregatesFrom(from: number, to: number): Promise<Aggregate[]>;
  light(on: boolean, level?: number): Promise<WriteResult>;
  nightlight(on: boolean): Promise<WriteResult>;
  sunset(on: boolean): Promise<WriteResult>;
  sunsetSettings(settings: SunsetSettings): Promise<WriteResult>;
  snooze(minutes: number): Promise<WriteResult>;
  alarm(n: number): Promise<WriteResult>;
  createAlarm(): Promise<WriteResult>;
  updateAlarm(n: number, edit: AlarmEdit): Promise<WriteResult>;
  deleteAlarm(n: number): Promise<WriteResult>;
}

export function createCollectorApi(baseUrl: string, fetchImpl: typeof fetch = fetch): CollectorApi {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(
    method: string,
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<{ status: number; body: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(root + path, {
        method,
        headers:
          body === undefined
            ? { Accept: 'application/json' }
            : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { reason: text };
        }
      }
      return { status: res.status, body: parsed };
    } catch {
      throw new CollectorUnreachableError();
    } finally {
      clearTimeout(timer);
    }
  }

  async function get<T>(path: string): Promise<T> {
    const r = await request('GET', path, undefined, READ_TIMEOUT_MS);
    if (r.status !== 200) throw new CollectorHttpError(r.status, r.body);
    return r.body as T;
  }

  async function write(method: string, path: string, body?: unknown): Promise<WriteResult> {
    const r = await request(method, path, body, WRITE_TIMEOUT_MS);
    const parsed = r.body && typeof r.body === 'object' ? (r.body as WriteBody) : {};
    return { status: r.status, body: parsed };
  }

  return {
    baseUrl: root,
    status: () => get('/v1/status'),
    device: () => get('/v1/device'),
    catalog: () => get('/v1/catalog/themes'),
    night: (id) => get(`/v1/nights/${id}`),
    syncBefore: (before, limit) => get(`/v1/sync?before=${before}&limit=${limit}`),
    syncSince: (sinceSeq, limit) => get(`/v1/sync?since_seq=${sinceSeq}&limit=${limit}`),
    bedtime: () => write('POST', '/v1/nights/bedtime'),
    risetime: () => write('POST', '/v1/nights/risetime'),
    correctNight: (id, field, value) =>
      write('POST', `/v1/nights/${id}/corrections`, { field, value }),
    // Absentes d'un collecteur antérieur au 2026-09-15 : un 404 n'est pas une panne, il dit que
    // la route n'existe pas encore. L'export s'en passe, la réparation ne se lance pas.
    async settingsSnapshot() {
      try {
        return await get<SettingsSnapshot>('/v1/settings/snapshot');
      } catch (e) {
        if (e instanceof CollectorHttpError && e.status === 404) return null;
        throw e;
      }
    },
    async aggregatesFrom(from, to) {
      const r = await get<{ aggregates?: Aggregate[] }>(`/v1/aggregates?from=${from}&to=${to}`);
      return r.aggregates ?? [];
    },
    light: (on, level) => write('PUT', '/v1/light', level === undefined ? { on } : { on, level }),
    nightlight: (on) => write('PUT', '/v1/nightlight', { on }),
    sunset: (on) => write('PUT', '/v1/sunset', { on }),
    sunsetSettings: (settings) => write('PUT', '/v1/sunset/settings', settings),
    snooze: (minutes) => write('PUT', '/v1/snooze', { minutes }),
    alarm: (n) => write('GET', `/v1/alarms/${n}`),
    createAlarm: () => write('POST', '/v1/alarms'),
    updateAlarm: (n, edit) => write('PUT', `/v1/alarms/${n}`, edit),
    deleteAlarm: (n) => write('DELETE', `/v1/alarms/${n}`),
  };
}

/** La raison d'un refus, qu'elle vienne du relais (`reason`) ou de FastAPI (`detail`). */
export function refusalReason(body: WriteBody): string | null {
  if (typeof body.reason === 'string' && body.reason) return body.reason;
  if (typeof body.detail === 'string' && body.detail) return body.detail;
  return null;
}
