import { BAITS_BY_ID } from './data/baits';
import { BOATS_BY_ID } from './data/boats';
import { getFish } from './data/fish';
import { QUESTS_BY_ID } from './data/quests';
import { RODS_BY_ID, getRod } from './data/rods';
import { REGION_REWARDS, bestiaryCompletion, regionProgress, type Bestiary } from './bestiary';
import { levelFromXp, levelLuckBonus } from './economy';
import type { EnvSnapshot } from './environment';
import { Emitter } from './events';
import { applyCatchToQuests, questStatus, type QuestLog } from './quests';
import type { BaitDef, BoatDef, CaughtFish, QuestDef, RegionId, RodDef, VariantId } from './types';

export const SAVE_KEY = 'fisch-web-save-v1';

export interface Settings {
  volume: number;
  music: number;
  muted: boolean;
  quality: 'auto' | 'low' | 'high';
}

export interface Stats {
  totalCaught: number;
  perfectCatches: number;
  totalEarned: number;
  casts: number;
  escaped: number;
  biggest?: { fishId: string; weight: number };
  rarest?: { fishId: string; variant: VariantId };
}

export interface SaveData {
  version: 1;
  cash: number;
  xp: number;
  ownedRods: string[];
  equippedRod: string;
  baits: Record<string, number>;
  equippedBait: string | null;
  ownedBoats: string[];
  selectedBoat: string | null;
  inventory: CaughtFish[];
  bestiary: Bestiary;
  quests: QuestLog;
  regionRewards: RegionId[];
  stats: Stats;
  settings: Settings;
  tutorialDone: boolean;
  env?: EnvSnapshot;
  player?: { x: number; y: number; z: number; rot: number };
}

export function newSave(): SaveData {
  return {
    version: 1,
    cash: 0,
    xp: 0,
    ownedRods: ['training'],
    equippedRod: 'training',
    baits: {},
    equippedBait: null,
    ownedBoats: [],
    selectedBoat: null,
    inventory: [],
    bestiary: {},
    quests: {},
    regionRewards: [],
    stats: { totalCaught: 0, perfectCatches: 0, totalEarned: 0, casts: 0, escaped: 0 },
    settings: { volume: 0.8, music: 0.6, muted: false, quality: 'auto' },
    tutorialDone: false,
  };
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

export interface CatchOutcome {
  isNewSpecies: boolean;
  isNewVariant: boolean;
  isRecord: boolean;
  questsCompleted: QuestDef[];
  levelUps: number[];
  xpGained: number;
  bonusCash: number;
}

export interface StateEvents extends Record<string, unknown> {
  cash: number;
  xp: { level: number; into: number; needed: number };
  levelUp: number;
  inventory: CaughtFish[];
  rods: string;
  baits: Record<string, number>;
  boats: string[];
  bestiary: Bestiary;
  quests: QuestLog;
  questCompleted: QuestDef;
  toast: { text: string; kind?: 'info' | 'good' | 'bad' | 'rare' };
}

let uidCounter = 0;
export function makeUid(): string {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Oyuncunun kalıcı durumu ve tüm ekonomik eylemler. */
export class PlayerState {
  readonly events = new Emitter<StateEvents>();
  data: SaveData;

  constructor(data?: SaveData) {
    this.data = data ? migrate(data) : newSave();
  }

  // ───────── Okuma ─────────
  get cash(): number {
    return this.data.cash;
  }
  get levelInfo() {
    return levelFromXp(this.data.xp);
  }
  get level(): number {
    return this.levelInfo.level;
  }
  get rod(): RodDef {
    return getRod(this.data.equippedRod);
  }
  get bait(): BaitDef | null {
    const id = this.data.equippedBait;
    if (!id || !(this.data.baits[id] > 0)) return null;
    return BAITS_BY_ID[id] ?? null;
  }
  get selectedBoat(): BoatDef | null {
    const id = this.data.selectedBoat;
    return id && this.data.ownedBoats.includes(id) ? BOATS_BY_ID[id] : null;
  }
  get completion(): number {
    return bestiaryCompletion(this.data.bestiary);
  }

  /** Olta ve yem dışındaki kalıcı şans bonusları. */
  permanentLuck(): number {
    let luck = levelLuckBonus(this.level);
    for (const r of this.data.regionRewards) luck += REGION_REWARDS[r].luck;
    return luck;
  }

  // ───────── Para ve XP ─────────
  addCash(n: number): void {
    this.data.cash = Math.max(0, Math.round(this.data.cash + n));
    if (n > 0) this.data.stats.totalEarned += n;
    this.events.emit('cash', this.data.cash);
  }

  spend(n: number): boolean {
    if (this.data.cash < n) return false;
    this.data.cash -= n;
    this.events.emit('cash', this.data.cash);
    return true;
  }

  addXp(n: number): number[] {
    const before = this.level;
    this.data.xp += n;
    const info = this.levelInfo;
    const ups: number[] = [];
    for (let l = before + 1; l <= info.level; l++) ups.push(l);
    // Aynı anda birden çok seviye atlanırsa tek bildirim
    if (ups.length) this.events.emit('levelUp', info.level);
    this.events.emit('xp', info);
    return ups;
  }

  // ───────── Oltalar ─────────
  canBuyRod(id: string): ActionResult {
    const rod = RODS_BY_ID[id];
    if (!rod) return { ok: false, reason: 'Bilinmeyen olta' };
    if (this.data.ownedRods.includes(id)) return { ok: false, reason: 'Zaten sahipsin' };
    if (this.level < rod.requiredLevel) return { ok: false, reason: `Seviye ${rod.requiredLevel} gerekli` };
    if (this.completion < rod.requiredBestiary)
      return { ok: false, reason: `Ansiklopedi %${Math.round(rod.requiredBestiary * 100)} gerekli` };
    if (this.data.cash < rod.price) return { ok: false, reason: 'Yetersiz C$' };
    return { ok: true };
  }

  buyRod(id: string): ActionResult {
    const check = this.canBuyRod(id);
    if (!check.ok) return check;
    const rod = RODS_BY_ID[id];
    this.spend(rod.price);
    this.data.ownedRods.push(id);
    this.data.equippedRod = id;
    this.events.emit('rods', id);
    return { ok: true };
  }

  equipRod(id: string): ActionResult {
    if (!this.data.ownedRods.includes(id)) return { ok: false, reason: 'Bu oltaya sahip değilsin' };
    this.data.equippedRod = id;
    this.events.emit('rods', id);
    return { ok: true };
  }

  // ───────── Yemler ─────────
  buyBait(id: string, packs = 1): ActionResult {
    const b = BAITS_BY_ID[id];
    if (!b) return { ok: false, reason: 'Bilinmeyen yem' };
    const cost = b.packPrice * packs;
    if (!this.spend(cost)) return { ok: false, reason: 'Yetersiz C$' };
    this.addBait(id, b.packSize * packs);
    if (!this.data.equippedBait) this.data.equippedBait = id;
    this.events.emit('baits', this.data.baits);
    return { ok: true };
  }

  addBait(id: string, amount: number): void {
    this.data.baits[id] = (this.data.baits[id] ?? 0) + amount;
    this.events.emit('baits', this.data.baits);
  }

  equipBait(id: string | null): void {
    this.data.equippedBait = id;
    this.events.emit('baits', this.data.baits);
  }

  /** Bir atışta kullanılan yemi düşer. Kullanılan yemi döndürür. */
  consumeBait(): BaitDef | null {
    const b = this.bait;
    if (!b) return null;
    this.data.baits[b.id] -= 1;
    if (this.data.baits[b.id] <= 0) {
      delete this.data.baits[b.id];
      this.data.equippedBait = null;
      this.events.emit('toast', { text: `${b.name} bitti!`, kind: 'info' });
    }
    this.events.emit('baits', this.data.baits);
    return b;
  }

  // ───────── Tekneler ─────────
  buyBoat(id: string): ActionResult {
    const b = BOATS_BY_ID[id];
    if (!b) return { ok: false, reason: 'Bilinmeyen tekne' };
    if (this.data.ownedBoats.includes(id)) return { ok: false, reason: 'Zaten sahipsin' };
    if (this.level < b.requiredLevel) return { ok: false, reason: `Seviye ${b.requiredLevel} gerekli` };
    if (!this.spend(b.price)) return { ok: false, reason: 'Yetersiz C$' };
    this.data.ownedBoats.push(id);
    this.data.selectedBoat = id;
    this.events.emit('boats', this.data.ownedBoats);
    return { ok: true };
  }

  selectBoat(id: string): void {
    if (this.data.ownedBoats.includes(id)) {
      this.data.selectedBoat = id;
      this.events.emit('boats', this.data.ownedBoats);
    }
  }

  // ───────── Yakalama ─────────
  recordCatch(c: CaughtFish, xp: number, bonusCash: number): CatchOutcome {
    const fish = getFish(c.fishId);
    const b = this.data.bestiary;
    const prev = b[c.fishId];
    const isNewSpecies = !prev;
    const entry = prev ?? { count: 0, maxWeight: 0, variants: [], firstCaughtAt: Date.now() };
    const isRecord = !isNewSpecies && c.weight > entry.maxWeight;
    const isNewVariant = c.variant !== 'none' && !entry.variants.includes(c.variant);
    entry.count += 1;
    entry.maxWeight = Math.max(entry.maxWeight, c.weight);
    if (isNewVariant) entry.variants.push(c.variant);
    b[c.fishId] = entry;

    this.data.inventory.push(c);
    const s = this.data.stats;
    s.totalCaught += 1;
    if (c.perfect) s.perfectCatches += 1;
    if (!s.biggest || c.weight > s.biggest.weight) s.biggest = { fishId: c.fishId, weight: c.weight };

    const questsCompleted = applyCatchToQuests(this.data.quests, c, fish);
    if (bonusCash > 0) this.addCash(bonusCash);
    let questXp = 0;
    for (const q of questsCompleted) {
      this.grantQuestReward(q);
      questXp += q.reward.xp;
    }
    const levelUps = this.addXp(xp + questXp);

    this.events.emit('inventory', this.data.inventory);
    this.events.emit('bestiary', b);
    this.events.emit('quests', this.data.quests);
    return { isNewSpecies, isNewVariant, isRecord, questsCompleted, levelUps, xpGained: xp, bonusCash };
  }

  sellFish(uid: string): number {
    const idx = this.data.inventory.findIndex((f) => f.uid === uid);
    if (idx < 0) return 0;
    const [f] = this.data.inventory.splice(idx, 1);
    this.addCash(f.value);
    this.events.emit('inventory', this.data.inventory);
    return f.value;
  }

  /** Kilitli olmayan tüm balıkları satar. */
  sellAll(): { count: number; total: number } {
    let total = 0;
    let count = 0;
    const keep: CaughtFish[] = [];
    for (const f of this.data.inventory) {
      if (f.locked) keep.push(f);
      else {
        total += f.value;
        count++;
      }
    }
    this.data.inventory = keep;
    if (total > 0) this.addCash(total);
    this.events.emit('inventory', this.data.inventory);
    return { count, total };
  }

  toggleLock(uid: string): void {
    const f = this.data.inventory.find((x) => x.uid === uid);
    if (f) {
      f.locked = !f.locked;
      this.events.emit('inventory', this.data.inventory);
    }
  }

  inventoryValue(): number {
    return this.data.inventory.reduce((a, f) => a + f.value, 0);
  }

  // ───────── Görevler ─────────
  acceptQuest(id: string): ActionResult {
    const q = QUESTS_BY_ID[id];
    if (!q) return { ok: false, reason: 'Bilinmeyen görev' };
    const st = questStatus(q, this.data.quests);
    if (st !== 'available') return { ok: false, reason: 'Bu görev alınamaz' };
    this.data.quests[id] = { status: 'active', progress: 0 };
    this.events.emit('quests', this.data.quests);
    return { ok: true };
  }

  private grantQuestReward(q: QuestDef): void {
    this.addCash(q.reward.cash);
    if (q.reward.bait) this.addBait(q.reward.bait.id, q.reward.bait.amount);
    this.events.emit('questCompleted', q);
  }

  // ───────── Ansiklopedi ödülleri ─────────
  canClaimRegion(region: RegionId): boolean {
    return !this.data.regionRewards.includes(region) && regionProgress(this.data.bestiary, region).complete;
  }

  claimRegion(region: RegionId): ActionResult {
    if (!this.canClaimRegion(region)) return { ok: false, reason: 'Bölge henüz tamamlanmadı' };
    this.data.regionRewards.push(region);
    this.addCash(REGION_REWARDS[region].cash);
    this.events.emit('bestiary', this.data.bestiary);
    return { ok: true };
  }

  // ───────── Kayıt ─────────
  serialize(): string {
    return JSON.stringify(this.data);
  }

  static deserialize(json: string): PlayerState {
    const raw = JSON.parse(json) as SaveData;
    return new PlayerState(raw);
  }
}

/** Eski/eksik kayıtları güvenli biçimde tamamlar. */
function migrate(raw: Partial<SaveData>): SaveData {
  const base = newSave();
  const d: SaveData = {
    ...base,
    ...raw,
    stats: { ...base.stats, ...(raw.stats ?? {}) },
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  } as SaveData;
  if (!Array.isArray(d.ownedRods) || d.ownedRods.length === 0) d.ownedRods = ['training'];
  d.ownedRods = d.ownedRods.filter((r) => RODS_BY_ID[r]);
  if (!d.ownedRods.includes('training')) d.ownedRods.unshift('training');
  if (!d.ownedRods.includes(d.equippedRod)) d.equippedRod = d.ownedRods[0];
  d.inventory = (d.inventory ?? []).filter((f) => {
    try {
      getFish(f.fishId);
      return true;
    } catch {
      return false;
    }
  });
  d.ownedBoats = (d.ownedBoats ?? []).filter((b) => BOATS_BY_ID[b]);
  return d;
}

export function loadFromStorage(): PlayerState {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) return PlayerState.deserialize(json);
  } catch (e) {
    console.warn('Kayıt yüklenemedi, yeni oyun başlatılıyor.', e);
  }
  return new PlayerState();
}

export function saveToStorage(state: PlayerState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, state.serialize());
    return true;
  } catch {
    return false;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* yok say */
  }
}
