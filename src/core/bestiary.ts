import { FISH } from './data/fish';
import { rarityAtLeast } from './data/rarities';
import type { FishDef, RegionId, VariantId } from './types';

export interface BestiaryEntry {
  count: number;
  maxWeight: number;
  variants: VariantId[];
  firstCaughtAt: number;
}

export type Bestiary = Record<string, BestiaryEntry>;

/** Bölgenin ansiklopedi listesi (çöp hariç). */
export function regionFish(region: RegionId): FishDef[] {
  return FISH.filter((f) => f.regions !== 'all' && f.regions.includes(region));
}

export function trashFish(): FishDef[] {
  return FISH.filter((f) => f.regions === 'all');
}

function isSecretTier(f: FishDef): boolean {
  return rarityAtLeast(f.rarity, 'secret');
}

export interface RegionProgress {
  caught: number;
  total: number;
  /** Ödül için gereken (gizli olmayan) türler. */
  required: number;
  requiredCaught: number;
  complete: boolean;
}

export function regionProgress(bestiary: Bestiary, region: RegionId): RegionProgress {
  const list = regionFish(region);
  const required = list.filter((f) => !isSecretTier(f));
  const caught = list.filter((f) => bestiary[f.id]?.count > 0).length;
  const requiredCaught = required.filter((f) => bestiary[f.id]?.count > 0).length;
  return { caught, total: list.length, required: required.length, requiredCaught, complete: requiredCaught >= required.length };
}

/** Toplam ansiklopedi tamamlanma oranı (0-1). */
export function bestiaryCompletion(bestiary: Bestiary): number {
  const caught = FISH.filter((f) => bestiary[f.id]?.count > 0).length;
  return caught / FISH.length;
}

export const REGION_REWARDS: Record<RegionId, { cash: number; luck: number }> = {
  moosewood: { cash: 5000, luck: 5 },
  roslit: { cash: 25000, luck: 5 },
  snowcap: { cash: 40000, luck: 5 },
  ocean: { cash: 50000, luck: 5 },
  deep: { cash: 150000, luck: 10 },
};
