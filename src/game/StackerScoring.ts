import type { StackerRunState } from '../types';

export interface ScoreChecksumFields {
  nickname: string;
  score: number;
  baseScore: number;
  packingBonus: number;
  packingRate: number;
  height: number;
  drops: number;
  runSeed: string;
  contentVersion: string;
  playedAt: string;
}

export const placementQuality = (pieceTop: number, dangerY: number, floorY: number): number => {
  const usableHeight = Math.max(1, floorY - dangerY);
  return Math.max(0, Math.min(1000, Math.round(((pieceTop - dangerY) / usableHeight) * 1000)));
};

export const packingBonusFor = (qualitySum: number, drops: number, maxBonus: number): number => {
  if (drops <= 0) return 0;
  return Math.max(0, Math.min(maxBonus, Math.round((qualitySum / drops / 1000) * maxBonus)));
};

export const weightedTotalScore = (baseScore: number, packingBonus: number): number => baseScore + packingBonus;

export function isValidFinalScore(state: StackerRunState, piecePoints: Record<string, number>, maxPackingBonus: number): boolean {
  const counts = Object.entries(state.pieceCounts ?? {});
  const countedDrops = counts.reduce((sum, [, count]) => sum + count, 0);
  const expectedBaseScore = counts.reduce((sum, [id, count]) => sum + (piecePoints[id] ?? NaN) * count, 0);
  return state.gameOver
    && Number.isSafeInteger(state.score)
    && state.score >= 0
    && counts.every(([id, count]) => Number.isSafeInteger(count) && count >= 0 && Number.isSafeInteger(piecePoints[id]))
    && countedDrops === state.drops
    && state.baseScore === expectedBaseScore
    && state.packingBonus >= 0
    && state.packingBonus <= maxPackingBonus
    && state.score === weightedTotalScore(state.baseScore, state.packingBonus)
    && state.packingRate >= 0
    && state.packingRate <= 100
    && Math.abs(Math.round((state.packingBonus / Math.max(1, maxPackingBonus)) * 100) - state.packingRate) <= 1
    && state.height >= 0
    && state.drops >= 0
    && !!state.runSeed;
}

export function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function scoreChecksum(fields: ScoreChecksumFields): string {
  return fnv1a([
    fields.nickname,
    fields.score,
    fields.baseScore,
    fields.packingBonus,
    fields.packingRate,
    fields.height,
    fields.drops,
    fields.runSeed,
    fields.contentVersion,
    fields.playedAt,
  ].join('|'));
}
