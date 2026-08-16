import type { CompletedRunStats, LocalScoreEntry, StackerGameProtocol, StackerRunState, StackerSaveData } from '../types';
import { fnv1a, isValidFinalScore, scoreChecksum } from '../game/StackerScoring';
import { compareRankedScores, MAX_LEADERBOARD_ENTRIES, normalizeLocalLeaderboard } from '../leaderboard/ScoreEntries';

const PREFIX = 'chami-stacker';

export interface ScoreSubmission {
  entry: LocalScoreEntry;
  leaderboard: LocalScoreEntry[];
}

export class StackerSaveManager {
  constructor(private content: StackerGameProtocol) {}

  private get key(): string { return `${PREFIX}:${this.content.game.id}`; }

  create(): StackerSaveData {
    return { version: 3, contentId: this.content.game.id, contentVersion: this.content.game.version, bestScore: 0, bestHeight: 0, totalDrops: 0, gamesPlayed: 0, nickname: '', leaderboard: [] };
  }

  load(): StackerSaveData {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return this.create();
      const parsed = JSON.parse(raw) as Partial<StackerSaveData>;
      if (parsed.contentId !== this.content.game.id) return this.create();
      if (parsed.contentVersion !== this.content.game.version) {
        return { ...this.create(), nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '' };
      }
      const migrated = { ...this.create(), ...parsed, version: 3 as const, contentVersion: this.content.game.version };
      migrated.bestScore = Number.isSafeInteger(parsed.bestScore) && parsed.bestScore! >= 0 ? parsed.bestScore! : 0;
      migrated.bestHeight = Number.isSafeInteger(parsed.bestHeight) && parsed.bestHeight! >= 0 ? parsed.bestHeight! : 0;
      migrated.totalDrops = Number.isSafeInteger(parsed.totalDrops) && parsed.totalDrops! >= 0 ? parsed.totalDrops! : 0;
      migrated.gamesPlayed = Number.isSafeInteger(parsed.gamesPlayed) && parsed.gamesPlayed! >= 0 ? parsed.gamesPlayed! : 0;
      migrated.nickname = typeof parsed.nickname === 'string' ? [...parsed.nickname.normalize('NFKC')].slice(0, 12).join('') : '';
      migrated.leaderboard = normalizeLocalLeaderboard(parsed.leaderboard, this.content.game.version);
      return migrated;
    } catch {
      return this.create();
    }
  }

  save(data: StackerSaveData): void {
    try { localStorage.setItem(this.key, JSON.stringify(data)); }
    catch { /* Strict storage policies must not stop gameplay. */ }
  }

  leaderboard(): LocalScoreEntry[] { return this.load().leaderboard; }

  recordCompletedRun(result: CompletedRunStats): StackerSaveData {
    const save = this.load();
    save.bestScore = Math.max(save.bestScore, result.score);
    save.bestHeight = Math.max(save.bestHeight, result.height);
    save.totalDrops += result.drops;
    save.gamesPlayed += 1;
    this.save(save);
    return save;
  }

  submitScore(nicknameInput: string, state: StackerRunState): ScoreSubmission {
    const nickname = [...nicknameInput.normalize('NFKC').replace(/[<>\u0000-\u001f]/g, '').trim()].slice(0, 12).join('');
    const existingSave = this.load();
    const existingEntry = existingSave.leaderboard.find((entry) => entry.runSeed === state.runSeed);
    if (existingEntry) return { entry: existingEntry, leaderboard: existingSave.leaderboard };
    if (!nickname) throw new Error('닉네임을 한 글자 이상 입력해 주세요.');
    const piecePoints = Object.fromEntries(Object.entries(this.content.pieces).map(([id, piece]) => [id, piece.points]));
    if (!isValidFinalScore(state, piecePoints, this.content.stacking.maxPackingBonus)) throw new Error('점수 정보를 확인할 수 없어요. 다시 플레이해 주세요.');
    const playedAt = new Date().toISOString();
    const checksumFields = {
      nickname,
      score: state.score,
      baseScore: state.baseScore,
      packingBonus: state.packingBonus,
      packingRate: state.packingRate,
      height: state.height,
      drops: state.drops,
      runSeed: state.runSeed,
      contentVersion: this.content.game.version,
      playedAt,
    };
    const checksum = scoreChecksum(checksumFields);
    const entry: LocalScoreEntry = {
      id: `${Date.now().toString(36)}-${fnv1a(`${state.runSeed}|${checksum}`)}`,
      nickname,
      score: state.score,
      baseScore: state.baseScore,
      packingBonus: state.packingBonus,
      packingRate: state.packingRate,
      height: state.height,
      drops: state.drops,
      pieceCounts: { ...state.pieceCounts },
      playedAt,
      runSeed: state.runSeed,
      contentVersion: this.content.game.version,
      checksum,
    };
    const save = existingSave;
    save.nickname = nickname;
    save.bestScore = Math.max(save.bestScore, entry.score);
    save.bestHeight = Math.max(save.bestHeight, entry.height);
    save.leaderboard = [...save.leaderboard, entry]
      .sort(compareRankedScores)
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    this.save(save);
    return { entry, leaderboard: save.leaderboard };
  }
}
