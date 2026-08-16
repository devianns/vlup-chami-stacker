import { describe, expect, it } from 'vitest';
import { isValidFinalScore, packingBonusFor, placementQuality, weightedTotalScore } from './StackerScoring';

describe('fair stacker scoring', () => {
  it('gives a better placement value to a Chami settled lower in the box', () => {
    expect(placementQuality(800, 200, 900)).toBeGreaterThan(placementQuality(400, 200, 900));
  });

  it('keeps the packing bonus smaller than the smallest size score', () => {
    expect(weightedTotalScore(6000, 0)).toBeGreaterThan(weightedTotalScore(0, 2999));
    expect(packingBonusFor(4000, 5, 2999)).toBe(2399);
  });

  it('rejects a forged total', () => {
    const state = { gameOver: true, score: 999, baseScore: 10000, packingBonus: 2000, packingRate: 20, height: 91, drops: 1, pieceCounts: { 'round-m': 1 }, runSeed: 'run-test' };
    expect(isValidFinalScore(state as never, { 'round-m': 10000 }, 2999)).toBe(false);
  });
});
