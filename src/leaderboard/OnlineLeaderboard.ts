import type { LocalScoreEntry } from '../types';

const CACHE_KEY = 'chami-stacker:online-leaderboard:v2';
const REQUEST_TIMEOUT_MS = 8_000;

type ApiResponse = { entries?: unknown; updatedAt?: unknown; error?: unknown };
type CacheRecord = { entries: LocalScoreEntry[]; updatedAt: string };

function apiEndpoint(): string | null {
  return '/api/leaderboard';
}

function isEntry(value: unknown): value is LocalScoreEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LocalScoreEntry>;
  return typeof entry.id === 'string'
    && typeof entry.nickname === 'string'
    && Number.isFinite(entry.score)
    && Number.isFinite(entry.baseScore)
    && Number.isFinite(entry.packingBonus)
    && Number.isFinite(entry.packingRate)
    && Number.isFinite(entry.drops)
    && !!entry.pieceCounts
    && typeof entry.pieceCounts === 'object'
    && typeof entry.runSeed === 'string'
    && typeof entry.playedAt === 'string';
}

function parseResponse(payload: ApiResponse): LocalScoreEntry[] {
  if (!Array.isArray(payload.entries)) throw new Error(typeof payload.error === 'string' ? payload.error : '점수판 응답이 올바르지 않아요.');
  return payload.entries.filter(isEntry);
}

async function request(init?: RequestInit): Promise<LocalScoreEntry[]> {
  const endpoint = apiEndpoint();
  if (!endpoint) throw new Error('온라인 점수판 주소가 아직 설정되지 않았어요.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...init?.headers } });
    let payload: ApiResponse;
    try { payload = await response.json() as ApiResponse; }
    catch { throw new Error('점수판 서버의 응답을 읽지 못했어요. 잠시 뒤 다시 확인해 주세요.'); }
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : '점수판을 불러오지 못했어요.');
    const entries = parseResponse(payload);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ entries, updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString() } satisfies CacheRecord));
    } catch { /* The cache is optional; the successful response remains valid. */ }
    return entries;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('점수판 응답이 늦어지고 있어요. 잠시 후 다시 확인해 주세요.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export class OnlineLeaderboard {
  readonly available = apiEndpoint() !== null;

  cached(): LocalScoreEntry[] {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Partial<CacheRecord> | null;
      return Array.isArray(cached?.entries) ? cached.entries.filter(isEntry) : [];
    } catch {
      return [];
    }
  }

  refresh(): Promise<LocalScoreEntry[]> { return request(); }

  submit(entry: LocalScoreEntry): Promise<LocalScoreEntry[]> {
    return request({
      method: 'POST',
      body: JSON.stringify({
        nickname: entry.nickname,
        drops: entry.drops,
        baseScore: entry.baseScore,
        pieceCounts: entry.pieceCounts,
        packingBonus: entry.packingBonus,
        packingRate: entry.packingRate,
        height: entry.height,
        runSeed: entry.runSeed,
        contentVersion: entry.contentVersion,
        checksum: entry.checksum,
        playedAt: entry.playedAt,
      }),
    });
  }

  warmup(onReady: (entries: LocalScoreEntry[]) => void): void {
    if (!this.available) return;
    const load = () => { void this.refresh().then(onReady).catch(() => undefined); };
    const idleCallback = window.requestIdleCallback;
    if (typeof idleCallback === 'function') idleCallback(load, { timeout: 2_000 });
    else globalThis.setTimeout(load, 700);
  }
}
