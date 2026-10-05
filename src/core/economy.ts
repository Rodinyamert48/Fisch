import { RARITIES } from './data/rarities';
import { VARIANTS } from './data/variants';
import type { FishDef, VariantId } from './types';

/** Balığın satış değeri (akçe). Ağırlık ve varyanta göre ölçeklenir. */
export function fishValue(fish: FishDef, weight: number, variant: VariantId): number {
  const weightFactor = 0.55 + 0.45 * (weight / fish.avgWeight);
  return Math.max(1, Math.round(fish.baseValue * weightFactor * VARIANTS[variant].valueMult));
}

/** Yakalamadan kazanılan XP. Kusursuz yakalama 1.5x. */
export function catchXp(fish: FishDef, perfect: boolean): number {
  const base = RARITIES[fish.rarity].xp;
  return Math.round(base * (perfect ? 1.5 : 1));
}

/** Kusursuz yakalama için anında verilen ekstra akçe (değerin %25'i, Martı Oltası pasifiyle %75). */
export function perfectBonusCash(value: number, championPassive: boolean): number {
  return Math.round(value * (championPassive ? 0.75 : 0.25));
}

/** Bir sonraki seviyeye geçmek için gereken XP. */
export function xpToNext(level: number): number {
  return Math.floor(40 * Math.pow(level, 1.15));
}

/** Toplam XP'den seviye ve seviye içi ilerleme. */
export function levelFromXp(totalXp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpToNext(level) && level < 999) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, into: remaining, needed: xpToNext(level) };
}

/** Seviye başına küçük kalıcı şans bonusu. */
export function levelLuckBonus(level: number): number {
  return Math.min(50, (level - 1) * 0.5);
}

export function formatCash(n: number): string {
  return `${Math.floor(n).toLocaleString('tr-TR')} akçe`;
}

export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} t`;
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  return `${kg.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg`;
}
