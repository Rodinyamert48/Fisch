import type { BaitDef } from '../types';

export const BAITS: BaitDef[] = [
  {
    id: 'solucan', name: 'Solucan', packPrice: 60, packSize: 10,
    lureSpeed: 15, luck: 0, variantBoost: 1, color: '#d97a8a',
    description: 'Klasik. Balıklar daha çabuk gelir.',
  },
  {
    id: 'karides', name: 'Karides', packPrice: 150, packSize: 10,
    lureSpeed: 0, luck: 25, variantBoost: 1, color: '#ff9a6a',
    description: 'Nadir balıkları cezbeder.',
  },
  {
    id: 'balik_kafasi', name: 'Balık Kafası', packPrice: 500, packSize: 10,
    lureSpeed: -10, luck: 45, variantBoost: 1, color: '#9aa8b0',
    description: 'Büyük avcılar bayılır. Biraz yavaş.',
  },
  {
    id: 'kalamar', name: 'Kalamar', packPrice: 1500, packSize: 10,
    lureSpeed: 10, luck: 60, variantBoost: 1, color: '#e8d0ff',
    description: 'Hem hızlı hem şanslı.',
  },
  {
    id: 'isiltili', name: 'Işıltılı Yem', packPrice: 4000, packSize: 10,
    lureSpeed: 0, luck: 20, variantBoost: 2, color: '#fff27a',
    description: 'Varyant çıkma şansını 2 katına çıkarır.',
  },
  {
    id: 'efsane', name: 'Efsane Solucanı', packPrice: 15000, packSize: 10,
    lureSpeed: -30, luck: 150, variantBoost: 1.25, color: '#b57bff',
    description: 'Efsanevi balıkların favorisi. Çok yavaş ama çok şanslı.',
  },
];

export const BAITS_BY_ID: Record<string, BaitDef> = Object.fromEntries(BAITS.map((b) => [b.id, b]));
