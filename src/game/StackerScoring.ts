import type { StackerRunState } from '../types';

export const placementQuality = (pieceTop: number, dangerY: number, floorY: number): number => {
  const usableHeight = Math.max(1, floorY - dangerY);
  return Math.max(0, Math.min(1000, Math.round(((pieceTop - dangerY) / usableHeight) * 1000)));
};

export const packingBonusFor = (qualitySum: number, drops: number, maxBonus: number): number => {
  if (drops <= 0) return 0;
  return Math.max(0, Math.min(maxBonus, Math.round((qualitySum / drops / 1000) * maxBonus)));
};

export const totalScore = (drops: number, pointsPerChami: number, packingBonus: number): number => drops * pointsPerChami + packingBonus;

export function isValidFinalScore(state: StackerRunState, pointsPerChami: number, maxPackingBonus: number): boolean {
  return state.gameOver
    && Number.isSafeInteger(state.score)
    && state.score >= 0
    && state.baseScore === state.drops * pointsPerChami
    && state.packingBonus >= 0
    && state.packingBonus <= maxPackingBonus
    && state.score === totalScore(state.drops, pointsPerChami, state.packingBonus)
    && state.packingRate >= 0
    && state.packingRate <= 100
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
