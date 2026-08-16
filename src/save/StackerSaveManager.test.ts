import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StackerGameProtocol, StackerRunState } from '../types';
import { StackerSaveManager } from './StackerSaveManager';

const content = JSON.parse(readFileSync(new URL('../../public/game-data/stacker.json', import.meta.url), 'utf8')) as StackerGameProtocol;
const finalState: StackerRunState = {
  score: 12_500,
  baseScore: 10_000,
  packingBonus: 2_500,
  packingRate: 25,
  height: 120,
  drops: 1,
  bestScore: 12_500,
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
    expect(saves.submitScore('테스터', finalState)).toHaveLength(1);
    expect(saves.submitScore('테스터', finalState)).toHaveLength(1);
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
