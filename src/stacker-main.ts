import Phaser from 'phaser';
import './fonts.css';
import './stacker.css';
import { ContentError, loadStackerContent } from './game/StackerContentLoader';
import { StackerScene } from './game/StackerScene';
import { StackerSaveManager } from './save/StackerSaveManager';
import { OnlineLeaderboard } from './leaderboard/OnlineLeaderboard';
import { GameAudio } from './audio/GameAudio';
import type { LocalScoreEntry, StackerRunState } from './types';

document.body.innerHTML = `
  <section id="title-screen" class="title-screen" aria-labelledby="title-logo">
    <img id="title-art" class="title-art" alt="시트리와 차미가 함께하는 차미 쌓기 게임" />
    <div class="title-shade"></div>
    <div class="title-copy">
      <span id="title-eyebrow" class="title-eyebrow">SITRY × CHAMI</span>
      <h1 id="title-logo"><span>차미 쌓기</span><strong>게임!</strong></h1>
      <p id="title-description">말랑한 차미를 아슬아슬 쌓아 보세요!</p>
      <button id="enter-game" type="button" disabled><span>준비 중…</span><i>▶</i></button>
      <button id="title-sound" class="sound-toggle title-sound" type="button" aria-pressed="false"><i>🔇</i><span>소리 켜기</span></button>
      <button id="title-ranking" class="title-ranking" type="button" disabled>🏆 전체 순위표 보기</button>
      <button id="title-notice" class="title-notice" type="button" disabled>ⓘ 팬게임 이용 안내</button>
      <small>CLICK / ENTER</small>
    </div>
    <p class="title-legal">비영리 팬게임 · Original By Creatorbus Inc. · <a href="https://www.youtube.com/@sitry_vlup" target="_blank" rel="noopener noreferrer">시트리 공식 유튜브</a><br>캐릭터·배경·타이틀 등 시각 에셋 제작에 생성형 AI를 사용했습니다.</p>
  </section>
  <main class="app-shell">
    <header class="title-block">
      
      <h1 id="game-title">차미를 불러오는 중…</h1>
      <p id="game-subtitle">잠시만 기다려 주세요.</p>
    </header>
    <section class="game-layout">
      <aside class="score-panel" aria-label="현재 기록">
        <button id="score-info" class="score-info" type="button" aria-expanded="false" aria-controls="score-help" title="점수 규칙 보기">i</button>
        <section id="score-help" class="score-help" hidden>
          <strong>점수는 이렇게 계산해요</strong>
          <p id="score-size-rule"></p>
          <p id="score-bonus-rule"></p>
          <small>총점이 높은 순서로 순위가 정해지고, 동점이면 밀집도와 차미 개수를 차례로 비교해요.</small>
        </section>
        <div><span>점수</span><strong id="score">0</strong></div>
        <div><span>쌓은 차미</span><strong><b id="drops">0</b>개</strong></div>
        <div><span>최고점</span><strong id="best-score">0</strong></div>
        <div><span>밀집도</span><strong><b id="packing-rate">0</b>%</strong></div>
      </aside>
      <div class="stage-wrap">
        <div id="game" aria-label="차미 스태커 게임 화면"></div>
        <div id="loading" class="loading">게임 데이터를 검사하고 있어요…</div>
        <div id="game-over" class="game-over hidden" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div class="result-card">
            <span id="result-reason" class="result-kicker">와르르…!</span>
            <h2 id="result-title">이번 차미탑은 여기까지!</h2>
            <strong id="result-score">0</strong><small>FINAL SCORE</small>
            <dl class="score-breakdown">
              <div><dt>차미 크기 점수</dt><dd id="result-base-score">0</dd></div>
              <div><dt>빈틈 보너스</dt><dd id="result-packing-bonus">0</dd></div>
              <div><dt>평균 밀집도</dt><dd id="result-packing-rate">0%</dd></div>
            </dl>
            <p>차미 <b id="result-drops">0</b>개 · 높이 <b id="result-height">0</b>cm</p>
            <label class="nickname-field"><span>기록에 남길 닉네임</span><input id="nickname" maxlength="12" autocomplete="nickname" placeholder="1~12자로 입력해 주세요" /></label>
            <button id="register-score" class="primary-result" type="button">전체 순위표에 등록하기</button>
            <em id="register-status" aria-live="polite"></em>
            <div class="result-actions"><button id="restart" type="button">다시 쌓기</button><button id="result-ranking" type="button">전체 순위표</button></div>
          </div>
        </div>
      </div>
      <aside class="next-panel" aria-label="다음 차미">
        <div class="host-row">
          <div class="presenter-stage"><img id="presenter" class="presenter" alt="시트리" /><b>시트리</b></div>
          <section class="speech" aria-live="polite"><i></i><strong>시트리</strong><p id="message">차미를 고르는 중이에요…</p></section>
        </div>
        <div class="next-queue"><span>다음 차미</span><div id="next-pieces"></div></div>
        <small>빨간 선을 넘지 않도록 빈틈을 채우세요.<br>위치를 잡고 클릭하면 놓을 수 있어요.<br><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd>도 가능!</small>
      </aside>
    </section>
    <div class="mobile-bottom-bar">
      <div class="game-legal-watermark" aria-hidden="true">
        <strong>비영리 팬게임 · Original By Creatorbus Inc.</strong>
        <span>캐릭터·배경·타이틀 등 시각 에셋 제작에 생성형 AI를 사용했습니다.</span>
      </div>
      <nav class="floating-actions" aria-label="빠른 메뉴">
        <button id="game-sound" class="sound-toggle game-sound" type="button" aria-pressed="false" aria-label="소리 켜기"><i>🔇</i><span>소리 켜기</span></button>
        <button id="floating-ranking" class="floating-ranking" type="button" aria-label="전체 순위표 보기"><i>🏆</i><span>전체 순위표</span></button>
        <button id="floating-notice" class="floating-notice" type="button" aria-label="팬게임 이용 안내"><i>ⓘ</i><span>이용 안내</span></button>
      </nav>
    </div>
  </main>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog">
    <form method="dialog" class="leaderboard-head"><div><span>전체 이용자 TOP 20</span><h2>차미 쌓기 전체 순위표</h2></div><div class="ranking-head-actions"><i id="ranking-spinner" class="ui-spinner hidden" aria-label="전체 순위표 불러오는 중"></i><button aria-label="전체 순위표 닫기">×</button></div></form>
    <div id="leaderboard-list" class="leaderboard-list"></div>
    <p id="ranking-status">전체 순위표를 준비하고 있어요.</p>
  </dialog>
  <dialog id="notice-dialog" class="notice-dialog" aria-labelledby="notice-title">
    <div class="notice-heading"><span>FAN GAME NOTICE</span><h2 id="notice-title">팬게임 이용 안내</h2></div>
    <section class="notice-card">
      <strong>Original By Creatorbus Inc.</strong>
      <p>본 게임은 V-LUP 시트리를 바탕으로 개인이 제작한 비공식·비영리 팬게임이며, ㈜크리에이터버스 및 시트리의 공식 서비스가 아닙니다.</p>
      <p>캐릭터 스탠딩·스프라이트·배경·타이틀 등 일부 시각 에셋은 생성형 AI를 활용해 제작했습니다. 공식 음원 및 스트리머 음성 합성은 사용하지 않으며, 게임 음악과 효과음은 독자적인 실시간 합성 음향입니다.</p>
      <p>원저작자의 권리와 V-LUP 팬게임·2차창작 가이드라인을 존중하며, 권리자의 요청이 있을 경우 수정하거나 배포를 중단합니다.</p>
      <nav class="notice-links" aria-label="공식 링크">
        <a href="https://www.youtube.com/@sitry_vlup" target="_blank" rel="noopener noreferrer">시트리 공식 YouTube ↗</a>
        <a href="https://cafe.naver.com/vlup" target="_blank" rel="noopener noreferrer">V-LUP 공식 카페 ↗</a>
        <a id="notice-game-link" href="/" target="_blank" rel="noopener noreferrer">게임 배포처 ↗</a>
      </nav>
    </section>
    <form method="dialog"><button class="notice-close" aria-label="팬게임 이용 안내 닫기">확인</button></form>
  </dialog>`;

const element = <T extends HTMLElement>(id: string): T => document.querySelector<T>(id)!;
let currentState: StackerRunState | null = null;
let previousAudioState: StackerRunState | null = null;
const audio = new GameAudio();

function updateSoundButtons(): void {
  const enabled = audio.isEnabled();
  document.querySelectorAll<HTMLButtonElement>('.sound-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? '소리 끄기' : '소리 켜기');
    button.querySelector('i')!.textContent = enabled ? '🔊' : '🔇';
    button.querySelector('span')!.textContent = enabled ? '소리 끄기' : '소리 켜기';
  });
}

document.querySelectorAll<HTMLButtonElement>('.sound-toggle').forEach((button) => {
  button.onclick = async () => { await audio.setEnabled(!audio.isEnabled()); updateSoundButtons(); };
});
updateSoundButtons();

async function boot(): Promise<void> {
  try {
    const content = await loadStackerContent();
    const saves = new StackerSaveManager(content);
    const online = new OnlineLeaderboard();
    let onlineEntries = online.cached();
    const scene = new StackerScene(content, saves.load());
    scene.connect((state) => render(state, content), (save) => saves.save(save), () => audio.play('drop'));
    new Phaser.Game({
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
    element('#game-title').textContent = content.game.title;
    element('#game-subtitle').textContent = content.game.subtitle;
    const sizePoints = [...new Set(Object.values(content.pieces).map((piece) => piece.points))].sort((a, b) => a - b);
    element('#score-size-rule').textContent = `차미 크기 점수: 작은 차미 ${sizePoints[0].toLocaleString()}점 · 중간 차미 ${sizePoints[1].toLocaleString()}점 · 큰 차미 ${sizePoints[2].toLocaleString()}점`;
    element('#score-bonus-rule').textContent = `밀집도 보너스: 차미를 낮고 촘촘하게 둘수록 0~${content.stacking.maxPackingBonus.toLocaleString()}점`;
    const scoreInfo = element<HTMLButtonElement>('#score-info');
    const scoreHelp = element<HTMLElement>('#score-help');
    const closeScoreHelp = () => { scoreHelp.hidden = true; scoreInfo.setAttribute('aria-expanded', 'false'); };
    scoreInfo.onclick = (event) => {
      event.stopPropagation();
      scoreHelp.hidden = !scoreHelp.hidden;
      scoreInfo.setAttribute('aria-expanded', String(!scoreHelp.hidden));
    };
    scoreHelp.onclick = (event) => event.stopPropagation();
    document.addEventListener('click', closeScoreHelp);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeScoreHelp(); });
    if (content.renderer.backgroundImage) document.documentElement.style.setProperty('--page-bg', `url("${content.assets.images[content.renderer.backgroundImage].src}")`);
    const title = content.titleScreen;
    element<HTMLImageElement>('#title-art').src = content.assets.images[title.art].src;
    element('#title-eyebrow').textContent = title.eyebrow;
    element('#title-logo').innerHTML = `<span>${title.title}</span><strong>${title.accent}</strong>`;
    element('#title-description').textContent = title.subtitle;
    const enter = element<HTMLButtonElement>('#enter-game');
    enter.disabled = false;
    enter.querySelector('span')!.textContent = title.cta;
    const openGame = () => {
      const screen = element('#title-screen');
      if (screen.classList.contains('leaving')) return;
      scene.startRun();
      screen.classList.add('leaving');
      audio.play('ui');
      window.setTimeout(() => {
        screen.classList.add('hidden');
      }, 520);
    };
    enter.onclick = openGame;
    const rankingDialog = element<HTMLDialogElement>('#leaderboard-dialog');
    const noticeDialog = element<HTMLDialogElement>('#notice-dialog');
    element<HTMLAnchorElement>('#notice-game-link').href = location.href;
    const showNotice = () => {
      if (noticeDialog.open) return;
      scene.scene.pause();
      noticeDialog.showModal();
    };
    noticeDialog.addEventListener('close', () => {
      if (scene.scene.isPaused()) scene.scene.resume();
    });
    element<HTMLButtonElement>('#title-notice').onclick = showNotice;
    element<HTMLButtonElement>('#title-notice').disabled = false;
    element<HTMLButtonElement>('#floating-notice').onclick = showNotice;
    const setRankingBusy = (busy: boolean) => element('#ranking-spinner').classList.toggle('hidden', !busy);
    const applyOnlineRanking = (entries: LocalScoreEntry[], animate = false) => {
      onlineEntries = entries;
      renderLeaderboard(entries, animate);
      element('#ranking-status').textContent = '방금 전체 순위표를 새로 불러왔어요.';
    };
    const refreshRanking = async () => {
      if (!online.available) {
        element('#ranking-status').textContent = '전체 순위표에 연결하지 못해 이 브라우저의 기록을 보여 드려요.';
        return;
      }
      setRankingBusy(true);
      try { applyOnlineRanking(await online.refresh(), rankingDialog.open); }
      catch (error) { element('#ranking-status').textContent = error instanceof Error ? error.message : '점수판을 불러오지 못했어요.'; }
      finally { setRankingBusy(false); }
    };
    const showRanking = () => {
      const initial = onlineEntries.length ? onlineEntries : saves.leaderboard();
      renderLeaderboard(initial);
      element('#ranking-status').textContent = onlineEntries.length ? '미리 받아 둔 기록이에요. 최신 기록을 확인하고 있어요…' : '최신 기록을 불러오고 있어요…';
      if (!rankingDialog.open) {
        scene.scene.pause();
        rankingDialog.showModal();
      }
      void refreshRanking();
    };
    rankingDialog.addEventListener('close', () => {
      if (scene.scene.isPaused()) scene.scene.resume();
    });
    online.warmup((entries) => { onlineEntries = entries; if (rankingDialog.open) applyOnlineRanking(entries, true); });
    const titleRanking = element<HTMLButtonElement>('#title-ranking');
    titleRanking.disabled = false;
    titleRanking.onclick = showRanking;
    element<HTMLButtonElement>('#floating-ranking').onclick = showRanking;
    element<HTMLButtonElement>('#result-ranking').onclick = showRanking;
    element<HTMLInputElement>('#nickname').value = saves.load().nickname;
    element<HTMLButtonElement>('#register-score').onclick = async () => {
      const button = element<HTMLButtonElement>('#register-score');
      const status = element('#register-status');
      try {
        if (!currentState) return;
        const rankings = saves.submitScore(element<HTMLInputElement>('#nickname').value, currentState);
        const entry = rankings.find((candidate) => candidate.runSeed === currentState!.runSeed)!;
        button.disabled = true;
        button.classList.add('is-loading');
        button.dataset.seed = currentState.runSeed;
        status.textContent = '기록을 저장하고 있어요…';
        if (online.available) {
          applyOnlineRanking(await online.submit(entry));
          const onlineRank = onlineEntries.findIndex((candidate) => candidate.runSeed === currentState!.runSeed);
          status.textContent = onlineRank >= 0 ? `온라인 기록 저장 완료! 현재 ${onlineRank + 1}위예요.` : '온라인에 기록을 저장했어요! TOP 20에도 다시 도전해 보세요.';
          audio.play('saved');
        } else {
          status.textContent = `이 브라우저에 저장했어요. 현재 ${rankings.findIndex((candidate) => candidate.runSeed === currentState!.runSeed) + 1}위예요.`;
          renderLeaderboard(rankings);
        }
      } catch (error) {
        status.textContent = `${error instanceof Error ? error.message : '온라인에 기록을 저장하지 못했어요.'} 이 브라우저에는 기록을 보관했어요.`;
        button.disabled = false;
        button.removeAttribute('data-seed');
      } finally {
        button.classList.remove('is-loading');
      }
    };
    window.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !enter.disabled) openGame(); });
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('play')) openGame();
    element('#loading').classList.add('hidden');
    element<HTMLButtonElement>('#restart').onclick = () => {
      element<HTMLButtonElement>('#register-score').disabled = false;
      element<HTMLButtonElement>('#register-score').removeAttribute('data-seed');
      element('#register-status').textContent = '';
      scene.events.emit('restart-run');
    };
  } catch (error) {
    const issues = error instanceof ContentError ? error.issues : [error instanceof Error ? error.message : String(error)];
    element('#loading').classList.add('error');
    element('#loading').textContent = `게임 설정 오류: ${issues.join(' / ')}`;
  }
}

function render(state: StackerRunState, content: Awaited<ReturnType<typeof loadStackerContent>>): void {
  if (previousAudioState) {
    if (state.gameOver && !previousAudioState.gameOver) audio.play('gameOver');
    else if (state.nearLimit && !previousAudioState.nearLimit) audio.play('danger');
    else if (state.drops > previousAudioState.drops) audio.play(state.drops % 5 === 0 ? 'milestone' : 'land');
  }
  previousAudioState = { ...state, nextPieces: [...state.nextPieces] };
  currentState = state;
  element('#score').textContent = state.score.toLocaleString();
  element('#drops').textContent = state.drops.toLocaleString();
  element('#best-score').textContent = state.bestScore.toLocaleString();
  element('#packing-rate').textContent = state.packingRate.toLocaleString();
  element('#message').textContent = state.message;
  const presenterMood = state.gameOver ? 'idle' : state.nearLimit ? 'worried' : state.drops > 0 && state.drops % 5 === 0 ? 'cheer' : state.drops === 0 ? 'idle' : 'guide';
  const presenterKey = presenterMood === 'cheer' ? content.presenter.cheer : presenterMood === 'idle' ? content.presenter.idle : content.presenter.guide;
  const presenter = element<HTMLImageElement>('#presenter');
  presenter.src = content.assets.images[presenterKey].src;
  presenter.alt = `${content.presenter.name} 스탠딩 일러스트`;
  if (presenter.dataset.mood !== presenterMood) {
    presenter.dataset.mood = presenterMood;
    presenter.classList.remove('reacting');
    void presenter.offsetWidth;
    presenter.classList.add('reacting');
  }
  element('#next-pieces').innerHTML = state.nextPieces.map((id) => {
    const piece = content.pieces[id];
    const asset = content.assets.images[piece.texture];
    return `<figure><img src="${asset.src}" alt="${piece.name}"><figcaption>${piece.name}</figcaption></figure>`;
  }).join('');
  if (state.gameOver) {
    element('#result-reason').textContent = '차미가 빨간 선을 넘어 버렸어요!';
    element('#result-score').textContent = state.score.toLocaleString();
    element('#result-base-score').textContent = state.baseScore.toLocaleString();
    element('#result-packing-bonus').textContent = `+${state.packingBonus.toLocaleString()}`;
    element('#result-packing-rate').textContent = `${state.packingRate.toLocaleString()}%`;
    element('#result-drops').textContent = state.drops.toLocaleString();
    element('#result-height').textContent = state.height.toLocaleString();
    const register = element<HTMLButtonElement>('#register-score');
    register.disabled = register.dataset.seed === state.runSeed;
  }
  element('#game-over').classList.toggle('hidden', !state.gameOver);
}

function renderLeaderboard(entries: LocalScoreEntry[], animate = false): void {
  const list = element('#leaderboard-list');
  list.innerHTML = entries.length ? entries.map((entry, index) => `
    <article class="rank-row ${index < 3 ? `rank-${index + 1}` : ''}">
      <b>${index + 1}</b><strong>${escapeHtml(entry.nickname)}</strong><span>${entry.score.toLocaleString()}점</span>
      <small>차미 ${entry.drops}개 · 밀집도 ${entry.packingRate}% · ${new Date(entry.playedAt).toLocaleDateString('ko-KR')}</small>
    </article>`).join('') : '<div class="empty-ranking">아직 저장된 기록이 없어요.<br>차미탑을 쌓고 첫 기록을 남겨 보세요!</div>';
  if (animate) {
    list.classList.remove('ranking-updated');
    void list.offsetWidth;
    list.classList.add('ranking-updated');
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

void boot();
