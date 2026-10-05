import type { RegionId } from '../types';

export type IslandStyle = 'temperate' | 'volcanic' | 'snow' | 'station';
export type NpcRole = 'merchant' | 'rods' | 'bait' | 'boats' | 'quest' | 'lore';

export interface BuildingDef {
  kind: 'shop' | 'house' | 'lighthouse' | 'container' | 'tower';
  label?: string;
  /** Kasaba yerel çerçevesi: x = sağ, f = ileri (iskeleye doğru). */
  x: number;
  f: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
}

export interface NpcDef {
  id: string;
  name: string;
  role: NpcRole;
  x: number;
  f: number;
  shirt: string;
  pants: string;
  skin: string;
  hat?: string;
  lines: string[];
}

export interface IslandDef {
  id: Exclude<RegionId, 'ocean'>;
  name: string;
  subtitle: string;
  cx: number;
  cz: number;
  radius: number;
  peak: number;
  seed: number;
  style: IslandStyle;
  fishRadius: number;
  /** İskele yönü (radyan, +z'den saat yönünde). */
  dockAngle: number;
  townDist: number;
  townRadius: number;
  townHeight: number;
  palette: { sand: string; grass: string; grass2: string; rock: string; snow: string; seabed: string };
  fogTint: string;
  buildings: BuildingDef[];
  npcs: NpcDef[];
}

export const SEA_FLOOR = -22;
export const WORLD_LIMIT = 900;

/** Derinlikler çukuru (Batiskaf ile balık tutulabilen bölge). */
export const TRENCH = { cx: 60, cz: 660, radius: 160 };

const towardOrigin = (x: number, z: number) => Math.atan2(-x, -z);

export const ISLANDS: IslandDef[] = [
  {
    id: 'moosewood',
    name: 'Moosewood',
    subtitle: 'Başlangıç adası · Sakin sular',
    cx: 0, cz: 0, radius: 78, peak: 24, seed: 11, style: 'temperate',
    fishRadius: 200, dockAngle: 0, townDist: 0.42, townRadius: 30, townHeight: 2.2,
    palette: { sand: '#e8d49a', grass: '#5fa646', grass2: '#7dbb52', rock: '#7d7468', snow: '#ffffff', seabed: '#b8a878' },
    fogTint: '#bcd9f0',
    buildings: [
      { kind: 'shop', label: 'Olta Dükkanı', x: -17, f: -9, w: 9, d: 7, h: 5, color: '#b5653a', roof: '#6a2a1a' },
      { kind: 'shop', label: 'Balık Pazarı', x: 0, f: -13, w: 11, d: 8, h: 6, color: '#e2cc94', roof: '#3a5a8a' },
      { kind: 'shop', label: 'Yem Dükkanı', x: 16, f: -9, w: 8, d: 6, h: 4.5, color: '#8ab06a', roof: '#5a3a2a' },
      { kind: 'shop', label: 'Tersane', x: 21, f: 7, w: 8, d: 8, h: 5, color: '#7a8a9a', roof: '#2a3a4a' },
      { kind: 'house', x: -27, f: 5, w: 7, d: 6, h: 4, color: '#d8b48a', roof: '#8a3a2a' },
      { kind: 'house', x: -26, f: -24, w: 7, d: 7, h: 4.5, color: '#c8d8e0', roof: '#4a6a3a' },
      { kind: 'house', x: 27, f: -23, w: 6, d: 6, h: 4, color: '#e8c8a8', roof: '#6a4a8a' },
      { kind: 'lighthouse', x: -34, f: 22, w: 4, d: 4, h: 16, color: '#f4f4f4', roof: '#d83a3a' },
    ],
    npcs: [
      { id: 'marc', name: 'Tüccar Marc', role: 'merchant', x: 0, f: -7.5, shirt: '#3a5a8a', pants: '#2a2a3a', skin: '#e8b88a', hat: '#2a2a2a',
        lines: ['Taze balık mı getirdin? Hepsini en iyi fiyattan alırım!', 'Nadir balıklar servet eder, dostum.'] },
      { id: 'ayse', name: 'Olta Ustası Ayşe', role: 'rods', x: -17, f: -4, shirt: '#b5653a', pants: '#3a2a1a', skin: '#c8906a',
        lines: ['İyi bir olta, iyi bir avın yarısıdır.', 'Sabit Olta ağır balıklar için birebir!'] },
      { id: 'cem', name: 'Yemci Cem', role: 'bait', x: 16, f: -4.5, shirt: '#6a9a4a', pants: '#3a3a2a', skin: '#f0c8a0',
        lines: ['Solucan, karides, kalamar... Ne istersen var!', 'Doğru yem, doğru balık.'] },
      { id: 'riza', name: 'Tersaneci Rıza', role: 'boats', x: 21, f: 12.5, shirt: '#2a3a4a', pants: '#1a1a2a', skin: '#d8a070', hat: '#e8e8e8',
        lines: ['Adalar arasında yüzerek mi gideceksin? Bir tekne al!', 'Teknen hazır olduğunda T tuşuyla çağırabilirsin.'] },
      { id: 'kaptan', name: 'Kaptan Ahmet', role: 'quest', x: -7, f: 5, shirt: '#1a2a5a', pants: '#1a1a1a', skin: '#e0b090', hat: '#1a2a5a',
        lines: ['Hoş geldin evlat! Moosewood\'da her balıkçı benden ders alır.'] },
      { id: 'elif', name: 'Balıkçı Elif', role: 'quest', x: 7, f: 16, shirt: '#e86a3a', pants: '#2a4a6a', skin: '#f0d0b0', hat: '#f0d84a',
        lines: ['İskelenin ucu en iyi yerdir. Bana sorarsan tabii.'] },
    ],
  },
  {
    id: 'roslit',
    name: 'Roslit Koyu',
    subtitle: 'Volkanik koy · Mercan resifleri',
    cx: 420, cz: 330, radius: 88, peak: 40, seed: 23, style: 'volcanic',
    fishRadius: 210, dockAngle: towardOrigin(420, 330), townDist: 0.5, townRadius: 28, townHeight: 2.4,
    palette: { sand: '#f0c8b0', grass: '#4fae6a', grass2: '#e86a9a', rock: '#4a3a3a', snow: '#ff7a3a', seabed: '#e8a8a0' },
    fogTint: '#f0c8c8',
    buildings: [
      { kind: 'shop', label: 'Olta Dükkanı', x: -15, f: -8, w: 9, d: 7, h: 5, color: '#e8a0b0', roof: '#8a2a4a' },
      { kind: 'shop', label: 'Balık Pazarı', x: 2, f: -12, w: 10, d: 8, h: 5.5, color: '#f0e0c0', roof: '#2a8a8a' },
      { kind: 'shop', label: 'Yem & Tersane', x: 18, f: -6, w: 9, d: 7, h: 5, color: '#a0d8c8', roof: '#3a4a8a' },
      { kind: 'house', x: -25, f: 6, w: 6, d: 6, h: 4, color: '#ffd8a8', roof: '#c83a3a' },
      { kind: 'house', x: 25, f: 8, w: 6, d: 5, h: 4, color: '#f8e8d8', roof: '#e86a3a' },
    ],
    npcs: [
      { id: 'lina', name: 'Tüccar Lina', role: 'merchant', x: 2, f: -7, shirt: '#2a8a8a', pants: '#f0e0c0', skin: '#a8704a', hat: '#f0d080',
        lines: ['Roslit balıkları renkli ve değerlidir!'] },
      { id: 'kerem', name: 'Usta Kerem', role: 'rods', x: -15, f: -3.5, shirt: '#8a2a4a', pants: '#2a1a1a', skin: '#c88a5a',
        lines: ['Şampiyon ve Trident oltaları yalnızca bende.', 'Trident ile batık hazinelerin ruhunu yakalarsın.'] },
      { id: 'pinar', name: 'Denizci Pınar', role: 'boats', x: 22, f: -2, shirt: '#3a4a8a', pants: '#1a1a2a', skin: '#e8c0a0', hat: '#ffffff',
        lines: ['Derinliklere inmek mi istiyorsun? Batiskaf şart.'] },
      { id: 'yemci_roslit', name: 'Yemci Tuna', role: 'bait', x: 14, f: -2, shirt: '#a0d8c8', pants: '#3a3a2a', skin: '#b8805a',
        lines: ['Mercan yemleri burada!'] },
      { id: 'deniz', name: 'Volkanolog Deniz', role: 'quest', x: -6, f: 6, shirt: '#ff8a3a', pants: '#3a3a3a', skin: '#e8b890', hat: '#ffcc33',
        lines: ['Volkan suları ısıtıyor; nadir balıklar yüzeye çıkıyor!'] },
      { id: 'nil', name: 'Mercan Bekçisi Nil', role: 'quest', x: 8, f: 10, shirt: '#e86a9a', pants: '#2a4a5a', skin: '#8a5a3a',
        lines: ['Resifler sabır ister. Gerçek ustalık mükemmel yakalamadadır.'] },
    ],
  },
  {
    id: 'snowcap',
    name: 'Snowcap Adası',
    subtitle: 'Buzul ortamı · Kutup ışıkları',
    cx: -430, cz: 360, radius: 92, peak: 58, seed: 37, style: 'snow',
    fishRadius: 215, dockAngle: towardOrigin(-430, 360), townDist: 0.5, townRadius: 28, townHeight: 2.6,
    palette: { sand: '#d8dce0', grass: '#e8f0f8', grass2: '#c8d8e8', rock: '#6a7480', snow: '#ffffff', seabed: '#8a9aa8' },
    fogTint: '#dce8f4',
    buildings: [
      { kind: 'shop', label: 'Olta Dükkanı', x: -14, f: -8, w: 8, d: 7, h: 5, color: '#8a5a3a', roof: '#f4f8ff' },
      { kind: 'shop', label: 'Balık Pazarı', x: 3, f: -12, w: 10, d: 8, h: 5.5, color: '#a87a4a', roof: '#f4f8ff' },
      { kind: 'house', x: 18, f: -7, w: 7, d: 6, h: 4, color: '#6a4a3a', roof: '#f4f8ff' },
      { kind: 'house', x: -24, f: 5, w: 6, d: 6, h: 4, color: '#7a5a3a', roof: '#f4f8ff' },
      { kind: 'tower', x: 22, f: 8, w: 3, d: 3, h: 9, color: '#5a4a3a', roof: '#f4f8ff' },
    ],
    npcs: [
      { id: 'bjorn', name: 'Tüccar Björn', role: 'merchant', x: 3, f: -7, shirt: '#8a2a2a', pants: '#2a2a2a', skin: '#f0d0c0', hat: '#c83a3a',
        lines: ['Soğuk sulardan gelen balık en tazesidir!'] },
      { id: 'sigrid', name: 'Olta Ustası Sigrid', role: 'rods', x: -14, f: -3.5, shirt: '#3a5a8a', pants: '#2a2a3a', skin: '#f8e0d0', hat: '#ffffff',
        lines: ['Fırtına Oltası yağmurda canlanır.', 'Cennet Oltası\'nı yalnızca gerçek koleksiyonculara satarım.'] },
      { id: 'kaan', name: 'Buz Kâşifi Kaan', role: 'quest', x: -5, f: 6, shirt: '#e8e8f0', pants: '#3a3a5a', skin: '#e0b898', hat: '#5a8ae8',
        lines: ['Kutup ışıklarını hiç gördün mü? Gece gökyüzü yeşile boyanır...'] },
      { id: 'oguz', name: 'Yaşlı Balıkçı Oğuz', role: 'quest', x: 9, f: 9, shirt: '#5a4a3a', pants: '#2a2a2a', skin: '#d8b090', hat: '#3a3a3a',
        lines: ['Buz tutmuş ellerimle elli yıl balık tuttum.'] },
    ],
  },
  {
    id: 'deep',
    name: 'Derin Deniz İstasyonu',
    subtitle: 'Derinlikler · Batiskaf gerekli',
    cx: TRENCH.cx, cz: TRENCH.cz, radius: 0, peak: 0, seed: 51, style: 'station',
    fishRadius: 0, dockAngle: towardOrigin(TRENCH.cx, TRENCH.cz), townDist: 0, townRadius: 20, townHeight: 2.6,
    palette: { sand: '#3a4a5a', grass: '#5a6a7a', grass2: '#4a5a6a', rock: '#2a3a4a', snow: '#ffffff', seabed: '#0a1420' },
    fogTint: '#2a3a5a',
    buildings: [
      { kind: 'container', label: 'Araştırma Lab.', x: -8, f: -6, w: 9, d: 6, h: 4.5, color: '#e8b83a', roof: '#3a3a3a' },
      { kind: 'container', label: 'Abis Pazarı', x: 7, f: -6, w: 8, d: 6, h: 4.5, color: '#3a8ae8', roof: '#2a2a2a' },
      { kind: 'tower', x: 13, f: 9, w: 2, d: 2, h: 12, color: '#c8c8c8', roof: '#ff3a3a' },
    ],
    npcs: [
      { id: 'vera', name: 'Koleksiyoncu Vera', role: 'quest', x: -2, f: 4, shirt: '#8a3ae8', pants: '#1a1a2a', skin: '#e8c8a8', hat: '#2a2a2a',
        lines: ['Varyantlar... ne güzel bir tutku.'] },
      { id: 'dr_derin', name: 'Dr. Derin', role: 'quest', x: -8, f: -1.5, shirt: '#f4f4f4', pants: '#2a3a5a', skin: '#d0a080',
        lines: ['Derinliklerin biyolüminesans canlıları üzerine çalışıyorum.'] },
      { id: 'abis_tuccar', name: 'Abis Tüccarı', role: 'merchant', x: 7, f: -1.5, shirt: '#1a3a6a', pants: '#1a1a1a', skin: '#b8885a', hat: '#ffcc33',
        lines: ['Karanlık sulardan gelen her şeyi alırım.'] },
      { id: 'prizma', name: 'Prizma Ustası', role: 'rods', x: 3, f: 6, shirt: '#ff8cf0', pants: '#3a2a5a', skin: '#f0d8c8', hat: '#8ae8ff',
        lines: ['Ethereal Prism... ışığı yedi renge bölen olta.', 'Yalnızca ansiklopedisini doldurmuş olanlara.'] },
      { id: 'dalgic', name: 'Gizemli Dalgıç', role: 'lore', x: 11, f: 2, shirt: '#1a1a1a', pants: '#1a1a1a', skin: '#8a6a5a', hat: '#ffd23a',
        lines: [
          'Bu çukurun ötesinde... Mariana\'nın Perdesi var.',
          'Oraya inebilmek için daha güçlü bir denizaltı gerekecek. Belki bir gün.',
          'Abisal Ejder\'i gördüğünü söyleyenler hep yalnız döner.',
        ] },
    ],
  },
];

export const ISLANDS_BY_ID: Record<string, IslandDef> = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

export const REGION_NAMES: Record<RegionId, string> = {
  moosewood: 'Moosewood',
  roslit: 'Roslit Koyu',
  snowcap: 'Snowcap Adası',
  ocean: 'Açık Deniz',
  deep: 'Derinlikler',
};

export const REGION_ORDER: RegionId[] = ['moosewood', 'roslit', 'snowcap', 'ocean', 'deep'];
