import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StackerGameProtocol, StackerRunState } from '../types';
import { StackerSaveManager } from './StackerSaveManager';

const content = JSON.parse(readFileSync(new URL('../../public/game-data/stacker.json', import.meta.url), 'utf8')) as StackerGameProtocol;
const finalState: StackerRunState = {
  score: 10_750,
  baseScore: 10_000,
  packingBonus: 750,
  packingRate: 25,
  height: 120,
  drops: 1,
  pieceCounts: { 'round-m': 1 },
  bestScore: 10_750,
  nextPieces: [],
  message: '',
  gameOver: true,
  nearLimit: false,
  gameOverReason: 'limit-crossed',
  runSeed: 'stable-run',
};

describe('stacker save stability', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
  });

  it('treats score submission as idempotent so an online retry is possible', () => {
    const saves = new StackerSaveManager(content);
    expect(saves.submitScore('테스터', finalState).leaderboard).toHaveLength(1);
    expect(saves.submitScore('테스터', finalState).leaderboard).toHaveLength(1);
  });

  it('returns the current entry even when it does not enter the local top 20', () => {
    const saves = new StackerSaveManager(content);
    const save = saves.create();
    save.leaderboard = Array.from({ length: 20 }, (_, index) => ({
      id: `high-${index}`,
      nickname: `상위${index}`,
      score: 20_000,
      baseScore: 20_000,
      packingBonus: 0,
      packingRate: 0,
      height: 100,
      drops: 2,
      pieceCounts: { 'round-m': 2 },
      playedAt: new Date(2026, 0, index + 1).toISOString(),
      runSeed: `high-run-${index}`,
      contentVersion: content.game.version,
      checksum: index.toString(16).padStart(8, '0'),
    }));
    saves.save(save);

    const submission = saves.submitScore('테스터', finalState);
    expect(submission.leaderboard).toHaveLength(20);
    expect(submission.entry.runSeed).toBe(finalState.runSeed);
    expect(submission.leaderboard.some((entry) => entry.runSeed === finalState.runSeed)).toBe(false);
  });

  it('preserves nickname and leaderboard when a later run is completed', () => {
    const saves = new StackerSaveManager(content);
    saves.recordCompletedRun(finalState);
    saves.submitScore('테스터', finalState);
    saves.recordCompletedRun({ score: 6_000, height: 80, drops: 1 });

    const stored = saves.load();
    expect(stored.nickname).toBe('테스터');
    expect(stored.leaderboard).toHaveLength(1);
    expect(stored.leaderboard[0].runSeed).toBe(finalState.runSeed);
    expect(stored.gamesPlayed).toBe(2);
    expect(stored.totalDrops).toBe(2);
  });

  it('keeps the game usable when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('blocked', 'SecurityError'); },
    });
    const saves = new StackerSaveManager(content);
    expect(saves.load()).toEqual(saves.create());
    expect(() => saves.save(saves.create())).not.toThrow();
  });
});
