import { describe, expect, it } from 'vitest';
import { FISH, FISH_BY_ID } from '../src/core/data/fish';
import { RODS, getRod } from '../src/core/data/rods';
import { BAITS_BY_ID } from '../src/core/data/baits';
import { RARITIES } from '../src/core/data/rarities';
import { VARIANTS } from '../src/core/data/variants';
import { ISLANDS } from '../src/core/data/world';
import { QUESTS } from '../src/core/data/quests';
import {
  biteDelay,
  fishPool,
  rarityDistribution,
  rollCatch,
  rollVariant,
  type CatchContext,
} from '../src/core/catchRoller';
import { CastMeter } from '../src/core/castMeter';
import { ReelMinigame, reelParamsFor } from '../src/core/reelMinigame';
import { fishValue, levelFromXp, xpToNext } from '../src/core/economy';
import { EnvironmentSim, DAY_LENGTH_SEC } from '../src/core/environment';
import { PlayerState } from '../src/core/playerState';
import { mulberry32 } from '../src/core/rng';
import { groundHeight, regionAt, terrainHeight, townCenter, PLATFORMS } from '../src/core/worldMap';

const baseCtx = (over: Partial<CatchContext> = {}): CatchContext => ({
  region: 'moosewood',
  rod: getRod('training'),
  bait: null,
  bonusLuck: 0,
  time: 'day',
  weather: 'clear',
  season: 'spring',
  nukeEvent: false,
  ...over,
});

describe('veri bütünlüğü', () => {
  it('30+ balık türü ve benzersiz kimlikler', () => {
    expect(FISH.length).toBeGreaterThanOrEqual(30);
    expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
  });

  it('balık ağırlık aralıkları tutarlı', () => {
    for (const f of FISH) {
      expect(f.minWeight).toBeLessThanOrEqual(f.avgWeight);
      expect(f.avgWeight).toBeLessThanOrEqual(f.maxWeight);
      expect(RARITIES[f.rarity]).toBeDefined();
    }
  });

  it('olta fiyatları 500 C$ Çelimsiz → 15.000.000 C$ Ethereal Prism', () => {
    expect(getRod('flimsy').price).toBe(500);
    expect(getRod('ethereal').price).toBe(15_000_000);
    const tiers = RODS.map((r) => r.tier);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it('görevler var olan NPC ve balıklara işaret eder', () => {
    const npcIds = new Set(ISLANDS.flatMap((i) => i.npcs.map((n) => n.id)));
    for (const q of QUESTS) {
      expect(npcIds.has(q.npcId)).toBe(true);
      if (q.objective.fishId) expect(FISH_BY_ID[q.objective.fishId]).toBeDefined();
    }
  });

  it('her adada 1-2 görev NPC\'si var', () => {
    for (const isl of ISLANDS) {
      const questNpcs = isl.npcs.filter((n) => QUESTS.some((q) => q.npcId === n.id));
      expect(questNpcs.length).toBeGreaterThanOrEqual(1);
      expect(questNpcs.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('yakalama zarı', () => {
  it('koşullar havuzu filtreler (gece, hava, mevsim)', () => {
    const day = fishPool('moosewood', { time: 'day', weather: 'clear', season: 'spring', nukeEvent: false });
    const night = fishPool('moosewood', { time: 'night', weather: 'fog', season: 'autumn', nukeEvent: false });
    expect(day.some((f) => f.id === 'gece_yayini')).toBe(false);
    expect(night.some((f) => f.id === 'gece_yayini')).toBe(true);
    expect(night.some((f) => f.id === 'kirmizi_somon')).toBe(true);
    expect(day.some((f) => f.id === 'kirmizi_somon')).toBe(false);
    expect(night.some((f) => f.id === 'kadim_kaplumbaga')).toBe(true);
  });

  it('şans nadir balık olasılığını artırır', () => {
    const pool = fishPool('moosewood', { time: 'night', weather: 'rain', season: 'autumn', nukeEvent: false });
    const low = rarityDistribution(pool, 0);
    const high = rarityDistribution(pool, 300);
    expect(high.legendary!).toBeGreaterThan(low.legendary!);
    expect(high.trash!).toBeLessThan(low.trash!);
    const sum = Object.values(low).reduce((a, b) => a + (b ?? 0), 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('rollCatch her zaman bölgedeki bir balığı döndürür', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const r = rollCatch(baseCtx({ region: 'snowcap' }), rng);
      expect(r.fish.regions === 'all' || r.fish.regions.includes('snowcap')).toBe(true);
      expect(r.weight).toBeGreaterThanOrEqual(r.fish.minWeight);
      expect(r.weight).toBeLessThanOrEqual(r.fish.maxWeight);
    }
  });

  it('Prizmatik yalnızca Ethereal Prism ile ve ~%50', () => {
    const rng = mulberry32(7);
    let prism = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (rollVariant(baseCtx({ rod: getRod('ethereal') }), rng) === 'prismize') prism++;
    expect(prism / n).toBeGreaterThan(0.45);
    expect(prism / n).toBeLessThan(0.55);
    for (let i = 0; i < 2000; i++) expect(rollVariant(baseCtx({ rod: getRod('carbon') }), rng)).not.toBe('prismize');
  });

  it('Nükleer yalnızca Nükleer Olay sırasında', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 3000; i++) expect(rollVariant(baseCtx(), rng)).not.toBe('nuclear');
    let nuclear = 0;
    for (let i = 0; i < 3000; i++) if (rollVariant(baseCtx({ nukeEvent: true }), rng) === 'nuclear') nuclear++;
    expect(nuclear).toBeGreaterThan(300);
  });

  it('Batık yalnızca özel olta ile', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 3000; i++) expect(rollVariant(baseCtx({ rod: getRod('steady') }), rng)).not.toBe('sunken');
    let sunken = 0;
    for (let i = 0; i < 3000; i++) if (rollVariant(baseCtx({ rod: getRod('trident') }), rng) === 'sunken') sunken++;
    expect(sunken).toBeGreaterThan(200);
  });

  it('varyant olasılıkları önerilen aralıklarda', () => {
    expect(VARIANTS.shiny.chance).toBeGreaterThanOrEqual(0.01);
    expect(VARIANTS.shiny.chance).toBeLessThanOrEqual(0.05);
    expect(VARIANTS.golden.chance).toBeGreaterThanOrEqual(0.001);
    expect(VARIANTS.golden.chance).toBeLessThanOrEqual(0.01);
    expect(VARIANTS.celestial.chance).toBeGreaterThanOrEqual(0.0001);
    expect(VARIANTS.celestial.chance).toBeLessThanOrEqual(0.001);
  });

  it('yem hızı oltaya gelme süresini kısaltır, nadir balıklar daha uzun bekler', () => {
    const rngA = mulberry32(1);
    const rngB = mulberry32(1);
    expect(biteDelay('common', 100, rngA)).toBeLessThan(biteDelay('common', 0, rngB));
    const r1 = mulberry32(3);
    const r2 = mulberry32(3);
    expect(biteDelay('mythical', 0, r1)).toBeGreaterThan(biteDelay('common', 0, r2));
  });
});

describe('atış çubuğu', () => {
  it('derecelendirme: Meh.. → İyi → Mükemmel!', () => {
    expect(CastMeter.rate(0.2)).toBe('meh');
    expect(CastMeter.rate(0.7)).toBe('good');
    expect(CastMeter.rate(0.9)).toBe('perfect');
    expect(CastMeter.rate(0.99)).toBe('good');
  });

  it('güç gidip gelir', () => {
    const m = new CastMeter();
    m.start();
    m.update(CastMeter.FILL_TIME * 0.5);
    expect(m.power).toBeCloseTo(0.5, 5);
    m.update(CastMeter.FILL_TIME * 0.75);
    expect(m.power).toBeCloseTo(0.75, 5);
  });
});

describe('çekme mini oyunu', () => {
  const fish = FISH_BY_ID['sazan'];
  it('balığı takip eden oyuncu mükemmel yakalama yapar', () => {
    const params = reelParamsFor(fish, 4, getRod('carbon'));
    const g = new ReelMinigame(params, mulberry32(11));
    let t = 0;
    while (g.status === 'playing' && t < 30) {
      const center = g.barPos + params.barWidth / 2;
      // Basit kontrolcü: hıza göre önden kestir
      const predicted = center + g.barVel * 0.18;
      g.update(1 / 60, predicted < g.fishPos);
      t += 1 / 60;
    }
    expect(g.status).toBe('won');
  });

  it('hiç basmayan oyuncu kaybeder ve mükemmel değildir', () => {
    const params = reelParamsFor(fish, 4, getRod('training'));
    const g = new ReelMinigame(params, mulberry32(3));
    let t = 0;
    while (g.status === 'playing' && t < 60) {
      g.update(1 / 30, false);
      t += 1 / 30;
    }
    expect(g.status).toBe('lost');
    expect(g.perfect).toBe(false);
  });

  it('maks ağırlığı aşan balık çok daha yavaş dolar, Sabit Olta cezayı azaltır', () => {
    const tuna = FISH_BY_ID['sari_ton'];
    const ok = reelParamsFor(tuna, 40, getRod('carbon'));
    const heavy = reelParamsFor(tuna, 40, getRod('training'));
    expect(heavy.overweight).toBe(true);
    expect(heavy.fillRate).toBeLessThan(ok.fillRate);
    const sunfish = FISH_BY_ID['ay_baligi'];
    const champion = reelParamsFor(sunfish, 1200, getRod('champion'));
    const steadyLike = { ...getRod('champion'), passive: 'steady' as const };
    expect(reelParamsFor(sunfish, 1200, steadyLike).fillRate).toBeGreaterThan(champion.fillRate);
  });

  it('kontrol çubuğu genişliğini, direnç kaybı etkiler', () => {
    const a = reelParamsFor(fish, 4, getRod('training'));
    const b = reelParamsFor(fish, 4, getRod('ethereal'));
    expect(b.barWidth).toBeGreaterThan(a.barWidth);
    expect(b.lossRate).toBeLessThan(a.lossRate);
  });
});

describe('ekonomi ve ilerleme', () => {
  it('varyant ve ağırlık değeri artırır', () => {
    const f = FISH_BY_ID['levrek'];
    expect(fishValue(f, f.avgWeight, 'none')).toBe(f.baseValue);
    expect(fishValue(f, f.avgWeight * 2, 'none')).toBeGreaterThan(f.baseValue);
    expect(fishValue(f, f.avgWeight, 'golden')).toBe(f.baseValue * 3);
  });

  it('seviye hesabı', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpToNext(1)).level).toBe(2);
    expect(levelFromXp(xpToNext(1) + xpToNext(2) - 1).level).toBe(2);
  });

  it('olta satın alma şartları', () => {
    const s = new PlayerState();
    expect(s.buyRod('flimsy').ok).toBe(false);
    s.addCash(600);
    expect(s.buyRod('flimsy').ok).toBe(true);
    expect(s.cash).toBe(100);
    expect(s.rod.id).toBe('flimsy');
    s.addCash(20_000_000);
    const r = s.buyRod('ethereal');
    expect(r.ok).toBe(false);
  });

  it('yakalama: ansiklopedi, envanter, görev, satış', () => {
    const s = new PlayerState();
    expect(s.acceptQuest('q_ilk_adim').ok).toBe(true);
    for (let i = 0; i < 5; i++) {
      s.recordCatch(
        { uid: `u${i}`, fishId: 'sazan', weight: 3 + i, variant: i === 4 ? 'shiny' : 'none', perfect: i === 0, value: 20, region: 'moosewood', caughtAt: 0 },
        12,
        0,
      );
    }
    expect(s.data.bestiary['sazan'].count).toBe(5);
    expect(s.data.bestiary['sazan'].maxWeight).toBe(7);
    expect(s.data.bestiary['sazan'].variants).toEqual(['shiny']);
    expect(s.data.quests['q_ilk_adim'].status).toBe('done');
    expect(s.data.baits['solucan']).toBe(10);
    expect(s.cash).toBe(250);
    s.toggleLock('u0');
    const sold = s.sellAll();
    expect(sold.count).toBe(4);
    expect(s.data.inventory.length).toBe(1);
  });

  it('yem tüketimi', () => {
    const s = new PlayerState();
    s.addCash(1000);
    s.buyBait('solucan');
    expect(s.bait?.id).toBe('solucan');
    for (let i = 0; i < 10; i++) s.consumeBait();
    expect(s.bait).toBeNull();
    expect(BAITS_BY_ID['solucan'].packSize).toBe(10);
  });

  it('kayıt/yükleme', () => {
    const s = new PlayerState();
    s.addCash(1234);
    const copy = PlayerState.deserialize(s.serialize());
    expect(copy.cash).toBe(1234);
    expect(copy.rod.id).toBe('training');
  });
});

describe('çevre', () => {
  it('gündüz/gece ve mevsimler', () => {
    const env = new EnvironmentSim(mulberry32(1));
    expect(env.timeOfDay).toBe('day');
    env.setHour(23);
    expect(env.timeOfDay).toBe('night');
    expect(env.season).toBe('spring');
    env.update(DAY_LENGTH_SEC * 2);
    expect(env.season).toBe('summer');
  });

  it('kutup ışıkları gündüz olmaz', () => {
    const env = new EnvironmentSim(mulberry32(2));
    env.setHour(12);
    for (let i = 0; i < 400; i++) {
      env.update(30);
      if (env.timeOfDay === 'day') expect(env.weather).not.toBe('aurora');
    }
  });
});

describe('dünya', () => {
  it('ada merkezleri karada, açık deniz suda', () => {
    for (const isl of ISLANDS) {
      if (isl.style === 'station') continue;
      const t = townCenter(isl);
      expect(terrainHeight(t.x, t.z)).toBeGreaterThan(1);
    }
    expect(terrainHeight(250, -300)).toBeLessThan(-10);
  });

  it('iskeleler yürünebilir ve suyun üzerinde uzanır', () => {
    for (const p of PLATFORMS) {
      expect(groundHeight(p.cx, p.cz)).toBeGreaterThanOrEqual(p.top);
    }
  });

  it('bölge tespiti', () => {
    expect(regionAt(0, 120, false)).toBe('moosewood');
    expect(regionAt(60, 660, false)).toBe('ocean');
    expect(regionAt(60, 660, true)).toBe('deep');
    expect(regionAt(250, -300, false)).toBe('ocean');
  });
});
