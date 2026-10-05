import type { RodDef } from '../types';

/**
 * Olta yükseltme yolu:
 * Eğitim → Çelimsiz → Karbon → Sabit → Şampiyon / Trident → Fırtına → Cennet → Ethereal Prism
 * Kontrol: çekme çubuğu genişliğine eklenen pay (yol genişliğinin oranı).
 * Direnç: ilerleme kaybını yüzde olarak azaltır.
 */
export const RODS: RodDef[] = [
  {
    id: 'training', name: 'Eğitim Oltası', price: 0, tier: 0,
    lureSpeed: -10, luck: 0, control: 0, resilience: 0, maxWeight: 15,
    passive: 'none', soldAt: null, requiredLevel: 0, requiredBestiary: 0, color: '#c9a36a',
  },
  {
    id: 'flimsy', name: 'Çelimsiz Olta', price: 500, tier: 1,
    lureSpeed: 0, luck: 10, control: 0.03, resilience: 5, maxWeight: 40,
    passive: 'none', soldAt: 'moosewood', requiredLevel: 0, requiredBestiary: 0, color: '#d8b07a',
  },
  {
    id: 'carbon', name: 'Karbon Olta', price: 2000, tier: 2,
    lureSpeed: 10, luck: 25, control: 0.05, resilience: 10, maxWeight: 120,
    passive: 'none', soldAt: 'moosewood', requiredLevel: 2, requiredBestiary: 0, color: '#2a2a2e',
  },
  {
    id: 'steady', name: 'Sabit Olta', price: 7500, tier: 3,
    lureSpeed: 5, luck: 35, control: 0.04, resilience: 30, maxWeight: 2000,
    passive: 'steady', passiveText: 'Ağır balıklar oltayı daha az zorlar (ağırlık cezası yarıya iner).',
    soldAt: 'moosewood', requiredLevel: 4, requiredBestiary: 0, color: '#5a7a4a',
  },
  {
    id: 'champion', name: 'Şampiyon Oltası', price: 45000, tier: 4,
    lureSpeed: 25, luck: 60, control: 0.08, resilience: 15, maxWeight: 600,
    passive: 'champion', passiveText: 'Mükemmel yakalamalar +%50 ekstra C$ kazandırır.',
    soldAt: 'roslit', requiredLevel: 7, requiredBestiary: 0, color: '#e8b83a',
  },
  {
    id: 'trident', name: 'Trident Oltası', price: 150000, tier: 5,
    lureSpeed: 20, luck: 75, control: 0.07, resilience: 20, maxWeight: 1500,
    passive: 'sunken', passiveText: '%15 şansla Batık varyantlı balık yakalar.',
    soldAt: 'roslit', requiredLevel: 10, requiredBestiary: 0, color: '#3ac0b0',
  },
  {
    id: 'storm', name: 'Fırtına Oltası', price: 600000, tier: 6,
    lureSpeed: 30, luck: 100, control: 0.1, resilience: 25, maxWeight: 4000,
    passive: 'storm', passiveText: 'Yağmurda +%60 şans ve +%30 yem hızı.',
    soldAt: 'snowcap', requiredLevel: 15, requiredBestiary: 0, color: '#5a6aff',
  },
  {
    id: 'heaven', name: 'Cennet Oltası', price: 2500000, tier: 7,
    lureSpeed: 45, luck: 150, control: 0.13, resilience: 30, maxWeight: 12000,
    passive: 'heaven', passiveText: 'Gizli ve İlahi balıkların çıkma şansı 2 katına çıkar.',
    soldAt: 'snowcap', requiredLevel: 22, requiredBestiary: 0.3, color: '#fff2b0',
  },
  {
    id: 'ethereal', name: 'Ethereal Prism Oltası', price: 15000000, tier: 8,
    lureSpeed: 55, luck: 225, control: 0.16, resilience: 40, maxWeight: 60000,
    passive: 'prism', passiveText: '%50 şansla Prizmatik varyantlı balık yakalar.',
    soldAt: 'deep', requiredLevel: 30, requiredBestiary: 0.55, color: '#ff8cf0',
  },
];

export const RODS_BY_ID: Record<string, RodDef> = Object.fromEntries(RODS.map((r) => [r.id, r]));

export function getRod(id: string): RodDef {
  return RODS_BY_ID[id] ?? RODS[0];
}
