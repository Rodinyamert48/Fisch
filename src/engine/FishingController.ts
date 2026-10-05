import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import type { Scene } from '@babylonjs/core/scene';
import { RARITIES } from '../core/data/rarities';
import { VARIANTS } from '../core/data/variants';
import { biteDelay, rollCatch, totalLureSpeed, type CatchRoll } from '../core/catchRoller';
import { CastMeter, type CastRating } from '../core/castMeter';
import { catchXp, fishValue, perfectBonusCash } from '../core/economy';
import type { EnvironmentSim } from '../core/environment';
import { makeUid, type PlayerState } from '../core/playerState';
import { ReelMinigame, reelParamsFor } from '../core/reelMinigame';
import type { BaitDef, CaughtFish, RegionId } from '../core/types';
import { groundHeight, inTrench, regionAt } from '../core/worldMap';
import type { AudioSystem } from '../audio/AudioSystem';
import type { UI } from '../ui/UI';
import type { CameraController } from './CameraController';
import type { Effects } from './Effects';
import { buildFishModel, type FishModel } from './FishModel';
import type { Materials } from './materials';
import type { Player } from './Player';

export type FishingState = 'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'result';

export interface FishingDeps {
  scene: Scene;
  mats: Materials;
  player: Player;
  state: PlayerState;
  env: EnvironmentSim;
  audio: AudioSystem;
  ui: UI;
  effects: Effects;
  camera: CameraController;
  glow: GlowLayer | null;
  haptic: (pattern: number | number[]) => void;
}

const LINE_POINTS = 14;

/**
 * Dört aşamalı balık tutma akışı:
 * 1) Atış (güç çubuğu) → 2) Bekleme & Sarsma → 3) Çekme mini oyunu → 4) Sonuç ve gösterim.
 */
export class FishingController {
  state: FishingState = 'idle';
  private meter = new CastMeter();
  private bobber: Mesh;
  private line: LinesMesh;
  private linePts: Vector3[] = [];
  private castFrom = new Vector3();
  private castTo = new Vector3();
  private castT = 0;
  private castDur = 1;
  private castDist = 10;
  private rating: CastRating = 'meh';
  private roll: CatchRoll | null = null;
  private region: RegionId = 'camlikoy';
  private usedBait: BaitDef | null = null;
  private biteTimer = 0;
  private biteTotal = 0;
  private shakeTimer = 0;
  private nibbleTimer = 0;
  private stateTime = 0;
  private reel: ReelMinigame | null = null;
  private showcase: FishModel | null = null;
  private dip = 0;
  private trenchHintShown = false;

  constructor(private readonly d: FishingDeps) {
    const { scene, mats } = d;
    this.bobber = CreateSphere('bobber', { diameter: 0.34, segments: 6 }, scene);
    this.bobber.material = mats.solid('#ff3a3a', { emissive: 0.25, specular: 0.4 });
    const cap = CreateCylinder('bobberTop', { height: 0.22, diameterTop: 0.04, diameterBottom: 0.12, tessellation: 6 }, scene);
    cap.material = mats.solid('#ffffff', { emissive: 0.2 });
    cap.parent = this.bobber;
    cap.position.y = 0.2;
    this.bobber.isPickable = false;
    this.bobber.setEnabled(false);
    for (let i = 0; i < LINE_POINTS; i++) this.linePts.push(new Vector3());
    this.line = CreateLines('line', { points: this.linePts, updatable: true }, scene);
    this.line.color = new Color3(0.92, 0.95, 1);
    this.line.alpha = 0.85;
    this.line.isPickable = false;
    this.line.setEnabled(false);
  }

  get busy(): boolean {
    return this.state !== 'idle';
  }

  /** Hareketi kilitleyen durumlar. */
  get locksMovement(): boolean {
    return this.state === 'charging' || this.state === 'casting' || this.state === 'bite' || this.state === 'reeling' || this.state === 'result';
  }

  private canCast(): boolean {
    const p = this.d.player;
    if (this.d.ui.modalOpen) return false;
    if (p.swimming) {
      this.d.ui.toast('Yüzerken balık tutamazsın!', 'bad');
      return false;
    }
    if (p.boat && Math.abs(p.boat.speed) > 2.5) {
      this.d.ui.toast('Atış için tekneyi durdur.', 'info');
      return false;
    }
    return true;
  }

  onPrimaryDown(): void {
    if (this.state === 'idle') {
      if (!this.canCast()) return;
      this.setState('charging');
      this.meter.start();
      const f = this.d.camera.forward();
      this.d.player.aimYaw = Math.atan2(f.x, f.z);
      this.d.player.setPose('charge');
      this.d.audio.castCharge();
    } else if (this.state === 'result') {
      this.dismissResult();
    }
  }

  onPrimaryUp(): void {
    if (this.state === 'charging') this.release();
  }

  /** Oltayı geri sar (bekleme sırasında hareket edilirse). */
  cancel(message?: string): void {
    if (this.state === 'waiting' || this.state === 'casting' || this.state === 'charging' || this.state === 'bite') {
      if (message) this.d.ui.toast(message, 'info');
      this.resetToIdle();
    }
  }

  private setState(s: FishingState): void {
    this.state = s;
    this.stateTime = 0;
  }

  private release(): void {
    const { power, rating } = this.meter.release();
    this.rating = rating;
    this.d.ui.hidePower();
    this.d.ui.castRating(rating);
    this.d.audio.castRating(rating);
    this.d.audio.whoosh(power);
    this.castDist = CastMeter.distance(power);
    const p = this.d.player;
    let yaw = p.aimYaw ?? p.yaw;
    // Nişan yardımı: hedef karadaysa en yakın açıda/mesafede suya yönlendir
    const fix = this.aimAssist(p.position, yaw, this.castDist + 1.5);
    if (fix) {
      yaw = fix.yaw;
      this.castDist = fix.dist - 1.5;
      p.aimYaw = yaw;
    }
    const dir = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.castFrom = p.tipPosition();
    this.castTo = p.position.add(dir.scale(this.castDist + 1.5));
    this.castTo.y = 0.05;
    if (rating === 'perfect') this.d.haptic(35);
    this.castT = 0;
    this.castDur = 0.55 + this.castDist * 0.018;
    this.d.state.data.stats.casts++;
    p.setPose('cast');
    this.bobber.setEnabled(true);
    this.line.setEnabled(true);
    this.setState('casting');
  }

  /** Hedef karadaysa ±80° içinde ve daha kısa mesafelerde su arar. */
  private aimAssist(from: Vector3, yaw: number, dist: number): { yaw: number; dist: number } | null {
    const isWater = (y: number, d: number) => groundHeight(from.x + Math.sin(y) * d, from.z + Math.cos(y) * d) < -0.6;
    if (isWater(yaw, dist)) return null;
    for (const k of [1, 0.85, 0.7, 0.55]) {
      const d = Math.max(7, dist * k);
      for (let step = 1; step <= 11; step++) {
        for (const sgn of [1, -1]) {
          const y = yaw + sgn * step * 0.125;
          if (isWater(y, d)) return { yaw: y, dist: d };
        }
      }
    }
    return null;
  }

  private land(): void {
    const to = this.castTo;
    const g = groundHeight(to.x, to.z);
    if (g > -0.25) {
      this.d.ui.toast(g > 1 ? 'Yem karaya düştü! Suya doğru at.' : 'Burası çok sığ! Daha derine at.', 'bad');
      this.d.audio.error();
      this.resetToIdle();
      return;
    }
    this.d.effects.splash(new Vector3(to.x, 0.05, to.z), 0.8);
    this.d.audio.splash(0.8);
    const s = this.d.state;
    const env = this.d.env;
    const boat = this.d.player.boat;
    this.usedBait = s.consumeBait();
    this.region = regionAt(to.x, to.z, !!boat?.def.allowsDeep);
    if (this.region === 'acikdeniz' && inTrench(to.x, to.z) && !this.trenchHintShown) {
      this.trenchHintShown = true;
      this.d.ui.toast('Abis balıkları için Batiskaf gerekli. Burada açık deniz balıkları var.', 'info', 4500);
    }
    const perfect = this.rating === 'perfect';
    this.roll = rollCatch(
      {
        region: this.region,
        rod: s.rod,
        bait: this.usedBait,
        bonusLuck: s.permanentLuck() + (boat?.def.luckBonus ?? 0) + (perfect ? 10 : 0),
        time: env.timeOfDay,
        weather: env.weather,
        season: env.season,
        nukeEvent: env.nukeActive,
      },
      Math.random,
    );
    const lure = totalLureSpeed(s.rod, this.usedBait, env.weather, perfect);
    this.biteTotal = biteDelay(this.roll.fish.rarity, lure, Math.random);
    this.biteTimer = this.biteTotal;
    this.shakeTimer = 0.6 + Math.random() * 0.6;
    this.nibbleTimer = 1.2;
    this.d.player.setPose('wait');
    this.d.ui.setHint(this.d.ui.isTouch ? 'Bekleniyor... SARS butonlarına dokun!' : 'Bekleniyor... SARS butonlarına tıkla! (Hareket edersen olta toplanır)');
    this.setState('waiting');
  }

  private shakeHit = (): void => {
    if (this.state !== 'waiting') return;
    const cut = Math.max(0.7, this.biteTotal * 0.13);
    this.biteTimer -= cut;
    this.dip = 0.25;
    this.d.audio.shakeClick();
    this.d.effects.bubbles(this.bobber.position, false);
  };

  private startBite(): void {
    const roll = this.roll!;
    const r = RARITIES[roll.fish.rarity];
    this.d.ui.clearShakes();
    this.d.ui.setHint(null);
    this.d.ui.biteAlert(r.order >= 4 ? r.color : '#ffd23f');
    this.d.audio.bite(r.hookPitch, r.order);
    this.d.haptic(r.order >= 4 ? [60, 40, 120] : 70);
    this.d.effects.splash(this.bobber.position.clone(), 0.6 + r.order * 0.08);
    this.d.camera.addShake(0.4 + r.order * 0.05);
    this.dip = 0.6;
    this.setState('bite');
  }

  private startReel(): void {
    const roll = this.roll!;
    const params = reelParamsFor(roll.fish, roll.weight, this.d.state.rod);
    this.reel = new ReelMinigame(params, Math.random);
    this.d.ui.showReel(roll.fish, params);
    this.d.ui.updateReel(this.reel);
    this.d.audio.reelStart();
    this.d.player.setPose('reel');
    if (params.overweight) this.d.ui.toast(`Bu balık oltan için çok ağır! (Maks ${this.d.state.rod.maxWeight} kg)`, 'bad', 4000);
    this.setState('reeling');
  }

  private finishReel(won: boolean): void {
    const reel = this.reel!;
    this.d.audio.reelStop();
    this.d.ui.hideReel();
    this.reel = null;
    if (!won) {
      this.d.audio.fail();
      this.d.haptic(180);
      this.d.ui.toast(`${this.roll?.fish.name ?? 'Balık'} kaçtı!`, 'bad');
      this.d.state.data.stats.escaped++;
      this.resetToIdle();
      return;
    }
    const roll = this.roll!;
    const fish = roll.fish;
    const s = this.d.state;
    const perfect = reel.perfect;
    const value = fishValue(fish, roll.weight, roll.variant);
    const xp = catchXp(fish, perfect);
    const bonus = perfect ? perfectBonusCash(value, s.rod.passive === 'usta') : 0;
    const caught: CaughtFish = {
      uid: makeUid(),
      fishId: fish.id,
      weight: roll.weight,
      variant: roll.variant,
      perfect,
      value,
      region: this.region,
      caughtAt: Date.now(),
    };
    const outcome = s.recordCatch(caught, xp, bonus);
    const r = RARITIES[fish.rarity];
    this.d.audio.success(r.order, perfect);
    this.d.haptic(r.celebrate ? [80, 50, 80, 50, 220] : [40, 40, 60]);
    const pp = this.d.player.position;
    this.d.effects.splash(this.bobber.position.clone(), 1.1);
    if (r.celebrate) this.d.effects.lightPillar(new Vector3(pp.x, 0, pp.z), r.color, 6 + r.order * 0.4);
    else if (roll.variant !== 'none') this.d.effects.confetti(pp.add(new Vector3(0, 2.5, 0)), [VARIANTS[roll.variant].color, '#ffffff']);
    if (perfect) this.d.effects.confetti(pp.add(new Vector3(0, 2.5, 0)));
    if (outcome.levelUps.length) this.d.effects.confetti(pp.add(new Vector3(0, 3, 0)), ['#7ad8ff', '#ffffff', '#ffd23f']);
    this.bobber.setEnabled(false);
    this.line.setEnabled(false);
    this.d.player.setPose('hold');

    // 3B gösterim: kameraya bağlı, dönen balık modeli
    const model = buildFishModel(this.d.scene, this.d.mats, fish, roll.variant, 1);
    model.root.parent = this.d.camera.camera;
    model.root.position.set(0, 0.25, 4.6);
    const glowing = ['fosfor', 'takimyildiz', 'tayf'].includes(roll.variant);
    if (glowing) this.d.glow?.addIncludedOnlyMesh(model.mesh);
    this.showcase = model;

    this.d.ui.showCatch({ fish, caught, outcome }, () => this.dismissResult());
    this.setState('result');
  }

  dismissResult(): void {
    if (this.state !== 'result' || this.stateTime < 0.4) return;
    this.d.ui.hideCatch();
    if (this.showcase) {
      this.d.glow?.removeIncludedOnlyMesh(this.showcase.mesh);
      this.showcase.dispose();
      this.showcase = null;
    }
    this.resetToIdle();
  }

  private resetToIdle(): void {
    this.d.ui.hidePower();
    this.d.ui.hideReel();
    this.d.ui.clearShakes();
    this.d.ui.setHint(null);
    this.d.audio.reelStop();
    this.bobber.setEnabled(false);
    this.line.setEnabled(false);
    this.d.player.aimYaw = null;
    this.d.player.setPose('none');
    this.reel = null;
    this.roll = null;
    this.setState('idle');
  }

  update(dt: number, holding: boolean): void {
    this.stateTime += dt;
    this.dip = Math.max(0, this.dip - dt * 1.5);
    switch (this.state) {
      case 'charging':
        this.meter.update(dt);
        this.d.ui.showPower(this.meter.power);
        break;
      case 'casting': {
        this.castT = Math.min(1, this.castT + dt / this.castDur);
        const t = this.castT;
        const pos = Vector3.Lerp(this.castFrom, this.castTo, t);
        pos.y += Math.sin(Math.PI * t) * (2.5 + this.castDist * 0.22);
        this.bobber.position.copyFrom(pos);
        if (t >= 1) this.land();
        break;
      }
      case 'waiting': {
        this.biteTimer -= dt;
        const rarity = RARITIES[this.roll!.fish.rarity];
        // Sars butonları
        this.shakeTimer -= dt;
        if (this.shakeTimer <= 0) {
          this.shakeTimer = 0.75 + Math.random() * 0.75;
          this.d.ui.spawnShake(this.shakeHit);
        }
        // Dokunuşlar: nadir balıklarda daha belirgin ses ve kabarcık
        this.nibbleTimer -= dt;
        const close = 1 - Math.max(0, this.biteTimer) / this.biteTotal;
        if (this.nibbleTimer <= 0) {
          const rareCue = rarity.order >= 4;
          const intensity = Math.min(1, (rareCue ? 0.55 : 0.15) + close * 0.4);
          this.nibbleTimer = (rareCue ? 0.9 : 1.6) * (1.2 - close * 0.6) + Math.random() * 0.4;
          this.d.audio.nibble(intensity);
          this.dip = Math.max(this.dip, rareCue ? 0.18 : 0.08);
          if (rareCue || Math.random() < 0.3) this.d.effects.bubbles(this.bobber.position, rareCue);
        }
        if (this.biteTimer <= 0) this.startBite();
        break;
      }
      case 'bite':
        if (this.stateTime > 0.55) this.startReel();
        break;
      case 'reeling': {
        const reel = this.reel!;
        const status = reel.update(dt, holding);
        this.d.ui.updateReel(reel);
        this.d.audio.reelUpdate(reel.progress, reel.fishInside, holding);
        if (status !== 'playing') this.finishReel(status === 'won');
        break;
      }
      case 'result':
        if (this.showcase) {
          this.showcase.root.rotation.y += dt * 0.9;
          this.showcase.root.rotation.x = Math.sin(this.stateTime * 1.3) * 0.12;
          this.showcase.update(dt);
          const intro = Math.min(1, this.stateTime / 0.35);
          this.showcase.root.scaling.setAll(intro * (1 + Math.sin(this.stateTime * 2) * 0.03));
        }
        if (this.stateTime > 12) this.dismissResult();
        break;
      default:
        break;
    }
    this.updateBobberAndLine(dt);
  }

  private updateBobberAndLine(dt: number): void {
    if (!this.bobber.isEnabled()) return;
    const t = performance.now() / 1000;
    if (this.state === 'waiting' || this.state === 'bite') {
      this.bobber.position.x = this.castTo.x;
      this.bobber.position.z = this.castTo.z;
      this.bobber.position.y = 0.06 + Math.sin(t * 2.2) * 0.05 - this.dip * 0.5;
    } else if (this.state === 'reeling' && this.reel) {
      // Balık çekildikçe şamandıra oyuncuya yaklaşır ve çırpınır
      const pp = this.d.player.position;
      const k = this.reel.progress * 0.75;
      const side = (this.reel.fishPos - 0.5) * 4;
      const p = this.d.player;
      const yaw = p.aimYaw ?? p.yaw;
      const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const target = Vector3.Lerp(this.castTo, new Vector3(pp.x, 0, pp.z), k).add(right.scale(side));
      this.bobber.position.x += (target.x - this.bobber.position.x) * Math.min(1, dt * 3);
      this.bobber.position.z += (target.z - this.bobber.position.z) * Math.min(1, dt * 3);
      this.bobber.position.y = -0.05 + Math.sin(t * 18) * 0.08;
      if (Math.random() < dt * 4) this.d.effects.bubbles(this.bobber.position, false);
    }
    // Olta ipi: uçtan şamandıraya sarkan eğri
    const a = this.d.player.tipPosition();
    const b = this.bobber.position;
    const tension = this.state === 'reeling' ? 0.15 : this.state === 'casting' ? 0.05 : 1;
    const dist = Vector3.Distance(a, b);
    for (let i = 0; i < LINE_POINTS; i++) {
      const u = i / (LINE_POINTS - 1);
      const p = this.linePts[i];
      p.x = a.x + (b.x - a.x) * u;
      p.y = a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * dist * 0.08 * tension;
      p.z = a.z + (b.z - a.z) * u;
    }
    this.line = CreateLines('line', { points: this.linePts, instance: this.line });
  }
}
