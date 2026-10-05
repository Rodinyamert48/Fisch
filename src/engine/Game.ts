import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { BOATS_BY_ID } from '../core/data/boats';
import { FISH_BY_ID } from '../core/data/fish';
import { ISLANDS, ISLANDS_BY_ID, REGION_NAMES, WORLD_LIMIT } from '../core/data/world';
import { EnvironmentSim, SEASON_NAMES, WEATHER_NAMES, formatClock } from '../core/environment';
import { clearStorage, saveToStorage, type PlayerState } from '../core/playerState';
import { findLandNear, findWaterNear, groundHeight, inTrench, islandAt, townCenter, zoneNameAt } from '../core/worldMap';
import type { RegionId, SeasonId } from '../core/types';
import { AudioSystem } from '../audio/AudioSystem';
import { UI } from '../ui/UI';
import { fullscreenSupported, isFullscreen, isIOS, isStandalone, onFullscreenChange, toggleFullscreen, vibrate } from '../ui/fullscreen';
import { Boat } from './Boat';
import { CameraController } from './CameraController';
import { Effects } from './Effects';
import { FishingController } from './FishingController';
import { Graphics } from './Graphics';
import { hex } from './geometry';
import { Input } from './Input';
import { Materials } from './materials';
import { NpcManager, type NpcEntity } from './Npcs';
import { Player } from './Player';
import { Sky } from './Sky';
import { Water } from './Water';
import { WorldBuilder } from './WorldBuilder';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';

const SEASON_TINT: Record<SeasonId, string> = {
  spring: '#f4fff0',
  summer: '#ffffff',
  autumn: '#ffe8c8',
  winter: '#eef4ff',
};

const C = (h: string) => hex(h);
const SKY = {
  dayZen: C('#3a86de'),
  dayHor: C('#bfe2fb'),
  setZen: C('#3e4f92'),
  setHor: C('#ffac70'),
  nightZen: C('#050c1c'),
  nightHor: C('#16284a'),
  rain: C('#6f7c8a'),
  fog: C('#c4cfd8'),
  nukeZen: C('#14400c'),
  nukeHor: C('#7cff52'),
};

/** Oyunun kalbi: sahne, sistemler ve ana döngü. */
export class Game {
  readonly engine: Engine;
  readonly scene: Scene;
  private mats: Materials;
  private sky: Sky;
  private water: Water;
  private glow: GlowLayer | null;
  private gfx: Graphics;
  private sun: DirectionalLight;
  private hemi: HemisphericLight;
  private cam: CameraController;
  private input: Input;
  private player: Player;
  private npcs: NpcManager;
  private fishing: FishingController;
  private effects: Effects;
  private env: EnvironmentSim;
  readonly audio = new AudioSystem();
  readonly ui: UI;
  private boat: Boat | null = null;
  private nearestNpc: NpcEntity | null = null;
  private lastZoneKey = '';
  private saveTimer = 0;
  private hudTimer = 0;
  private weatherF = { rain: 0, fog: 0, aurora: 0, nuke: 0, deep: 0, snow: 0 };
  private readonly debug = new URLSearchParams(location.search).has('debug');
  readonly quality: 'low' | 'high';
  private firstCastHintShown = false;
  private foamTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    readonly state: PlayerState,
  ) {
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    const q = state.data.settings.quality;
    this.quality = q === 'auto' ? (isTouch || navigator.hardwareConcurrency <= 4 ? 'low' : 'high') : q;
    const high = this.quality === 'high';

    this.engine = new Engine(canvas, high, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }, true);
    const dpr = window.devicePixelRatio || 1;
    this.engine.setHardwareScalingLevel(high ? 1 / Math.min(dpr, 1.5) : Math.max(1, 1.4 / dpr));
    const scene = new Scene(this.engine);
    this.scene = scene;
    scene.skipPointerMovePicking = true;
    scene.clearColor = new Color4(0.75, 0.88, 0.98, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0018;
    scene.ambientColor = new Color3(0.15, 0.15, 0.18);

    this.mats = new Materials(scene, this.quality);
    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.3), scene);
    this.sun.intensity = 1.1;
    this.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    this.hemi.intensity = 0.6;

    this.glow = new GlowLayer('glow', scene, { mainTextureRatio: high ? 0.5 : 0.25, blurKernelSize: high ? 48 : 24 });
    this.glow.intensity = 0.85;

    this.cam = new CameraController(scene, canvas);
    this.gfx = new Graphics(this.engine, scene, this.cam.camera, this.sun, high);
    this.sky = new Sky(scene, this.gfx.linearOutput);
    this.water = new Water(scene, 3200, high ? 512 : 256);
    this.water.addToRenderList(this.sky.mesh);
    if (!high) this.water.setRefreshRate(2);

    // Dünya
    const builder = new WorldBuilder(scene, this.mats, this.quality);
    const world = builder.build();
    for (const m of [...world.terrain, ...world.props, world.seabed]) this.water.addToRenderList(m);
    for (const m of world.lamps) this.water.addToRenderList(m);
    for (const m of [...world.lamps, ...world.lava]) this.glow.addIncludedOnlyMesh(m);
    this.gfx.addCasters(world.props);
    this.gfx.addReceivers([...world.terrain, ...world.props, ...world.grass]);

    this.effects = new Effects(scene, this.mats, this.cam.camera, !high);
    for (const p of builder.lavaPoints) this.effects.addSmoke(p);

    // Oyuncu
    const spawn = this.spawnPoint();
    this.player = new Player(scene, this.mats, builder.colliders, spawn);
    this.player.yaw = state.data.player?.rot ?? ISLANDS[0].dockAngle;
    this.cam.snapBehind(this.player.yaw);
    for (const m of this.player.meshes) this.water.addToRenderList(m);
    this.gfx.addCasters(this.player.meshes);
    this.gfx.addReceivers(this.player.meshes);
    this.player.setRod(state.rod.color, state.rod.tier);

    // Kamera binaların içine girmesin
    const boxes = builder.colliders.filter((c) => c.kind === 'box');
    this.cam.blocked = (x, y, z) =>
      boxes.some((c) => {
        if (c.kind !== 'box') return false;
        const dx = x - c.x;
        const dz = z - c.z;
        const s = Math.sin(c.angle);
        const co = Math.cos(c.angle);
        return Math.abs(dx * co - dz * s) < c.hw + 0.6 && Math.abs(dx * s + dz * co) < c.hd + 0.6 && y < groundHeight(c.x, c.z) + 9;
      });

    this.npcs = new NpcManager(scene, this.mats, builder.npcSpots);
    for (const n of this.npcs.list) {
      this.gfx.addCasters(n.char.meshes);
      this.gfx.addReceivers(n.char.meshes);
    }
    this.env = new EnvironmentSim(Math.random, state.data.env);

    this.input = new Input(canvas);
    this.ui = new UI(document.getElementById('ui')!, state, this.audio, isTouch, {
      summonBoat: () => this.summonBoat(),
      toggleFullscreen: () => void this.toggleFullscreen(),
      interact: () => this.interact(),
      jump: () => (this.jumpQueued = true),
      resetSave: () => this.resetSave(),
      settingsChanged: () => this.applySettings(),
      panelChanged: (open) => {
        if (open) this.fishing.cancel();
        this.input.releaseAll();
      },
    });
    this.input.blocked = () => this.ui.modalOpen;
    this.ui.blockPanels = () => ['charging', 'casting', 'bite', 'reeling', 'result'].includes(this.fishing.state);
    this.ui.onJoystick = (x, y) => {
      this.input.joystick.x = x;
      this.input.joystick.y = y;
    };
    this.ui.onAction = (down) => {
      this.audio.init();
      this.input.hold('action', down);
    };
    this.ui.onHold = (source, down) => this.input.hold(source, down);
    // Çekme sırasında ekranın her yerine basmak çubuğu sağa iter (mobil rahatlığı)
    const holdMode = () => this.fishing.state === 'reeling' || this.fishing.state === 'bite';
    this.ui.holdMode = holdMode;
    this.input.touchHold = holdMode;
    this.cam.ignoreTouch = holdMode;
    onFullscreenChange(() => {
      this.engine.resize();
      this.ui.setFullscreenState(isFullscreen(), fullscreenSupported() || isIOS());
    });
    this.ui.setFullscreenState(isFullscreen(), (fullscreenSupported() || isIOS()) && !isStandalone());
    this.ui.setBoatAvailable(state.data.ownedBoats.length > 0);

    this.fishing = new FishingController({
      scene, mats: this.mats, player: this.player, state, env: this.env, audio: this.audio, ui: this.ui,
      effects: this.effects, camera: this.cam, glow: this.glow,
      haptic: (p) => this.haptic(p),
    });

    this.wireInput();
    this.wireState();
    if (this.debug) (window as unknown as { fischData: unknown }).fischData = { FISH_BY_ID };
    this.applySettings();

    if (state.data.ownedBoats.length && !state.data.selectedBoat) state.selectBoat(state.data.ownedBoats[0]);
    window.addEventListener('resize', () => this.engine.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
    window.addEventListener('beforeunload', () => this.save());
  }

  private jumpQueued = false;

  private spawnPoint(): Vector3 {
    const p = this.state.data.player;
    if (p && Number.isFinite(p.x) && Math.hypot(p.x, p.z) < WORLD_LIMIT) {
      return new Vector3(p.x, Math.max(groundHeight(p.x, p.z), -1.15), p.z);
    }
    const isl = ISLANDS[0];
    const t = townCenter(isl);
    const fx = Math.sin(isl.dockAngle);
    const fz = Math.cos(isl.dockAngle);
    const x = t.x + fx * 6;
    const z = t.z + fz * 6;
    return new Vector3(x, groundHeight(x, z), z);
  }

  /** Sahne hazır olduğunda render döngüsünü başlatır. */
  async start(onProgress: (p: number) => void): Promise<void> {
    onProgress(0.6);
    await this.scene.whenReadyAsync();
    onProgress(1);
    this.engine.runRenderLoop(() => this.frame());
  }

  begin(): void {
    this.audio.init();
    this.applySettings();
    const z = zoneNameAt(this.player.position.x, this.player.position.z);
    this.lastZoneKey = '';
    this.checkZone(z.name);
    if (!this.state.data.tutorialDone) {
      this.ui.openHelp();
      this.state.data.tutorialDone = true;
    }
    if (this.ui.isTouch && window.innerHeight > window.innerWidth) {
      this.ui.toast('🔄 Daha rahat oynamak için telefonu yatay çevir.', 'info', 5000);
    }
  }

  // ───────────── Girdi ─────────────
  private wireInput(): void {
    const inp = this.input;
    inp.onPrimaryDown = () => {
      this.audio.init();
      if (this.ui.catchVisible) {
        this.fishing.dismissResult();
        return;
      }
      if (this.ui.modalOpen) return;
      this.fishing.onPrimaryDown();
    };
    inp.onPrimaryUp = () => this.fishing.onPrimaryUp();
    inp.onKeyDown = (code) => {
      this.audio.init();
      if (code === 'Escape') {
        if (this.ui.modalOpen) this.ui.closePanel();
        else if (this.ui.catchVisible) this.fishing.dismissResult();
        else this.fishing.cancel('Olta toplandı.');
        return;
      }
      if ((code === 'Space' || code === 'Enter') && this.ui.catchVisible) {
        this.fishing.dismissResult();
        return;
      }
      if (code === 'KeyF') {
        if (!this.ui.modalOpen) inp.setPrimary(true);
        return;
      }
      const toggle = (open: () => void) => {
        if (this.ui.modalOpen) this.ui.closePanel();
        else open();
      };
      switch (code) {
        case 'KeyE':
          this.interact();
          break;
        case 'KeyT':
          this.summonBoat();
          break;
        case 'KeyI':
          toggle(() => this.ui.openInventory());
          break;
        case 'KeyK':
        case 'KeyB':
          toggle(() => this.ui.openBestiary(this.currentRegion()));
          break;
        case 'KeyJ':
          toggle(() => this.ui.openQuests());
          break;
        case 'KeyO':
          toggle(() => this.ui.openSettings());
          break;
        case 'KeyH':
          toggle(() => this.ui.openHelp());
          break;
        case 'KeyU':
          void this.toggleFullscreen();
          break;
        case 'KeyM':
          this.state.data.settings.muted = !this.state.data.settings.muted;
          this.applySettings();
          this.ui.toast(this.state.data.settings.muted ? '🔇 Ses kapalı' : '🔊 Ses açık');
          break;
        case 'Space':
          if (this.fishing.state === 'idle') this.jumpQueued = true;
          break;
        default:
          if (this.debug) this.debugKey(code);
      }
    };
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyF') inp.setPrimary(false);
    });
  }

  private debugKey(code: string): void {
    const env = this.env;
    switch (code) {
      case 'KeyN':
        env.setHour(env.timeOfDay === 'day' ? 22 : 9);
        this.ui.toast(`[debug] Saat ${formatClock(env.hour)}`);
        break;
      case 'KeyR': {
        const order = ['clear', 'rain', 'fog', 'aurora'] as const;
        env.setWeather(order[(order.indexOf(env.weather) + 1) % order.length]);
        this.ui.toast(`[debug] Hava: ${WEATHER_NAMES[env.weather]}`);
        break;
      }
      case 'KeyY':
        env.startNuke();
        this.ui.toast('[debug] Yeşil Şafak');
        break;
      case 'KeyC':
        this.state.addCash(100000);
        break;
      case 'KeyL':
        this.state.addXp(this.state.levelInfo.needed);
        break;
      case 'KeyP':
        env.totalSeconds += 720 * 2;
        this.ui.toast(`[debug] Mevsim: ${SEASON_NAMES[env.season]}`);
        break;
    }
  }

  private wireState(): void {
    const s = this.state;
    s.events.on('rods', () => this.player.setRod(s.rod.color, s.rod.tier));
    s.events.on('levelUp', (lv) => {
      this.audio.levelUp();
      if (this.fishing.state !== 'reeling') this.ui.toast(`⭐ Seviye atladın! Seviye ${lv}`, 'rare', 4000);
      this.effects.confetti(this.player.position.add(new Vector3(0, 3, 0)), ['#7ad8ff', '#ffffff', '#ffd23f']);
    });
    s.events.on('questCompleted', (q) => {
      this.audio.questComplete();
      if (this.fishing.state !== 'reeling') this.ui.toast(`📜 Görev tamamlandı: ${q.title}!`, 'rare', 4500);
    });
    s.events.on('boats', () => {
      this.ui.setBoatAvailable(s.data.ownedBoats.length > 0);
      if (this.boat && this.boat.def.id !== s.data.selectedBoat && !this.player.boat) {
        this.boat.dispose();
        this.boat = null;
      }
    });
  }

  /** Tam ekranı aç/kapat; iPhone'da Ana Ekrana Ekle ipucu gösterir. */
  async toggleFullscreen(): Promise<void> {
    if (!fullscreenSupported()) {
      if (isIOS()) this.ui.toast('iPhone/iPad\'de tam ekran için: Paylaş ⬆️ → "Ana Ekrana Ekle", sonra oyunu oradan aç.', 'info', 6000);
      else this.ui.toast('Bu tarayıcı tam ekranı desteklemiyor.', 'bad');
      return;
    }
    await toggleFullscreen(this.ui.isTouch);
    window.setTimeout(() => this.engine.resize(), 250);
  }

  /** Dokunmatik titreşim (ayar açıksa). */
  haptic(pattern: number | number[]): void {
    if (this.ui.isTouch && this.state.data.settings.haptics) vibrate(pattern);
  }

  private applySettings(): void {
    const st = this.state.data.settings;
    this.audio.setVolumes(st.volume, st.music, st.muted);
    this.save();
  }

  private resetSave(): void {
    clearStorage();
    this.resetting = true;
    location.reload();
  }

  private resetting = false;

  save(): void {
    if (this.resetting) return;
    const p = this.player.boat ? this.player.boat.position : this.player.position;
    this.state.data.env = this.env.snapshot();
    this.state.data.player = { x: p.x, y: p.y, z: p.z, rot: this.player.yaw };
    saveToStorage(this.state);
  }

  // ───────────── Etkileşim ─────────────
  private currentRegion(): RegionId {
    const p = this.player.position;
    const isl = islandAt(p.x, p.z, true);
    if (isl) return isl.id;
    return inTrench(p.x, p.z) ? 'abis' : 'acikdeniz';
  }

  private interact(): void {
    if (this.ui.modalOpen || this.fishing.locksMovement) return;
    const p = this.player;
    if (p.boat) {
      this.exitBoat();
      return;
    }
    if (this.nearestNpc) {
      this.fishing.cancel();
      this.ui.openNpc(this.nearestNpc.def, this.nearestNpc.island);
      return;
    }
    if (this.boat && Vector3.Distance(p.position, this.boat.seatWorld()) < 7) {
      this.enterBoat();
    }
  }

  private summonBoat(): void {
    this.audio.init();
    if (this.player.boat) {
      this.ui.toast('Zaten teknedesin. E ile inebilirsin.');
      return;
    }
    const def = this.state.selectedBoat;
    if (!def) {
      this.ui.toast('Teknen yok! Çamlıkoy Kayıkhanesi\'nden bir Kayık al (300 akçe).', 'bad', 4000);
      return;
    }
    const p = this.player.position;
    const spot = findWaterNear(p.x, p.z, -1.8);
    if (!spot) {
      this.ui.toast('Yakında uygun su yok. Kıyıya veya iskele ucuna git.', 'bad');
      this.audio.error();
      return;
    }
    if (this.boat) {
      this.gfx.removeCasters([this.boat.mesh]);
      this.boat.dispose();
    }
    const heading = Math.atan2(spot.x - p.x, spot.z - p.z);
    this.boat = new Boat(this.scene, this.mats, this.effects, BOATS_BY_ID[def.id], spot.x, spot.z, heading);
    this.water.addToRenderList(this.boat.mesh);
    this.gfx.addCasters([this.boat.mesh]);
    this.gfx.addReceivers([this.boat.mesh]);
    this.effects.splash(new Vector3(spot.x, 0.1, spot.z), 1.6);
    this.audio.splash(1.2);
    this.ui.toast(`${def.name} hazır! Yanına gidip E ile bin.`, 'good');
  }

  private enterBoat(): void {
    if (!this.boat) return;
    this.fishing.cancel();
    this.player.boat = this.boat;
    this.player.swimming = false;
    this.cam.radius = Math.max(this.cam.radius, 18);
    this.audio.boatEngine(true);
    this.ui.toast(this.ui.isTouch ? 'Joystick ile sür. Durunca balık tutabilirsin.' : 'W/S: gaz · A/D: dümen · Durunca balık tutabilirsin · E: in');
  }

  private exitBoat(): void {
    const b = this.player.boat;
    if (!b) return;
    if (this.fishing.busy) this.fishing.cancel();
    this.player.boat = null;
    const land = findLandNear(b.x, b.z, 10);
    if (land) {
      this.player.position.set(land.x, land.y, land.z);
    } else {
      const r = { x: Math.cos(b.heading), z: -Math.sin(b.heading) };
      this.player.position.set(b.x + r.x * (b.shape.width + 1), -1.15, b.z + r.z * (b.shape.width + 1));
      this.player.swimming = true;
    }
    b.speed = 0;
  }

  // ───────────── Ana döngü ─────────────
  private frame(): void {
    const dt = Math.min(0.1, this.engine.getDeltaTime() / 1000);
    this.gfx.adapt(dt);
    this.gfx.focus(this.player.position);
    this.update(dt);
    this.scene.render();
  }

  private update(dt: number): void {
    const inp = this.input;
    const move = inp.move();
    const locked = this.fishing.locksMovement || this.ui.catchVisible;

    // Bekleme sırasında hareket etmek oltayı toplar
    if (this.fishing.state === 'waiting' && Math.hypot(move.x, move.y) > 0.2) this.fishing.cancel('Olta toplandı.');

    const fwd = this.cam.forward();
    if (this.player.boat) {
      const b = this.player.boat;
      const drive = this.fishing.busy ? { x: 0, y: 0 } : move;
      b.update(dt, drive.y, drive.x, true);
      if (Math.abs(b.speed) > 3) this.cam.followBehind(b.speed > 0 ? b.heading : b.heading + Math.PI, dt);
    } else if (this.boat) {
      this.boat.update(dt, 0, 0, false);
    }
    this.player.update(dt, move, inp.running, this.jumpQueued, fwd, locked);
    this.jumpQueued = false;

    const holding = inp.primaryHeld || (this.fishing.state === 'reeling' && inp.key('Space'));
    this.fishing.update(dt, holding);

    const changes = this.env.update(dt);
    if (changes.weather) {
      const icons: Record<string, string> = { clear: '☀️', rain: '🌧️', fog: '🌫️', aurora: '🌌' };
      this.ui.toast(`${icons[changes.weather]} Hava değişti: ${WEATHER_NAMES[changes.weather]}`);
    }
    if (changes.nukeStarted) {
      this.ui.toast('🟢 YEŞİL ŞAFAK! Gökyüzü yeşile döndü, Fosforlu balıklar ortaya çıktı!', 'rare', 6000);
      this.audio.error();
    }
    if (changes.nukeEnded) this.ui.toast('🟢 Yeşil Şafak sona erdi.');
    if (changes.season) this.ui.toast(`🍃 Mevsim değişti: ${SEASON_NAMES[changes.season]}`, 'good', 4500);

    const followPos = this.player.boat ? this.player.position.add(new Vector3(0, -0.6, 0)) : this.player.position;
    this.cam.update(dt, followPos, groundHeight);

    // NPC'ler ve etkileşim istemi
    this.nearestNpc = this.player.boat ? null : this.npcs.update(dt, this.player.position, this.state.data.quests);
    if (this.player.boat) this.npcs.update(dt, this.player.position, this.state.data.quests, 0);
    this.updatePrompt();

    this.updateEnvironmentVisuals(dt);
    this.effects.update(dt, this.cam.camera.position);
    this.audio.update(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.25;
      const p = this.player.position;
      const z = zoneNameAt(p.x, p.z);
      this.checkZone(z.name);
      this.ui.updateEnv({
        clock: formatClock(this.env.hour),
        isNight: this.env.timeOfDay === 'night',
        weather: WEATHER_NAMES[this.env.weather],
        weatherId: this.env.weather,
        season: SEASON_NAMES[this.env.season],
        zone: z.name,
        nuke: this.env.nukeActive,
      });
      this.ui.drawMinimap(p.x, p.z, this.player.yaw, this.boat && !this.player.boat ? { x: this.boat.x, z: this.boat.z } : null);
      if (!this.firstCastHintShown && this.state.data.stats.casts === 0 && this.fishing.state === 'idle' && !this.ui.modalOpen) {
        this.ui.setHint(this.ui.isTouch ? '🎣 Büyük butonu basılı tut, yeşil alanda bırak!' : '🎣 Suya bak, sol tıkı basılı tut ve yeşil alanda bırak!');
      } else if (!this.firstCastHintShown && this.state.data.stats.casts > 0) {
        this.firstCastHintShown = true;
      }
    }

    this.saveTimer += dt;
    if (this.saveTimer > 10) {
      this.saveTimer = 0;
      this.save();
    }
  }

  private updatePrompt(): void {
    // Mobil eylem butonu: duruma göre simge/etiket
    if (this.ui.isTouch) {
      const st = this.fishing.state;
      this.ui.setActionMode(
        this.ui.catchVisible ? 'continue'
          : st === 'charging' ? 'release'
            : st === 'reeling' || st === 'bite' ? 'reel'
              : st === 'waiting' || st === 'casting' ? 'wait'
                : this.player.swimming ? 'swim' : 'cast',
      );
    }
    if (this.ui.modalOpen || this.fishing.locksMovement) {
      this.ui.setPrompt(null);
      return;
    }
    const p = this.player;
    if (p.boat) {
      this.ui.setPrompt(`[E] ${p.boat.def.name}'dan in`, '⬅️');
    } else if (this.nearestNpc) {
      this.ui.setPrompt(`[E] ${this.nearestNpc.def.name} ile konuş`, '💬');
    } else if (this.boat && Vector3.Distance(p.position, this.boat.seatWorld()) < 7) {
      this.ui.setPrompt(`[E] ${this.boat.def.name}'ya bin`, '⛵');
    } else {
      this.ui.setPrompt(null);
    }
  }

  private checkZone(name: string): void {
    if (name === this.lastZoneKey) return;
    this.lastZoneKey = name;
    const region = this.currentRegion();
    this.audio.setMood(region);
    const isl = islandAt(this.player.position.x, this.player.position.z, true);
    if (isl) this.ui.showZoneBanner(isl.name, isl.subtitle);
    else if (inTrench(this.player.position.x, this.player.position.z)) {
      const st = ISLANDS_BY_ID['abis'];
      this.ui.showZoneBanner('Abis Çukuru', this.player.boat?.def.allowsDeep ? 'Batiskaf ile abis balıkları seni bekliyor' : st.subtitle);
    } else this.ui.showZoneBanner(REGION_NAMES.acikdeniz, 'Açık deniz balıkları · Tekneden balık tut');
  }

  private updateEnvironmentVisuals(dt: number): void {
    const env = this.env;
    const sunV = env.sunDirection();
    const sunDir = new Vector3(sunV.x, sunV.y, sunV.z);
    const daylight = env.daylight();
    const p = this.player.position;
    const nearSnow = Math.hypot(p.x - ISLANDS_BY_ID['ayazburun'].cx, p.z - ISLANDS_BY_ID['ayazburun'].cz) < 260;
    const winter = env.season === 'winter';
    const deep = inTrench(p.x, p.z) ? 1 : 0;
    const k = 1 - Math.exp(-dt * 0.6);
    const f = this.weatherF;
    const target = {
      rain: env.weather === 'rain' ? 1 : 0,
      fog: env.weather === 'fog' ? 1 : 0,
      aurora: env.weather === 'aurora' ? 1 : 0,
      nuke: env.nukeActive ? 1 : 0,
      deep,
      snow: nearSnow ? 0.35 + (env.weather === 'rain' ? 0.65 : 0) : winter && env.weather === 'rain' ? 1 : 0,
    };
    for (const key of Object.keys(f) as (keyof typeof f)[]) f[key] += (target[key] - f[key]) * k;
    const rainVisual = f.rain * (nearSnow || winter ? 0 : 1);

    const sunset = Math.max(0, 1 - Math.abs(sunDir.y) / 0.28) * (sunDir.y > -0.25 ? 1 : 0);
    let zen = Color3.Lerp(SKY.nightZen, SKY.dayZen, daylight);
    let hor = Color3.Lerp(SKY.nightHor, SKY.dayHor, daylight);
    zen = Color3.Lerp(zen, SKY.setZen, sunset * 0.45);
    hor = Color3.Lerp(hor, SKY.setHor, sunset * 0.65);
    const gray = SKY.rain.scale(0.25 + 0.75 * daylight);
    zen = Color3.Lerp(zen, gray.scale(0.8), f.rain * 0.7);
    hor = Color3.Lerp(hor, gray, f.rain * 0.7);
    hor = Color3.Lerp(hor, SKY.fog.scale(0.2 + 0.8 * daylight), f.fog * 0.85);
    zen = Color3.Lerp(zen, SKY.nukeZen, f.nuke * 0.6);
    hor = Color3.Lerp(hor, SKY.nukeHor.scale(0.25 + 0.5 * daylight), f.nuke * 0.45);
    const isl = islandAt(p.x, p.z, true);
    if (isl) hor = Color3.Lerp(hor, hex(isl.fogTint).scale(0.25 + 0.75 * daylight), 0.15);
    const fogColor = Color3.Lerp(hor, C('#04101e'), f.deep * 0.6);

    const sunColor = Color3.Lerp(C('#fff4d8'), C('#ff9a50'), sunset);
    this.sky.update(dt, {
      sunDir,
      zenith: zen,
      horizon: hor,
      sunColor,
      cloudColor: Color3.Lerp(C('#ffffff'), C('#8a96a2'), f.rain).scale(0.2 + 0.8 * daylight).add(SKY.setHor.scale(sunset * 0.2)),
      night: 1 - daylight,
      aurora: f.aurora * (1 - daylight),
      cloudCover: Math.min(1, 0.3 + f.rain * 0.65 + f.fog * 0.25),
    });
    const sc = this.scene;
    sc.fogColor = fogColor;
    sc.clearColor.set(fogColor.r, fogColor.g, fogColor.b, 1);
    sc.fogDensity = 0.0012 + f.fog * 0.009 + f.rain * 0.0018 + f.deep * 0.0035;

    // Işıklar: gündüz güneş, gece ay
    const lightDir = sunDir.y > -0.05 ? sunDir : sunDir.scale(-1).add(new Vector3(0, 0.3, 0)).normalize();
    this.sun.direction = lightDir.scale(-1);
    const storm = 1 - f.rain * 0.45;
    // Yüksek kalitede gölgeler okunsun diye güneş güçlü, ortam ışığı zayıf
    const hq = this.gfx.high;
    this.sun.intensity = (daylight * (hq ? 1.75 : 1.15) + (1 - daylight) * 0.32) * storm;
    this.sun.diffuse = daylight > 0.05 ? sunColor : C('#9ab4ff');
    this.sun.specular = this.sun.diffuse.scale(0.6);
    this.hemi.intensity = (0.4 + (hq ? 0.12 : 0.42) * daylight) * (1 - f.rain * 0.25) + f.aurora * 0.15 + f.nuke * 0.1 + (hq ? f.rain * 0.25 : 0);
    this.hemi.diffuse = Color3.Lerp(C('#7a8cc8'), C('#dcecff'), daylight).add(C('#3aff7a').scale(f.aurora * 0.15 + f.nuke * 0.25));
    this.hemi.groundColor = Color3.Lerp(C('#141a2a'), C('#6a6a5a'), daylight);

    const waterBase = isl?.style === 'volcanic' ? C('#1a6a7a') : isl?.style === 'snow' ? C('#2a5a7a') : C('#145a78');
    this.water.setMood({ color: Color3.Lerp(waterBase, C('#030a18'), f.deep * 0.8), daylight, storm: f.rain, deep: f.deep });

    const night = 1 - daylight;
    this.mats.lamps.emissiveColor = new Color3(1, 0.82, 0.5).scale(0.2 + night * 1.0);
    const tint = hex(SEASON_TINT[env.season]);
    this.mats.terrain.diffuseColor = tint.scale(1.22);
    this.mats.nature.diffuseColor = tint.scale(1.2);
    this.gfx.setDaylight(daylight, f.rain);
    // Kıyı köpüğü: yavaşça kayar ve nefes alır
    this.foamTime += dt;
    const foamTex = this.mats.foam.diffuseTexture;
    if (foamTex) {
      (foamTex as Texture).uOffset = this.foamTime * 0.012;
      (foamTex as Texture).vOffset = Math.sin(this.foamTime * 0.7) * 0.06;
    }
    this.mats.foam.emissiveColor = new Color3(0.12, 0.14, 0.16).scale(0.4 + daylight * 0.8);
    this.mats.foam.alpha = 0.75 + Math.sin(this.foamTime * 0.7) * 0.15;

    this.effects.setRain(rainVisual);
    this.effects.setSnow(f.snow);
    this.audio.updateAmbience({
      daylight,
      rain: f.rain,
      wind: nearSnow ? 0.6 : f.rain * 0.5 + (isl ? 0 : 0.15),
      nearLand: isl ? 1 : 0.2,
      deep: f.deep,
    });
  }
}

