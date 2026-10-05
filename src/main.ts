import './ui/styles.css';
import { loadFromStorage } from './core/playerState';
import { Game } from './engine/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const loading = document.getElementById('loading')!;
const bar = document.getElementById('loading-bar')!;
const text = document.getElementById('loading-text')!;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;

function progress(p: number): void {
  bar.style.width = `${Math.round(p * 100)}%`;
}

async function boot(): Promise<void> {
  progress(0.15);
  // Yükleme ekranının çizilmesine izin ver
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const state = loadFromStorage();
  progress(0.3);
  const game = new Game(canvas, state);
  await game.start(progress);
  text.textContent = state.data.stats.totalCaught > 0 ? `Tekrar hoş geldin! ${state.data.stats.totalCaught} balık yakaladın.` : 'Hazır! Oltanı kap.';
  startBtn.style.display = 'block';
  const go = () => {
    loading.classList.add('done');
    window.setTimeout(() => loading.remove(), 700);
    game.begin();
    canvas.focus();
  };
  startBtn.addEventListener('click', go, { once: true });
  (window as unknown as { fisch: Game }).fisch = game;
}

boot().catch((e) => {
  console.error(e);
  text.textContent = `Oyun başlatılamadı: ${e instanceof Error ? e.message : String(e)}. WebGL destekli bir tarayıcı gerekli.`;
});
