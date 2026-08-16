import { GameAudio } from '../audio/GameAudio';
import { ContentError, loadStackerContent } from '../game/StackerContentLoader';
import { OnlineLeaderboard } from '../leaderboard/OnlineLeaderboard';
import { StackerSaveManager } from '../save/StackerSaveManager';
import type { LeaderboardEntry, StackerGameProtocol, StackerRunState } from '../types';
import type { StackerAppView } from '../ui/StackerAppView';
import type { StackerScene } from '../game/StackerScene';

const GAME_READY_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally {
    window.clearTimeout(timeout);
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, a, input, textarea, select, dialog');
}

export class StackerAppController {
  private readonly audio = new GameAudio();
  private currentState: StackerRunState | null = null;
  private previousAudioState: Pick<StackerRunState, 'drops' | 'gameOver' | 'nearLimit'> | null = null;
  private registeredRunSeed: string | null = null;

  constructor(private view: StackerAppView) {
    this.view.elements.soundToggles.forEach((button) => {
      button.addEventListener('click', () => { void this.toggleSound(); });
    });
    this.view.setSoundEnabled(this.audio.isEnabled());
  }

  async boot(): Promise<void> {
    try {
      const content = await loadStackerContent();
      this.view.applyContent(content);
      const saves = new StackerSaveManager(content);
      const online = new OnlineLeaderboard(content.game.version);
      const initialSave = saves.load();
      const [{ default: Phaser }, { StackerScene }] = await Promise.all([import('phaser'), import('../game/StackerScene')]);
      const scene = new StackerScene(content, initialSave.bestScore);
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        width: content.renderer.width,
        height: content.renderer.height,
        transparent: true,
        physics: { default: 'matter', matter: { gravity: { x: 0, y: content.physics.gravityY }, debug: false } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, pixelArt: false },
        scene,
      });
      try {
        await withTimeout(scene.waitUntilReady(), GAME_READY_TIMEOUT_MS, '게임 이미지 준비 시간이 너무 오래 걸리고 있어요.');
      } catch (error) {
        game.destroy(true);
        throw error;
      }
      scene.connect({
        onState: (state) => this.handleRunState(state, content),
        onRunComplete: (result) => saves.recordCompletedRun(result).bestScore,
        onDrop: () => this.audio.play('drop'),
      });
      this.configureDialogs(scene);
      this.configureLeaderboard(scene, saves, online);
      this.configureScoreSubmission(scene, saves, online);
      this.configureGameStart(scene);
      this.view.elements.nickname.value = initialSave.nickname;
      this.view.markReady(content.titleScreen.cta);
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('play')) this.openGame(scene);
    } catch (error) {
      const issues = error instanceof ContentError ? error.issues : [error instanceof Error ? error.message : String(error)];
      this.view.showBootError(`게임을 준비하지 못했어요: ${issues.join(' / ')}`);
      this.view.elements.enterGame.onclick = () => location.reload();
    }
  }

  private configureGameStart(scene: StackerScene): void {
    this.view.elements.enterGame.onclick = () => this.openGame(scene);
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.repeat || isInteractiveTarget(event.target)) return;
      this.openGame(scene);
    });
  }

  private openGame(scene: StackerScene): void {
    if (!this.view.isTitleReady() || this.view.hasOpenDialog()) return;
    scene.startRun();
    this.view.beginGame();
    this.audio.play('ui');
  }

  private configureDialogs(scene: StackerScene): void {
    const openScoreHelp = this.pausingDialog(scene, this.view.elements.scoreHelp);
    const openNotice = this.pausingDialog(scene, this.view.elements.noticeDialog);
    this.view.elements.scoreInfo.onclick = openScoreHelp;
    this.view.elements.titleNotice.onclick = openNotice;
    this.view.elements.appNotice.onclick = openNotice;
  }

  private configureLeaderboard(scene: StackerScene, saves: StackerSaveManager, online: OnlineLeaderboard): void {
    const openDialog = this.pausingDialog(scene, this.view.elements.leaderboardDialog);
    const applyOnlineRanking = (entries: LeaderboardEntry[], animate = false) => {
      this.view.renderLeaderboard(entries, animate);
      this.view.setRankingStatus('방금 전체 순위표를 새로 불러왔어요.');
    };
    const refreshRanking = async () => {
      this.view.setRankingBusy(true);
      try {
        applyOnlineRanking(await online.refresh(), this.view.elements.leaderboardDialog.open);
      } catch (error) {
        this.view.setRankingStatus(error instanceof Error ? error.message : '점수판을 불러오지 못했어요. 이 브라우저의 기록은 그대로 볼 수 있어요.');
      } finally {
        this.view.setRankingBusy(false);
      }
    };
    const showRanking = () => {
      const cached = online.cached();
      const initial = cached.length ? cached : saves.leaderboard();
      this.view.renderLeaderboard(initial);
      this.view.setRankingStatus(cached.length ? '미리 받아 둔 기록이에요. 최신 기록을 확인하고 있어요…' : '최신 기록을 불러오고 있어요…');
      openDialog();
      void refreshRanking();
    };
    online.warmup((entries) => {
      if (this.view.elements.leaderboardDialog.open) applyOnlineRanking(entries, true);
    });
    this.view.elements.titleRanking.onclick = showRanking;
    this.view.elements.appRanking.onclick = showRanking;
    this.view.elements.resultRanking.onclick = showRanking;
  }

  private configureScoreSubmission(scene: StackerScene, saves: StackerSaveManager, online: OnlineLeaderboard): void {
    this.view.elements.registerScore.onclick = async () => {
      const submittedState = this.currentState;
      if (!submittedState?.gameOver) return;
      let localResult: 'not-attempted' | 'saved' | 'outside-top-20' = 'not-attempted';
      this.view.setRegistrationBusy(true);
      try {
        const { entry, leaderboard } = saves.submitScore(this.view.elements.nickname.value, submittedState);
        const localRank = leaderboard.findIndex((candidate) => candidate.runSeed === entry.runSeed);
        localResult = localRank >= 0 ? 'saved' : 'outside-top-20';
        if (this.isCurrentRun(entry.runSeed)) this.view.elements.registerStatus.textContent = '온라인 순위표에 기록하고 있어요…';
        const entries = await online.submit(entry);
        const onlineRank = entries.findIndex((candidate) => candidate.runSeed === entry.runSeed);
        if (this.isCurrentRun(entry.runSeed)) {
          this.registeredRunSeed = entry.runSeed;
          this.view.elements.registerStatus.textContent = onlineRank >= 0
            ? `온라인 기록 저장 완료! 현재 ${onlineRank + 1}위예요.`
            : '온라인에 기록을 저장했어요! TOP 20에도 다시 도전해 보세요.';
          if (this.view.elements.leaderboardDialog.open) this.view.renderLeaderboard(entries, true);
          this.audio.play('saved');
        }
      } catch (error) {
        if (this.isCurrentRun(submittedState.runSeed)) {
          const localMessage = localResult === 'saved'
            ? ' 이 브라우저에는 기록을 보관했어요.'
            : localResult === 'outside-top-20'
              ? ' 이번 기록은 이 브라우저의 TOP 20 밖이에요.'
              : '';
          this.view.elements.registerStatus.textContent = `${error instanceof Error ? error.message : '온라인에 기록을 저장하지 못했어요.'}${localMessage}`;
        }
      } finally {
        if (this.isCurrentRun(submittedState.runSeed)) {
          this.view.setRegistrationBusy(false);
          this.view.setRegistrationComplete(this.registeredRunSeed === submittedState.runSeed);
        }
      }
    };
    this.view.elements.restart.onclick = () => {
      this.registeredRunSeed = null;
      this.view.resetRegistration();
      scene.restartRun();
    };
  }

  private pausingDialog(scene: StackerScene, dialog: HTMLDialogElement): () => void {
    let pausedByDialog = false;
    dialog.addEventListener('close', () => {
      if (pausedByDialog && scene.scene.isPaused()) scene.scene.resume();
      pausedByDialog = false;
    });
    return () => {
      if (this.view.hasOpenDialog()) return;
      pausedByDialog = scene.scene.isActive() && !scene.scene.isPaused();
      if (pausedByDialog) scene.scene.pause();
      dialog.showModal();
    };
  }

  private handleRunState(state: StackerRunState, content: StackerGameProtocol): void {
    if (this.previousAudioState) {
      if (state.gameOver && !this.previousAudioState.gameOver) this.audio.play('gameOver');
      else if (state.nearLimit && !this.previousAudioState.nearLimit) this.audio.play('danger');
      else if (state.drops > this.previousAudioState.drops) this.audio.play(state.drops % 5 === 0 ? 'milestone' : 'land');
    }
    this.previousAudioState = { drops: state.drops, gameOver: state.gameOver, nearLimit: state.nearLimit };
    this.currentState = state;
    this.view.renderRun(state, content);
  }

  private isCurrentRun(runSeed: string): boolean { return this.currentState?.runSeed === runSeed; }

  private async toggleSound(): Promise<void> {
    await this.audio.setEnabled(!this.audio.isEnabled());
    this.view.setSoundEnabled(this.audio.isEnabled());
  }
}
