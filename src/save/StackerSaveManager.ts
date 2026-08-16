import type { StackerGameProtocol, StackerSaveData } from '../types';

const PREFIX = 'chami-stacker';

export class StackerSaveManager {
  constructor(private content: StackerGameProtocol) {}

  private get key(): string { return `${PREFIX}:${this.content.game.id}`; }

  create(): StackerSaveData {
    return { version: 1, contentId: this.content.game.id, contentVersion: this.content.game.version, bestScore: 0, bestHeight: 0, totalDrops: 0, gamesPlayed: 0, muted: false };
  }

  load(): StackerSaveData {
    const raw = localStorage.getItem(this.key);
    if (!raw) return this.create();
    try {
      const parsed = JSON.parse(raw) as Partial<StackerSaveData>;
      if (parsed.version !== 1 || parsed.contentId !== this.content.game.id) return this.create();
      return { ...this.create(), ...parsed, contentVersion: this.content.game.version };
    } catch {
      return this.create();
    }
  }

  save(data: StackerSaveData): void { localStorage.setItem(this.key, JSON.stringify(data)); }
}
