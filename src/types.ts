export type PieceShape = 'circle' | 'capsule' | 'rectangle' | 'trapezoid' | 'fromVertices';

export interface ImageAsset { src: string }

export interface StackerPieceDefinition {
  name: string;
  points: number;
  texture: string;
  shape: PieceShape;
  width: number;
  height: number;
  radius?: number;
  mass: number;
  friction: number;
  frictionAir: number;
  restitution: number;
  angleJitter: number;
  collisionWidthScale?: number;
  collisionHeightScale?: number;
  trapezoidSlope?: number;
  collisionVertices?: Array<{ x: number; y: number }>;
  renderOrigin?: { x: number; y: number };
  centerOfMass?: { x: number; y: number };
}

export interface StackerGameProtocol {
  protocolVersion: 5;
  game: { id: string; title: string; subtitle: string; version: string };
  renderer: { width: number; height: number; background: string; backgroundImage?: string; arenaWidth: number; floorY: number; dangerY: number };
  physics: { gravityY: number; wallThickness: number; settleVelocity: number; settleMs: number };
  stacking: { previewY: number; spawnPadding: number; dangerGraceMs: number; nextPreviewCount: number; maxPackingBonus: number; randomHorizontalVelocity?: number; randomAngularVelocity?: number; bag: string[] };
  assets: { images: Record<string, ImageAsset> };
  pieces: Record<string, StackerPieceDefinition>;
  presenter: { name: string; idle: string; guide: string; cheer: string };
  titleScreen: { art: string; eyebrow: string; title: string; accent: string; subtitle: string; cta: string };
  dialogue: { start: string[]; drop: string[]; milestone: string[]; danger: string[]; gameOver: string[] };
}

export interface StackerSaveData {
  version: 3;
  contentId: string;
  contentVersion: string;
  bestScore: number;
  bestHeight: number;
  totalDrops: number;
  gamesPlayed: number;
  nickname: string;
  leaderboard: LocalScoreEntry[];
}

export type GameOverReason = 'limit-crossed';

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  packingRate: number;
  drops: number;
  playedAt: string;
  runSeed: string;
}

export interface LocalScoreEntry extends LeaderboardEntry {
  baseScore: number;
  packingBonus: number;
  height: number;
  pieceCounts: Record<string, number>;
  contentVersion: string;
  checksum: string;
}

export interface CompletedRunStats {
  score: number;
  height: number;
  drops: number;
}

export interface StackerRunState {
  score: number;
  baseScore: number;
  packingBonus: number;
  packingRate: number;
  height: number;
  drops: number;
  pieceCounts: Record<string, number>;
  bestScore: number;
  nextPieces: string[];
  message: string;
  gameOver: boolean;
  nearLimit: boolean;
  gameOverReason: GameOverReason | null;
  runSeed: string;
}
