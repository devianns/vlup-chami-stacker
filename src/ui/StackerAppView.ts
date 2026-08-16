import type { LeaderboardEntry, StackerGameProtocol, StackerRunState } from '../types';

export type AppPhase = 'loading' | 'title' | 'playing' | 'result' | 'error';

const APP_TEMPLATE = `
  <section id="title-screen" class="title-screen" aria-labelledby="title-logo">
    <img id="title-art" class="title-art" alt="시트리와 차미가 함께하는 차미 쌓기 게임" />
    <div class="title-shade"></div>
    <div class="title-copy">
      <span id="title-eyebrow" class="title-eyebrow">SITRY × CHAMI</span>
      <h1 id="title-logo"><span>차미 쌓기</span><strong>게임!</strong></h1>
      <p id="title-description">말랑한 차미를 아슬아슬 쌓아 보세요!</p>
      <button id="enter-game" type="button" disabled><span>준비 중…</span><i>▶</i></button>
      <button id="title-sound" class="sound-toggle title-sound" type="button" aria-pressed="false">
        <i aria-hidden="true"><svg viewBox="0 0 24 24"><path class="speaker" d="M4 9v6h4l5 4V5L8 9H4z"/><path class="sound-wave" d="M16 8.5c1.6 1.9 1.6 5.1 0 7M18.8 6c3 3.4 3 8.6 0 12"/><path class="mute-slash" d="M4 4l16 16"/></svg></i><span>소리 켜기</span>
      </button>
      <button id="title-ranking" class="title-ranking" type="button" disabled>🏆 전체 순위표 보기</button>
      <button id="title-notice" class="title-notice" type="button" disabled>ⓘ 팬게임 이용 안내</button>
    </div>
    <p class="title-legal">비영리 팬게임 · Original By Creatorbus Inc. · <a href="https://www.youtube.com/@sitry_vlup" target="_blank" rel="noopener noreferrer">시트리 공식 유튜브</a><br>캐릭터·배경·타이틀 등 시각 에셋 제작에 생성형 AI를 사용했습니다.</p>
  </section>
  <main class="app-shell" aria-hidden="true" inert>
    <header class="title-block">
      <h1 id="game-title">차미를 불러오는 중…</h1>
      <p id="game-subtitle">잠시만 기다려 주세요.</p>
    </header>
    <section class="game-layout">
      <aside class="score-panel" aria-label="현재 기록">
        <button id="score-info" class="score-info" type="button" aria-haspopup="dialog" title="점수 규칙 보기">i</button>
        <div><span>점수</span><strong id="score">0</strong></div>
        <div><span>쌓은 차미</span><strong><b id="drops">0</b>개</strong></div>
        <div><span>최고점</span><strong id="best-score">0</strong></div>
        <div><span>낮게 넣기</span><strong><b id="packing-rate">0</b>%</strong></div>
      </aside>
      <div class="stage-cell">
        <div class="stage-wrap">
          <div id="game" tabindex="-1" aria-label="차미 스태커 게임 화면"></div>
          <div id="loading" class="loading">게임 데이터를 검사하고 있어요…</div>
          <div id="game-over" class="game-over hidden" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div class="result-card">
              <span id="result-reason" class="result-kicker">와르르…!</span>
              <h2 id="result-title" tabindex="-1">이번 차미탑은 여기까지!</h2>
              <strong id="result-score">0</strong><small>FINAL SCORE</small>
              <dl class="score-breakdown">
                <div><dt>차미 크기 점수</dt><dd id="result-base-score">0</dd></div>
                <div><dt>낮게 넣기 보너스</dt><dd id="result-packing-bonus">0</dd></div>
                <div><dt>평균 배치율</dt><dd id="result-packing-rate">0%</dd></div>
              </dl>
              <p>차미 <b id="result-drops">0</b>개 · 최고 높이 <b id="result-height">0</b>px</p>
              <label class="nickname-field"><span>기록에 남길 닉네임</span><input id="nickname" maxlength="12" autocomplete="nickname" placeholder="1~12자로 입력해 주세요" /></label>
              <button id="register-score" class="primary-result" type="button">전체 순위표에 등록하기</button>
              <em id="register-status" role="status" aria-live="polite"></em>
              <div class="result-actions"><button id="restart" type="button">다시 쌓기</button><button id="result-ranking" type="button">전체 순위표</button></div>
            </div>
          </div>
        </div>
      </div>
      <aside class="next-panel" aria-label="시트리와 다음 차미">
        <div class="presenter-stage">
          <img id="presenter" class="presenter" alt="시트리 전신 일러스트" />
          <span class="presenter-face" aria-hidden="true"><img id="presenter-face" alt="" /></span>
          <b>시트리</b>
        </div>
        <section class="speech" aria-live="polite"><strong>시트리</strong><p id="message">차미를 고르는 중이에요…</p></section>
        <div class="next-queue"><span>다음 차미</span><div id="next-pieces"></div></div>
        <small>빨간 선을 넘지 않도록 낮은 빈틈부터 채우세요.<br>위치를 잡고 클릭하면 놓을 수 있어요.<br><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd>도 가능!</small>
      </aside>
      <footer class="app-utility">
        <div class="game-legal-watermark" aria-hidden="true">
          <strong>비영리 팬게임 · Original By Creatorbus Inc.</strong>
          <span>캐릭터·배경 등 시각 에셋에 생성형 AI를 사용했습니다.</span>
        </div>
        <nav class="app-actions" aria-label="빠른 메뉴">
          <button id="game-sound" class="sound-toggle game-sound" type="button" aria-pressed="false" aria-label="소리 켜기">
            <i aria-hidden="true"><svg viewBox="0 0 24 24"><path class="speaker" d="M4 9v6h4l5 4V5L8 9H4z"/><path class="sound-wave" d="M16 8.5c1.6 1.9 1.6 5.1 0 7M18.8 6c3 3.4 3 8.6 0 12"/><path class="mute-slash" d="M4 4l16 16"/></svg></i><span>소리</span>
          </button>
          <button id="app-ranking" class="app-ranking" type="button" aria-label="전체 순위표 보기">
            <i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 4h8v3c0 3-1.7 5.4-4 6.4C9.7 12.4 8 10 8 7V4zM8 6H5v1c0 2.2 1.3 3.8 3.4 4.3M16 6h3v1c0 2.2-1.3 3.8-3.4 4.3M12 13v4M8 20h8M10 17h4"/></svg></i><span>순위표</span>
          </button>
          <button id="app-notice" class="app-notice" type="button" aria-label="팬게임 이용 안내">
            <i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/></svg></i><span>이용 안내</span>
          </button>
        </nav>
      </footer>
    </section>
  </main>
  <dialog id="score-help" class="score-help" aria-labelledby="score-help-title">
    <h2 id="score-help-title">점수는 이렇게 계산해요</h2>
    <p id="score-size-rule"></p>
    <p id="score-bonus-rule"></p>
    <small>총점이 높은 순서로 순위가 정해지고, 동점이면 낮게 넣기 비율과 차미 개수를 차례로 비교해요.</small>
    <form method="dialog"><button type="submit">확인</button></form>
  </dialog>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog" aria-labelledby="leaderboard-title">
    <form method="dialog" class="leaderboard-head"><div><span>전체 이용자 TOP 20</span><h2 id="leaderboard-title">차미 쌓기 전체 순위표</h2></div><div class="ranking-head-actions"><i id="ranking-spinner" class="ui-spinner hidden" aria-label="전체 순위표 불러오는 중"></i><button aria-label="전체 순위표 닫기">×</button></div></form>
    <div id="leaderboard-list" class="leaderboard-list"></div>
    <p id="ranking-status" role="status" aria-live="polite">전체 순위표를 준비하고 있어요.</p>
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

function required<T extends Element>(root: ParentNode, selector: string): T {
  const match = root.querySelector<T>(selector);
  if (!match) throw new Error(`필수 화면 요소를 찾지 못했습니다: ${selector}`);
  return match;
}

export class StackerAppView {
  readonly elements;
  private phase: AppPhase = 'loading';
  private renderedNextKey = '';
  private resultVisible = false;

  constructor(private root: HTMLElement) {
    root.innerHTML = APP_TEMPLATE;
    this.elements = {
      titleScreen: required<HTMLElement>(root, '#title-screen'),
      titleArt: required<HTMLImageElement>(root, '#title-art'),
      titleEyebrow: required<HTMLElement>(root, '#title-eyebrow'),
      titleLogo: required<HTMLElement>(root, '#title-logo'),
      titleDescription: required<HTMLElement>(root, '#title-description'),
      appShell: required<HTMLElement>(root, '.app-shell'),
      gameTitle: required<HTMLElement>(root, '#game-title'),
      gameSubtitle: required<HTMLElement>(root, '#game-subtitle'),
      enterGame: required<HTMLButtonElement>(root, '#enter-game'),
      soundToggles: [...root.querySelectorAll<HTMLButtonElement>('.sound-toggle')],
      titleRanking: required<HTMLButtonElement>(root, '#title-ranking'),
      titleNotice: required<HTMLButtonElement>(root, '#title-notice'),
      scoreInfo: required<HTMLButtonElement>(root, '#score-info'),
      scoreHelp: required<HTMLDialogElement>(root, '#score-help'),
      scoreSizeRule: required<HTMLElement>(root, '#score-size-rule'),
      scoreBonusRule: required<HTMLElement>(root, '#score-bonus-rule'),
      score: required<HTMLElement>(root, '#score'),
      drops: required<HTMLElement>(root, '#drops'),
      bestScore: required<HTMLElement>(root, '#best-score'),
      packingRate: required<HTMLElement>(root, '#packing-rate'),
      stage: required<HTMLElement>(root, '#game'),
      loading: required<HTMLElement>(root, '#loading'),
      gameOver: required<HTMLElement>(root, '#game-over'),
      scorePanel: required<HTMLElement>(root, '.score-panel'),
      nextPanel: required<HTMLElement>(root, '.next-panel'),
      appUtility: required<HTMLElement>(root, '.app-utility'),
      presenter: required<HTMLImageElement>(root, '#presenter'),
      presenterFace: required<HTMLImageElement>(root, '#presenter-face'),
      message: required<HTMLElement>(root, '#message'),
      nextPieces: required<HTMLElement>(root, '#next-pieces'),
      resultReason: required<HTMLElement>(root, '#result-reason'),
      resultTitle: required<HTMLElement>(root, '#result-title'),
      resultScore: required<HTMLElement>(root, '#result-score'),
      resultBaseScore: required<HTMLElement>(root, '#result-base-score'),
      resultPackingBonus: required<HTMLElement>(root, '#result-packing-bonus'),
      resultPackingRate: required<HTMLElement>(root, '#result-packing-rate'),
      resultDrops: required<HTMLElement>(root, '#result-drops'),
      resultHeight: required<HTMLElement>(root, '#result-height'),
      nickname: required<HTMLInputElement>(root, '#nickname'),
      registerScore: required<HTMLButtonElement>(root, '#register-score'),
      registerStatus: required<HTMLElement>(root, '#register-status'),
      restart: required<HTMLButtonElement>(root, '#restart'),
      resultRanking: required<HTMLButtonElement>(root, '#result-ranking'),
      appRanking: required<HTMLButtonElement>(root, '#app-ranking'),
      appNotice: required<HTMLButtonElement>(root, '#app-notice'),
      leaderboardDialog: required<HTMLDialogElement>(root, '#leaderboard-dialog'),
      leaderboardList: required<HTMLElement>(root, '#leaderboard-list'),
      rankingSpinner: required<HTMLElement>(root, '#ranking-spinner'),
      rankingStatus: required<HTMLElement>(root, '#ranking-status'),
      noticeDialog: required<HTMLDialogElement>(root, '#notice-dialog'),
      noticeGameLink: required<HTMLAnchorElement>(root, '#notice-game-link'),
    };
    this.setPhase('loading');
  }

  applyContent(content: StackerGameProtocol): void {
    if (content.renderer.backgroundImage) {
      document.documentElement.style.setProperty('--page-bg', `url("${content.assets.images[content.renderer.backgroundImage].src}")`);
    }
    const title = content.titleScreen;
    this.elements.titleArt.src = content.assets.images[title.art].src;
    this.elements.titleEyebrow.textContent = title.eyebrow;
    required<HTMLElement>(this.elements.titleLogo, 'span').textContent = title.title;
    required<HTMLElement>(this.elements.titleLogo, 'strong').textContent = title.accent;
    this.elements.titleDescription.textContent = title.subtitle;
    this.elements.gameTitle.textContent = content.game.title;
    this.elements.gameSubtitle.textContent = content.game.subtitle;
    const labels = ['작은 차미', '중간 차미', '큰 차미'];
    const sizePoints = [...new Set(Object.values(content.pieces).map((piece) => piece.points))].sort((a, b) => a - b);
    this.elements.scoreSizeRule.textContent = `차미 크기 점수: ${sizePoints.map((points, index) => `${labels[index] ?? `${index + 1}단계`} ${points.toLocaleString()}점`).join(' · ')}`;
    this.elements.scoreBonusRule.textContent = `낮게 넣기 보너스: 각 차미를 한계선보다 얼마나 낮게 배치했는지 평균 내어 0~${content.stacking.maxPackingBonus.toLocaleString()}점을 더해요.`;
    this.elements.noticeGameLink.href = location.href;
  }

  markReady(callToAction: string): void {
    this.elements.loading.classList.add('hidden');
    this.elements.enterGame.disabled = false;
    required<HTMLElement>(this.elements.enterGame, 'span').textContent = callToAction;
    this.elements.titleRanking.disabled = false;
    this.elements.titleNotice.disabled = false;
    this.setPhase('title');
  }

  showBootError(message: string): void {
    this.elements.loading.classList.add('error');
    this.elements.loading.textContent = message;
    this.elements.titleDescription.textContent = message;
    this.elements.enterGame.disabled = false;
    required<HTMLElement>(this.elements.enterGame, 'span').textContent = '다시 불러오기';
    this.setPhase('error');
  }

  beginGame(): void {
    if (this.phase !== 'title') return;
    this.setPhase('playing');
    this.elements.titleScreen.classList.add('leaving');
    window.setTimeout(() => this.elements.titleScreen.classList.add('hidden'), 520);
    this.elements.stage.focus({ preventScroll: true });
  }

  isTitleReady(): boolean { return this.phase === 'title'; }

  hasOpenDialog(): boolean {
    return [this.elements.scoreHelp, this.elements.leaderboardDialog, this.elements.noticeDialog].some((dialog) => dialog.open);
  }

  setSoundEnabled(enabled: boolean): void {
    this.elements.soundToggles.forEach((button) => {
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', enabled ? '소리 끄기' : '소리 켜기');
      required<HTMLElement>(button, 'span').textContent = enabled ? '소리 끄기' : '소리 켜기';
    });
  }

  setRankingBusy(busy: boolean): void { this.elements.rankingSpinner.classList.toggle('hidden', !busy); }
  setRankingStatus(message: string): void { this.elements.rankingStatus.textContent = message; }

  setRegistrationBusy(busy: boolean): void {
    this.elements.registerScore.disabled = busy;
    this.elements.registerScore.classList.toggle('is-loading', busy);
  }

  setRegistrationComplete(complete: boolean): void {
    this.elements.registerScore.disabled = complete;
    this.elements.registerScore.textContent = complete ? '온라인 등록 완료' : '전체 순위표에 등록하기';
  }

  resetRegistration(): void {
    this.setRegistrationBusy(false);
    this.setRegistrationComplete(false);
    this.elements.registerStatus.textContent = '';
  }

  renderRun(state: StackerRunState, content: StackerGameProtocol): void {
    this.elements.score.textContent = state.score.toLocaleString();
    this.elements.drops.textContent = state.drops.toLocaleString();
    this.elements.bestScore.textContent = state.bestScore.toLocaleString();
    this.elements.packingRate.textContent = state.packingRate.toLocaleString();
    this.elements.message.textContent = state.message;
    this.renderPresenter(state, content);
    this.renderQueue(state, content);
    if (state.gameOver) {
      this.elements.resultReason.textContent = '차미가 빨간 선을 넘어 버렸어요!';
      this.elements.resultScore.textContent = state.score.toLocaleString();
      this.elements.resultBaseScore.textContent = state.baseScore.toLocaleString();
      this.elements.resultPackingBonus.textContent = `+${state.packingBonus.toLocaleString()}`;
      this.elements.resultPackingRate.textContent = `${state.packingRate.toLocaleString()}%`;
      this.elements.resultDrops.textContent = state.drops.toLocaleString();
      this.elements.resultHeight.textContent = state.height.toLocaleString();
    }
    this.setResultVisible(state.gameOver);
  }

  renderLeaderboard(entries: LeaderboardEntry[], animate = false): void {
    const fragment = document.createDocumentFragment();
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-ranking';
      empty.append('아직 저장된 기록이 없어요.', document.createElement('br'), '차미탑을 쌓고 첫 기록을 남겨 보세요!');
      fragment.append(empty);
    } else {
      entries.forEach((entry, index) => {
        const row = document.createElement('article');
        row.className = `rank-row${index < 3 ? ` rank-${index + 1}` : ''}`;
        const rank = document.createElement('b');
        rank.textContent = String(index + 1);
        const nickname = document.createElement('strong');
        nickname.textContent = entry.nickname;
        const score = document.createElement('span');
        score.textContent = `${entry.score.toLocaleString()}점`;
        const details = document.createElement('small');
        details.textContent = `차미 ${entry.drops}개 · 낮게 넣기 ${entry.packingRate}% · ${new Date(entry.playedAt).toLocaleDateString('ko-KR')}`;
        row.append(rank, nickname, score, details);
        fragment.append(row);
      });
    }
    this.elements.leaderboardList.replaceChildren(fragment);
    if (animate) {
      this.elements.leaderboardList.classList.remove('ranking-updated');
      void this.elements.leaderboardList.offsetWidth;
      this.elements.leaderboardList.classList.add('ranking-updated');
    }
  }

  private setPhase(phase: AppPhase): void {
    this.phase = phase;
    this.root.dataset.phase = phase;
    const titleActive = phase === 'loading' || phase === 'title' || phase === 'error';
    this.elements.titleScreen.inert = !titleActive;
    this.elements.titleScreen.setAttribute('aria-hidden', String(!titleActive));
    this.elements.appShell.inert = titleActive;
    this.elements.appShell.setAttribute('aria-hidden', String(titleActive));
  }

  private setResultVisible(visible: boolean): void {
    this.elements.gameOver.classList.toggle('hidden', !visible);
    this.elements.scorePanel.inert = visible;
    this.elements.nextPanel.inert = visible;
    this.elements.appUtility.inert = visible;
    this.elements.stage.inert = visible;
    if (visible === this.resultVisible) return;
    this.resultVisible = visible;
    if (visible) {
      this.setPhase('result');
      requestAnimationFrame(() => this.elements.resultTitle.focus({ preventScroll: true }));
    } else if (this.phase === 'result') {
      this.setPhase('playing');
      requestAnimationFrame(() => this.elements.stage.focus({ preventScroll: true }));
    }
  }

  private renderPresenter(state: StackerRunState, content: StackerGameProtocol): void {
    const mood = state.gameOver ? 'idle' : state.nearLimit ? 'worried' : state.drops > 0 && state.drops % 5 === 0 ? 'cheer' : state.drops === 0 ? 'idle' : 'guide';
    const assetKey = mood === 'cheer' ? content.presenter.cheer : mood === 'idle' ? content.presenter.idle : content.presenter.guide;
    if (this.elements.presenter.dataset.mood === mood) return;
    this.elements.presenter.src = content.assets.images[assetKey].src;
    this.elements.presenter.alt = `${content.presenter.name} 스탠딩 일러스트`;
    this.elements.presenterFace.src = this.elements.presenter.src;
    this.elements.presenter.dataset.mood = mood;
    this.elements.presenter.classList.remove('reacting');
    void this.elements.presenter.offsetWidth;
    this.elements.presenter.classList.add('reacting');
  }

  private renderQueue(state: StackerRunState, content: StackerGameProtocol): void {
    const nextKey = state.nextPieces.join('|');
    if (nextKey === this.renderedNextKey) return;
    this.renderedNextKey = nextKey;
    const fragment = document.createDocumentFragment();
    state.nextPieces.forEach((id) => {
      const piece = content.pieces[id];
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = content.assets.images[piece.texture].src;
      image.alt = piece.name;
      const caption = document.createElement('figcaption');
      caption.textContent = piece.name;
      figure.append(image, caption);
      fragment.append(figure);
    });
    this.elements.nextPieces.replaceChildren(fragment);
  }
}

export function mountStackerApp(): StackerAppView {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('게임 앱을 표시할 #app 요소가 없습니다.');
  return new StackerAppView(root);
}
