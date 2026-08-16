import type { LocalScoreEntry, StackerGameProtocol, StackerRunState, StackerSaveData } from '../types';
import { fnv1a, isValidFinalScore } from '../game/StackerScoring';

const PREFIX = 'chami-stacker';

export class StackerSaveManager {
  constructor(private content: StackerGameProtocol) {}

  private get key(): string { return `${PREFIX}:${this.content.game.id}`; }

  create(): StackerSaveData {
    return { version: 2, contentId: this.content.game.id, contentVersion: this.content.game.version, bestScore: 0, bestHeight: 0, totalDrops: 0, gamesPlayed: 0, muted: false, nickname: '', leaderboard: [] };
  }

  load(): StackerSaveData {
    const raw = localStorage.getItem(this.key);
    if (!raw) return this.create();
    try {
      const parsed = JSON.parse(raw) as Partial<StackerSaveData>;
      if (parsed.contentId !== this.content.game.id) return this.create();
      const migrated = { ...this.create(), ...parsed, version: 2 as const, contentVersion: this.content.game.version };
      migrated.leaderboard = Array.isArray(parsed.leaderboard) ? parsed.leaderboard.slice(0, 20) : [];
      return migrated;
    } catch {
      return this.create();
    }
  }

  save(data: StackerSaveData): void { localStorage.setItem(this.key, JSON.stringify(data)); }

  leaderboard(): LocalScoreEntry[] { return this.load().leaderboard; }

  submitScore(nicknameInput: string, state: StackerRunState): LocalScoreEntry[] {
    const nickname = [...nicknameInput.normalize('NFKC').replace(/[<>\u0000-\u001f]/g, '').trim()].slice(0, 12).join('');
    if (this.load().leaderboard.some((entry) => entry.runSeed === state.runSeed)) {
      throw new Error('이 기록은 이미 저장했어요.');
    }
    if (!nickname) throw new Error('닉네임을 한 글자 이상 입력해 주세요.');
    if (!isValidFinalScore(state)) throw new Error('점수 정보를 확인할 수 없어요. 다시 플레이해 주세요.');
    const playedAt = new Date().toISOString();
    const payload = [nickname, state.score, state.pieceScore, state.heightBonus, state.comboBonus, state.height, state.drops, state.runSeed, this.content.game.version, playedAt].join('|');
    const entry: LocalScoreEntry = {
      id: `${Date.now().toString(36)}-${fnv1a(payload)}`,
      nickname,
      score: state.score,
      pieceScore: state.pieceScore,
      heightBonus: state.heightBonus,
      comboBonus: state.comboBonus,
      height: state.height,
      drops: state.drops,
      playedAt,
      runSeed: state.runSeed,
      contentVersion: this.content.game.version,
      checksum: fnv1a(payload),
    };
    const save = this.load();
    save.nickname = nickname;
    save.bestScore = Math.max(save.bestScore, entry.score);
    save.bestHeight = Math.max(save.bestHeight, entry.height);
    save.leaderboard = [...save.leaderboard, entry]
      .sort((a, b) => b.score - a.score || b.height - a.height || b.drops - a.drops || a.playedAt.localeCompare(b.playedAt))
      .slice(0, 20);
    this.save(save);
    return save.leaderboard;
  }
}
