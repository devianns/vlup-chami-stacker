import type { LeaderboardEntry, LocalScoreEntry } from '../types';
import { isLeaderboardEntry } from './ScoreEntries';

const REQUEST_TIMEOUT_MS = 8_000;
const API_ENDPOINT = '/api/leaderboard';

type ApiResponse = { entries?: unknown; updatedAt?: unknown; error?: unknown };
type CacheRecord = { entries: LeaderboardEntry[]; updatedAt: string };

function parseResponse(payload: ApiResponse): LeaderboardEntry[] {
  if (!Array.isArray(payload.entries)) throw new Error(typeof payload.error === 'string' ? payload.error : '점수판 응답이 올바르지 않아요.');
  return payload.entries.filter(isLeaderboardEntry);
}

export class OnlineLeaderboard {
  private readonly cacheKey: string;
  private latestEntries: LeaderboardEntry[];
  private requestSequence = 0;
  private appliedSequence = 0;
  private refreshRequest: Promise<LeaderboardEntry[]> | null = null;

  constructor(contentVersion: string) {
    this.cacheKey = `chami-stacker:online-leaderboard:${contentVersion}`;
    this.latestEntries = this.readCache();
  }

  cached(): LeaderboardEntry[] { return [...this.latestEntries]; }

  refresh(): Promise<LeaderboardEntry[]> {
    if (this.refreshRequest) return this.refreshRequest;
    const pending = this.request().finally(() => {
      if (this.refreshRequest === pending) this.refreshRequest = null;
    });
    this.refreshRequest = pending;
    return pending;
  }

  submit(entry: LocalScoreEntry): Promise<LeaderboardEntry[]> {
    return this.request({
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

  warmup(onReady: (entries: LeaderboardEntry[]) => void): void {
    const load = () => { void this.refresh().then(onReady).catch(() => undefined); };
    const idleCallback = window.requestIdleCallback;
    if (typeof idleCallback === 'function') idleCallback(load, { timeout: 2_000 });
    else globalThis.setTimeout(load, 700);
  }

  private readCache(): LeaderboardEntry[] {
    try {
      const cached = JSON.parse(localStorage.getItem(this.cacheKey) ?? 'null') as Partial<CacheRecord> | null;
      return Array.isArray(cached?.entries) ? cached.entries.filter(isLeaderboardEntry) : [];
    } catch {
      return [];
    }
  }

  private async request(init?: RequestInit): Promise<LeaderboardEntry[]> {
    const sequence = ++this.requestSequence;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API_ENDPOINT, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...init?.headers } });
      let payload: ApiResponse;
      try { payload = await response.json() as ApiResponse; }
      catch { throw new Error('점수판 서버의 응답을 읽지 못했어요. 잠시 뒤 다시 확인해 주세요.'); }
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : '점수판을 불러오지 못했어요.');
      const entries = parseResponse(payload);
      if (sequence >= this.appliedSequence) {
        this.appliedSequence = sequence;
        this.latestEntries = entries;
        try {
          localStorage.setItem(this.cacheKey, JSON.stringify({ entries, updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString() } satisfies CacheRecord));
        } catch { /* Caching is optional; the successful response remains usable. */ }
      }
      return [...this.latestEntries];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('점수판 응답이 늦어지고 있어요. 잠시 후 다시 확인해 주세요.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
