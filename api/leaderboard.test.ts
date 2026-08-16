import { describe, expect, it } from 'vitest';
import { scoreChecksum } from '../src/game/StackerScoring';
import { leaderboardRules, normalizeInput } from './leaderboard-validation';

function validSubmission(height = 120): Record<string, unknown> {
  const nickname = '테스터';
  const drops = 1;
  const baseScore = 6_000;
  const packingBonus = 1_500;
  const packingRate = 50;
  const runSeed = 'test-run-1234';
  const contentVersion = leaderboardRules.contentVersion;
  const playedAt = new Date().toISOString();
  const score = baseScore + packingBonus;
  const checksum = scoreChecksum({ nickname, score, baseScore, packingBonus, packingRate, height, drops, runSeed, contentVersion, playedAt });
  return { nickname, drops, baseScore, pieceCounts: { 'round-s': 1 }, packingBonus, packingRate, height, runSeed, contentVersion, playedAt, checksum };
}

describe('leaderboard submission validation', () => {
  it('accepts a self-consistent current-version score', () => {
    expect(normalizeInput(validSubmission())).toMatchObject({ nickname: '테스터', drops: 1, baseScore: 6_000 });
  });

  it('accepts the game-over Chami extending above the danger line', () => {
    expect(normalizeInput(validSubmission(leaderboardRules.maxHeight - 1))).not.toBeNull();
  });

  it('rejects a score when its checksum was changed', () => {
    expect(normalizeInput({ ...validSubmission(), checksum: 'deadbeef' })).toBeNull();
  });

  it('rejects malformed and physically impossible submissions', () => {
    expect(normalizeInput(null)).toBeNull();
    expect(normalizeInput(validSubmission(leaderboardRules.maxHeight + 1))).toBeNull();
  });
});
