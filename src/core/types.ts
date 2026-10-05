export type RarityId =
  | 'trash'
  | 'common'
  | 'uncommon'
  | 'unusual'
  | 'rare'
  | 'legendary'
  | 'mythical'
  | 'exotic'
  | 'secret'
  | 'divine';

export type RegionId = 'camlikoy' | 'kizilkaya' | 'ayazburun' | 'acikdeniz' | 'abis';
export type WeatherId = 'clear' | 'rain' | 'fog' | 'aurora';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeOfDay = 'day' | 'night';

export type VariantId =
  | 'none'
  | 'sedef'
  | 'yildizli'
  | 'karbeyaz'
  | 'yaldiz'
  | 'ruhani'
  | 'takimyildiz'
  | 'fosfor'
  | 'kabuklu'
  | 'tayf';

export type FishShape =
  | 'standard'
  | 'long'
  | 'round'
  | 'flat'
  | 'eel'
  | 'shark'
  | 'squid'
  | 'jelly'
  | 'angler'
  | 'sword'
  | 'puffer'
  | 'seahorse'
  | 'crab'
  | 'turtle'
  | 'boot'
  | 'can'
  | 'weed'
  | 'bottle';

export interface RarityDef {
  id: RarityId;
  name: string;
  color: string;
  order: number;
  /** Temel çıkma ağırlığı (şans 0 iken). */
  baseWeight: number;
  /** Şansın bu nadirliğe etkisi (negatif = şans arttıkça azalır). */
  luckScale: number;
  xp: number;
  /** Çekme mini oyunu: balık simgesinin hızı (yol genişliği / saniye). */
  fishSpeed: number;
  /** Ne kadar düzensiz/zıplayarak hareket ettiği (0-1). */
  erratic: number;
  /** Balık kapsandığında ilerlemenin dolma hızı (saniyede). */
  fillRate: number;
  /** Balık dışarıdayken ilerleme kaybı (saniyede). */
  lossRate: number;
  /** Oltaya gelme süresi aralığı (saniye). */
  biteTime: [number, number];
  /** Oltaya gelme sesinin perdesi (Hz). */
  hookPitch: number;
  /** Işık sütunu / özel kutlama. */
  celebrate: boolean;
}

export interface FishConditions {
  time?: TimeOfDay;
  weather?: WeatherId[];
  seasons?: SeasonId[];
}

export interface FishDef extends FishConditions {
  id: string;
  name: string;
  rarity: RarityId;
  regions: RegionId[] | 'all';
  avgWeight: number;
  minWeight: number;
  maxWeight: number;
  baseValue: number;
  shape: FishShape;
  colors: { body: string; fin: string; belly?: string; accent?: string; glow?: string };
  description: string;
}

export interface VariantDef {
  id: VariantId;
  name: string;
  valueMult: number;
  /** Doğal çıkma şansı (0-1). Koşullu varyantlarda 0. */
  chance: number;
  color: string;
  description: string;
}

export type RodPassive = 'none' | 'agir' | 'usta' | 'kabuk' | 'poyraz' | 'yildiz' | 'tayf';

export interface RodDef {
  id: string;
  name: string;
  price: number;
  lureSpeed: number;
  luck: number;
  control: number;
  resilience: number;
  maxWeight: number;
  passive: RodPassive;
  passiveText?: string;
  soldAt: RegionId | null;
  requiredLevel: number;
  requiredBestiary: number;
  color: string;
  tier: number;
}

export interface BaitDef {
  id: string;
  name: string;
  packPrice: number;
  packSize: number;
  lureSpeed: number;
  luck: number;
  variantBoost: number;
  description: string;
  color: string;
}

export interface BoatDef {
  id: string;
  name: string;
  price: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  luckBonus: number;
  allowsDeep: boolean;
  requiredLevel: number;
  description: string;
  color: string;
}

export interface CaughtFish {
  uid: string;
  fishId: string;
  weight: number;
  variant: VariantId;
  perfect: boolean;
  value: number;
  region: RegionId;
  caughtAt: number;
  locked?: boolean;
}

export interface QuestObjective {
  count: number;
  fishId?: string;
  region?: RegionId;
  minRarity?: RarityId;
  variantRequired?: boolean;
  perfect?: boolean;
}

export interface QuestReward {
  cash: number;
  xp: number;
  bait?: { id: string; amount: number };
}

export interface QuestDef {
  id: string;
  npcId: string;
  title: string;
  description: string;
  objective: QuestObjective;
  reward: QuestReward;
  requires?: string;
}
