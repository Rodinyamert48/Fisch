import type { VariantDef, VariantId } from '../types';

/**
 * Varyant (mutasyon) tanımları.
 * Olasılıklar: yaygın varyant %1-5, nadir %0.1-1, efsanevi %0.01-0.1.
 * Koşullu varyantların (Nükleer, Batık, Prizmatik) doğal şansı 0'dır.
 */
export const VARIANTS: Record<VariantId, VariantDef> = {
  none: { id: 'none', name: 'Normal', valueMult: 1, chance: 0, color: '#ffffff', description: '' },
  shiny: {
    id: 'shiny', name: 'Parlak', valueMult: 1.85, chance: 0.03, color: '#f2f6ff',
    description: 'Gümüş-beyaz bir ışıltı yayar.',
  },
  sparkling: {
    id: 'sparkling', name: 'Işıltılı', valueMult: 1.85, chance: 0.02, color: '#fff3a0',
    description: 'Çevresinde titreşen parçacıklar dans eder.',
  },
  albino: {
    id: 'albino', name: 'Albino', valueMult: 2, chance: 0.012, color: '#ffe3ec',
    description: 'Pigmentsiz, sütbeyazı pullar.',
  },
  golden: {
    id: 'golden', name: 'Altın', valueMult: 3, chance: 0.005, color: '#ffd23f',
    description: 'Saf altından dökülmüş gibi.',
  },
  ghastly: {
    id: 'ghastly', name: 'Hayalet', valueMult: 3.5, chance: 0.002, color: '#9fe8ff',
    description: 'Yarı saydam, ürkütücü bir silüet.',
  },
  celestial: {
    id: 'celestial', name: 'Göksel', valueMult: 6, chance: 0.0006, color: '#b9a6ff',
    description: 'Pullarında yıldızlar parlıyor.',
  },
  nuclear: {
    id: 'nuclear', name: 'Nükleer', valueMult: 4, chance: 0, color: '#6dff4a',
    description: 'Yeşil parlıyor. Yalnızca Nükleer Olay sırasında görülür.',
  },
  sunken: {
    id: 'sunken', name: 'Batık', valueMult: 3.5, chance: 0, color: '#4fa39a',
    description: 'Batık hazinelerin ruhunu taşır. Özel olta gerekir.',
  },
  prismize: {
    id: 'prismize', name: 'Prizmatik', valueMult: 5, chance: 0, color: '#ff8cf0',
    description: 'Gökkuşağının tüm renklerinde kırılır. Ethereal Prism Olta ile.',
  },
};

/** Doğal varyantlar: en nadirden en yaygına doğru denenir. */
export const NATURAL_VARIANT_ORDER: VariantId[] = ['celestial', 'ghastly', 'golden', 'albino', 'sparkling', 'shiny'];

/** Nükleer Olay sırasında Nükleer varyant şansı. */
export const NUCLEAR_EVENT_CHANCE = 0.22;
/** Batık pasifine sahip olta ile Batık varyant şansı. */
export const SUNKEN_ROD_CHANCE = 0.15;
/** Ethereal Prism Olta ile Prizmatik şansı. */
export const PRISM_ROD_CHANCE = 0.5;
