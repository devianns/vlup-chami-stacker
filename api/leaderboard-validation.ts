import stackerContent from '../public/game-data/stacker.json';
import { scoreChecksum } from '../src/game/StackerScoring';

const MAX_SCORE_AGE_MS = 24 * 60 * 60 * 1_000;

export const leaderboardRules = {
  contentVersion: stackerContent.game.version,
  maxPackingBonus: stackerContent.stacking.maxPackingBonus,
  maxDrops: 100,
  // Height includes the Chami that crosses the danger line. Its body may extend
  // above the canvas while still resting on the stack, so allow one tallest-piece
  // overhang instead of using only the playable height below the danger line.
  maxHeight: stackerContent.renderer.floorY + Math.max(...Object.values(stackerContent.pieces).map((piece) => piece.height)),
  piecePoints: Object.fromEntries(Object.entries(stackerContent.pieces).map(([id, piece]) => [id, piece.points])) as Record<string, number>,
} as const;

type ScoreInput = {
  nickname?: unknown;
  drops?: unknown;
  baseScore?: unknown;
  pieceCounts?: unknown;
  packingBonus?: unknown;
  packingRate?: unknown;
  height?: unknown;
  runSeed?: unknown;
  contentVersion?: unknown;
  checksum?: unknown;
  playedAt?: unknown;
};

export interface NormalizedScoreInput {
  nickname: string;
  drops: number;
  baseScore: number;
  pieceCounts: Record<string, number>;
  packingBonus: number;
  packingRate: number;
  height: number;
  runSeed: string;
  checksum: string;
}

export function normalizeInput(body: unknown, now = Date.now()): NormalizedScoreInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = body as ScoreInput;
  const nickname = typeof value.nickname === 'string'
    ? [...value.nickname.normalize('NFKC').replace(/[<>\u0000-\u001f]/g, '').trim()].slice(0, 12).join('')
    : '';
  const drops = Number(value.drops);
  const baseScore = Number(value.baseScore);
  const packingBonus = Number(value.packingBonus);
  const packingRate = Number(value.packingRate);
  const height = Number(value.height);
  const runSeed = typeof value.runSeed === 'string' ? value.runSeed.slice(0, 96) : '';
  const checksum = typeof value.checksum === 'string' ? value.checksum.slice(0, 64).toLowerCase() : '';
  const playedAt = typeof value.playedAt === 'string' ? value.playedAt.slice(0, 64) : '';
  if (!nickname
    || value.contentVersion !== leaderboardRules.contentVersion
    || !/^[a-z0-9-]{8,96}$/i.test(runSeed)
    || !/^[a-f0-9]{8}$/.test(checksum)) return null;
  if (![drops, baseScore, packingBonus, packingRate, height].every(Number.isSafeInteger)) return null;
  if (drops < 0 || drops > leaderboardRules.maxDrops
    || packingBonus < 0 || packingBonus > leaderboardRules.maxPackingBonus
    || packingRate < 0 || packingRate > 100
    || height < 0 || height > leaderboardRules.maxHeight) return null;
  if (!value.pieceCounts || typeof value.pieceCounts !== 'object' || Array.isArray(value.pieceCounts)) return null;
  const pieceCounts = value.pieceCounts as Record<string, unknown>;
  const countEntries = Object.entries(pieceCounts);
  if (countEntries.length > Object.keys(leaderboardRules.piecePoints).length) return null;
  if (!countEntries.every(([id, count]) => id in leaderboardRules.piecePoints && Number.isSafeInteger(count) && Number(count) >= 0)) return null;
  const expectedDrops = countEntries.reduce((sum, [, count]) => sum + Number(count), 0);
  const expectedBaseScore = countEntries.reduce((sum, [id, count]) => sum + leaderboardRules.piecePoints[id] * Number(count), 0);
  if (drops !== expectedDrops || baseScore !== expectedBaseScore) return null;
  const expectedRate = Math.round((packingBonus / Math.max(1, leaderboardRules.maxPackingBonus)) * 100);
  if (Math.abs(expectedRate - packingRate) > 1) return null;
  const playedAtTime = Date.parse(playedAt);
  if (!Number.isFinite(playedAtTime) || Math.abs(now - playedAtTime) > MAX_SCORE_AGE_MS) return null;
  const score = baseScore + packingBonus;
  const expectedChecksum = scoreChecksum({
    nickname,
    score,
    baseScore,
    packingBonus,
    packingRate,
    height,
    drops,
    runSeed,
    contentVersion: leaderboardRules.contentVersion,
    playedAt,
  });
  if (checksum !== expectedChecksum) return null;
  return { nickname, drops, baseScore, pieceCounts: pieceCounts as Record<string, number>, packingBonus, packingRate, height, runSeed, checksum };
}
