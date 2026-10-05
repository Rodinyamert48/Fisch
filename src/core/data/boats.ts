import type { BoatDef } from '../types';

export const BOATS: BoatDef[] = [
  {
    id: 'kano', name: 'Kano', price: 300, maxSpeed: 12, accel: 6, turnRate: 1.6, luckBonus: 0,
    allowsDeep: false, requiredLevel: 0, color: '#b5713a',
    description: 'Basit ama güvenilir. Adalar arası ilk yolculuğun için.',
  },
  {
    id: 'surat', name: 'Sürat Teknesi', price: 20000, maxSpeed: 28, accel: 12, turnRate: 1.3, luckBonus: 0,
    allowsDeep: false, requiredLevel: 4, color: '#e83a3a',
    description: 'Okyanusu rüzgâr gibi geç.',
  },
  {
    id: 'trol', name: 'Balıkçı Teknesi', price: 90000, maxSpeed: 18, accel: 7, turnRate: 1.1, luckBonus: 15,
    allowsDeep: false, requiredLevel: 8, color: '#3a7ae8',
    description: 'Üzerinden balık tutarken +%15 şans.',
  },
  {
    id: 'batiskaf', name: 'Batiskaf', price: 350000, maxSpeed: 14, accel: 6, turnRate: 1.2, luckBonus: 10,
    allowsDeep: true, requiredLevel: 14, color: '#ffc83a',
    description: 'Derinliklere dalabilen denizaltı. Derinlikler balıkları için gerekli.',
  },
];

export const BOATS_BY_ID: Record<string, BoatDef> = Object.fromEntries(BOATS.map((b) => [b.id, b]));
