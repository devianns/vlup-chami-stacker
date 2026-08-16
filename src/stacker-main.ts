import Phaser from 'phaser';
import './stacker.css';
import { ContentError, loadStackerContent } from './game/StackerContentLoader';
import { StackerScene } from './game/StackerScene';
import { StackerSaveManager } from './save/StackerSaveManager';
import { OnlineLeaderboard } from './leaderboard/OnlineLeaderboard';
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
      <button id="title-ranking" class="title-ranking" type="button" disabled>🏆 내 기록 보기</button>
      <small>CLICK / ENTER</small>
    </div>
  </section>
  <main class="app-shell">
    <header class="title-block">
      <span class="eyebrow">시트리와 함께하는 차미 쌓기</span>
      <h1 id="game-title">차미를 불러오는 중…</h1>
      <p id="game-subtitle">잠시만 기다려 주세요.</p>
    </header>
    <section class="game-layout">
      <aside class="score-panel" aria-label="현재 기록">
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
              <div><dt>차미 개수 점수</dt><dd id="result-base-score">0</dd></div>
              <div><dt>빈틈 보너스</dt><dd id="result-packing-bonus">0</dd></div>
              <div><dt>평균 밀집도</dt><dd id="result-packing-rate">0%</dd></div>
            </dl>
            <p>차미 <b id="result-drops">0</b>개 · 높이 <b id="result-height">0</b>cm</p>
            <label class="nickname-field"><span>기록에 남길 닉네임</span><input id="nickname" maxlength="12" autocomplete="nickname" placeholder="1~12자로 입력해 주세요" /></label>
            <button id="register-score" class="primary-result" type="button">내 기록 저장하기</button>
            <em id="register-status" aria-live="polite"></em>
            <div class="result-actions"><button id="restart" type="button">다시 쌓기</button><button id="result-ranking" type="button">순위 보기</button></div>
          </div>
        </div>
      </div>
      <aside class="next-panel" aria-label="다음 차미">
        <div class="presenter-stage"><img id="presenter" class="presenter" alt="시트리" /><b>시트리</b></div>
        <div class="next-queue"><span>다음 차미</span><div id="next-pieces"></div></div>
        <small>빨간 선을 넘지 않도록 빈틈을 채우세요.<br>위치를 잡고 클릭하면 놓을 수 있어요.<br><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd>도 가능!</small>
      </aside>
    </section>
    <section class="speech" aria-live="polite"><i></i><strong>시트리</strong><p id="message">차미를 고르는 중이에요…</p></section>
    <footer><span id="content-version">게임 데이터 확인 중</span><button id="footer-ranking" type="button">🏆 내 기록 보기</button><span>기록은 이 브라우저에만 저장됩니다.</span></footer>
  </main>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog">
    <form method="dialog" class="leaderboard-head"><div><span>전체 이용자 TOP 20</span><h2>차미 쌓기 최고 기록</h2></div><div class="ranking-head-actions"><i id="ranking-spinner" class="ui-spinner hidden" aria-label="점수판 불러오는 중"></i><button aria-label="닫기">×</button></div></form>
    <div id="leaderboard-list" class="leaderboard-list"></div>
    <p id="ranking-status">점수판을 준비하고 있어요.</p>
  </dialog>`;

const element = <T extends HTMLElement>(id: string): T => document.querySelector<T>(id)!;
let currentState: StackerRunState | null = null;

async function boot(): Promise<void> {
  try {
    const content = await loadStackerContent();
    const saves = new StackerSaveManager(content);
    const online = new OnlineLeaderboard();
    let onlineEntries = online.cached();
    const scene = new StackerScene(content, saves.load());
    scene.connect((state) => render(state, content), (save) => saves.save(save));
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
    element('#content-version').textContent = `게임 데이터 ${content.game.version}`;
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
      screen.classList.add('leaving');
      window.setTimeout(() => screen.classList.add('hidden'), 520);
    };
    enter.onclick = openGame;
    const rankingDialog = element<HTMLDialogElement>('#leaderboard-dialog');
    const setRankingBusy = (busy: boolean) => element('#ranking-spinner').classList.toggle('hidden', !busy);
    const applyOnlineRanking = (entries: LocalScoreEntry[], animate = false) => {
      onlineEntries = entries;
      renderLeaderboard(entries, animate);
      element('#ranking-status').textContent = '방금 온라인 점수판과 동기화했어요.';
    };
    const refreshRanking = async () => {
      if (!online.available) {
        element('#ranking-status').textContent = '온라인 주소가 없어 이 브라우저의 기록만 보여 드려요.';
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
      if (!rankingDialog.open) rankingDialog.showModal();
      void refreshRanking();
    };
    online.warmup((entries) => { onlineEntries = entries; if (rankingDialog.open) applyOnlineRanking(entries, true); });
    const titleRanking = element<HTMLButtonElement>('#title-ranking');
    titleRanking.disabled = false;
    titleRanking.onclick = showRanking;
    element<HTMLButtonElement>('#footer-ranking').onclick = showRanking;
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
        } else {
          status.textContent = `이 브라우저에 저장했어요. 현재 ${rankings.findIndex((candidate) => candidate.runSeed === currentState!.runSeed) + 1}위예요.`;
          renderLeaderboard(rankings);
        }
      } catch (error) {
        status.textContent = `${error instanceof Error ? error.message : '온라인에 기록을 저장하지 못했어요.'} 이 브라우저에는 기록을 보관했어요.`;
      } finally {
        button.classList.remove('is-loading');
      }
    };
    window.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !enter.disabled) openGame(); });
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
