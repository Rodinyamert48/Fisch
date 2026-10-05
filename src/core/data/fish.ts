import type { FishDef } from '../types';

/**
 * Balık türleri. Ağırlıklar kg cinsinden, baseValue C$ cinsinden ortalama ağırlıktaki değerdir.
 * Bölge: 'all' = her yerde (çöp eşyalar).
 */
export const FISH: FishDef[] = [
  // ───────────── Çöp (her bölge) ─────────────
  {
    id: 'eski_bot', name: 'Eski Bot', rarity: 'trash', regions: 'all',
    avgWeight: 1, minWeight: 0.4, maxWeight: 2.2, baseValue: 3, shape: 'boot',
    colors: { body: '#5b3a24', fin: '#3a2414' }, description: 'Birinin kayıp botu. Teki hâlâ kayıp.',
  },
  {
    id: 'yosun', name: 'Deniz Yosunu', rarity: 'trash', regions: 'all',
    avgWeight: 0.3, minWeight: 0.1, maxWeight: 0.8, baseValue: 2, shape: 'weed',
    colors: { body: '#2f7d3a', fin: '#1f5a28' }, description: 'Kaygan ve yeşil. Çorbası yapılır mı?',
  },
  {
    id: 'teneke', name: 'Teneke Kutu', rarity: 'trash', regions: 'all',
    avgWeight: 0.2, minWeight: 0.1, maxWeight: 0.4, baseValue: 4, shape: 'can',
    colors: { body: '#b8c2cc', fin: '#d4473f' }, description: 'Paslı bir gazoz kutusu. Lütfen geri dönüştür.',
  },
  {
    id: 'sise', name: 'Mesajlı Şişe', rarity: 'trash', regions: 'all',
    avgWeight: 0.5, minWeight: 0.3, maxWeight: 0.8, baseValue: 8, shape: 'bottle',
    colors: { body: '#5fbf8f', fin: '#e8dcb8' }, description: 'İçinde soluk bir harita var... "Derinliklerde ejder uyur."',
  },

  // ───────────── Moosewood ─────────────
  {
    id: 'sazan', name: 'Sazan', rarity: 'common', regions: ['moosewood'],
    avgWeight: 4, minWeight: 1, maxWeight: 12, baseValue: 15, shape: 'standard',
    colors: { body: '#8a8a3e', fin: '#6b5a2a', belly: '#d8c98a' }, description: 'Moosewood göllerinin sabırlı sakini.',
  },
  {
    id: 'japon', name: 'Japon Balığı', rarity: 'common', regions: ['moosewood'],
    avgWeight: 0.3, minWeight: 0.1, maxWeight: 1, baseValue: 12, shape: 'round',
    colors: { body: '#ff8a1f', fin: '#ffb35c', belly: '#ffd08a' }, description: 'Kavanozdan kaçmış olmalı.',
  },
  {
    id: 'cipura', name: 'Çipura', rarity: 'common', regions: ['moosewood'],
    avgWeight: 1.2, minWeight: 0.4, maxWeight: 3, baseValue: 18, shape: 'round',
    colors: { body: '#b9c3cc', fin: '#7d8a96', belly: '#eef2f5', accent: '#e8c34a' }, description: 'Alnında altın bir şerit taşır.',
  },
  {
    id: 'levrek', name: 'Levrek', rarity: 'uncommon', regions: ['moosewood'],
    avgWeight: 3, minWeight: 1, maxWeight: 8, baseValue: 45, shape: 'standard',
    colors: { body: '#4c7a3c', fin: '#2f4f25', belly: '#d9e3b0', accent: '#1f3318' }, description: 'İri ağızlı ve iştahlı bir avcı.',
  },
  {
    id: 'alabalik', name: 'Alabalık', rarity: 'uncommon', regions: ['moosewood'],
    avgWeight: 2, minWeight: 0.5, maxWeight: 6, baseValue: 50, shape: 'standard',
    colors: { body: '#9aa86f', fin: '#7c6a4a', belly: '#f2c4b8', accent: '#d9574a' }, description: 'Benekli pulları güneşte parlar.',
  },
  {
    id: 'gece_yayini', name: 'Gece Yayını', rarity: 'unusual', regions: ['moosewood'], time: 'night',
    avgWeight: 6, minWeight: 2, maxWeight: 20, baseValue: 140, shape: 'long',
    colors: { body: '#3b3f46', fin: '#24272c', belly: '#8a8f96' }, description: 'Yalnızca gece çamurdan çıkar. Bıyıkları ile avlanır.',
  },
  {
    id: 'turna', name: 'Turna Balığı', rarity: 'unusual', regions: ['moosewood'],
    avgWeight: 5, minWeight: 2, maxWeight: 15, baseValue: 110, shape: 'long',
    colors: { body: '#6f8f3a', fin: '#c4a33a', belly: '#e9e2a8', accent: '#3c5222' }, description: 'Sazlıkların sinsi pusucusu.',
  },
  {
    id: 'kirmizi_somon', name: 'Kırmızı Somon', rarity: 'rare', regions: ['moosewood'], seasons: ['autumn'],
    avgWeight: 4, minWeight: 2, maxWeight: 9, baseValue: 300, shape: 'standard',
    colors: { body: '#d63a2f', fin: '#3b6b3a', belly: '#ff9a7a' }, description: 'Sonbaharda akıntıya karşı yüzer. Mevsimlik!',
  },
  {
    id: 'sari_ton', name: 'Sarı Yüzgeçli Ton', rarity: 'rare', regions: ['moosewood', 'ocean'],
    avgWeight: 45, minWeight: 15, maxWeight: 120, baseValue: 260, shape: 'standard',
    colors: { body: '#2f4e8c', fin: '#ffd21f', belly: '#dfe6ee' }, description: 'Güçlü ve ağır. Çelimsiz oltalar zorlanır.',
  },
  {
    id: 'kor_mercan', name: 'Kor Mercan', rarity: 'legendary', regions: ['moosewood'],
    avgWeight: 7, minWeight: 3, maxWeight: 15, baseValue: 1200, shape: 'standard',
    colors: { body: '#ff5a2a', fin: '#ffb03a', belly: '#ffd2a0', glow: '#ff7a2a' }, description: 'Pulları közden yapılmış gibi ışıldar.',
  },
  {
    id: 'biyikli_gaga', name: 'Bıyıklı Gaga', rarity: 'mythical', regions: ['moosewood'], time: 'night',
    avgWeight: 30, minWeight: 12, maxWeight: 70, baseValue: 4500, shape: 'sword',
    colors: { body: '#6a3fa8', fin: '#c08aff', belly: '#d8c8f0', glow: '#a070ff' }, description: 'Gece yarısı gagasıyla suyu yarar.',
  },
  {
    id: 'altin_sazan', name: 'Altın Sazan', rarity: 'exotic', regions: ['moosewood'], weather: ['rain'],
    avgWeight: 10, minWeight: 4, maxWeight: 25, baseValue: 18000, shape: 'standard',
    colors: { body: '#ffcc33', fin: '#ffe680', belly: '#fff2c0', glow: '#ffd84a' }, description: 'Yağmurlu günlerde yüzeye çıkan efsanevi sazan.',
  },
  {
    id: 'kadim_kaplumbaga', name: 'Kadim Kaplumbağa', rarity: 'secret', regions: ['moosewood'], time: 'night', weather: ['fog'],
    avgWeight: 80, minWeight: 40, maxWeight: 200, baseValue: 90000, shape: 'turtle',
    colors: { body: '#4f6b3a', fin: '#8aa36a', belly: '#c9b98a', glow: '#9cffb0' }, description: 'Sisli gecelerde adayı korur. Moosewood ondan daha yaşlı değil.',
  },

  // ───────────── Roslit Koyu ─────────────
  {
    id: 'palyaco', name: 'Palyaço Balığı', rarity: 'common', regions: ['roslit'],
    avgWeight: 0.25, minWeight: 0.1, maxWeight: 0.6, baseValue: 20, shape: 'round',
    colors: { body: '#ff7a1a', fin: '#1a1a1a', belly: '#ffffff', accent: '#ffffff' }, description: 'Mercanların arasında saklambaç oynar.',
  },
  {
    id: 'kelebek', name: 'Kelebek Balığı', rarity: 'common', regions: ['roslit'],
    avgWeight: 0.4, minWeight: 0.15, maxWeight: 0.9, baseValue: 22, shape: 'round',
    colors: { body: '#ffd83a', fin: '#2a2a2a', belly: '#fff3b0', accent: '#2a2a2a' }, description: 'Resif kadar renkli.',
  },
  {
    id: 'balon', name: 'Balon Balığı', rarity: 'uncommon', regions: ['roslit'],
    avgWeight: 1.5, minWeight: 0.5, maxWeight: 4, baseValue: 60, shape: 'puffer',
    colors: { body: '#d9c27a', fin: '#a08a4a', belly: '#f5ecd0', accent: '#5a4a2a' }, description: 'Korkunca şişer. Dikenlerine dikkat!',
  },
  {
    id: 'magma_levregi', name: 'Magma Levreği', rarity: 'unusual', regions: ['roslit'],
    avgWeight: 6, minWeight: 2, maxWeight: 14, baseValue: 150, shape: 'standard',
    colors: { body: '#5a1f1a', fin: '#ff6a1a', belly: '#c45a3a', glow: '#ff5a1a' }, description: 'Volkanik ılıcalarda yaşar, dokunması sıcaktır.',
  },
  {
    id: 'denizati', name: 'Denizatı', rarity: 'unusual', regions: ['roslit'],
    avgWeight: 0.1, minWeight: 0.03, maxWeight: 0.3, baseValue: 160, shape: 'seahorse',
    colors: { body: '#ff9ab8', fin: '#ffd0e0', belly: '#ffe0ea' }, description: 'Kuyruğuyla mercanlara tutunur.',
  },
  {
    id: 'gece_kalamari', name: 'Gece Kalamarı', rarity: 'rare', regions: ['roslit'], time: 'night',
    avgWeight: 3, minWeight: 1, maxWeight: 8, baseValue: 380, shape: 'squid',
    colors: { body: '#8a3fd1', fin: '#c890ff', belly: '#e0c8ff', glow: '#b070ff' }, description: 'Karanlıkta mor ışıklar saçar.',
  },
  {
    id: 'kilic', name: 'Kılıç Balığı', rarity: 'rare', regions: ['roslit', 'ocean'],
    avgWeight: 60, minWeight: 25, maxWeight: 150, baseValue: 420, shape: 'sword',
    colors: { body: '#3a5a8a', fin: '#5a7aaa', belly: '#d8e2ee' }, description: 'Okyanusun eskrimcisi.',
  },
  {
    id: 'lav_yilan', name: 'Lav Yılanbalığı', rarity: 'legendary', regions: ['roslit'],
    avgWeight: 12, minWeight: 5, maxWeight: 30, baseValue: 2200, shape: 'eel',
    colors: { body: '#1f1a1a', fin: '#ff7a1a', belly: '#ff4a1a', glow: '#ff6a00' }, description: 'Lav çatlaklarının arasından süzülür.',
  },
  {
    id: 'alev_koi', name: 'Alev Koi', rarity: 'mythical', regions: ['roslit'], seasons: ['summer'], weather: ['clear'],
    avgWeight: 8, minWeight: 3, maxWeight: 18, baseValue: 7000, shape: 'standard',
    colors: { body: '#ff3a1a', fin: '#ffffff', belly: '#ffffff', accent: '#ffffff', glow: '#ff6a3a' }, description: 'Yazın açık havada ateş gibi yanar. Mevsimlik!',
  },
  {
    id: 'anka', name: 'Anka Balığı', rarity: 'exotic', regions: ['roslit'], time: 'day',
    avgWeight: 20, minWeight: 8, maxWeight: 45, baseValue: 32000, shape: 'sword',
    colors: { body: '#ff9a1a', fin: '#ff3a3a', belly: '#ffe08a', glow: '#ffb01a' }, description: 'Küllerinden yeniden doğduğu söylenir.',
  },
  {
    id: 'ejder_koi', name: 'Ejder Koi', rarity: 'secret', regions: ['roslit'], time: 'night', weather: ['rain'],
    avgWeight: 25, minWeight: 10, maxWeight: 60, baseValue: 120000, shape: 'eel',
    colors: { body: '#c01a2a', fin: '#ffd23a', belly: '#ffe0a0', glow: '#ff3a4a' }, description: 'Yağmurlu gecelerde krater gölünden iner.',
  },

  // ───────────── Snowcap Adası ─────────────
  {
    id: 'morina', name: 'Kuzey Morinası', rarity: 'common', regions: ['snowcap'],
    avgWeight: 5, minWeight: 1.5, maxWeight: 14, baseValue: 25, shape: 'standard',
    colors: { body: '#8a7a5a', fin: '#5a4f3a', belly: '#e6dcc4' }, description: 'Soğuk suların dayanıklı balığı.',
  },
  {
    id: 'buz_baligi', name: 'Buz Balığı', rarity: 'common', regions: ['snowcap'],
    avgWeight: 0.8, minWeight: 0.3, maxWeight: 2, baseValue: 28, shape: 'long',
    colors: { body: '#cfe8f5', fin: '#a8d0e8', belly: '#f0f8ff' }, description: 'Kanı neredeyse şeffaftır.',
  },
  {
    id: 'ringa', name: 'Ringa', rarity: 'common', regions: ['snowcap', 'ocean'],
    avgWeight: 0.4, minWeight: 0.15, maxWeight: 1, baseValue: 22, shape: 'standard',
    colors: { body: '#6a8aaa', fin: '#4a6a8a', belly: '#e8f0f8' }, description: 'Büyük sürüler halinde dolaşır.',
  },
  {
    id: 'kar_alabaligi', name: 'Kar Alabalığı', rarity: 'uncommon', regions: ['snowcap'],
    avgWeight: 3, minWeight: 1, maxWeight: 8, baseValue: 75, shape: 'standard',
    colors: { body: '#5a6a7a', fin: '#ff8a6a', belly: '#ffc0a8', accent: '#ffffff' }, description: 'Karlı pullarla örtülü.',
  },
  {
    id: 'buz_yengeci', name: 'Buz Yengeci', rarity: 'uncommon', regions: ['snowcap'],
    avgWeight: 2, minWeight: 0.6, maxWeight: 5, baseValue: 80, shape: 'crab',
    colors: { body: '#6aa8d8', fin: '#ffffff', belly: '#d8ecf8' }, description: 'Kıskaçları buz kadar soğuk.',
  },
  {
    id: 'kalkan', name: 'Pullu Kalkan', rarity: 'unusual', regions: ['snowcap'],
    avgWeight: 12, minWeight: 4, maxWeight: 40, baseValue: 180, shape: 'flat',
    colors: { body: '#7a6a4a', fin: '#5a4a2a', belly: '#f0ece0' }, description: 'Dipte kumun altına gizlenir.',
  },
  {
    id: 'mersin', name: 'Kutup Mersini', rarity: 'rare', regions: ['snowcap'],
    avgWeight: 50, minWeight: 20, maxWeight: 140, baseValue: 520, shape: 'long',
    colors: { body: '#5a5f66', fin: '#3a3f46', belly: '#c8ccd0', accent: '#8a8f96' }, description: 'Dinozorlar çağından kalma zırhlı bir dev.',
  },
  {
    id: 'buzul_turnasi', name: 'Buzul Turnası', rarity: 'legendary', regions: ['snowcap'], seasons: ['winter'],
    avgWeight: 15, minWeight: 6, maxWeight: 35, baseValue: 2600, shape: 'long',
    colors: { body: '#7ad0ff', fin: '#d8f4ff', belly: '#ffffff', glow: '#8ae0ff' }, description: 'Yalnızca kışın, buz kırıldığında görünür. Mevsimlik!',
  },
  {
    id: 'aurora_somonu', name: 'Aurora Somonu', rarity: 'mythical', regions: ['snowcap'], weather: ['aurora'],
    avgWeight: 9, minWeight: 4, maxWeight: 20, baseValue: 9500, shape: 'standard',
    colors: { body: '#3aff9a', fin: '#a05aff', belly: '#c8ffe8', glow: '#5affc0' }, description: 'Kutup ışıkları gökyüzünü boyadığında ortaya çıkar.',
  },
  {
    id: 'kristal_yilan', name: 'Kristal Yılanbalığı', rarity: 'exotic', regions: ['snowcap'], weather: ['fog'],
    avgWeight: 6, minWeight: 2, maxWeight: 14, baseValue: 38000, shape: 'eel',
    colors: { body: '#e8faff', fin: '#9ae8ff', belly: '#ffffff', glow: '#b0f0ff' }, description: 'Sisin içinde buz kristali gibi kırılır.',
  },
  {
    id: 'kutup_kralicesi', name: 'Kutup Kraliçesi', rarity: 'secret', regions: ['snowcap'], weather: ['aurora'], seasons: ['winter'],
    avgWeight: 300, minWeight: 150, maxWeight: 700, baseValue: 160000, shape: 'shark',
    colors: { body: '#d8f0ff', fin: '#7ab8e8', belly: '#ffffff', glow: '#a0e8ff' }, description: 'Kış gecelerinde kutup ışıklarının altında hüküm sürer.',
  },

  // ───────────── Açık Deniz ─────────────
  {
    id: 'uskumru', name: 'Uskumru', rarity: 'common', regions: ['ocean'],
    avgWeight: 0.8, minWeight: 0.3, maxWeight: 2, baseValue: 22, shape: 'standard',
    colors: { body: '#2a8a7a', fin: '#1a4a5a', belly: '#e8f0f0', accent: '#103a3a' }, description: 'Hızlı ve çizgili.',
  },
  {
    id: 'sardalya', name: 'Sardalya', rarity: 'common', regions: ['ocean'],
    avgWeight: 0.15, minWeight: 0.05, maxWeight: 0.35, baseValue: 14, shape: 'long',
    colors: { body: '#8aa0b8', fin: '#5a7088', belly: '#f0f4f8' }, description: 'Küçük ama lezzetli.',
  },
  {
    id: 'lampuka', name: 'Lampuka', rarity: 'uncommon', regions: ['ocean'], seasons: ['summer', 'autumn'],
    avgWeight: 12, minWeight: 4, maxWeight: 30, baseValue: 85, shape: 'standard',
    colors: { body: '#3ac04a', fin: '#2a7aff', belly: '#ffe03a' }, description: 'Yaz ve sonbaharda açık denizde dolaşır.',
  },
  {
    id: 'barakuda', name: 'Barakuda', rarity: 'unusual', regions: ['ocean'],
    avgWeight: 15, minWeight: 5, maxWeight: 40, baseValue: 170, shape: 'long',
    colors: { body: '#a8b4c0', fin: '#5a6470', belly: '#f0f2f4', accent: '#3a4450' }, description: 'Jilet gibi dişleri var.',
  },
  {
    id: 'mavi_marlin', name: 'Mavi Marlin', rarity: 'rare', regions: ['ocean'],
    avgWeight: 180, minWeight: 60, maxWeight: 600, baseValue: 600, shape: 'sword',
    colors: { body: '#1a3a8a', fin: '#2a5aca', belly: '#d8e4f8' }, description: 'Okyanusun en hızlı yüzücülerinden.',
  },
  {
    id: 'ay_baligi', name: 'Ay Balığı', rarity: 'legendary', regions: ['ocean'],
    avgWeight: 900, minWeight: 300, maxWeight: 2300, baseValue: 3000, shape: 'round',
    colors: { body: '#9aa4ae', fin: '#7a848e', belly: '#d8dde2' }, description: 'Devasa ve sakin. Güçlü bir olta gerekir.',
  },
  {
    id: 'cekic', name: 'Çekiç Başlı', rarity: 'mythical', regions: ['ocean'], weather: ['rain'],
    avgWeight: 250, minWeight: 100, maxWeight: 600, baseValue: 9000, shape: 'shark',
    colors: { body: '#6a7884', fin: '#4a5864', belly: '#e0e4e8' }, description: 'Fırtınalarda avlanmaya çıkar.',
  },
  {
    id: 'buyuk_beyaz', name: 'Büyük Beyaz', rarity: 'exotic', regions: ['ocean'],
    avgWeight: 1100, minWeight: 500, maxWeight: 2500, baseValue: 45000, shape: 'shark',
    colors: { body: '#5a6a78', fin: '#3a4a58', belly: '#ffffff' }, description: 'Denizlerin tartışmasız hükümdarı.',
  },
  {
    id: 'hayalet_denizanasi', name: 'Hayalet Denizanası', rarity: 'secret', regions: ['ocean'], time: 'night', weather: ['fog'],
    avgWeight: 40, minWeight: 15, maxWeight: 90, baseValue: 150000, shape: 'jelly',
    colors: { body: '#c8f0ff', fin: '#8ad8ff', belly: '#ffffff', glow: '#a0f0ff' }, description: 'Sisli gecelerde açık denizde süzülen bir hayalet.',
  },

  // ───────────── Derinlikler (Batiskaf gerekli) ─────────────
  {
    id: 'fener', name: 'Fener Balığı', rarity: 'uncommon', regions: ['deep'],
    avgWeight: 4, minWeight: 1, maxWeight: 10, baseValue: 140, shape: 'angler',
    colors: { body: '#2a2a3a', fin: '#1a1a2a', belly: '#4a4a5a', glow: '#c8ff6a' }, description: 'Başındaki ışıkla avını kandırır.',
  },
  {
    id: 'engerek', name: 'Engerek Balığı', rarity: 'unusual', regions: ['deep'],
    avgWeight: 1, minWeight: 0.3, maxWeight: 2.5, baseValue: 260, shape: 'long',
    colors: { body: '#1a2a3a', fin: '#2a4a6a', belly: '#3a5a7a', glow: '#4ac0ff' }, description: 'Ağzına sığmayan iğne gibi dişler.',
  },
  {
    id: 'golge', name: 'Gölge Balığı', rarity: 'rare', regions: ['deep'],
    avgWeight: 5, minWeight: 2, maxWeight: 12, baseValue: 700, shape: 'round',
    colors: { body: '#1a1a22', fin: '#0a0a12', belly: '#2a2a36', glow: '#ff3a5a' }, description: 'Kırmızı gözleri dışında görünmez.',
  },
  {
    id: 'derin_denizanasi', name: 'Derin Denizanası', rarity: 'rare', regions: ['deep'],
    avgWeight: 2, minWeight: 0.5, maxWeight: 6, baseValue: 650, shape: 'jelly',
    colors: { body: '#3a6aff', fin: '#8aaaff', belly: '#c8d8ff', glow: '#5a8aff' }, description: 'Biyolüminesans bir fener gibi parlar.',
  },
  {
    id: 'dev_kalamar', name: 'Dev Kalamar', rarity: 'legendary', regions: ['deep'],
    avgWeight: 300, minWeight: 120, maxWeight: 700, baseValue: 5000, shape: 'squid',
    colors: { body: '#c83a2a', fin: '#ff6a4a', belly: '#ffb0a0' }, description: 'Denizcilerin kâbusu.',
  },
  {
    id: 'hayalet_kopekbaligi', name: 'Hayalet Köpekbalığı', rarity: 'mythical', regions: ['deep'],
    avgWeight: 400, minWeight: 180, maxWeight: 900, baseValue: 15000, shape: 'shark',
    colors: { body: '#c8d0e0', fin: '#9aa8c0', belly: '#ffffff', glow: '#d8e8ff' }, description: 'Uçurumun yarı saydam bekçisi.',
  },
  {
    id: 'leviathan', name: 'Leviathan Yavrusu', rarity: 'exotic', regions: ['deep'],
    avgWeight: 600, minWeight: 250, maxWeight: 1500, baseValue: 60000, shape: 'eel',
    colors: { body: '#1a4a4a', fin: '#3aaa9a', belly: '#8ad8c8', glow: '#3affd0' }, description: 'Yavrusu bile bir tekneyi devirebilir.',
  },
  {
    id: 'abisal_ejder', name: 'Abisal Ejder', rarity: 'divine', regions: ['deep'],
    avgWeight: 1500, minWeight: 700, maxWeight: 4000, baseValue: 750000, shape: 'eel',
    colors: { body: '#14101a', fin: '#ffd23a', belly: '#3a2a1a', glow: '#ffcc33' }, description: 'Şişedeki mesaj doğruymuş. Derinlikler onun krallığı.',
  },
];

export const FISH_BY_ID: Record<string, FishDef> = Object.fromEntries(FISH.map((f) => [f.id, f]));

export function getFish(id: string): FishDef {
  const f = FISH_BY_ID[id];
  if (!f) throw new Error(`Bilinmeyen balık: ${id}`);
  return f;
}
