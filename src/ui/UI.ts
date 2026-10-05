import { BAITS, BAITS_BY_ID } from '../core/data/baits';
import { BOATS } from '../core/data/boats';
import { FISH_BY_ID } from '../core/data/fish';
import { QUESTS } from '../core/data/quests';
import { RARITIES } from '../core/data/rarities';
import { RODS } from '../core/data/rods';
import { VARIANTS } from '../core/data/variants';
import { ISLANDS, REGION_NAMES, REGION_ORDER, TRENCH, type IslandDef, type NpcDef } from '../core/data/world';
import { REGION_REWARDS, regionFish, regionProgress, trashFish } from '../core/bestiary';
import { CastMeter, CAST_RATING_TEXT, type CastRating } from '../core/castMeter';
import { formatCash, formatWeight } from '../core/economy';
import { SEASON_NAMES, WEATHER_NAMES } from '../core/environment';
import type { PlayerState, CatchOutcome, StateEvents } from '../core/playerState';
import { questStatus, questsForNpc } from '../core/quests';
import type { ReelMinigame, ReelParams } from '../core/reelMinigame';
import type { CaughtFish, FishDef, QuestDef, RegionId, RodDef } from '../core/types';
import type { AudioSystem } from '../audio/AudioSystem';
import { button, clear, el, fishSvg } from './dom';

export interface UIActions {
  summonBoat(): void;
  toggleFullscreen(): void;
  interact(): void;
  jump(): void;
  resetSave(): void;
  settingsChanged(): void;
  panelChanged(open: boolean): void;
}

export interface HudInfo {
  clock: string;
  isNight: boolean;
  weather: string;
  weatherId: string;
  season: string;
  zone: string;
  nuke: boolean;
}

export interface CatchCardData {
  fish: FishDef;
  caught: CaughtFish;
  outcome: CatchOutcome;
}

const WEATHER_ICON: Record<string, string> = { clear: '☀️', rain: '🌧️', fog: '🌫️', aurora: '🌌' };

/** Tüm DOM arayüzü: HUD, balık tutma arayüzü, mağazalar, ansiklopedi, görevler, ayarlar ve mobil kontroller. */
export class UI {
  private cashEl: HTMLElement;
  private levelEl: HTMLElement;
  private xpFill: HTMLElement;
  private xpText: HTMLElement;
  private gearEl: HTMLElement;
  private envEl: HTMLElement;
  private zoneEl: HTMLElement;
  private nukeEl: HTMLElement;
  private minimap: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private promptEl: HTMLElement;
  private hintEl: HTMLElement;
  private bannerEl: HTMLElement;
  private bannerTimer = 0;
  private toastsEl: HTMLElement;
  private powerEl: HTMLElement;
  private powerFill: HTMLElement;
  private powerNeedle: HTMLElement;
  private shakeLayer: HTMLElement;
  private reelEl: HTMLElement;
  private reelTitle: HTMLElement;
  private reelBar: HTMLElement;
  private reelFish: HTMLElement;
  private reelProgress: HTMLElement;
  private reelProgressFill: HTMLElement;
  private reelInfo: HTMLElement;
  private catchEl: HTMLElement;
  private modalWrap: HTMLElement;
  private modalTitle: HTMLElement;
  private modalBody: HTMLElement;
  private panelRender: (() => void) | null = null;
  private panelEvents: (keyof StateEvents)[] = [];
  private catchDismiss: (() => void) | null = null;
  readonly actionBtn: HTMLButtonElement | null = null;
  private fsBtn: HTMLButtonElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: PlayerState,
    private readonly audio: AudioSystem,
    readonly isTouch: boolean,
    private readonly actions: UIActions,
  ) {
    if (isTouch) document.body.classList.add('touch');

    // Sol üst
    const tl = el('div', 'hud-tl', null, root);
    this.cashEl = el('div', 'pill cash', '', tl);
    const lv = el('div', 'level-box', null, tl);
    const lvRow = el('div', 'lv', null, lv);
    this.levelEl = el('span', null, 'Seviye 1', lvRow);
    this.xpText = el('span', 'gear', '', lvRow);
    const xpbar = el('div', 'xpbar', null, lv);
    this.xpFill = el('div', null, null, xpbar);
    this.gearEl = el('div', 'pill gear', '', tl);

    // Sağ üst
    const tr = el('div', 'hud-tr', null, root);
    this.envEl = el('div', 'pill env', '', tr);
    this.nukeEl = el('div', 'nuke-badge', '🟢 YEŞİL ŞAFAK', tr);
    this.minimap = el('canvas', null, null, tr);
    this.minimap.id = 'minimap';
    this.minimap.width = 336;
    this.minimap.height = 336;
    this.mctx = this.minimap.getContext('2d')!;
    this.zoneEl = el('div', 'pill zone-name', '', tr);

    // Alt menü
    const bottom = el('div', 'hud-bottom', null, root);
    const menu = (icon: string, label: string, key: string, fn: () => void) => {
      const b = el('button', 'menu-btn interactive', null, bottom);
      b.innerHTML = `<span class="ic">${icon}</span><span class="label">${label}</span><span class="key">${key}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.click();
        fn();
      });
      return b;
    };
    menu('🎒', 'Envanter', 'I', () => this.openInventory());
    menu('📖', 'Atlas', 'K', () => this.openBestiary());
    menu('📜', 'Görevler', 'J', () => this.openQuests());
    menu('⛵', 'Tekne', 'T', () => this.actions.summonBoat());
    menu('⚙️', 'Ayarlar', 'O', () => this.openSettings());
    menu('❔', 'Yardım', 'H', () => this.openHelp());
    this.fsBtn = menu('⛶', 'Tam Ekran', 'U', () => this.actions.toggleFullscreen());

    this.promptEl = el('div', 'prompt', '', root);
    this.hintEl = el('div', 'hint', '', root);
    this.bannerEl = el('div', 'zone-banner', null, root);
    this.toastsEl = el('div', 'toasts', null, root);

    // Atış güç çubuğu
    this.powerEl = el('div', 'power', null, root);
    const zone = el('div', 'zone', null, this.powerEl);
    zone.style.bottom = `${CastMeter.PERFECT_MIN * 100}%`;
    zone.style.height = `${(CastMeter.PERFECT_MAX - CastMeter.PERFECT_MIN) * 100}%`;
    this.powerFill = el('div', 'fill', null, this.powerEl);
    this.powerNeedle = el('div', 'needle', null, this.powerEl);

    this.shakeLayer = el('div', 'shake-layer', null, root);

    // Çekme oyunu
    this.reelEl = el('div', 'reel', null, root);
    this.reelTitle = el('div', 'reel-title', '', this.reelEl);
    const track = el('div', 'reel-track', null, this.reelEl);
    this.reelBar = el('div', 'reel-bar', null, track);
    this.reelFish = el('div', 'reel-fish', null, track);
    this.reelProgress = el('div', 'reel-progress', null, this.reelEl);
    this.reelProgressFill = el('div', null, null, this.reelProgress);
    this.reelInfo = el('div', 'reel-info', '', this.reelEl);

    // Yakalama kartı
    this.catchEl = el('div', 'catch interactive', null, root);
    this.catchEl.addEventListener('click', () => this.catchDismiss?.());

    // Modal
    this.modalWrap = el('div', 'modal-wrap', null, root);
    const modal = el('div', 'modal', null, this.modalWrap);
    const head = el('div', 'modal-head', null, modal);
    this.modalTitle = el('h2', null, '', head);
    const close = el('button', 'close', '✕', head);
    close.addEventListener('click', () => this.closePanel());
    this.modalBody = el('div', 'modal-body', null, modal);
    this.modalWrap.addEventListener('pointerdown', (e) => {
      if (e.target === this.modalWrap) this.closePanel();
    });

    if (isTouch) this.actionBtn = this.buildMobileControls();

    // Durum olayları
    state.events.on('cash', () => this.refreshHud());
    state.events.on('xp', () => this.refreshHud());
    state.events.on('rods', () => this.refreshHud());
    state.events.on('baits', () => this.refreshHud());
    state.events.on('toast', (t) => this.toast(t.text, t.kind));
    const allEvents: (keyof StateEvents)[] = ['cash', 'inventory', 'rods', 'baits', 'boats', 'bestiary', 'quests'];
    for (const ev of allEvents) {
      state.events.on(ev, () => {
        if (this.panelRender && this.panelEvents.includes(ev)) this.panelRender();
      });
    }
    this.refreshHud();
  }

  // ═════════════ HUD ═════════════
  refreshHud(): void {
    const s = this.state;
    this.cashEl.textContent = `🪙 ${formatCash(s.cash)}`;
    const li = s.levelInfo;
    this.levelEl.textContent = `⭐ Seviye ${li.level}`;
    this.xpText.textContent = `${li.into}/${li.needed} XP`;
    this.xpFill.style.width = `${(li.into / li.needed) * 100}%`;
    const bait = s.bait;
    this.gearEl.innerHTML = `🎣 <b>${s.rod.name}</b> · 🪱 ${bait ? `<b>${bait.name}</b> ×${s.data.baits[bait.id]}` : 'Yem yok'}`;
  }

  updateEnv(info: HudInfo): void {
    this.envEl.innerHTML = `<span class="clock">${info.isNight ? '🌙' : '☀️'} ${info.clock}</span> · ${WEATHER_ICON[info.weatherId] ?? ''} ${info.weather} · ${info.season}`;
    this.zoneEl.textContent = `📍 ${info.zone}`;
    this.nukeEl.style.display = info.nuke ? 'block' : 'none';
  }

  setFullscreenState(on: boolean, supported: boolean): void {
    if (!this.fsBtn) return;
    this.fsBtn.style.display = supported ? '' : 'none';
    const ic = this.fsBtn.querySelector('.ic');
    const lb = this.fsBtn.querySelector('.label');
    if (ic) ic.textContent = on ? '🗗' : '⛶';
    if (lb) lb.textContent = on ? 'Pencere' : 'Tam Ekran';
  }

  showZoneBanner(title: string, subtitle: string): void {
    this.bannerEl.innerHTML = `<div class="t">${title}</div><div class="s">${subtitle}</div>`;
    this.bannerEl.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), 3200);
  }

  private lastPrompt: string | null = null;

  setPrompt(text: string | null, icon = '💬'): void {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    if (text) {
      this.promptEl.innerHTML = this.isTouch ? text.replace(/\[E\] ?/, '') : text.replace(/\[E\]/, '<span class="key">E</span>');
      this.promptEl.style.display = 'block';
    } else this.promptEl.style.display = 'none';
    if (this.interactBtn) {
      this.interactBtn.classList.toggle('show', !!text);
      this.interactBtn.textContent = icon;
    }
  }

  setHint(text: string | null): void {
    if (text) {
      this.hintEl.textContent = text;
      this.hintEl.style.display = 'block';
    } else this.hintEl.style.display = 'none';
  }

  private pendingToasts: [string, 'info' | 'good' | 'bad' | 'rare', number][] = [];

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'rare' = 'info', ms = 3200): void {
    // Yakalama kartı açıkken bildirimleri biriktir (kart başlığıyla çakışmasın)
    if (this.catchVisible) {
      this.pendingToasts.push([text, kind, ms]);
      return;
    }
    const t = el('div', `toast ${kind}`, text, this.toastsEl);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild?.remove();
    window.setTimeout(() => {
      t.classList.add('out');
      window.setTimeout(() => t.remove(), 450);
    }, ms);
  }

  drawMinimap(px: number, pz: number, yaw: number, boat: { x: number; z: number } | null): void {
    const c = this.mctx;
    const W = this.minimap.width;
    const R = W / 2;
    const scale = R / 620;
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath();
    c.arc(R, R, R, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#1d5a80';
    c.fillRect(0, 0, W, W);
    // Kuzey (+z) yukarıda; x sağa
    const toMap = (x: number, z: number) => [R + (x - px) * scale, R - (z - pz) * scale] as const;
    // Abis Çukuru
    {
      const [x, y] = toMap(TRENCH.cx, TRENCH.cz);
      c.fillStyle = '#0a2238';
      c.beginPath();
      c.arc(x, y, TRENCH.radius * scale, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffd23a88';
      c.lineWidth = 3;
      c.setLineDash([6, 6]);
      c.stroke();
      c.setLineDash([]);
    }
    for (const isl of ISLANDS) {
      const [x, y] = toMap(isl.cx, isl.cz);
      if (isl.style === 'station') {
        c.fillStyle = '#e8b83a';
        c.fillRect(x - 6, y - 6, 12, 12);
      } else {
        c.fillStyle = isl.style === 'snow' ? '#e8f0f8' : isl.style === 'volcanic' ? '#d88a7a' : '#6ab04a';
        c.beginPath();
        c.arc(x, y, isl.radius * scale, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#f0d89a';
        c.lineWidth = 3;
        c.stroke();
      }
      c.fillStyle = '#fff';
      c.font = 'bold 22px Fredoka, sans-serif';
      c.textAlign = 'center';
      c.strokeStyle = '#0008';
      c.lineWidth = 4;
      const label = isl.style === 'station' ? 'İstasyon' : isl.name.split(' ')[0];
      c.strokeText(label, x, y - (isl.radius * scale + 8));
      c.fillText(label, x, y - (isl.radius * scale + 8));
    }
    if (boat) {
      const [x, y] = toMap(boat.x, boat.z);
      c.fillStyle = '#ffd23a';
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
    }
    // Oyuncu oku
    c.translate(R, R);
    c.rotate(yaw);
    c.fillStyle = '#ff4a3a';
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(10, 10);
    c.lineTo(0, 5);
    c.lineTo(-10, 10);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    c.fillStyle = '#fff';
    c.font = 'bold 22px Fredoka, sans-serif';
    c.textAlign = 'center';
    c.fillText('K', R, 24);
  }

  // ═════════════ Balık tutma ═════════════
  showPower(power: number): void {
    this.powerEl.style.display = 'block';
    this.powerFill.style.height = `${power * 100}%`;
    this.powerNeedle.style.bottom = `calc(${power * 100}% - 2px)`;
  }

  hidePower(): void {
    this.powerEl.style.display = 'none';
  }

  castRating(rating: CastRating): void {
    const e = el('div', `cast-rating ${rating}`, CAST_RATING_TEXT[rating], this.root);
    window.setTimeout(() => e.remove(), 1200);
  }

  spawnShake(onHit: () => void, lifetime = 1.7): void {
    const b = el('button', 'shake-btn', 'SARS!', this.shakeLayer);
    const x = 22 + Math.random() * 56;
    const y = 28 + Math.random() * 40;
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    let done = false;
    const remove = (cls: string) => {
      if (done) return;
      done = true;
      b.classList.add(cls);
      window.setTimeout(() => b.remove(), 260);
    };
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (done) return;
      onHit();
      remove('hit');
    });
    window.setTimeout(() => remove('out'), lifetime * 1000);
  }

  clearShakes(): void {
    clear(this.shakeLayer);
  }

  biteAlert(color: string): void {
    const e = el('div', 'bite', '!', this.root);
    e.style.color = color;
    window.setTimeout(() => e.remove(), 650);
  }

  showReel(fish: FishDef, params: ReelParams): void {
    const r = RARITIES[fish.rarity];
    this.reelTitle.innerHTML = `<span style="color:${r.color}">${fish.name}</span> · ${r.name}${params.overweight ? ' · <span style="color:#ff8a8a">⚠ Çok ağır!</span>' : ''}`;
    this.reelBar.style.width = `${params.barWidth * 100}%`;
    this.reelFish.innerHTML = fishSvg(r.color);
    this.reelEl.style.display = 'flex';
  }

  updateReel(game: ReelMinigame): void {
    this.reelBar.style.left = `${game.barPos * 100}%`;
    this.reelBar.classList.toggle('inside', game.fishInside);
    this.reelFish.style.left = `${game.fishPos * 100}%`;
    this.reelProgressFill.style.width = `${game.progress * 100}%`;
    this.reelProgress.classList.toggle('losing', !game.fishInside);
    const hint = !game.started ? '⏳ Hazır ol...' : this.isTouch ? 'Ekrana bas → sağa · Bırak → sola' : 'Basılı tut → sağa · Bırak → sola';
    this.reelInfo.innerHTML = `<span>${hint}</span><span class="${game.perfect ? 'perfect-on' : 'perfect-off'}">✨ Kusursuz</span>`;
  }

  hideReel(): void {
    this.reelEl.style.display = 'none';
  }

  get catchVisible(): boolean {
    return this.catchEl.classList.contains('show');
  }

  showCatch(d: CatchCardData, onDismiss: () => void): void {
    const r = RARITIES[d.fish.rarity];
    const v = VARIANTS[d.caught.variant];
    const o = d.outcome;
    const c = this.catchEl;
    clear(c);
    c.style.background = `radial-gradient(ellipse at 50% 48%, transparent 22%, ${r.color}33 45%, rgba(5,10,20,0.7) 78%)`;
    const head = el('div', 'catch-head', null, c);
    el('div', 'label', o.isNewSpecies ? '✦ YENİ TÜR! ✦' : 'YAKALANDI!', head);
    const name = el('div', 'name', d.fish.name, head);
    name.style.color = r.color;
    const badges = el('div', 'badges', null, head);
    const rb = el('span', 'badge', r.name, badges);
    rb.style.borderColor = r.color;
    rb.style.color = r.color;
    if (d.caught.variant !== 'none') {
      const vb = el('span', 'badge variant', `${v.name} ×${v.valueMult}`, badges);
      vb.style.background = v.color;
    }
    if (d.caught.perfect) el('span', 'badge perfect', '✨ KUSURSUZ YAKALAMA', badges);
    if (o.isNewVariant) el('span', 'badge new', 'Yeni varyant!', badges);
    if (o.isRecord) el('span', 'badge new', '🏆 Yeni rekor!', badges);

    el('div', null, null, c).style.flex = '1';

    const info = el('div', 'catch-info', null, c);
    if (d.caught.variant !== 'none') el('div', 'catch-desc', v.description, info);
    else el('div', 'catch-desc', d.fish.description, info);
    const stats = el('div', 'catch-stats', null, info);
    stats.innerHTML = `
      <div><small>Ağırlık</small><b>${formatWeight(d.caught.weight)}</b></div>
      <div><small>Değer</small><b style="color:var(--gold)">${formatCash(d.caught.value)}</b></div>
      <div><small>XP</small><b style="color:#7ad8ff">+${o.xpGained}${d.caught.perfect ? ' (1.5x)' : ''}</b></div>`;
    const extra = el('div', 'catch-extra', null, info);
    if (o.bonusCash > 0) el('div', null, `🪙 Kusursuz yakalama bonusu: +${formatCash(o.bonusCash)}`, extra);
    for (const q of o.questsCompleted) el('div', null, `📜 Görev tamamlandı: ${q.title} (+${formatCash(q.reward.cash)})`, extra);
    for (const l of o.levelUps) el('div', null, `⭐ Seviye ${l}!`, extra);
    button(this.isTouch ? 'Devam' : 'Devam (Space)', 'green', onDismiss, info);
    this.catchDismiss = onDismiss;
    c.classList.add('show');
  }

  hideCatch(): void {
    this.catchEl.classList.remove('show');
    this.catchDismiss = null;
    const pending = this.pendingToasts.splice(0);
    for (const [text, kind, ms] of pending) this.toast(text, kind, ms);
  }

  // ═════════════ Paneller ═════════════
  get modalOpen(): boolean {
    return this.modalWrap.classList.contains('show');
  }

  /** Çekme sırasında panel açılmasını engellemek için oyun tarafından atanır. */
  blockPanels: () => boolean = () => false;

  private openPanel(title: string, render: (body: HTMLElement) => void, events: (keyof StateEvents)[] = []): void {
    if (this.blockPanels()) return;
    const body = this.modalBody;
    const scroll = this.modalOpen && this.modalTitle.textContent === title ? body.scrollTop : 0;
    this.modalTitle.textContent = title;
    this.panelRender = () => {
      const st = body.scrollTop;
      clear(body);
      render(body);
      body.scrollTop = st;
    };
    this.panelEvents = events;
    clear(body);
    render(body);
    body.scrollTop = scroll;
    if (!this.modalOpen) {
      this.modalWrap.classList.add('show');
      this.actions.panelChanged(true);
    }
  }

  closePanel(): void {
    if (!this.modalOpen) return;
    this.modalWrap.classList.remove('show');
    this.panelRender = null;
    this.actions.panelChanged(false);
  }

  private npcLine(body: HTMLElement, npc: NpcDef): void {
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
    el('div', 'npc-line', null, body).innerHTML = `<b>${npc.name}:</b> “${line}”`;
  }

  openNpc(npc: NpcDef, island: IslandDef): void {
    this.audio.click();
    switch (npc.role) {
      case 'merchant':
        return this.openMerchant(npc);
      case 'rods':
        return this.openRodShop(npc, island);
      case 'bait':
        return this.openBaitShop(npc);
      case 'boats':
        return this.openBoatShop(npc);
      case 'quest':
        return this.openQuestNpc(npc);
      default:
        return this.openLore(npc);
    }
  }

  private fishRows(list: HTMLElement, items: CaughtFish[], sell: boolean): void {
    for (const f of [...items].reverse()) {
      const def = FISH_BY_ID[f.fishId];
      const r = RARITIES[def.rarity];
      const row = el('div', 'fish-row', null, list);
      row.style.borderLeftColor = r.color;
      const n = el('div', null, null, row);
      const variant = f.variant !== 'none' ? ` <span class="badge variant" style="background:${VARIANTS[f.variant].color}">${VARIANTS[f.variant].name}</span>` : '';
      n.innerHTML = `<span class="n" style="color:${r.color}">${def.name}</span>${variant}${f.perfect ? ' ✨' : ''}<div class="w">${r.name} · ${formatWeight(f.weight)}</div>`;
      el('div', 'v', formatCash(f.value), row);
      const lock = el('button', `lock${f.locked ? ' on' : ''}`, f.locked ? '🔒' : '🔓', row);
      lock.title = 'Kilitle (Hepsini Sat bunu atlar)';
      lock.addEventListener('click', () => this.state.toggleLock(f.uid));
      if (sell) {
        button('Sat', 'gold', () => {
          const v = this.state.sellFish(f.uid);
          if (v > 0) this.audio.coin();
        }, row);
      } else el('span', null, '', row);
    }
  }

  openMerchant(npc: NpcDef): void {
    this.openPanel(`🐟 ${npc.name}`, (body) => {
      this.npcLine(body, npc);
      const inv = this.state.data.inventory;
      const sellable = inv.filter((f) => !f.locked);
      const total = sellable.reduce((a, f) => a + f.value, 0);
      const bar = el('div', 'sell-bar', null, body);
      el('div', null, `Envanter: ${inv.length} balık · Toplam ${formatCash(this.state.inventoryValue())}`, bar);
      const b = button(`Hepsini Sat (${sellable.length}) · ${formatCash(total)}`, 'gold', () => {
        const r = this.state.sellAll();
        if (r.count > 0) {
          this.audio.coin();
          this.toast(`${r.count} balık satıldı: +${formatCash(r.total)}`, 'good');
        }
      }, bar);
      b.disabled = sellable.length === 0;
      const list = el('div', 'list', null, body);
      if (inv.length === 0) el('div', 'empty', 'Satacak balığın yok. Hadi oltayı at!', list);
      this.fishRows(list, inv, true);
    }, ['inventory', 'cash']);
  }

  private rodStats(rod: RodDef, parent: HTMLElement): void {
    const s = el('div', 'stats', null, parent);
    const fmt = (v: number, suffix = '%') => `<b class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}${suffix}</b>`;
    s.innerHTML = `
      <span>Yem Hızı</span>${fmt(rod.lureSpeed)}
      <span>Şans</span>${fmt(rod.luck)}
      <span>Kontrol</span>${fmt(Math.round(rod.control * 100))}
      <span>Direnç</span>${fmt(rod.resilience)}
      <span>Maks Ağırlık</span><b>${formatWeight(rod.maxWeight)}</b>`;
    if (rod.passiveText) el('div', 'passive', `✦ ${rod.passiveText}`, parent);
  }

  openRodShop(npc: NpcDef, island: IslandDef): void {
    this.openPanel(`🎣 ${npc.name}`, (body) => {
      this.npcLine(body, npc);
      const grid = el('div', 'grid', null, body);
      const rods = RODS.filter((r) => r.soldAt === island.id);
      for (const rod of rods) {
        const owned = this.state.data.ownedRods.includes(rod.id);
        const equipped = this.state.data.equippedRod === rod.id;
        const card = el('div', `card${owned ? ' owned' : ''}${equipped ? ' equipped' : ''}`, null, grid);
        el('h3', null, rod.name, card).style.color = rod.color === '#2a2a2e' ? '#cfd6e0' : rod.color;
        this.rodStats(rod, card);
        const row = el('div', 'row', null, card);
        el('span', 'price', owned ? 'Sahipsin' : formatCash(rod.price), row);
        if (owned) {
          const b = button(equipped ? 'Kuşanıldı' : 'Kuşan', 'green', () => this.state.equipRod(rod.id), row);
          b.disabled = equipped;
        } else {
          const check = this.state.canBuyRod(rod.id);
          const b = button('Satın Al', 'gold', () => {
            const r = this.state.buyRod(rod.id);
            if (r.ok) {
              this.audio.coin();
              this.toast(`${rod.name} satın alındı ve kuşanıldı!`, 'good');
            } else {
              this.audio.error();
              this.toast(r.reason, 'bad');
            }
          }, row);
          if (!check.ok) {
            b.disabled = check.reason !== 'Yetersiz akçe';
            el('div', 'req', check.reason, card);
          }
        }
        const reqs: string[] = [];
        if (rod.requiredLevel > 0) reqs.push(`Seviye ${rod.requiredLevel}`);
        if (rod.requiredBestiary > 0) reqs.push(`Balık Atlası %${Math.round(rod.requiredBestiary * 100)} (şu an %${Math.round(this.state.completion * 100)})`);
        if (reqs.length && !owned) el('div', 'sub', `Şartlar: ${reqs.join(' · ')}`, card);
      }
      const others = RODS.filter((r) => r.soldAt && r.soldAt !== island.id && !this.state.data.ownedRods.includes(r.id));
      if (others.length) {
        const hint = el('div', 'npc-line', null, body);
        hint.style.marginTop = '14px';
        hint.innerHTML = `Diğer oltalar: ${others.map((r) => `<b>${r.name}</b> (${REGION_NAMES[r.soldAt!]})`).join(', ')}`;
      }
    }, ['cash', 'rods']);
  }

  openBaitShop(npc: NpcDef): void {
    this.openPanel(`🪱 ${npc.name}`, (body) => {
      this.npcLine(body, npc);
      const grid = el('div', 'grid', null, body);
      for (const b of BAITS) {
        const count = this.state.data.baits[b.id] ?? 0;
        const equipped = this.state.data.equippedBait === b.id;
        const card = el('div', `card${equipped ? ' equipped' : ''}`, null, grid);
        el('h3', null, b.name, card).style.color = b.color;
        el('div', 'sub', b.description, card);
        const s = el('div', 'stats', null, card);
        s.innerHTML = `<span>Yem Hızı</span><b class="${b.lureSpeed >= 0 ? 'pos' : 'neg'}">${b.lureSpeed >= 0 ? '+' : ''}${b.lureSpeed}%</b>
          <span>Şans</span><b class="pos">+${b.luck}%</b>${b.variantBoost > 1 ? `<span>Varyant</span><b class="pos">x${b.variantBoost}</b>` : ''}
          <span>Sahip</span><b>${count}</b>`;
        const row = el('div', 'row', null, card);
        el('span', 'price', `${formatCash(b.packPrice)} / ${b.packSize} adet`, row);
        button('Satın Al', 'gold', () => {
          const r = this.state.buyBait(b.id);
          if (r.ok) this.audio.coin();
          else {
            this.audio.error();
            this.toast(r.reason, 'bad');
          }
        }, row);
        if (count > 0) {
          const eb = button(equipped ? 'Takılı' : 'Tak', 'green', () => this.state.equipBait(b.id), card);
          eb.disabled = equipped;
        }
      }
    }, ['cash', 'baits']);
  }

  openBoatShop(npc: NpcDef): void {
    this.openPanel(`⛵ ${npc.name}`, (body) => {
      this.npcLine(body, npc);
      const grid = el('div', 'grid', null, body);
      for (const b of BOATS) {
        const owned = this.state.data.ownedBoats.includes(b.id);
        const selected = this.state.data.selectedBoat === b.id;
        const card = el('div', `card${owned ? ' owned' : ''}${selected ? ' equipped' : ''}`, null, grid);
        el('h3', null, b.name, card).style.color = b.color;
        el('div', 'sub', b.description, card);
        const s = el('div', 'stats', null, card);
        s.innerHTML = `<span>Hız</span><b>${b.maxSpeed}</b><span>Dönüş</span><b>${b.turnRate}</b>${b.luckBonus ? `<span>Şans</span><b class="pos">+${b.luckBonus}%</b>` : ''}${b.allowsDeep ? '<span>Derinlikler</span><b class="pos">✓</b>' : ''}`;
        const row = el('div', 'row', null, card);
        el('span', 'price', owned ? 'Sahipsin' : formatCash(b.price), row);
        if (owned) {
          const sb = button(selected ? 'Seçili' : 'Seç', 'green', () => this.state.selectBoat(b.id), row);
          sb.disabled = selected;
        } else {
          button('Satın Al', 'gold', () => {
            const r = this.state.buyBoat(b.id);
            if (r.ok) {
              this.audio.coin();
              this.toast(`${b.name} senin! Suya yakınken T ile çağır.`, 'good', 4500);
            } else {
              this.audio.error();
              this.toast(r.reason, 'bad');
            }
          }, row);
          if (b.requiredLevel > this.state.level) el('div', 'req', `Seviye ${b.requiredLevel} gerekli`, card);
        }
      }
    }, ['cash', 'boats']);
  }

  private questCard(q: QuestDef, parent: HTMLElement, withActions: boolean): void {
    const st = questStatus(q, this.state.data.quests);
    const p = this.state.data.quests[q.id];
    const card = el('div', `card quest-card${st === 'done' ? ' done' : ''}`, null, parent);
    el('h3', null, `${st === 'done' ? '✅ ' : ''}${q.title}`, card);
    el('div', 'sub', q.description, card);
    const rw = [`🪙 ${formatCash(q.reward.cash)}`, `⭐ ${q.reward.xp} XP`];
    if (q.reward.bait) rw.push(`🪱 ${BAITS_BY_ID[q.reward.bait.id].name} ×${q.reward.bait.amount}`);
    el('div', 'passive', `Ödül: ${rw.join(' · ')}`, card);
    if (st === 'active' || st === 'done') {
      const prog = el('div', 'progress', null, card);
      const fill = el('div', null, null, prog);
      const val = st === 'done' ? q.objective.count : p?.progress ?? 0;
      fill.style.width = `${(val / q.objective.count) * 100}%`;
      el('div', 'sub', `${val} / ${q.objective.count}`, card);
    }
    if (!withActions) return;
    if (st === 'available') {
      button('Görevi Kabul Et', 'green', () => {
        const r = this.state.acceptQuest(q.id);
        if (r.ok) {
          this.audio.click();
          this.toast(`Yeni görev: ${q.title}`, 'good');
        }
      }, card);
    } else if (st === 'locked') {
      el('div', 'req', 'Önce önceki görevi tamamla.', card);
    }
  }

  openQuestNpc(npc: NpcDef): void {
    this.openPanel(`📜 ${npc.name}`, (body) => {
      this.npcLine(body, npc);
      const grid = el('div', 'grid', null, body);
      for (const q of questsForNpc(npc.id)) this.questCard(q, grid, true);
    }, ['quests']);
  }

  openLore(npc: NpcDef): void {
    this.openPanel(`❓ ${npc.name}`, (body) => {
      for (const line of npc.lines) el('div', 'npc-line', null, body).innerHTML = `<b>${npc.name}:</b> “${line}”`;
    });
  }

  openInventory(tab: 'fish' | 'rods' | 'baits' | 'boats' = 'fish'): void {
    let current = tab;
    this.openPanel('🎒 Envanter', (body) => {
      const tabs = el('div', 'tabs', null, body);
      const mk = (id: typeof current, label: string) => {
        const t = el('button', `tab${current === id ? ' active' : ''}`, label, tabs);
        t.addEventListener('click', () => {
          current = id;
          this.panelRender?.();
        });
      };
      mk('fish', `🐟 Balıklar (${this.state.data.inventory.length})`);
      mk('rods', '🎣 Oltalar');
      mk('baits', '🪱 Yemler');
      mk('boats', '⛵ Tekneler');
      if (current === 'fish') {
        el('div', 'npc-line', `Toplam değer: ${formatCash(this.state.inventoryValue())}. Satmak için bir Tüccar'a git.`, body);
        const list = el('div', 'list', null, body);
        if (this.state.data.inventory.length === 0) el('div', 'empty', 'Henüz balık yok.', list);
        this.fishRows(list, this.state.data.inventory, false);
      } else if (current === 'rods') {
        const grid = el('div', 'grid', null, body);
        for (const rod of RODS.filter((r) => this.state.data.ownedRods.includes(r.id))) {
          const equipped = this.state.data.equippedRod === rod.id;
          const card = el('div', `card owned${equipped ? ' equipped' : ''}`, null, grid);
          el('h3', null, rod.name, card);
          this.rodStats(rod, card);
          const b = button(equipped ? 'Kuşanıldı' : 'Kuşan', 'green', () => this.state.equipRod(rod.id), card);
          b.disabled = equipped;
        }
      } else if (current === 'baits') {
        const grid = el('div', 'grid', null, body);
        const owned = BAITS.filter((b) => (this.state.data.baits[b.id] ?? 0) > 0);
        if (owned.length === 0) el('div', 'empty', 'Yemin yok. Yemciden satın alabilirsin.', body);
        for (const b of owned) {
          const equipped = this.state.data.equippedBait === b.id;
          const card = el('div', `card${equipped ? ' equipped' : ''}`, null, grid);
          el('h3', null, `${b.name} ×${this.state.data.baits[b.id]}`, card).style.color = b.color;
          el('div', 'sub', b.description, card);
          button(equipped ? 'Çıkar' : 'Tak', equipped ? 'ghost' : 'green', () => this.state.equipBait(equipped ? null : b.id), card);
        }
      } else {
        const grid = el('div', 'grid', null, body);
        const owned = BOATS.filter((b) => this.state.data.ownedBoats.includes(b.id));
        if (owned.length === 0) el('div', 'empty', 'Teknen yok. Kayıkhaneden bir Kayık alarak başla!', body);
        for (const b of owned) {
          const selected = this.state.data.selectedBoat === b.id;
          const card = el('div', `card owned${selected ? ' equipped' : ''}`, null, grid);
          el('h3', null, b.name, card).style.color = b.color;
          el('div', 'sub', b.description, card);
          const sb = button(selected ? 'Seçili' : 'Seç', 'green', () => this.state.selectBoat(b.id), card);
          sb.disabled = selected;
        }
      }
    }, ['inventory', 'rods', 'baits', 'boats']);
  }

  openBestiary(region: RegionId | 'trash' = 'camlikoy'): void {
    let current: RegionId | 'trash' = region;
    this.openPanel('📖 Balık Atlası', (body) => {
      const comp = this.state.completion;
      const c = el('div', 'completion', null, body);
      el('b', null, `Toplam tamamlanma: %${Math.round(comp * 100)}`, c);
      const bar = el('div', 'bar', null, c);
      el('div', null, null, bar).style.width = `${comp * 100}%`;
      el('span', 'sub', 'Üst düzey oltalar ansiklopedi tamamlanması gerektirir.', c);

      const tabs = el('div', 'tabs', null, body);
      for (const r of [...REGION_ORDER, 'trash' as const]) {
        const label = r === 'trash' ? 'Çöp' : REGION_NAMES[r];
        let extra = '';
        if (r !== 'trash') {
          const p = regionProgress(this.state.data.bestiary, r);
          extra = ` ${p.caught}/${p.total}`;
        }
        const t = el('button', `tab${current === r ? ' active' : ''}`, label + extra, tabs);
        t.addEventListener('click', () => {
          current = r;
          this.panelRender?.();
        });
      }
      const list = current === 'trash' ? trashFish() : regionFish(current);
      if (current !== 'trash') {
        const p = regionProgress(this.state.data.bestiary, current);
        const reward = REGION_REWARDS[current];
        const claimed = this.state.data.regionRewards.includes(current);
        const rw = el('div', 'npc-line', null, body);
        rw.innerHTML = `Bölge ödülü (gizli türler hariç tümünü yakala: ${p.requiredCaught}/${p.required}): <b>${formatCash(reward.cash)}</b> + <b>kalıcı +%${reward.luck} şans</b>${claimed ? ' — ✅ Alındı' : ''}`;
        if (!claimed && p.complete) {
          button('Ödülü Al', 'gold', () => {
            const r = this.state.claimRegion(current as RegionId);
            if (r.ok) {
              this.audio.questComplete();
              this.toast(`${REGION_NAMES[current as RegionId]} tamamlandı! Ödül alındı.`, 'rare');
            }
          }, rw);
        }
      }
      const grid = el('div', 'grid', null, body);
      for (const f of list) {
        const entry = this.state.data.bestiary[f.id];
        const r = RARITIES[f.rarity];
        const card = el('div', `bestiary-card${entry ? '' : ' unknown'}`, null, grid);
        card.style.borderTopColor = r.color;
        const isSecret = r.order >= 8;
        el('h4', null, entry ? f.name : isSecret ? '??? (Gizli)' : '???', card).style.color = entry ? r.color : '#cfd6e0';
        el('div', 'sub', r.name, card).style.color = r.color;
        const cond: string[] = [];
        if (f.time) cond.push(f.time === 'night' ? '🌙 Gece' : '☀️ Gündüz');
        if (f.weather) cond.push(f.weather.map((w) => `${WEATHER_ICON[w]} ${WEATHER_NAMES[w]}`).join('/'));
        if (f.seasons) cond.push(f.seasons.map((s) => SEASON_NAMES[s]).join('/'));
        if (!entry && isSecret) el('div', 'cond', 'Koşullar gizli...', card);
        else el('div', 'cond', cond.length ? cond.join(' · ') : 'Her zaman', card);
        if (entry) {
          el('div', null, `Yakalanan: ${entry.count} · Rekor: ${formatWeight(entry.maxWeight)}`, card);
          if (entry.variants.length) {
            const vb = el('div', 'vbadges', null, card);
            for (const v of entry.variants) {
              const s = el('span', null, VARIANTS[v].name, vb);
              s.style.background = VARIANTS[v].color;
            }
          }
          el('div', 'cond', f.description, card);
        }
      }
    }, ['bestiary']);
  }

  openQuests(): void {
    this.openPanel('📜 Görevler', (body) => {
      const log = this.state.data.quests;
      const active = QUESTS.filter((q) => log[q.id]?.status === 'active');
      const done = QUESTS.filter((q) => log[q.id]?.status === 'done');
      const avail = QUESTS.filter((q) => questStatus(q, log) === 'available');
      el('h3', null, `Aktif (${active.length})`, body);
      const g1 = el('div', 'grid', null, body);
      if (!active.length) el('div', 'empty', 'Aktif görev yok. Adalardaki "!" işaretli kişilerle konuş.', g1);
      for (const q of active) this.questCard(q, g1, false);
      if (avail.length) {
        el('h3', null, 'Alınabilir', body);
        const g2 = el('div', 'grid', null, body);
        for (const q of avail) {
          const isl = ISLANDS.find((i) => i.npcs.some((n) => n.id === q.npcId))!;
          const npc = isl.npcs.find((n) => n.id === q.npcId)!;
          const card = el('div', 'card', null, g2);
          el('h3', null, q.title, card);
          el('div', 'sub', `${npc.name} · ${isl.name}`, card);
        }
      }
      if (done.length) {
        el('h3', null, `Tamamlanan (${done.length})`, body);
        const g3 = el('div', 'grid', null, body);
        for (const q of done) this.questCard(q, g3, false);
      }
    }, ['quests']);
  }

  openSettings(): void {
    this.openPanel('⚙️ Ayarlar', (body) => {
      const s = this.state.data.settings;
      const slider = (label: string, value: number, onChange: (v: number) => void) => {
        const row = el('div', 'settings-row', null, body);
        el('span', null, label, row);
        const inp = el('input', null, null, row);
        inp.type = 'range';
        inp.min = '0';
        inp.max = '1';
        inp.step = '0.05';
        inp.value = String(value);
        inp.addEventListener('input', () => onChange(Number(inp.value)));
      };
      slider('🔊 Ana ses', s.volume, (v) => {
        s.volume = v;
        this.actions.settingsChanged();
      });
      slider('🎵 Müzik', s.music, (v) => {
        s.music = v;
        this.actions.settingsChanged();
      });
      const mute = el('div', 'settings-row', null, body);
      el('span', null, '🔇 Sesi kapat (M)', mute);
      button(s.muted ? 'Sesi Aç' : 'Sustur', s.muted ? 'green' : 'red', () => {
        s.muted = !s.muted;
        this.actions.settingsChanged();
        this.panelRender?.();
      }, mute);
      const fs = el('div', 'settings-row', null, body);
      el('span', null, '⛶ Tam ekran (U)', fs);
      button('Aç / Kapat', 'ghost', () => this.actions.toggleFullscreen(), fs);
      if (this.isTouch) {
        const hp = el('div', 'settings-row', null, body);
        el('span', null, '📳 Titreşim', hp);
        button(s.haptics ? 'Açık' : 'Kapalı', s.haptics ? 'green' : 'ghost', () => {
          s.haptics = !s.haptics;
          this.actions.settingsChanged();
          this.panelRender?.();
        }, hp);
      }
      const q = el('div', 'settings-row', null, body);
      el('span', null, '🖥️ Grafik kalitesi (yeniden yükleme gerekir)', q);
      const sel = el('select', null, null, q);
      for (const [v, l] of [['auto', 'Otomatik'], ['high', 'Yüksek'], ['low', 'Düşük']] as const) {
        const o = el('option', null, l, sel);
        o.value = v;
        if (s.quality === v) o.selected = true;
      }
      sel.addEventListener('change', () => {
        s.quality = sel.value as typeof s.quality;
        this.actions.settingsChanged();
      });
      const st = this.state.data.stats;
      const stats = el('div', 'npc-line', null, body);
      stats.style.marginTop = '14px';
      const big = st.biggest ? `${FISH_BY_ID[st.biggest.fishId]?.name} (${formatWeight(st.biggest.weight)})` : '-';
      stats.innerHTML = `<b>İstatistikler</b><br>Toplam yakalanan: ${st.totalCaught} · Kusursuz: ${st.perfectCatches} · Kaçan: ${st.escaped} · Atış: ${st.casts}<br>Toplam kazanç: ${formatCash(st.totalEarned)} · En büyük: ${big}`;
      const reset = el('div', 'settings-row', null, body);
      el('span', null, '🗑️ Kaydı sıfırla', reset);
      button('Sıfırla', 'red', () => {
        if (window.confirm('Tüm ilerleme silinsin mi? Bu geri alınamaz.')) this.actions.resetSave();
      }, reset);
    });
  }

  openHelp(): void {
    this.openPanel('❔ Nasıl Oynanır', (body) => {
      el('div', 'npc-line', 'Atış → Bekleme & Sarsma → Çekme → Yakalama. Balık sat, olta yükselt, adaları keşfet ve ansiklopediyi doldur!', body);
      const g = el('div', 'help-grid', null, body);
      const rows: [string, string][] = this.isTouch
        ? [
            ['🕹️', 'Ekranın sol yarısına dokun ve sürükle: yürü (uzağa it: koş)'],
            ['🎣', 'Büyük butonu basılı tut → güç çubuğu dolar, yeşil alanda bırak = Mükemmel!'],
            ['SARS!', 'Beklerken beliren butonlara dokun: balık daha çabuk gelir'],
            ['🌀', 'Çekerken ekranın sağ yarısında HERHANGİ bir yere bas → çubuk sağa, bırak → sola'],
            ['💬', 'Biri yakındayken beliren butonla konuş / tekneye bin-in'],
            ['⛵', 'Teknen varsa suya yakınken çağır'],
            ['☝️', 'Sağ yarıyı sürükle: kamera · iki parmak: yakınlaştır'],
            ['⛶', 'Üstteki düğmeyle tam ekran (iPhone: Paylaş → Ana Ekrana Ekle)'],
          ]
        : [
            ['W A S D', 'Yürü (Shift: koş) · Space: zıpla'],
            ['Sol tık', 'Basılı tut → güç çubuğu dolar. Yeşil alanda bırak = Mükemmel!'],
            ['SARS!', 'Beklerken beliren butonlara tıkla: balık daha çabuk gelir'],
            ['Sol tık', 'Çekerken: basılı tut → çubuk sağa, bırak → sola. Balığı çubuğun içinde tut'],
            ['Sağ tık', 'Sürükle: kamerayı döndür · Tekerlek: yakınlaştır'],
            ['E', 'Kişilerle konuş / tekneye bin-in'],
            ['T', 'Teknen varsa suya yakınken çağır (teknede W/S gaz, A/D dümen)'],
            ['I K J', 'Envanter · Balık Atlası · Görevler'],
            ['M · U', 'Sesi aç/kapat · Tam ekran'],
          ];
      for (const [k, d] of rows) {
        el('span', 'key', k, g);
        el('span', null, d, g);
      }
      el('div', 'npc-line', null, body).innerHTML =
        '<b>İpuçları:</b> Nadir balıklar daha uzun bekler ama sesleri daha belirgindir. Gece, yağmur, sis, kutup ışıkları ve mevsimler farklı balıklar getirir. Balık hiç çubuktan çıkmazsa <b>Kusursuz Yakalama</b>: 1.5x XP + ekstra akçe!';
    });
  }

  // ═════════════ Mobil ═════════════
  private interactBtn: HTMLButtonElement | null = null;
  private boatBtn: HTMLButtonElement | null = null;
  private actionLabel: HTMLElement | null = null;
  private actionIcon: HTMLElement | null = null;
  private lastActionMode = '';

  /**
   * Mobil kontroller:
   * - Sol yarıda yüzen joystick: başparmağın değdiği yerde belirir.
   * - Büyük, duruma göre değişen eylem butonu (At / Bırak / Çek / Devam).
   * - Yalnızca etkileşim varken görünen "Konuş/Bin" butonu, zıplama ve tekne butonları.
   */
  private buildMobileControls(): HTMLButtonElement {
    const wrap = el('div', 'mobile', null, this.root);
    const zone = el('div', 'joy-zone', null, wrap);
    const base = el('div', 'joystick', null, zone);
    const knob = el('div', 'knob', null, base);
    let active: number | null = null;
    let cx = 0;
    let cy = 0;
    const R = 62;
    const place = (x: number, y: number) => {
      const zr = zone.getBoundingClientRect();
      cx = x;
      cy = y;
      base.style.left = `${x - zr.left}px`;
      base.style.top = `${y - zr.top}px`;
    };
    const move = (e: PointerEvent) => {
      let dx = (e.clientX - cx) / R;
      let dy = (e.clientY - cy) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        // Parmak çok uzaklaşırsa taban onu takip eder
        cx += (dx / l) * (l - 1) * R;
        cy += (dy / l) * (l - 1) * R;
        place(cx, cy);
        dx /= l;
        dy /= l;
      }
      knob.style.transform = `translate(${dx * R * 0.7}px, ${dy * R * 0.7}px)`;
      this.onJoystick?.(dx, -dy);
    };
    let holdId: number | null = null;
    zone.addEventListener('pointerdown', (e) => {
      // Çekme sırasında sol yarıya basmak da "basılı tut" sayılır
      if (this.holdMode()) {
        holdId = e.pointerId;
        safeCapture(zone, e.pointerId);
        this.onHold?.(`zone-${e.pointerId}`, true);
        return;
      }
      if (active !== null) return;
      active = e.pointerId;
      safeCapture(zone, e.pointerId);
      base.classList.add('active');
      place(e.clientX, e.clientY);
      move(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === active) move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === holdId) {
        holdId = null;
        this.onHold?.(`zone-${e.pointerId}`, false);
        return;
      }
      if (e.pointerId !== active) return;
      active = null;
      base.classList.remove('active');
      knob.style.transform = '';
      base.style.left = '';
      base.style.top = '';
      this.onJoystick?.(0, 0);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const mk = (cls: string, html: string) => {
      const b = el('button', `m-btn ${cls}`, null, wrap);
      b.innerHTML = html;
      return b;
    };
    const action = mk('m-action', '<span class="ic">🎣</span><span class="lb">AT</span>');
    this.actionIcon = action.querySelector('.ic');
    this.actionLabel = action.querySelector('.lb');
    action.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      safeCapture(action, e.pointerId);
      action.classList.add('held');
      this.onAction?.(true);
    });
    const up = () => {
      action.classList.remove('held');
      this.onAction?.(false);
    };
    action.addEventListener('pointerup', up);
    action.addEventListener('pointercancel', up);
    mk('m-jump', '⤒').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.actions.jump();
    });
    this.interactBtn = mk('m-interact', '💬');
    this.interactBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.actions.interact();
    });
    this.boatBtn = mk('m-boat', '⛵');
    this.boatBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.actions.summonBoat();
    });
    return action;
  }

  /** Mobil eylem butonunun simgesi ve etiketi (balık tutma durumuna göre). */
  setActionMode(mode: 'cast' | 'release' | 'wait' | 'reel' | 'continue' | 'swim'): void {
    if (!this.actionIcon || !this.actionLabel || mode === this.lastActionMode) return;
    this.lastActionMode = mode;
    const map = {
      cast: ['🎣', 'AT'],
      release: ['🎯', 'BIRAK'],
      wait: ['⏳', 'BEKLE'],
      reel: ['🌀', 'ÇEK'],
      continue: ['✔️', 'DEVAM'],
      swim: ['🏊', 'YÜZ'],
    } as const;
    this.actionIcon.textContent = map[mode][0];
    this.actionLabel.textContent = map[mode][1];
    this.actionBtn?.classList.toggle('reeling', mode === 'reel');
  }

  /** Tekne butonunu yalnızca tekne sahibi olunca göster. */
  setBoatAvailable(v: boolean): void {
    if (this.boatBtn) this.boatBtn.style.display = v ? '' : 'none';
  }

  onJoystick: ((x: number, y: number) => void) | null = null;
  onHold: ((source: string, down: boolean) => void) | null = null;
  holdMode: () => boolean = () => false;
  onAction: ((down: boolean) => void) | null = null;
}

/** Pointer yakalama bazı durumlarda (ör. sentetik olaylar) hata fırlatabilir; oyunu bozmasın. */
function safeCapture(el: Element, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    /* yok say */
  }
}
