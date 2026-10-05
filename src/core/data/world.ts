import type { RegionId } from '../types';

export type IslandStyle = 'temperate' | 'volcanic' | 'snow' | 'station';
export type NpcRole = 'merchant' | 'rods' | 'bait' | 'boats' | 'quest' | 'lore';
export type HatStyle = 'none' | 'cap' | 'bucket' | 'beanie' | 'captain' | 'straw';

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

export interface NpcLook {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  hat?: string;
  hatStyle?: HatStyle;
  beard?: boolean;
}

export interface NpcDef extends NpcLook {
  id: string;
  name: string;
  role: NpcRole;
  x: number;
  f: number;
  lines: string[];
}

export interface IslandDef {
  id: Exclude<RegionId, 'acikdeniz'>;
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

export const GAME_TITLE = 'Olta Efsanesi';
export const SEA_FLOOR = -22;
export const WORLD_LIMIT = 900;

/** Abis Çukuru (Batiskaf ile balık tutulabilen bölge). */
export const TRENCH = { cx: 60, cz: 660, radius: 160 };

const towardOrigin = (x: number, z: number) => Math.atan2(-x, -z);

export const ISLANDS: IslandDef[] = [
  {
    id: 'camlikoy',
    name: 'Çamlıkoy',
    subtitle: 'Başlangıç adası · Sakin sular',
    cx: 0, cz: 0, radius: 78, peak: 24, seed: 11, style: 'temperate',
    fishRadius: 200, dockAngle: 0, townDist: 0.42, townRadius: 30, townHeight: 2.2,
    palette: { sand: '#e2d3a6', grass: '#5d8f3e', grass2: '#8aa552', rock: '#857c70', snow: '#ffffff', seabed: '#a89c74' },
    fogTint: '#bcd9f0',
    buildings: [
      { kind: 'shop', label: 'Olta Atölyesi', x: -17, f: -9, w: 9, d: 7, h: 5, color: '#e9dcc4', roof: '#8a3a2a' },
      { kind: 'shop', label: 'Balık Hali', x: 0, f: -13, w: 11, d: 8, h: 6, color: '#efe6d2', roof: '#3a5a7a' },
      { kind: 'shop', label: 'Yem Dükkânı', x: 16, f: -9, w: 8, d: 6, h: 4.5, color: '#dfe8d0', roof: '#5a3a2a' },
      { kind: 'shop', label: 'Kayıkhane', x: 21, f: 7, w: 8, d: 8, h: 5, color: '#c9d2da', roof: '#2a3a4a' },
      { kind: 'house', x: -27, f: 5, w: 7, d: 6, h: 4, color: '#f1e3cc', roof: '#8a3a2a' },
      { kind: 'house', x: -26, f: -24, w: 7, d: 7, h: 4.5, color: '#dfe7ec', roof: '#4a5a3a' },
      { kind: 'house', x: 27, f: -23, w: 6, d: 6, h: 4, color: '#f2e2cf', roof: '#6a4a5a' },
      { kind: 'lighthouse', x: -34, f: 22, w: 4, d: 4, h: 16, color: '#f4f4f4', roof: '#c83a3a' },
    ],
    npcs: [
      { id: 'nazim', name: 'Balıkçı Nazım', role: 'merchant', x: 0, f: -7.5, shirt: '#3a5a8a', pants: '#2a2a3a', skin: '#e8b88a', hair: '#5a4632', hat: '#2a2a2a', hatStyle: 'captain', beard: true,
        lines: ['Taze balık mı getirdin? Hepsini en iyi fiyattan alırım!', 'Nadir balıklar servet eder, evlat.'] },
      { id: 'sevgul', name: 'Usta Sevgül', role: 'rods', x: -17, f: -4, shirt: '#b5653a', pants: '#3a2a1a', skin: '#c8906a', hair: '#2a1a12',
        lines: ['İyi bir olta, iyi bir avın yarısıdır.', 'Çapa Oltası ağır balıklar için birebir!'] },
      { id: 'cemal', name: 'Yemci Cemal', role: 'bait', x: 16, f: -4.5, shirt: '#6a9a4a', pants: '#3a3a2a', skin: '#f0c8a0', hair: '#8a6a3a', hatStyle: 'straw', hat: '#d8b870',
        lines: ['Solucan, karides, kalamar... Ne istersen var!', 'Doğru yem, doğru balık.'] },
      { id: 'rifat', name: 'Kayıkçı Rıfat', role: 'boats', x: 21, f: 12.5, shirt: '#2a3a4a', pants: '#1a1a2a', skin: '#d8a070', hair: '#c8c8c8', hat: '#e8e8e8', hatStyle: 'cap', beard: true,
        lines: ['Adalar arasında yüzerek mi gideceksin? Bir tekne al!', 'Teknen hazır olduğunda T tuşuyla çağırabilirsin.'] },
      { id: 'kaptan_yusuf', name: 'Kaptan Yusuf', role: 'quest', x: -7, f: 5, shirt: '#1a2a5a', pants: '#1a1a1a', skin: '#e0b090', hair: '#e8e8e8', hat: '#1a2a5a', hatStyle: 'captain', beard: true,
        lines: ['Hoş geldin evlat! Çamlıkoy\'da her balıkçı benden ders alır.'] },
      { id: 'deniz_kiz', name: 'Balıkçı Ela', role: 'quest', x: 7, f: 16, shirt: '#e86a3a', pants: '#2a4a6a', skin: '#f0d0b0', hair: '#a8401a', hat: '#f0d84a', hatStyle: 'bucket',
        lines: ['İskelenin ucu en iyi yerdir. Bana sorarsan tabii.'] },
    ],
  },
  {
    id: 'kizilkaya',
    name: 'Kızılkaya Adası',
    subtitle: 'Volkanik koy · Mercan resifleri',
    cx: 420, cz: 330, radius: 88, peak: 40, seed: 23, style: 'volcanic',
    fishRadius: 210, dockAngle: towardOrigin(420, 330), townDist: 0.5, townRadius: 28, townHeight: 2.4,
    palette: { sand: '#ead2bc', grass: '#4f9a5a', grass2: '#c76a8a', rock: '#4e4040', snow: '#ff7a3a', seabed: '#d8a89c' },
    fogTint: '#f0c8c8',
    buildings: [
      { kind: 'shop', label: 'Olta Atölyesi', x: -15, f: -8, w: 9, d: 7, h: 5, color: '#f2d6cf', roof: '#8a2a4a' },
      { kind: 'shop', label: 'Balık Hali', x: 2, f: -12, w: 10, d: 8, h: 5.5, color: '#f4ead8', roof: '#2a7a7a' },
      { kind: 'shop', label: 'Yem & Kayıkhane', x: 18, f: -6, w: 9, d: 7, h: 5, color: '#d8ece4', roof: '#3a4a7a' },
      { kind: 'house', x: -25, f: 6, w: 6, d: 6, h: 4, color: '#ffe2bc', roof: '#b83a3a' },
      { kind: 'house', x: 25, f: 8, w: 6, d: 5, h: 4, color: '#f8ece0', roof: '#d86a3a' },
    ],
    npcs: [
      { id: 'leyla', name: 'Tüccar Leyla', role: 'merchant', x: 2, f: -7, shirt: '#2a8a8a', pants: '#f0e0c0', skin: '#a8704a', hair: '#1a1210', hat: '#f0d080', hatStyle: 'straw',
        lines: ['Kızılkaya balıkları renkli ve değerlidir!'] },
      { id: 'kerem_usta', name: 'Demirci Kerem', role: 'rods', x: -15, f: -3.5, shirt: '#8a2a4a', pants: '#2a1a1a', skin: '#c88a5a', hair: '#2a1a12', beard: true,
        lines: ['Martı ve Enkaz oltaları yalnızca bende.', 'Enkaz Oltası batık gemilerin kabuklarını yakalar.'] },
      { id: 'pelin', name: 'Denizci Pelin', role: 'boats', x: 22, f: -2, shirt: '#3a4a8a', pants: '#1a1a2a', skin: '#e8c0a0', hair: '#d8b060', hat: '#ffffff', hatStyle: 'cap',
        lines: ['Abis Çukuru\'na inmek mi istiyorsun? Batiskaf şart.'] },
      { id: 'tunc', name: 'Yemci Tunç', role: 'bait', x: 14, f: -2, shirt: '#a0d8c8', pants: '#3a3a2a', skin: '#b8805a', hair: '#3a2a1a',
        lines: ['Mercan yemleri burada!'] },
      { id: 'volkan', name: 'Volkanbilimci Arda', role: 'quest', x: -6, f: 6, shirt: '#ff8a3a', pants: '#3a3a3a', skin: '#e8b890', hair: '#4a3a2a', hat: '#ffcc33', hatStyle: 'cap',
        lines: ['Volkan suları ısıtıyor; nadir balıklar yüzeye çıkıyor!'] },
      { id: 'mercan_bekcisi', name: 'Resif Bekçisi Nehir', role: 'quest', x: 8, f: 10, shirt: '#e86a9a', pants: '#2a4a5a', skin: '#8a5a3a', hair: '#1a1210',
        lines: ['Resifler sabır ister. Gerçek ustalık kusursuz yakalamadadır.'] },
    ],
  },
  {
    id: 'ayazburun',
    name: 'Ayazburun',
    subtitle: 'Buzul adası · Kutup ışıkları',
    cx: -430, cz: 360, radius: 92, peak: 58, seed: 37, style: 'snow',
    fishRadius: 215, dockAngle: towardOrigin(-430, 360), townDist: 0.5, townRadius: 28, townHeight: 2.6,
    palette: { sand: '#d4d8dc', grass: '#e8eef4', grass2: '#c6d4e2', rock: '#6a7480', snow: '#ffffff', seabed: '#8a9aa8' },
    fogTint: '#dce8f4',
    buildings: [
      { kind: 'shop', label: 'Olta Atölyesi', x: -14, f: -8, w: 8, d: 7, h: 5, color: '#a8784a', roof: '#f4f8ff' },
      { kind: 'shop', label: 'Balık Hali', x: 3, f: -12, w: 10, d: 8, h: 5.5, color: '#b88a5a', roof: '#f4f8ff' },
      { kind: 'house', x: 18, f: -7, w: 7, d: 6, h: 4, color: '#8a5a3a', roof: '#f4f8ff' },
      { kind: 'house', x: -24, f: 5, w: 6, d: 6, h: 4, color: '#9a6a4a', roof: '#f4f8ff' },
      { kind: 'tower', x: 22, f: 8, w: 3, d: 3, h: 9, color: '#5a4a3a', roof: '#f4f8ff' },
    ],
    npcs: [
      { id: 'erdem', name: 'Tüccar Erdem', role: 'merchant', x: 3, f: -7, shirt: '#8a2a2a', pants: '#2a2a2a', skin: '#f0d0c0', hair: '#d8c090', hat: '#c83a3a', hatStyle: 'beanie', beard: true,
        lines: ['Soğuk sulardan gelen balık en tazesidir!'] },
      { id: 'asli', name: 'Usta Aslı', role: 'rods', x: -14, f: -3.5, shirt: '#3a5a8a', pants: '#2a2a3a', skin: '#f8e0d0', hair: '#f0e0b0', hat: '#ffffff', hatStyle: 'beanie',
        lines: ['Poyraz Oltası yağmurda canlanır.', 'Yıldız Tozu Oltası\'nı yalnızca gerçek koleksiyonculara satarım.'] },
      { id: 'kaan_kasif', name: 'Kâşif Batu', role: 'quest', x: -5, f: 6, shirt: '#e8e8f0', pants: '#3a3a5a', skin: '#e0b898', hair: '#3a2a1a', hat: '#5a8ae8', hatStyle: 'beanie',
        lines: ['Kutup ışıklarını hiç gördün mü? Gece gökyüzü yeşile boyanır...'] },
      { id: 'yasli_oguz', name: 'Yaşlı Reis Osman', role: 'quest', x: 9, f: 9, shirt: '#5a4a3a', pants: '#2a2a2a', skin: '#d8b090', hair: '#e8e8e8', hat: '#3a3a3a', hatStyle: 'beanie', beard: true,
        lines: ['Buz tutmuş ellerimle elli yıl balık tuttum.'] },
    ],
  },
  {
    id: 'abis',
    name: 'Derinlik Üssü',
    subtitle: 'Abis Çukuru · Batiskaf gerekli',
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
      { id: 'vera', name: 'Koleksiyoncu Nilay', role: 'quest', x: -2, f: 4, shirt: '#8a3ae8', pants: '#1a1a2a', skin: '#e8c8a8', hair: '#1a1210', hat: '#2a2a2a', hatStyle: 'cap',
        lines: ['Varyantlar... ne güzel bir tutku.'] },
      { id: 'dr_derin', name: 'Dr. Mert Akın', role: 'quest', x: -8, f: -1.5, shirt: '#f4f4f4', pants: '#2a3a5a', skin: '#d0a080', hair: '#5a5a5a', beard: true,
        lines: ['Abisin biyolüminesans canlıları üzerine çalışıyorum.'] },
      { id: 'abis_tuccar', name: 'Abis Tüccarı Fikret', role: 'merchant', x: 7, f: -1.5, shirt: '#1a3a6a', pants: '#1a1a1a', skin: '#b8885a', hair: '#2a1a12', hat: '#ffcc33', hatStyle: 'beanie',
        lines: ['Karanlık sulardan gelen her şeyi alırım.'] },
      { id: 'prizma', name: 'Işık Ustası Selin', role: 'rods', x: 3, f: 6, shirt: '#ff8cf0', pants: '#3a2a5a', skin: '#f0d8c8', hair: '#c8e8ff', hat: '#8ae8ff', hatStyle: 'bucket',
        lines: ['Tayf Oltası... ışığı yedi renge bölen olta.', 'Yalnızca atlasını doldurmuş olanlara.'] },
      { id: 'dalgic', name: 'Sessiz Dalgıç', role: 'lore', x: 11, f: 2, shirt: '#1a1a1a', pants: '#1a1a1a', skin: '#8a6a5a', hair: '#1a1a1a', hat: '#ffd23a', hatStyle: 'beanie',
        lines: [
          'Bu çukurun ötesinde... Sonsuz Uçurum var.',
          'Oraya inebilmek için daha güçlü bir denizaltı gerekecek. Belki bir gün.',
          'Abisal Ejder\'i gördüğünü söyleyenler hep yalnız döner.',
        ] },
    ],
  },
];

export const ISLANDS_BY_ID: Record<string, IslandDef> = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

export const REGION_NAMES: Record<RegionId, string> = {
  camlikoy: 'Çamlıkoy',
  kizilkaya: 'Kızılkaya Adası',
  ayazburun: 'Ayazburun',
  acikdeniz: 'Açık Deniz',
  abis: 'Abis Çukuru',
};

export const REGION_ORDER: RegionId[] = ['camlikoy', 'kizilkaya', 'ayazburun', 'acikdeniz', 'abis'];

/** Eski kayıtlardaki bölge kimliklerinin karşılıkları. */
export const LEGACY_REGION_IDS: Record<string, RegionId> = {
  moosewood: 'camlikoy',
  roslit: 'kizilkaya',
  snowcap: 'ayazburun',
  ocean: 'acikdeniz',
  deep: 'abis',
};
