import Phaser from 'phaser';
import type { StackerGameProtocol, StackerPieceDefinition, StackerRunState, StackerSaveData } from '../types';

type StateHandler = (state: StackerRunState) => void;
type SaveHandler = (save: StackerSaveData) => void;

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
  private score = 0;
  private height = 0;
  private lives = 0;
  private drops = 0;
  private dangerSince = 0;
  private gameOver = false;
  private message = '';
  private saveData: StackerSaveData;
  private lastDropAt = 0;

  constructor(private content: StackerGameProtocol, saveData: StackerSaveData) {
    super('chami-stacker');
    this.saveData = { ...saveData };
  }

  preload(): void {
    Object.entries(this.content.assets.images).forEach(([id, asset]) => this.load.image(id, asset.src));
  }

  create(): void {
    const { width, height, arenaWidth, floorY, dangerY } = this.content.renderer;
    const wall = this.content.physics.wallThickness;
    const left = (width - arenaWidth) / 2;
    const right = left + arenaWidth;

    this.cameras.main.setBackgroundColor(this.content.renderer.background);
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      this.movePreview(pointer.x);
      this.dropPreview();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.dropPreview());
    this.input.keyboard?.on('keydown-LEFT', () => this.nudgePreview(-28));
    this.input.keyboard?.on('keydown-RIGHT', () => this.nudgePreview(28));

    this.events.on('restart-run', () => this.restartRun());
    this.resetRun();
  }

  update(time: number): void {
    if (this.gameOver) return;
    let changed = false;
    for (const piece of [...this.pieces]) {
      if (piece.y > this.content.renderer.height + 140) {
        this.pieces = this.pieces.filter((candidate) => candidate !== piece);
        piece.destroy();
        this.lives -= 1;
        this.message = this.pick('danger');
        changed = true;
        if (this.lives <= 0) { this.finishRun(); return; }
        if (!this.preview) this.time.delayedCall(250, () => this.spawnPreview());
        continue;
      }
      if (!piece.counted && piece.droppedAt && time - piece.droppedAt >= this.content.physics.settleMs) {
        const body = piece.body as MatterJS.BodyType;
        if (body.speed <= this.content.physics.settleVelocity && body.angularSpeed <= 0.035) {
          piece.counted = true;
          const definition = this.content.pieces[piece.pieceId!];
          this.drops += 1;
          this.score += definition.score;
          this.message = this.drops % 5 === 0 ? this.pick('combo') : this.pick('drop');
          this.recalculateHeight();
          changed = true;
          if (!this.preview) this.time.delayedCall(180, () => this.spawnPreview());
        }
      }
    }

    const inDanger = this.pieces.some((piece) => piece.counted && piece.y - piece.displayHeight * 0.42 < this.content.renderer.dangerY);
    if (inDanger) {
      if (!this.dangerSince) { this.dangerSince = time; this.message = this.pick('danger'); changed = true; }
      if (time - this.dangerSince >= this.content.stacking.dangerGraceMs) { this.finishRun(); return; }
    } else this.dangerSince = 0;
    if (changed) this.emitState();
  }

  connect(stateHandler: StateHandler, saveHandler: SaveHandler): void {
    this.stateHandler = stateHandler;
    this.saveHandler = saveHandler;
    this.emitState();
  }

  restartRun(): void { this.resetRun(); }

  private resetRun(): void {
    this.pieces.forEach((piece) => piece.destroy());
    this.preview?.destroy();
    this.preview = undefined;
    this.pieces = [];
    this.queue = [];
    this.score = 0;
    this.height = 0;
    this.lives = this.content.stacking.lives;
    this.drops = 0;
    this.dangerSince = 0;
    this.gameOver = false;
    this.message = this.pick('start');
    this.fillQueue();
    this.spawnPreview();
    this.emitState();
  }

  private fillQueue(): void {
    while (this.queue.length < this.content.stacking.nextPreviewCount + 1) this.queue.push(this.weightedPiece());
  }

  private weightedPiece(): string {
    const entries = Object.entries(this.content.pieces);
    const total = entries.reduce((sum, [, piece]) => sum + piece.weight, 0);
    let roll = Math.random() * total;
    for (const [id, piece] of entries) { roll -= piece.weight; if (roll <= 0) return id; }
    return entries[entries.length - 1][0];
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
    if (definition.shape === 'circle') image.setCircle(definition.radius ?? Math.min(definition.width, definition.height) / 2);
    else image.setRectangle(definition.width * 0.82, definition.height * (definition.shape === 'capsule' ? 0.78 : 0.86));
    image.setStatic(preview).setSensor(preview).setFriction(definition.friction).setFrictionAir(definition.frictionAir).setBounce(definition.restitution).setMass(definition.mass);
  }

  private movePreview(pointerX: number): void {
    if (!this.preview) return;
    const definition = this.content.pieces[this.preview.pieceId!];
    const halfArena = this.content.renderer.arenaWidth / 2;
    const min = this.content.renderer.width / 2 - halfArena + definition.width / 2 + this.content.stacking.spawnPadding;
    const max = this.content.renderer.width / 2 + halfArena - definition.width / 2 - this.content.stacking.spawnPadding;
    this.preview.setPosition(Phaser.Math.Clamp(pointerX, min, max), this.content.stacking.previewY);
  }

  private nudgePreview(amount: number): void { if (this.preview) this.movePreview(this.preview.x + amount); }

  private dropPreview(): void {
    if (!this.preview || this.gameOver || this.time.now - this.lastDropAt < 180) return;
    const piece = this.preview;
    const definition = this.content.pieces[piece.pieceId!];
    this.preview = undefined;
    this.lastDropAt = this.time.now;
    this.applyBody(piece, definition, false);
    piece.setAlpha(1).setAngle(Phaser.Math.FloatBetween(-definition.angleJitter, definition.angleJitter));
    piece.droppedAt = this.time.now;
    this.pieces.push(piece);
    this.emitState();
  }

  private recalculateHeight(): void {
    const settled = this.pieces.filter((piece) => piece.counted);
    if (!settled.length) return;
    const top = Math.min(...settled.map((piece) => piece.y - piece.displayHeight * 0.42));
    const nextHeight = Math.max(0, Math.round(this.content.renderer.floorY - top));
    if (nextHeight > this.height) this.score += Math.round((nextHeight - this.height) * this.content.stacking.heightScoreScale);
    this.height = Math.max(this.height, nextHeight);
  }

  private finishRun(): void {
    if (this.gameOver) return;
    this.gameOver = true;
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

  private emitState(): void {
    this.stateHandler?.({ score: this.score, height: this.height, lives: this.lives, drops: this.drops, bestScore: Math.max(this.saveData.bestScore, this.score), nextPieces: [...this.queue].slice(0, this.content.stacking.nextPreviewCount), message: this.message, gameOver: this.gameOver });
  }
}
