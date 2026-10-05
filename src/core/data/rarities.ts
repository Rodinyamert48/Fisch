import type { RarityDef, RarityId } from '../types';

export const RARITIES: Record<RarityId, RarityDef> = {
  trash: {
    id: 'trash', name: 'Çöp', color: '#8d8d8d', order: 0,
    baseWeight: 12, luckScale: -0.6, xp: 4,
    fishSpeed: 0.18, erratic: 0.1, fillRate: 0.42, lossRate: 0.1,
    biteTime: [2.5, 5], hookPitch: 330, celebrate: false,
  },
  common: {
    id: 'common', name: 'Yaygın', color: '#e8e8e8', order: 1,
    baseWeight: 50, luckScale: 0, xp: 12,
    fishSpeed: 0.26, erratic: 0.2, fillRate: 0.34, lossRate: 0.13,
    biteTime: [3, 6.5], hookPitch: 392, celebrate: false,
  },
  uncommon: {
    id: 'uncommon', name: 'Alışılmadık', color: '#6fdc6f', order: 2,
    baseWeight: 22, luckScale: 0.3, xp: 20,
    fishSpeed: 0.32, erratic: 0.28, fillRate: 0.31, lossRate: 0.15,
    biteTime: [4, 7.5], hookPitch: 440, celebrate: false,
  },
  unusual: {
    id: 'unusual', name: 'Sıradışı', color: '#3fd0c0', order: 3,
    baseWeight: 9, luckScale: 0.6, xp: 34,
    fishSpeed: 0.38, erratic: 0.36, fillRate: 0.29, lossRate: 0.17,
    biteTime: [5, 9], hookPitch: 494, celebrate: false,
  },
  rare: {
    id: 'rare', name: 'Nadir', color: '#4a8dff', order: 4,
    baseWeight: 4.5, luckScale: 1.0, xp: 60,
    fishSpeed: 0.45, erratic: 0.45, fillRate: 0.27, lossRate: 0.2,
    biteTime: [6, 10.5], hookPitch: 554, celebrate: true,
  },
  legendary: {
    id: 'legendary', name: 'Efsanevi', color: '#ffa53a', order: 5,
    baseWeight: 1.6, luckScale: 1.4, xp: 120,
    fishSpeed: 0.54, erratic: 0.55, fillRate: 0.25, lossRate: 0.23,
    biteTime: [8, 13], hookPitch: 622, celebrate: true,
  },
  mythical: {
    id: 'mythical', name: 'Mitolojik', color: '#ff4f8b', order: 6,
    baseWeight: 0.5, luckScale: 1.8, xp: 250,
    fishSpeed: 0.63, erratic: 0.64, fillRate: 0.23, lossRate: 0.26,
    biteTime: [10, 15], hookPitch: 698, celebrate: true,
  },
  exotic: {
    id: 'exotic', name: 'Egzotik', color: '#b57bff', order: 7,
    baseWeight: 0.12, luckScale: 2.2, xp: 500,
    fishSpeed: 0.72, erratic: 0.72, fillRate: 0.21, lossRate: 0.29,
    biteTime: [12, 17], hookPitch: 784, celebrate: true,
  },
  secret: {
    id: 'secret', name: 'Gizli', color: '#38f2ff', order: 8,
    baseWeight: 0.03, luckScale: 2.6, xp: 1200,
    fishSpeed: 0.8, erratic: 0.8, fillRate: 0.19, lossRate: 0.32,
    biteTime: [14, 19], hookPitch: 880, celebrate: true,
  },
  divine: {
    id: 'divine', name: 'İlahi Gizli', color: '#fff27a', order: 9,
    baseWeight: 0.006, luckScale: 3.0, xp: 3000,
    fishSpeed: 0.88, erratic: 0.88, fillRate: 0.17, lossRate: 0.35,
    biteTime: [16, 21], hookPitch: 988, celebrate: true,
  },
};

export const RARITY_ORDER: RarityId[] = (Object.keys(RARITIES) as RarityId[]).sort(
  (a, b) => RARITIES[a].order - RARITIES[b].order,
);

export function rarityAtLeast(r: RarityId, min: RarityId): boolean {
  return RARITIES[r].order >= RARITIES[min].order;
}
