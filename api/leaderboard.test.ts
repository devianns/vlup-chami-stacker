import { describe, expect, it } from 'vitest';
import { fnv1a, normalizeInput } from './leaderboard';

function validSubmission(): Record<string, unknown> {
  const nickname = '테스터';
  const drops = 1;
  const baseScore = 6_000;
  const packingBonus = 1_500;
  const packingRate = 50;
  const height = 120;
  const runSeed = 'test-run-1234';
  const contentVersion = '3.0.1';
  const playedAt = new Date().toISOString();
  const score = baseScore + packingBonus;
  const checksum = fnv1a([nickname, score, baseScore, packingBonus, packingRate, height, drops, runSeed, contentVersion, playedAt].join('|'));
  return { nickname, drops, baseScore, pieceCounts: { 'round-s': 1 }, packingBonus, packingRate, height, runSeed, contentVersion, playedAt, checksum };
}

describe('leaderboard submission validation', () => {
  it('accepts a self-consistent current-version score', () => {
    expect(normalizeInput(validSubmission())).toMatchObject({ nickname: '테스터', drops: 1, baseScore: 6_000 });
  });

  it('rejects a score when its checksum was changed', () => {
    expect(normalizeInput({ ...validSubmission(), checksum: 'deadbeef' })).toBeNull();
  });

  it('rejects malformed and physically impossible submissions', () => {
    expect(normalizeInput(null)).toBeNull();
    expect(normalizeInput({ ...validSubmission(), height: 721 })).toBeNull();
  });
});
