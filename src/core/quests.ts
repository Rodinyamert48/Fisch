import { QUESTS } from './data/quests';
import { rarityAtLeast } from './data/rarities';
import type { CaughtFish, FishDef, QuestDef } from './types';

export interface QuestProgress {
  status: 'active' | 'done';
  progress: number;
}

export type QuestLog = Record<string, QuestProgress>;

export function catchCountsForQuest(q: QuestDef, c: CaughtFish, fish: FishDef): boolean {
  const o = q.objective;
  if (o.fishId && o.fishId !== c.fishId) return false;
  if (o.region && o.region !== c.region) return false;
  if (o.minRarity && !rarityAtLeast(fish.rarity, o.minRarity)) return false;
  if (o.variantRequired && c.variant === 'none') return false;
  if (o.perfect && !c.perfect) return false;
  return true;
}

export type QuestAvailability = 'locked' | 'available' | 'active' | 'done';

export function questStatus(q: QuestDef, log: QuestLog): QuestAvailability {
  const p = log[q.id];
  if (p) return p.status;
  if (q.requires && log[q.requires]?.status !== 'done') return 'locked';
  return 'available';
}

export function questsForNpc(npcId: string): QuestDef[] {
  return QUESTS.filter((q) => q.npcId === npcId);
}

/** NPC'nin üzerinde "!" gösterilsin mi? (alınabilir görev var) */
export function npcHasAvailableQuest(npcId: string, log: QuestLog): boolean {
  return questsForNpc(npcId).some((q) => questStatus(q, log) === 'available');
}

/**
 * Yakalamayı aktif görevlere uygular. Tamamlanan görevleri döndürür.
 * (Görev kaydı yerinde güncellenir.)
 */
export function applyCatchToQuests(log: QuestLog, c: CaughtFish, fish: FishDef): QuestDef[] {
  const completed: QuestDef[] = [];
  for (const q of QUESTS) {
    const p = log[q.id];
    if (!p || p.status !== 'active') continue;
    if (!catchCountsForQuest(q, c, fish)) continue;
    p.progress = Math.min(q.objective.count, p.progress + 1);
    if (p.progress >= q.objective.count) {
      p.status = 'done';
      completed.push(q);
    }
  }
  return completed;
}
