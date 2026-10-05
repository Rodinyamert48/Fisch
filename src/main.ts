import './ui/styles.css';
import { loadFromStorage } from './core/playerState';
import { Game } from './engine/Game';
import { enterFullscreen, fullscreenSupported, isIOS, isStandalone } from './ui/fullscreen';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const loading = document.getElementById('loading')!;
const bar = document.getElementById('loading-bar')!;
const text = document.getElementById('loading-text')!;
const tip = document.getElementById('loading-tip')!;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const startFsBtn = document.getElementById('start-fs-btn') as HTMLButtonElement;

const TIPS = [
  'İpucu: Güç çubuğunu yeşil alanda bırakmak "Mükemmel!" atış sayılır.',
  'İpucu: Balık çubuktan hiç çıkmazsa Kusursuz Yakalama: 1.5x XP!',
  'İpucu: Gece, sis ve kutup ışıkları farklı balıklar getirir.',
  'İpucu: Kayıkhaneden bir Kayık alıp diğer adaları keşfet.',
  'İpucu: Balık Atlası\'nı doldurmak en güçlü oltaların kilidini açar.',
];
tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

function progress(p: number): void {
  bar.style.width = `${Math.round(p * 100)}%`;
}

async function boot(): Promise<void> {
  progress(0.15);
  // Yükleme ekranının çizilmesine izin ver
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  const state = loadFromStorage();
  progress(0.3);
  const game = new Game(canvas, state);
  await game.start(progress);
  text.textContent = state.data.stats.totalCaught > 0 ? `Tekrar hoş geldin! ${state.data.stats.totalCaught} balık yakaladın.` : 'Hazır! Oltanı kap.';
  const canFs = fullscreenSupported() && !isStandalone();
  startBtn.style.display = 'block';
  if (canFs) startFsBtn.style.display = 'block';
  else if (isIOS() && !isStandalone()) tip.textContent = 'iPhone/iPad: tam ekran için Paylaş ⬆️ → "Ana Ekrana Ekle", sonra oyunu oradan aç.';
  let started = false;
  const go = async (fullscreen: boolean) => {
    if (started) return;
    started = true;
    // Tam ekran isteği kullanıcı hareketinin içinde yapılmalı
    if (fullscreen) await enterFullscreen(game.ui.isTouch);
    loading.classList.add('done');
    window.setTimeout(() => loading.remove(), 700);
    game.engine.resize();
    game.begin();
    canvas.focus();
  };
  startBtn.addEventListener('click', () => void go(false));
  startFsBtn.addEventListener('click', () => void go(true));
  (window as unknown as { fisch: Game }).fisch = game;
}

boot().catch((e) => {
  console.error(e);
  text.textContent = `Oyun başlatılamadı: ${e instanceof Error ? e.message : String(e)}. WebGL2 destekli bir tarayıcı gerekli.`;
});
