import type { StackerRunState } from '../types';

export const comboBonusForDrop = (drops: number): number => drops > 0 && drops % 5 === 0 ? drops * 10 : 0;
export const heightBonusFor = (height: number, scale: number): number => Math.max(0, Math.round(height * scale));
export const totalScore = (pieceScore: number, heightBonus: number, comboBonus: number): number => pieceScore + heightBonus + comboBonus;

export function isValidFinalScore(state: StackerRunState): boolean {
  return state.gameOver
    && Number.isSafeInteger(state.score)
    && state.score >= 0
    && state.score === totalScore(state.pieceScore, state.heightBonus, state.comboBonus)
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
