import { describe, expect, it } from 'vitest';
import { isValidFinalScore, packingBonusFor, placementQuality, totalScore } from './StackerScoring';

describe('fair stacker scoring', () => {
  it('gives a better placement value to a Chami settled lower in the box', () => {
    expect(placementQuality(800, 200, 900)).toBeGreaterThan(placementQuality(400, 200, 900));
  });

  it('always ranks one more Chami above the maximum packing bonus', () => {
    expect(totalScore(6, 10000, 0)).toBeGreaterThan(totalScore(5, 10000, 9999));
    expect(packingBonusFor(4000, 5, 9999)).toBe(7999);
  });

  it('rejects a forged total', () => {
    const state = { gameOver: true, score: 999, baseScore: 10000, packingBonus: 2000, packingRate: 20, height: 91, drops: 1, runSeed: 'run-test' };
    expect(isValidFinalScore(state as never, 10000, 9999)).toBe(false);
  });
});
