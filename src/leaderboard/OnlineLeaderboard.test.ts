import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry, LocalScoreEntry } from '../types';
import { OnlineLeaderboard } from './OnlineLeaderboard';

const localEntry: LocalScoreEntry = {
  id: 'local-entry',
  nickname: '테스터',
  score: 7_000,
  baseScore: 6_000,
  packingBonus: 1_000,
  packingRate: 33,
  height: 100,
  drops: 1,
  pieceCounts: { 'round-s': 1 },
  playedAt: '2026-08-17T00:00:00.000Z',
  runSeed: 'run-newer',
  contentVersion: '3.0.1',
  checksum: '1234abcd',
};

const oldEntries: LeaderboardEntry[] = [{ ...localEntry, id: 'old', nickname: '이전', runSeed: 'run-older', score: 6_000 }];
const newEntries: LeaderboardEntry[] = [{ ...localEntry, id: 'new' }];

const response = (entries: LeaderboardEntry[]) => new Response(JSON.stringify({ entries, updatedAt: '2026-08-17T00:00:00.000Z' }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

describe('online leaderboard request ordering', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
  });

  it('keeps a newer POST result when an older GET finishes later', async () => {
    let finishGet!: (value: Response) => void;
    let finishPost!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((resolve) => {
      if (init?.method === 'POST') finishPost = resolve;
      else finishGet = resolve;
    })));
    const leaderboard = new OnlineLeaderboard('3.0.1');
    const pendingGet = leaderboard.refresh();
    const pendingPost = leaderboard.submit(localEntry);

    finishPost(response(newEntries));
    await expect(pendingPost).resolves.toEqual(newEntries);
    finishGet(response(oldEntries));
    await expect(pendingGet).resolves.toEqual(newEntries);
    expect(leaderboard.cached()).toEqual(newEntries);
  });

  it('shares an in-flight refresh instead of issuing duplicate GET requests', async () => {
    const fetchMock = vi.fn(async () => response(newEntries));
    vi.stubGlobal('fetch', fetchMock);
    const leaderboard = new OnlineLeaderboard('3.0.1');

    await Promise.all([leaderboard.refresh(), leaderboard.refresh()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
