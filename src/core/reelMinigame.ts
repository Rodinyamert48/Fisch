import { RARITIES } from './data/rarities';
import { clamp, lerp, type Rng } from './rng';
import type { FishDef, RodDef } from './types';

export interface ReelParams {
  /** Kontrol çubuğu genişliği (yolun oranı). */
  barWidth: number;
  fishSpeed: number;
  erratic: number;
  fillRate: number;
  lossRate: number;
  startProgress: number;
  /** Balık oltanın maks ağırlığını aşıyor mu? */
  overweight: boolean;
}

export const BAR_ACCEL = 3.1;
/** Başlangıçta oyuncuya hazırlanma süresi: çubuk ve balık hareket etmez, ceza yok. */
export const REEL_START_DELAY = 0.6;
export const BAR_GRAVITY = 2.6;
export const BAR_MAX_SPEED = 1.5;

export function reelParamsFor(fish: FishDef, weight: number, rod: RodDef): ReelParams {
  const r = RARITIES[fish.rarity];
  const ratio = weight / rod.maxWeight;
  const overweight = ratio > 1;
  const penaltyExp = rod.passive === 'agir' ? 0.5 : 1;
  const weightPenalty = overweight ? Math.pow(ratio, penaltyExp) * 1.4 : 1;
  const strength = clamp(weight / fish.avgWeight, 0.5, 2.5);
  return {
    barWidth: clamp(0.25 + rod.control, 0.12, 0.6),
    fishSpeed: r.fishSpeed * (0.88 + 0.12 * strength),
    erratic: r.erratic,
    fillRate: Math.max(0.025, r.fillRate / weightPenalty),
    lossRate: r.lossRate * (1 - clamp(rod.resilience, 0, 90) / 100),
    startProgress: 0.3,
    overweight,
  };
}

export type ReelStatus = 'playing' | 'won' | 'lost';

/**
 * Çekme mini oyunu (saf mantık, görselden bağımsız):
 * - Basılı tutunca kontrol çubuğu sağa ivmelenir, bırakınca sola kayar.
 * - Balık simgesi mavi yol üzerinde rastgele hareket eder.
 * - Çubuk balığı kapsarsa ilerleme dolar, kapsamazsa geriler.
 * - Balık hiç çubuktan çıkmazsa "Kusursuz Yakalama".
 */
export class ReelMinigame {
  barPos: number;
  barVel = 0;
  fishPos = 0.5;
  private fishTarget = 0.5;
  private fishTimer = 0.8;
  private dashTime = 0;
  progress: number;
  perfect = true;
  elapsed = 0;
  status: ReelStatus = 'playing';
  /** Balığın çubuk dışında geçirdiği toplam süre. */
  timeOutside = 0;

  constructor(
    readonly params: ReelParams,
    private readonly rng: Rng,
  ) {
    this.barPos = clamp(0.5 - params.barWidth / 2, 0, 1 - params.barWidth);
    this.progress = params.startProgress;
  }

  get fishInside(): boolean {
    return this.fishPos >= this.barPos && this.fishPos <= this.barPos + this.params.barWidth;
  }

  update(dt: number, holding: boolean): ReelStatus {
    if (this.status !== 'playing') return this.status;
    // Büyük dt'leri parçala (sekme/arka plan durumları için)
    let remaining = Math.min(dt, 0.25);
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 60);
      this.step(step, holding);
      remaining -= step;
      if (this.status !== 'playing') break;
    }
    return this.status;
  }

  /** Hazırlık süresi bitti mi? */
  get started(): boolean {
    return this.elapsed >= REEL_START_DELAY;
  }

  private step(dt: number, holding: boolean): void {
    const p = this.params;
    this.elapsed += dt;
    if (this.elapsed < REEL_START_DELAY) return;

    // Kontrol çubuğu fiziği
    this.barVel += (holding ? BAR_ACCEL : -BAR_GRAVITY) * dt;
    this.barVel = clamp(this.barVel, -BAR_MAX_SPEED, BAR_MAX_SPEED);
    this.barPos += this.barVel * dt;
    const maxPos = 1 - p.barWidth;
    if (this.barPos < 0) {
      this.barPos = 0;
      this.barVel = Math.abs(this.barVel) * 0.25;
    } else if (this.barPos > maxPos) {
      this.barPos = maxPos;
      this.barVel = -Math.abs(this.barVel) * 0.25;
    }

    // Balık hareketi
    this.fishTimer -= dt;
    if (this.fishTimer <= 0) {
      const jump = (0.12 + p.erratic * 0.55) * (this.rng() * 2 - 1);
      this.fishTarget = clamp(this.fishPos + jump, 0.04, 0.96);
      if (p.erratic > 0.45 && this.rng() < p.erratic * 0.25) {
        // Ani kaçış
        this.fishTarget = this.fishPos > 0.5 ? 0.05 + this.rng() * 0.25 : 0.7 + this.rng() * 0.25;
        this.dashTime = 0.45;
      }
      this.fishTimer = lerp(1.7, 0.4, p.erratic) * (0.6 + this.rng() * 0.8);
    }
    const dashBoost = this.dashTime > 0 ? 1.8 : 1;
    this.dashTime = Math.max(0, this.dashTime - dt);
    const delta = this.fishTarget - this.fishPos;
    const maxStep = p.fishSpeed * dashBoost * dt;
    this.fishPos += clamp(delta, -maxStep, maxStep);
    this.fishPos += Math.sin(this.elapsed * (5 + p.erratic * 9)) * 0.012 * p.erratic * dt * 10;
    this.fishPos = clamp(this.fishPos, 0.01, 0.99);

    // İlerleme
    if (this.fishInside) {
      this.progress += p.fillRate * dt;
    } else {
      this.progress -= p.lossRate * dt;
      this.timeOutside += dt;
      this.perfect = false;
    }
    if (this.progress >= 1) {
      this.progress = 1;
      this.status = 'won';
    } else if (this.progress <= 0) {
      this.progress = 0;
      this.status = 'lost';
    }
  }
}
