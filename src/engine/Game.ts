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
import { Boat } from './Boat';
import { CameraController } from './CameraController';
import { Effects } from './Effects';
import { FishingController } from './FishingController';
import { hex } from './geometry';
import { Input } from './Input';
import { Materials } from './materials';
import { NpcManager, type NpcEntity } from './Npcs';
import { Player } from './Player';
import { Sky } from './Sky';
import { Water } from './Water';
import { WorldBuilder } from './WorldBuilder';

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

    this.mats = new Materials(scene);
    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.3), scene);
    this.sun.intensity = 1.1;
    this.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    this.hemi.intensity = 0.6;

    this.glow = new GlowLayer('glow', scene, { mainTextureRatio: high ? 0.5 : 0.25, blurKernelSize: high ? 48 : 24 });
    this.glow.intensity = 0.85;

    this.cam = new CameraController(scene, canvas);
    this.sky = new Sky(scene);
    this.water = new Water(scene, 3200, high ? 512 : 256);
    this.water.addToRenderList(this.sky.mesh);
    if (!high) this.water.setRefreshRate(2);

    // Dünya
    const builder = new WorldBuilder(scene, this.mats, this.quality);
    const world = builder.build();
    for (const m of [...world.terrain, ...world.props, world.seabed]) this.water.addToRenderList(m);
    for (const m of world.lamps) this.water.addToRenderList(m);
    for (const m of [...world.lamps, ...world.lava]) this.glow.addIncludedOnlyMesh(m);

    this.effects = new Effects(scene, this.mats, this.cam.camera, !high);
    for (const p of builder.lavaPoints) this.effects.addSmoke(p);

    // Oyuncu
    const spawn = this.spawnPoint();
    this.player = new Player(scene, this.mats, builder.colliders, spawn);
    this.player.yaw = state.data.player?.rot ?? ISLANDS[0].dockAngle;
    this.cam.snapBehind(this.player.yaw);
    for (const m of this.player.meshes) this.water.addToRenderList(m);
    this.player.setRod(state.rod.color, state.rod.tier);

    this.npcs = new NpcManager(scene, this.mats, builder.npcSpots);
    this.env = new EnvironmentSim(Math.random, state.data.env);

    this.input = new Input(canvas);
    this.ui = new UI(document.getElementById('ui')!, state, this.audio, isTouch, {
      summonBoat: () => this.summonBoat(),
      interact: () => this.interact(),
      jump: () => (this.jumpQueued = true),
      resetSave: () => this.resetSave(),
      settingsChanged: () => this.applySettings(),
      panelChanged: (open) => {
        if (open) this.fishing.cancel();
        this.input.setPrimary(false);
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
      this.input.setPrimary(down);
    };

    this.fishing = new FishingController({
      scene, mats: this.mats, player: this.player, state, env: this.env, audio: this.audio, ui: this.ui,
      effects: this.effects, camera: this.cam, glow: this.glow,
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
      case 'KeyU':
        env.startNuke();
        this.ui.toast('[debug] Nükleer olay');
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
      if (this.boat && this.boat.def.id !== s.data.selectedBoat && !this.player.boat) {
        this.boat.dispose();
        this.boat = null;
      }
    });
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
    return inTrench(p.x, p.z) ? 'deep' : 'ocean';
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
      this.ui.toast('Teknen yok! Moosewood Tersanesi\'nden bir Kano al (300 C$).', 'bad', 4000);
      return;
    }
    const p = this.player.position;
    const spot = findWaterNear(p.x, p.z, -1.8);
    if (!spot) {
      this.ui.toast('Yakında uygun su yok. Kıyıya veya iskele ucuna git.', 'bad');
      this.audio.error();
      return;
    }
    this.boat?.dispose();
    const heading = Math.atan2(spot.x - p.x, spot.z - p.z);
    this.boat = new Boat(this.scene, this.mats, this.effects, BOATS_BY_ID[def.id], spot.x, spot.z, heading);
    this.water.addToRenderList(this.boat.mesh);
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
      this.ui.toast('☢️ NÜKLEER OLAY! Nükleer varyantlı balıklar ortaya çıktı!', 'rare', 6000);
      this.audio.error();
    }
    if (changes.nukeEnded) this.ui.toast('☢️ Nükleer olay sona erdi.');
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
    if (this.ui.modalOpen || this.fishing.locksMovement) {
      this.ui.setPrompt(null);
      return;
    }
    const p = this.player;
    if (p.boat) {
      this.ui.setPrompt(`[E] ${p.boat.def.name}'dan in`);
    } else if (this.nearestNpc) {
      this.ui.setPrompt(`[E] ${this.nearestNpc.def.name} ile konuş`);
    } else if (this.boat && Vector3.Distance(p.position, this.boat.seatWorld()) < 7) {
      this.ui.setPrompt(`[E] ${this.boat.def.name}'ya bin`);
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
      const st = ISLANDS_BY_ID['deep'];
      this.ui.showZoneBanner('Derinlikler', this.player.boat?.def.allowsDeep ? 'Batiskaf ile abis balıkları seni bekliyor' : st.subtitle);
    } else this.ui.showZoneBanner(REGION_NAMES.ocean, 'Açık deniz balıkları · Tekneden balık tut');
  }

  private updateEnvironmentVisuals(dt: number): void {
    const env = this.env;
    const sunV = env.sunDirection();
    const sunDir = new Vector3(sunV.x, sunV.y, sunV.z);
    const daylight = env.daylight();
    const p = this.player.position;
    const nearSnow = Math.hypot(p.x - ISLANDS_BY_ID['snowcap'].cx, p.z - ISLANDS_BY_ID['snowcap'].cz) < 260;
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
    this.sun.intensity = (daylight * 1.15 + (1 - daylight) * 0.32) * storm;
    this.sun.diffuse = daylight > 0.05 ? sunColor : C('#9ab4ff');
    this.sun.specular = this.sun.diffuse.scale(0.6);
    this.hemi.intensity = (0.4 + 0.42 * daylight) * (1 - f.rain * 0.25) + f.aurora * 0.15 + f.nuke * 0.1;
    this.hemi.diffuse = Color3.Lerp(C('#7a8cc8'), C('#dcecff'), daylight).add(C('#3aff7a').scale(f.aurora * 0.15 + f.nuke * 0.25));
    this.hemi.groundColor = Color3.Lerp(C('#141a2a'), C('#6a6a5a'), daylight);

    const waterBase = isl?.style === 'volcanic' ? C('#1a6a7a') : isl?.style === 'snow' ? C('#2a5a7a') : C('#145a78');
    this.water.setMood({ color: Color3.Lerp(waterBase, C('#030a18'), f.deep * 0.8), daylight, storm: f.rain, deep: f.deep });

    const night = 1 - daylight;
    this.mats.lamps.emissiveColor = new Color3(1, 0.82, 0.5).scale(0.2 + night * 1.0);
    this.mats.vertexColor.diffuseColor = hex(SEASON_TINT[env.season]);

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

