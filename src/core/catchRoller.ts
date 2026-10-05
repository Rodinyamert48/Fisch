import { FISH } from './data/fish';
import { RARITIES, RARITY_ORDER } from './data/rarities';
import { NATURAL_VARIANT_ORDER, NUCLEAR_EVENT_CHANCE, PRISM_ROD_CHANCE, SUNKEN_ROD_CHANCE, VARIANTS } from './data/variants';
import { clamp, gaussian, pick, pickWeighted, type Rng } from './rng';
import type { BaitDef, FishDef, RarityId, RegionId, RodDef, SeasonId, TimeOfDay, VariantId, WeatherId } from './types';

export interface Conditions {
  time: TimeOfDay;
  weather: WeatherId;
  season: SeasonId;
  nukeEvent: boolean;
}

export interface CatchContext extends Conditions {
  region: RegionId;
  rod: RodDef;
  bait: BaitDef | null;
  /** Olta + yem dışındaki ek şans (seviye, bölge ödülleri, tekne, mükemmel atış). */
  bonusLuck: number;
}

export interface CatchRoll {
  fish: FishDef;
  weight: number;
  variant: VariantId;
  luck: number;
}

export function fishMatchesConditions(fish: FishDef, c: Conditions): boolean {
  if (fish.time && fish.time !== c.time) return false;
  if (fish.weather && !fish.weather.includes(c.weather)) return false;
  if (fish.seasons && !fish.seasons.includes(c.season)) return false;
  return true;
}

export function fishInRegion(fish: FishDef, region: RegionId): boolean {
  return fish.regions === 'all' || fish.regions.includes(region);
}

/** Bölge ve koşullara göre yakalanabilir balık havuzu. */
export function fishPool(region: RegionId, c: Conditions): FishDef[] {
  return FISH.filter((f) => fishInRegion(f, region) && fishMatchesConditions(f, c));
}

/** Toplam şans yüzdesi (olta + yem + bonuslar + hava/olta pasifleri). */
export function totalLuck(ctx: CatchContext): number {
  let luck = ctx.rod.luck + (ctx.bait?.luck ?? 0) + ctx.bonusLuck;
  if (ctx.weather === 'fog') luck += 15;
  if (ctx.weather === 'aurora') luck += 40;
  if (ctx.rod.passive === 'poyraz' && ctx.weather === 'rain') luck += 60;
  return Math.max(0, luck);
}

/** Bir nadirliğin şansa göre ağırlığı. */
export function rarityWeight(rarity: RarityId, luck: number, rod?: RodDef): number {
  const def = RARITIES[rarity];
  let factor = 1 + (luck / 100) * def.luckScale;
  factor = Math.max(0.08, factor);
  let w = def.baseWeight * factor;
  if (rod?.passive === 'yildiz' && (rarity === 'secret' || rarity === 'divine')) w *= 2;
  return w;
}

/** Havuzdaki her nadirliğin olasılığı (UI ve testler için). */
export function rarityDistribution(pool: FishDef[], luck: number, rod?: RodDef): Partial<Record<RarityId, number>> {
  const present = RARITY_ORDER.filter((r) => pool.some((f) => f.rarity === r));
  const weights = present.map((r) => rarityWeight(r, luck, rod));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Partial<Record<RarityId, number>> = {};
  present.forEach((r, i) => (out[r] = weights[i] / total));
  return out;
}

export function rollWeight(fish: FishDef, rng: Rng): number {
  const g = clamp(gaussian(rng), -2.5, 3);
  let w = fish.avgWeight * Math.exp(g * 0.32);
  // Nadir "dev" örnekler
  if (rng() < 0.01) w *= 1.8;
  w = clamp(w, fish.minWeight, fish.maxWeight);
  return Math.round(w * 100) / 100;
}

export function rollVariant(ctx: CatchContext, rng: Rng): VariantId {
  if (ctx.rod.passive === 'tayf' && rng() < PRISM_ROD_CHANCE) return 'tayf';
  if (ctx.rod.passive === 'kabuk' && rng() < SUNKEN_ROD_CHANCE) return 'kabuklu';
  if (ctx.nukeEvent && rng() < NUCLEAR_EVENT_CHANCE) return 'fosfor';
  const boost = ctx.bait?.variantBoost ?? 1;
  for (const id of NATURAL_VARIANT_ORDER) {
    if (id === 'ruhani' && ctx.time !== 'night') continue;
    if (rng() < VARIANTS[id].chance * boost) return id;
  }
  return 'none';
}

/** Atış suya düştüğünde hangi balığın oltaya geleceğini belirler. */
export function rollCatch(ctx: CatchContext, rng: Rng): CatchRoll {
  let pool = fishPool(ctx.region, ctx);
  if (pool.length === 0) pool = FISH.filter((f) => f.regions === 'all');
  const luck = totalLuck(ctx);
  const present = RARITY_ORDER.filter((r) => pool.some((f) => f.rarity === r));
  const rarity = pickWeighted(rng, present, (r) => rarityWeight(r, luck, ctx.rod));
  const candidates = pool.filter((f) => f.rarity === rarity);
  const fish = pick(rng, candidates);
  return { fish, weight: rollWeight(fish, rng), variant: rollVariant(ctx, rng), luck };
}

/** Yem hızı (%) — olta, yem, hava ve mükemmel atış bonusu. */
export function totalLureSpeed(rod: RodDef, bait: BaitDef | null, weather: WeatherId, perfectCast: boolean): number {
  let lure = rod.lureSpeed + (bait?.lureSpeed ?? 0);
  if (weather === 'rain') lure += 20;
  if (rod.passive === 'poyraz' && weather === 'rain') lure += 30;
  if (perfectCast) lure += 20;
  return lure;
}

/** Balığın oltaya gelme süresi (saniye). */
export function biteDelay(rarity: RarityId, lureSpeed: number, rng: Rng): number {
  const [min, max] = RARITIES[rarity].biteTime;
  const base = min + (max - min) * rng();
  const mult = lureSpeed >= 0 ? 1 / (1 + lureSpeed / 100) : 1 + -lureSpeed / 100;
  return Math.max(1.2, base * mult);
}
