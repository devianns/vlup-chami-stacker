import type { LeaderboardEntry, LocalScoreEntry } from '../types';

export const MAX_LEADERBOARD_ENTRIES = 20;

export function compareRankedScores(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score
    || b.packingRate - a.packingRate
    || b.drops - a.drops
    || a.playedAt.localeCompare(b.playedAt);
}

export function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LeaderboardEntry>;
  return typeof entry.id === 'string'
    && entry.id.length > 0
    && typeof entry.nickname === 'string' && [...entry.nickname].length > 0 && [...entry.nickname].length <= 12
    && Number.isSafeInteger(entry.score) && entry.score! >= 0
    && Number.isSafeInteger(entry.packingRate) && entry.packingRate! >= 0 && entry.packingRate! <= 100
    && Number.isSafeInteger(entry.drops) && entry.drops! >= 0
    && typeof entry.runSeed === 'string' && entry.runSeed.length > 0
    && typeof entry.playedAt === 'string' && Number.isFinite(Date.parse(entry.playedAt));
}

export function isLocalScoreEntry(value: unknown, contentVersion: string): value is LocalScoreEntry {
  if (!isLeaderboardEntry(value)) return false;
  const entry = value as Partial<LocalScoreEntry>;
  if (entry.contentVersion !== contentVersion
    || !Number.isSafeInteger(entry.baseScore) || entry.baseScore! < 0
    || !Number.isSafeInteger(entry.packingBonus) || entry.packingBonus! < 0
    || !Number.isSafeInteger(entry.height) || entry.height! < 0
    || typeof entry.checksum !== 'string' || !/^[a-f0-9]{8}$/i.test(entry.checksum)
    || !entry.pieceCounts || typeof entry.pieceCounts !== 'object' || Array.isArray(entry.pieceCounts)) return false;
  return Object.values(entry.pieceCounts).every((count) => Number.isSafeInteger(count) && count >= 0);
}

export function normalizeLocalLeaderboard(value: unknown, contentVersion: string): LocalScoreEntry[] {
  return Array.isArray(value)
    ? value.filter((entry) => isLocalScoreEntry(entry, contentVersion)).sort(compareRankedScores).slice(0, MAX_LEADERBOARD_ENTRIES)
    : [];
}
