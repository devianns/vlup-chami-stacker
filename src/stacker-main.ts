import Phaser from 'phaser';
import './stacker.css';
import { ContentError, loadStackerContent } from './game/StackerContentLoader';
import { StackerScene } from './game/StackerScene';
import { StackerSaveManager } from './save/StackerSaveManager';
import type { StackerRunState } from './types';

document.body.innerHTML = `
  <section id="title-screen" class="title-screen" aria-labelledby="title-logo">
    <img id="title-art" class="title-art" alt="시트리와 차미가 함께하는 차미 쌓기 게임" />
    <div class="title-shade"></div>
    <div class="title-copy">
      <span id="title-eyebrow" class="title-eyebrow">SITRY × CHAMI</span>
      <h1 id="title-logo"><span>차미 쌓기</span><strong>게임!</strong></h1>
      <p id="title-description">말랑한 차미를 아슬아슬 쌓아 보세요!</p>
      <button id="enter-game" type="button" disabled><span>준비 중…</span><i>▶</i></button>
      <small>CLICK / ENTER</small>
    </div>
  </section>
  <main class="app-shell">
    <header class="title-block">
      <span class="eyebrow">말랑말랑 물리 스태커</span>
      <h1 id="game-title">차미를 불러오는 중…</h1>
      <p id="game-subtitle">잠시만 기다려 주세요.</p>
    </header>
    <section class="game-layout">
      <aside class="score-panel" aria-label="현재 기록">
        <div><span>점수</span><strong id="score">0</strong></div>
        <div><span>높이</span><strong><b id="height">0</b> cm</strong></div>
        <div><span>최고점</span><strong id="best-score">0</strong></div>
        <div><span>남은 기회</span><strong id="lives">● ● ●</strong></div>
      </aside>
      <div class="stage-wrap">
        <div id="game" aria-label="차미 스태커 게임 화면"></div>
        <div id="loading" class="loading">게임 데이터를 검사하고 있어요…</div>
        <div id="game-over" class="game-over hidden">
          <span>와르르…</span><strong>오늘의 차미탑 종료!</strong>
          <button id="restart" type="button">다시 쌓기</button>
        </div>
      </div>
      <aside class="next-panel" aria-label="다음 차미">
        <img id="presenter" class="presenter" alt="시트리" />
        <span>다음 차미</span><div id="next-pieces"></div>
        <small>마우스로 위치를 잡고<br>클릭해서 떨어뜨리세요.<br><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd>도 가능!</small>
      </aside>
    </section>
    <section class="speech" aria-live="polite"><i></i><p id="message">차미가 생각 중…</p></section>
    <footer><span id="content-version">JSON protocol</span><span>게임 진행은 브라우저에 저장됩니다.</span></footer>
  </main>`;

const element = <T extends HTMLElement>(id: string): T => document.querySelector<T>(id)!;

async function boot(): Promise<void> {
  try {
    const content = await loadStackerContent();
    const saves = new StackerSaveManager(content);
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
    element('#content-version').textContent = `JSON protocol v${content.protocolVersion} · content ${content.game.version}`;
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
    window.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !enter.disabled) openGame(); });
    element('#loading').classList.add('hidden');
    element<HTMLButtonElement>('#restart').onclick = () => scene.events.emit('restart-run');
  } catch (error) {
    const issues = error instanceof ContentError ? error.issues : [error instanceof Error ? error.message : String(error)];
    element('#loading').classList.add('error');
    element('#loading').textContent = `게임 설정 오류: ${issues.join(' / ')}`;
  }
}

function render(state: StackerRunState, content: Awaited<ReturnType<typeof loadStackerContent>>): void {
  element('#score').textContent = state.score.toLocaleString();
  element('#height').textContent = state.height.toLocaleString();
  element('#best-score').textContent = state.bestScore.toLocaleString();
  element('#lives').textContent = `${'● '.repeat(Math.max(0, state.lives))}${'○ '.repeat(Math.max(0, content.stacking.lives - state.lives))}`.trim();
  element('#message').textContent = state.message;
  const presenterKey = state.gameOver || state.drops === 0 ? content.presenter.idle : state.drops % 5 === 0 ? content.presenter.cheer : content.presenter.guide;
  const presenter = element<HTMLImageElement>('#presenter');
  presenter.src = content.assets.images[presenterKey].src;
  presenter.alt = `${content.presenter.name} 스탠딩 일러스트`;
  element('#next-pieces').innerHTML = state.nextPieces.map((id) => {
    const piece = content.pieces[id];
    const asset = content.assets.images[piece.texture];
    return `<figure><img src="${asset.src}" alt="${piece.name}"><figcaption>${piece.name}</figcaption></figure>`;
  }).join('');
  element('#game-over').classList.toggle('hidden', !state.gameOver);
}

void boot();
