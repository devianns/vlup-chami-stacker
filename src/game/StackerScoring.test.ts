import { describe, expect, it } from 'vitest';
import { comboBonusForDrop, heightBonusFor, isValidFinalScore, totalScore } from './StackerScoring';

describe('fair stacker scoring', () => {
  it('awards combo points only every fifth settled Chami', () => {
    expect(comboBonusForDrop(4)).toBe(0);
    expect(comboBonusForDrop(5)).toBe(50);
    expect(comboBonusForDrop(10)).toBe(100);
  });

  it('calculates a stable integer total', () => {
    const height = heightBonusFor(321, 0.22);
    expect(height).toBe(71);
    expect(totalScore(500, height, 50)).toBe(621);
  });

  it('rejects a forged total', () => {
    const state = { gameOver: true, score: 999, pieceScore: 100, heightBonus: 20, comboBonus: 0, height: 91, drops: 1, runSeed: 'run-test' };
    expect(isValidFinalScore(state as never)).toBe(false);
  });
});
