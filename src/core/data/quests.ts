import type { QuestDef } from '../types';

export const QUESTS: QuestDef[] = [
  // Moosewood
  {
    id: 'q_ilk_adim', npcId: 'kaptan', title: 'İlk Adımlar',
    description: 'Herhangi bir yerde 5 balık yakala. Atış, sarsma ve çekme... hepsini öğren!',
    objective: { count: 5 },
    reward: { cash: 250, xp: 60, bait: { id: 'solucan', amount: 10 } },
  },
  {
    id: 'q_moose_usta', npcId: 'kaptan', title: 'Moosewood Ustası', requires: 'q_ilk_adim',
    description: 'Moosewood sularında Sıradışı veya daha nadir 3 balık yakala.',
    objective: { count: 3, region: 'moosewood', minRarity: 'unusual' },
    reward: { cash: 1500, xp: 200, bait: { id: 'karides', amount: 10 } },
  },
  {
    id: 'q_levrek', npcId: 'elif', title: 'Levrek Peşinde',
    description: 'Bana 2 Levrek getir. İskelenin ucunda bol olur!',
    objective: { count: 2, fishId: 'levrek' },
    reward: { cash: 800, xp: 120 },
  },
  // Roslit
  {
    id: 'q_ates_sulari', npcId: 'deniz', title: 'Ateşli Sular',
    description: 'Roslit Koyu\'nda Nadir veya daha nadir 3 balık yakala.',
    objective: { count: 3, region: 'roslit', minRarity: 'rare' },
    reward: { cash: 6000, xp: 500 },
  },
  {
    id: 'q_usta_isi', npcId: 'nil', title: 'Usta İşi',
    description: '5 Mükemmel Yakalama yap: balık çubuktan hiç çıkmasın!',
    objective: { count: 5, perfect: true },
    reward: { cash: 4000, xp: 400, bait: { id: 'kalamar', amount: 10 } },
  },
  // Snowcap
  {
    id: 'q_soguk_sular', npcId: 'oguz', title: 'Soğuk Sular',
    description: 'Snowcap sularında 10 balık yakala.',
    objective: { count: 10, region: 'snowcap' },
    reward: { cash: 9000, xp: 700 },
  },
  {
    id: 'q_aurora', npcId: 'kaan', title: 'Kutup Işığı Efsanesi',
    description: 'Kutup ışıkları altında Aurora Somonu yakala.',
    objective: { count: 1, fishId: 'aurora_somonu' },
    reward: { cash: 60000, xp: 2500, bait: { id: 'efsane', amount: 5 } },
  },
  // Derin Deniz İstasyonu
  {
    id: 'q_abis', npcId: 'dr_derin', title: 'Abis Araştırması',
    description: 'Batiskaf ile Derinlikler\'de 2 Fener Balığı yakala.',
    objective: { count: 2, fishId: 'fener' },
    reward: { cash: 20000, xp: 1500 },
  },
  {
    id: 'q_varyant', npcId: 'vera', title: 'Varyant Koleksiyonu',
    description: 'Herhangi bir varyanta sahip 3 balık yakala.',
    objective: { count: 3, variantRequired: true },
    reward: { cash: 35000, xp: 2000, bait: { id: 'isiltili', amount: 10 } },
  },
];

export const QUESTS_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
