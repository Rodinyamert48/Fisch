import type { RodDef } from '../types';

/**
 * Olta yükseltme yolu:
 * Acemi → Kamış → Bambu → Çapa → Martı / Enkaz → Poyraz → Yıldız Tozu → Tayf
 * Kontrol: çekme çubuğu genişliğine eklenen pay (yolun oranı).
 * Direnç: ilerleme kaybını yüzde olarak azaltır.
 */
export const RODS: RodDef[] = [
  {
    id: 'acemi', name: 'Acemi Oltası', price: 0, tier: 0,
    lureSpeed: -10, luck: 0, control: 0, resilience: 0, maxWeight: 15,
    passive: 'none', soldAt: null, requiredLevel: 0, requiredBestiary: 0, color: '#c9a36a',
  },
  {
    id: 'kamis', name: 'Kamış Olta', price: 500, tier: 1,
    lureSpeed: 0, luck: 10, control: 0.03, resilience: 5, maxWeight: 40,
    passive: 'none', soldAt: 'camlikoy', requiredLevel: 0, requiredBestiary: 0, color: '#d8b07a',
  },
  {
    id: 'bambu', name: 'Bambu Olta', price: 2000, tier: 2,
    lureSpeed: 10, luck: 25, control: 0.05, resilience: 10, maxWeight: 120,
    passive: 'none', soldAt: 'camlikoy', requiredLevel: 2, requiredBestiary: 0, color: '#9ab84a',
  },
  {
    id: 'capa', name: 'Çapa Oltası', price: 7500, tier: 3,
    lureSpeed: 5, luck: 35, control: 0.04, resilience: 30, maxWeight: 2000,
    passive: 'agir', passiveText: 'Ağır balıklar oltayı daha az zorlar (ağırlık cezası yarıya iner).',
    soldAt: 'camlikoy', requiredLevel: 4, requiredBestiary: 0, color: '#5a6a7a',
  },
  {
    id: 'marti', name: 'Martı Oltası', price: 45000, tier: 4,
    lureSpeed: 25, luck: 60, control: 0.08, resilience: 15, maxWeight: 600,
    passive: 'usta', passiveText: 'Kusursuz yakalamalar +%50 ekstra akçe kazandırır.',
    soldAt: 'kizilkaya', requiredLevel: 7, requiredBestiary: 0, color: '#f0f0f0',
  },
  {
    id: 'enkaz', name: 'Enkaz Oltası', price: 150000, tier: 5,
    lureSpeed: 20, luck: 75, control: 0.07, resilience: 20, maxWeight: 1500,
    passive: 'kabuk', passiveText: '%15 şansla Kabuklu varyantlı balık yakalar.',
    soldAt: 'kizilkaya', requiredLevel: 10, requiredBestiary: 0, color: '#3ac0b0',
  },
  {
    id: 'poyraz', name: 'Poyraz Oltası', price: 600000, tier: 6,
    lureSpeed: 30, luck: 100, control: 0.1, resilience: 25, maxWeight: 4000,
    passive: 'poyraz', passiveText: 'Yağmurda +%60 şans ve +%30 yem hızı.',
    soldAt: 'ayazburun', requiredLevel: 15, requiredBestiary: 0, color: '#5a8aff',
  },
  {
    id: 'yildiz', name: 'Yıldız Tozu Oltası', price: 2500000, tier: 7,
    lureSpeed: 45, luck: 150, control: 0.13, resilience: 30, maxWeight: 12000,
    passive: 'yildiz', passiveText: 'Sır ve Kozmik balıkların çıkma şansı 2 katına çıkar.',
    soldAt: 'ayazburun', requiredLevel: 22, requiredBestiary: 0.3, color: '#fff2b0',
  },
  {
    id: 'tayf', name: 'Tayf Oltası', price: 15000000, tier: 8,
    lureSpeed: 55, luck: 225, control: 0.16, resilience: 40, maxWeight: 60000,
    passive: 'tayf', passiveText: '%50 şansla Tayf varyantlı balık yakalar.',
    soldAt: 'abis', requiredLevel: 30, requiredBestiary: 0.55, color: '#ff8cf0',
  },
];

export const RODS_BY_ID: Record<string, RodDef> = Object.fromEntries(RODS.map((r) => [r.id, r]));

/** Eski kayıtlardaki olta kimliklerinin karşılıkları. */
export const LEGACY_ROD_IDS: Record<string, string> = {
  training: 'acemi',
  flimsy: 'kamis',
  carbon: 'bambu',
  steady: 'capa',
  champion: 'marti',
  trident: 'enkaz',
  storm: 'poyraz',
  heaven: 'yildiz',
  ethereal: 'tayf',
};

export function getRod(id: string): RodDef {
  return RODS_BY_ID[id] ?? RODS_BY_ID[LEGACY_ROD_IDS[id]] ?? RODS[0];
}
