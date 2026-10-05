import type { QuestDef } from '../types';

export const QUESTS: QuestDef[] = [
  // Çamlıkoy
  {
    id: 'q_ilk_adim', npcId: 'kaptan_yusuf', title: 'İlk Adımlar',
    description: 'Herhangi bir yerde 5 balık yakala. Atış, sarsma ve çekme... hepsini öğren!',
    objective: { count: 5 },
    reward: { cash: 250, xp: 60, bait: { id: 'solucan', amount: 10 } },
  },
  {
    id: 'q_moose_usta', npcId: 'kaptan_yusuf', title: 'Çamlıkoy Ustası', requires: 'q_ilk_adim',
    description: 'Çamlıkoy sularında Özel veya daha nadir 3 balık yakala.',
    objective: { count: 3, region: 'camlikoy', minRarity: 'unusual' },
    reward: { cash: 1500, xp: 200, bait: { id: 'karides', amount: 10 } },
  },
  {
    id: 'q_levrek', npcId: 'deniz_kiz', title: 'Levrek Peşinde',
    description: 'Bana 2 Levrek getir. İskelenin ucunda bol olur!',
    objective: { count: 2, fishId: 'levrek' },
    reward: { cash: 800, xp: 120 },
  },
  // Kızılkaya
  {
    id: 'q_ates_sulari', npcId: 'volkan', title: 'Ateşli Sular',
    description: 'Kızılkaya Adası\'nda Nadir veya daha nadir 3 balık yakala.',
    objective: { count: 3, region: 'kizilkaya', minRarity: 'rare' },
    reward: { cash: 6000, xp: 500 },
  },
  {
    id: 'q_usta_isi', npcId: 'mercan_bekcisi', title: 'Usta İşi',
    description: '5 Kusursuz Yakalama yap: balık çubuktan hiç çıkmasın!',
    objective: { count: 5, perfect: true },
    reward: { cash: 4000, xp: 400, bait: { id: 'kalamar', amount: 10 } },
  },
  // Ayazburun
  {
    id: 'q_soguk_sular', npcId: 'yasli_oguz', title: 'Soğuk Sular',
    description: 'Ayazburun sularında 10 balık yakala.',
    objective: { count: 10, region: 'ayazburun' },
    reward: { cash: 9000, xp: 700 },
  },
  {
    id: 'q_aurora', npcId: 'kaan_kasif', title: 'Kutup Işığı Efsanesi',
    description: 'Kutup ışıkları altında Aurora Somonu yakala.',
    objective: { count: 1, fishId: 'aurora_somonu' },
    reward: { cash: 60000, xp: 2500, bait: { id: 'efsane', amount: 5 } },
  },
  // Derinlik Üssü
  {
    id: 'q_abis', npcId: 'dr_derin', title: 'Abis Araştırması',
    description: 'Batiskaf ile Abis Çukuru\'nda 2 Fener Balığı yakala.',
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
