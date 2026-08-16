import Phaser from 'phaser';
import type { GameOverReason, StackerGameProtocol, StackerPieceDefinition, StackerRunState, StackerSaveData } from '../types';
import { packingBonusFor, placementQuality, weightedTotalScore } from './StackerScoring';

type StateHandler = (state: StackerRunState) => void;
type SaveHandler = (save: StackerSaveData) => void;
type DropHandler = () => void;

interface ChamiPiece extends Phaser.Physics.Matter.Image {
  pieceId?: string;
  droppedAt?: number;
  counted?: boolean;
}

export class StackerScene extends Phaser.Scene {
  private preview?: ChamiPiece;
  private pieces: ChamiPiece[] = [];
  private queue: string[] = [];
  private stateHandler?: StateHandler;
  private saveHandler?: SaveHandler;
  private dropHandler?: DropHandler;
  private score = 0;
  private baseScore = 0;
  private packingBonus = 0;
  private packingRate = 0;
  private packingQualitySum = 0;
  private height = 0;
  private drops = 0;
  private pieceCounts: Record<string, number> = {};
  private dangerSince = 0;
  private gameOver = false;
  private gameOverReason: GameOverReason | null = null;
  private runSeed = '';
  private bagQueue: string[] = [];
  private randomState = 1;
  private message = '';
  private saveData: StackerSaveData;
  private lastDropAt = 0;
  private started = false;
  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (error: Error) => void;

  constructor(private content: StackerGameProtocol, saveData: StackerSaveData) {
    super('chami-stacker');
    this.saveData = { ...saveData };
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
  }

  preload(): void {
    const gameTextures = new Set(Object.values(this.content.pieces).map((piece) => piece.texture));
    if (this.content.renderer.backgroundImage) gameTextures.add(this.content.renderer.backgroundImage);
    gameTextures.forEach((id) => this.load.image(id, this.content.assets.images[id].src));
    this.load.once('loaderror', (file: { key?: string }) => {
      this.rejectReady(new Error(`게임 이미지(${file.key ?? '알 수 없음'})를 불러오지 못했어요.`));
    });
  }

  create(): void {
    const { width, height, arenaWidth, floorY, dangerY } = this.content.renderer;
    const wall = this.content.physics.wallThickness;
    const left = (width - arenaWidth) / 2;
    const right = left + arenaWidth;

    this.cameras.main.setBackgroundColor(this.content.renderer.background);
    if (this.content.renderer.backgroundImage) {
      this.add.image(width / 2, height / 2, this.content.renderer.backgroundImage).setDisplaySize(width, height).setDepth(-10).setAlpha(0.88);
    }
    this.add.rectangle(width / 2, floorY + wall / 2, arenaWidth + wall * 2, wall, 0xf3d6b0).setDepth(-1);
    this.add.rectangle(left - wall / 2, height / 2, wall, height, 0xf3d6b0).setDepth(-1);
    this.add.rectangle(right + wall / 2, height / 2, wall, height, 0xf3d6b0).setDepth(-1);
    this.matter.add.rectangle(width / 2, floorY + wall / 2, arenaWidth + wall * 2, wall, { isStatic: true, friction: 0.9 });
    this.matter.add.rectangle(left - wall / 2, height / 2, wall, height, { isStatic: true, friction: 0.9 });
    this.matter.add.rectangle(right + wall / 2, height / 2, wall, height, { isStatic: true, friction: 0.9 });

    const danger = this.add.graphics();
    danger.lineStyle(3, 0xf08c8c, 0.55).lineBetween(left + 8, dangerY, right - 8, dangerY);
    this.add.text(left + 14, dangerY - 28, '여기까지 쌓이면 큰일', { fontFamily: 'sans-serif', fontSize: '18px', color: '#b85f68' });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.movePreview(pointer.x));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      this.movePreview(pointer.x);
      this.dropPreview();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.dropPreview());
    this.input.keyboard?.on('keydown-LEFT', () => this.nudgePreview(-28));
    this.input.keyboard?.on('keydown-RIGHT', () => this.nudgePreview(28));

    this.events.on('restart-run', () => this.restartRun());
    this.resetRun();
    this.resolveReady();
  }

  update(time: number): void {
    if (!this.started || this.gameOver) return;
    let changed = false;
    let settledThisFrame = false;
    for (const piece of [...this.pieces]) {
      if (piece.y > this.content.renderer.height + 140) {
        this.finishRun('limit-crossed');
        return;
      }
      if (!piece.counted && piece.droppedAt && time - piece.droppedAt >= this.content.physics.settleMs) {
        const body = piece.body as MatterJS.BodyType;
        if (body.speed <= this.content.physics.settleVelocity && body.angularSpeed <= 0.035) {
          piece.counted = true;
          settledThisFrame = true;
          this.message = this.pieceTop(piece) < this.content.renderer.dangerY
            ? this.pick('danger')
            : this.pick('drop');
          changed = true;
          if (!this.preview) this.time.delayedCall(180, () => this.spawnPreview());
        }
      }
    }

    if (this.recalculateScoreFromBoard()) {
      if (settledThisFrame && this.drops > 0 && this.drops % 5 === 0) this.message = this.pick('milestone');
      changed = true;
    }
    const inDanger = this.pieces.some((piece) => piece.counted && this.pieceTop(piece) < this.content.renderer.dangerY);
    if (inDanger) {
      if (!this.dangerSince) { this.dangerSince = time; this.message = this.pick('danger'); changed = true; }
      if (time - this.dangerSince >= this.content.stacking.dangerGraceMs) { this.finishRun('limit-crossed'); return; }
    } else this.dangerSince = 0;
    if (changed) this.emitState();
  }

  connect(stateHandler: StateHandler, saveHandler: SaveHandler, dropHandler?: DropHandler): void {
    this.stateHandler = stateHandler;
    this.saveHandler = saveHandler;
    this.dropHandler = dropHandler;
    this.emitState();
  }

  waitUntilReady(): Promise<void> { return this.readyPromise; }

  restartRun(): void { this.resetRun(); }

  startRun(): void { this.started = true; }

  private resetRun(): void {
    this.pieces.forEach((piece) => piece.destroy());
    this.preview?.destroy();
    this.preview = undefined;
    this.pieces = [];
    this.queue = [];
    this.bagQueue = [];
    this.score = 0;
    this.baseScore = 0;
    this.packingBonus = 0;
    this.packingRate = 0;
    this.packingQualitySum = 0;
    this.height = 0;
    this.drops = 0;
    this.pieceCounts = {};
    this.dangerSince = 0;
    this.gameOver = false;
    this.gameOverReason = null;
    this.lastDropAt = 0;
    this.runSeed = this.createRunSeed();
    this.randomState = this.seedNumber(this.runSeed);
    this.message = this.pick('start');
    this.fillQueue();
    this.spawnPreview();
    this.emitState();
  }

  private fillQueue(): void {
    while (this.queue.length < this.content.stacking.nextPreviewCount + 1) {
      if (!this.bagQueue.length) this.bagQueue = this.shuffleBag(this.content.stacking.bag);
      this.queue.push(this.bagQueue.shift()!);
    }
  }

  private shuffleBag(source: string[]): string[] {
    const bag = [...source];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.nextRandom() * (index + 1));
      [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
    }
    return bag;
  }

  private spawnPreview(): void {
    if (this.preview || this.gameOver) return;
    this.fillQueue();
    const id = this.queue.shift()!;
    this.fillQueue();
    const definition = this.content.pieces[id];
    const image = this.matter.add.image(this.content.renderer.width / 2, this.content.stacking.previewY, definition.texture, undefined, { isStatic: true, isSensor: true }) as ChamiPiece;
    image.setDisplaySize(definition.width, definition.height).setDepth(3).setAlpha(0.9);
    image.pieceId = id;
    this.applyBody(image, definition, true);
    this.preview = image;
    this.emitState();
  }

  private applyBody(image: ChamiPiece, definition: StackerPieceDefinition, preview: boolean): void {
    const bodyWidth = definition.width * (definition.collisionWidthScale ?? 0.82);
    const bodyHeight = definition.height * (definition.collisionHeightScale ?? (definition.shape === 'capsule' ? 0.78 : 0.86));
    if (definition.shape === 'fromVertices' && definition.collisionVertices) {
      image.setBody({
        type: 'fromVertices',
        verts: definition.collisionVertices.map((vertex) => ({ x: vertex.x * definition.width, y: vertex.y * definition.height })),
      });
    } else if (definition.shape === 'circle') image.setCircle(definition.radius ?? Math.min(definition.width, definition.height) / 2);
    else if (definition.shape === 'trapezoid') image.setTrapezoid(bodyWidth, bodyHeight, definition.trapezoidSlope ?? 0.22);
    else image.setRectangle(bodyWidth, bodyHeight);
    if (definition.centerOfMass) {
      const body = image.body as MatterJS.BodyType;
      const offsetX = bodyWidth * definition.centerOfMass.x;
      const offsetY = bodyHeight * definition.centerOfMass.y;
      body.position.x += offsetX;
      body.position.y += offsetY;
      body.positionPrev.x += offsetX;
      body.positionPrev.y += offsetY;
    }
    if (definition.renderOrigin) image.setOrigin(definition.renderOrigin.x, definition.renderOrigin.y);
    image.setStatic(preview).setSensor(preview).setFriction(definition.friction).setFrictionAir(definition.frictionAir).setBounce(definition.restitution).setMass(definition.mass);
  }

  private movePreview(pointerX: number): void {
    if (!this.started || !this.preview) return;
    const definition = this.content.pieces[this.preview.pieceId!];
    const halfArena = this.content.renderer.arenaWidth / 2;
    const min = this.content.renderer.width / 2 - halfArena + definition.width / 2 + this.content.stacking.spawnPadding;
    const max = this.content.renderer.width / 2 + halfArena - definition.width / 2 - this.content.stacking.spawnPadding;
    this.preview.setPosition(Phaser.Math.Clamp(pointerX, min, max), this.content.stacking.previewY);
  }

  private nudgePreview(amount: number): void { if (this.preview) this.movePreview(this.preview.x + amount); }

  private dropPreview(): void {
    if (!this.started || !this.preview || this.gameOver || this.time.now - this.lastDropAt < 180) return;
    const piece = this.preview;
    const definition = this.content.pieces[piece.pieceId!];
    this.preview = undefined;
    this.lastDropAt = this.time.now;
    this.applyBody(piece, definition, false);
    const angleFactor = this.nextRandom() * 2 - 1;
    piece.setAlpha(1).setAngle(angleFactor * definition.angleJitter);
    piece.setVelocityX(angleFactor * (this.content.stacking.randomHorizontalVelocity ?? 0));
    piece.setAngularVelocity((this.nextRandom() * 2 - 1) * (this.content.stacking.randomAngularVelocity ?? 0));
    piece.droppedAt = this.time.now;
    this.pieces.push(piece);
    this.dropHandler?.();
    this.emitState();
  }

  private recalculateHeight(): void {
    const settled = this.pieces.filter((piece) => piece.counted);
    if (!settled.length) return;
    const top = Math.min(...settled.map((piece) => this.pieceTop(piece)));
    const nextHeight = Math.max(0, Math.round(this.content.renderer.floorY - top));
    this.height = Math.max(this.height, nextHeight);
  }

  private finishRun(reason: GameOverReason): void {
    if (this.gameOver) return;
    this.finalizeScoreFromBoard();
    this.gameOver = true;
    this.gameOverReason = reason;
    this.preview?.destroy();
    this.preview = undefined;
    this.message = this.pick('gameOver');
    this.saveData = {
      ...this.saveData,
      contentVersion: this.content.game.version,
      bestScore: Math.max(this.saveData.bestScore, this.score),
      bestHeight: Math.max(this.saveData.bestHeight, this.height),
      totalDrops: this.saveData.totalDrops + this.drops,
      gamesPlayed: this.saveData.gamesPlayed + 1,
    };
    this.saveHandler?.(this.saveData);
    this.emitState();
  }

  private pick(key: keyof StackerGameProtocol['dialogue']): string {
    return Phaser.Utils.Array.GetRandom(this.content.dialogue[key]);
  }

  private createRunSeed(): string {
    const values = new Uint32Array(2);
    globalThis.crypto?.getRandomValues?.(values);
    return `${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`;
  }

  private seedNumber(seed: string): number {
    let value = 2166136261;
    for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
    return value >>> 0 || 1;
  }

  private nextRandom(): number {
    this.randomState = (this.randomState + 0x6D2B79F5) >>> 0;
    let value = this.randomState;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  private recalculateScoreFromBoard(): boolean {
    const previous = `${this.score}|${this.baseScore}|${this.packingBonus}|${this.packingRate}|${this.height}|${this.drops}`;
    const eligible = this.pieces.filter((piece) => piece.counted && this.pieceTop(piece) >= this.content.renderer.dangerY);
    this.drops = eligible.length;
    this.pieceCounts = {};
    eligible.forEach((piece) => { this.pieceCounts[piece.pieceId!] = (this.pieceCounts[piece.pieceId!] ?? 0) + 1; });
    this.packingQualitySum = eligible.reduce((sum, piece) => sum + placementQuality(this.pieceTop(piece), this.content.renderer.dangerY, this.content.renderer.floorY), 0);
    this.baseScore = Object.entries(this.pieceCounts).reduce((sum, [id, count]) => sum + this.content.pieces[id].points * count, 0);
    this.packingBonus = packingBonusFor(this.packingQualitySum, this.drops, this.content.stacking.maxPackingBonus);
    this.packingRate = this.drops ? Math.round(this.packingQualitySum / this.drops / 10) : 0;
    this.score = weightedTotalScore(this.baseScore, this.packingBonus);
    this.recalculateHeight();
    return previous !== `${this.score}|${this.baseScore}|${this.packingBonus}|${this.packingRate}|${this.height}|${this.drops}`;
  }

  private finalizeScoreFromBoard(): void {
    this.recalculateScoreFromBoard();
  }

  private emitState(): void {
    const nearLimit = this.pieces.some((piece) => piece.counted && this.pieceTop(piece) < this.content.renderer.dangerY + 120);
    this.stateHandler?.({ score: this.score, baseScore: this.baseScore, packingBonus: this.packingBonus, packingRate: this.packingRate, height: this.height, drops: this.drops, pieceCounts: { ...this.pieceCounts }, bestScore: Math.max(this.saveData.bestScore, this.score), nextPieces: [...this.queue].slice(0, this.content.stacking.nextPreviewCount), message: this.message, gameOver: this.gameOver, nearLimit, gameOverReason: this.gameOverReason, runSeed: this.runSeed });
  }

  private pieceTop(piece: ChamiPiece): number {
    return (piece.body as MatterJS.BodyType).bounds.min.y;
  }
}
