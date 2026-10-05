import type { VariantDef, VariantId } from '../types';

/**
 * Varyant tanımları.
 * Olasılıklar: yaygın varyant %1-5, nadir %0.1-1, efsanevi %0.01-0.1.
 * Koşullu varyantların (Fosforlu, Kabuklu, Tayf) doğal şansı 0'dır.
 */
export const VARIANTS: Record<VariantId, VariantDef> = {
  none: { id: 'none', name: 'Normal', valueMult: 1, chance: 0, color: '#ffffff', description: '' },
  sedef: {
    id: 'sedef', name: 'Sedef', valueMult: 1.85, chance: 0.03, color: '#f2f6ff',
    description: 'Pulları istiridye kabuğunun içi gibi inci rengi parlıyor.',
  },
  yildizli: {
    id: 'yildizli', name: 'Yıldızlı', valueMult: 1.85, chance: 0.02, color: '#fff3a0',
    description: 'Çevresinde minik ışık zerreleri dans ediyor.',
  },
  karbeyaz: {
    id: 'karbeyaz', name: 'Karbeyaz', valueMult: 2, chance: 0.012, color: '#ffe3ec',
    description: 'Renksiz doğmuş; kar kadar beyaz pullar.',
  },
  yaldiz: {
    id: 'yaldiz', name: 'Yaldızlı', valueMult: 3, chance: 0.005, color: '#ffd23f',
    description: 'Sanki ustası onu altın varakla kaplamış.',
  },
  ruhani: {
    id: 'ruhani', name: 'Ruhani', valueMult: 3.5, chance: 0.002, color: '#9fe8ff',
    description: 'Yarı saydam bir silüet. Yalnızca gece görünür.',
  },
  takimyildiz: {
    id: 'takimyildiz', name: 'Takımyıldız', valueMult: 6, chance: 0.0006, color: '#b9a6ff',
    description: 'Sırtında bir takımyıldızın haritası taşıyor.',
  },
  fosfor: {
    id: 'fosfor', name: 'Fosforlu', valueMult: 4, chance: 0, color: '#6dff4a',
    description: 'Yeşil Şafak sırasında zehirli bir yeşille parlar.',
  },
  kabuklu: {
    id: 'kabuklu', name: 'Kabuklu', valueMult: 3.5, chance: 0, color: '#4fa39a',
    description: 'Üzerini batık gemilerin midyeleri sarmış. Enkaz Oltası gerekir.',
  },
  tayf: {
    id: 'tayf', name: 'Tayf', valueMult: 5, chance: 0, color: '#ff8cf0',
    description: 'Işığı gökkuşağının tüm renklerine böler. Tayf Oltası ile.',
  },
};

/** Doğal varyantlar: en nadirden en yaygına doğru denenir. */
export const NATURAL_VARIANT_ORDER: VariantId[] = ['takimyildiz', 'ruhani', 'yaldiz', 'karbeyaz', 'yildizli', 'sedef'];

/** Yeşil Şafak olayı sırasında Fosforlu varyant şansı. */
export const NUCLEAR_EVENT_CHANCE = 0.22;
/** Enkaz Oltası ile Kabuklu varyant şansı. */
export const SUNKEN_ROD_CHANCE = 0.15;
/** Tayf Oltası ile Tayf varyant şansı. */
export const PRISM_ROD_CHANCE = 0.5;

/** Eski kayıtlardaki varyant kimliklerinin karşılıkları. */
export const LEGACY_VARIANT_IDS: Record<string, VariantId> = {
  shiny: 'sedef',
  sparkling: 'yildizli',
  albino: 'karbeyaz',
  golden: 'yaldiz',
  ghastly: 'ruhani',
  celestial: 'takimyildiz',
  nuclear: 'fosfor',
  sunken: 'kabuklu',
  prismize: 'tayf',
};
