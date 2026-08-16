export type PieceShape = 'circle' | 'capsule' | 'rectangle';

export interface ImageAsset { src: string }

export interface StackerPieceDefinition {
  name: string;
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
  score: number;
  weight: number;
  centerOfMass?: { x: number; y: number };
}

export interface StackerGameProtocol {
  protocolVersion: 4;
  game: { id: string; title: string; subtitle: string; version: string };
  renderer: { width: number; height: number; background: string; arenaWidth: number; floorY: number; dangerY: number };
  physics: { gravityY: number; wallThickness: number; settleVelocity: number; settleMs: number };
  stacking: { lives: number; previewY: number; spawnPadding: number; dangerGraceMs: number; nextPreviewCount: number; heightScoreScale: number };
  assets: { images: Record<string, ImageAsset> };
  pieces: Record<string, StackerPieceDefinition>;
  dialogue: { start: string[]; drop: string[]; combo: string[]; danger: string[]; gameOver: string[] };
}

export interface StackerSaveData {
  version: 1;
  contentId: string;
  contentVersion: string;
  bestScore: number;
  bestHeight: number;
  totalDrops: number;
  gamesPlayed: number;
  muted: boolean;
}

export interface StackerRunState {
  score: number;
  height: number;
  lives: number;
  drops: number;
  bestScore: number;
  nextPieces: string[];
  message: string;
  gameOver: boolean;
}
