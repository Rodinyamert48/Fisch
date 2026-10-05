import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Scene } from '@babylonjs/core/scene';
import { ISLANDS_BY_ID, type IslandDef, type NpcDef, type NpcRole } from '../core/data/world';
import { npcHasAvailableQuest, type QuestLog } from '../core/quests';
import { Character } from './Character';
import type { Materials } from './materials';
import { lerpAngle } from './Player';
import type { NpcSpot } from './WorldBuilder';

const ROLE_LABEL: Record<NpcRole, string> = {
  merchant: 'Balık Sat',
  rods: 'Olta Dükkanı',
  bait: 'Yem Dükkanı',
  boats: 'Kayıkhane',
  quest: 'Görev',
  lore: '???',
};

const ROLE_COLOR: Record<NpcRole, string> = {
  merchant: '#ffd23f',
  rods: '#7ad8ff',
  bait: '#ff9ab0',
  boats: '#8affc0',
  quest: '#ffb03a',
  lore: '#c8a8ff',
};

export interface NpcEntity {
  def: NpcDef;
  island: IslandDef;
  char: Character;
  tag: Mesh;
  marker: Mesh;
  pos: Vector3;
  baseYaw: number;
}

/** Ada sakinleri: isim etiketleri, görev işaretleri ve oyuncuya dönme. */
export class NpcManager {
  readonly list: NpcEntity[] = [];
  private t = 0;

  constructor(scene: Scene, mats: Materials, spots: NpcSpot[]) {
    const markerTex = mats.textTexture('!', { width: 128, height: 128, color: '#ffd23f', stroke: '#6a4a00', font: 'bold 110px Fredoka, sans-serif' });
    const markerMat = mats.labelMaterial(markerTex, 'questMarker');
    for (const spot of spots) {
      const island = ISLANDS_BY_ID[spot.islandId];
      const def = island.npcs[spot.npcIndex];
      const char = new Character(scene, mats, `npc-${def.id}`, def);
      char.root.position.set(spot.x, spot.y, spot.z);
      char.root.rotation.y = spot.yaw;
      const tex = new DynamicTexture(`tagTex-${def.id}`, { width: 512, height: 160 }, scene, true);
      tex.hasAlpha = true;
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 512, 160);
      ctx.fillStyle = 'rgba(8,16,30,0.78)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(8, 10, 496, 140, 40);
      else ctx.rect(8, 10, 496, 140);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 54px Fredoka, "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(def.name, 256, 62);
      ctx.font = '600 36px Fredoka, "Segoe UI", sans-serif';
      ctx.fillStyle = ROLE_COLOR[def.role];
      ctx.fillText(ROLE_LABEL[def.role], 256, 118);
      tex.update(true);
      const tag = CreatePlane(`tag-${def.id}`, { width: 2.3, height: 0.72 }, scene);
      tag.material = mats.labelMaterial(tex, `tagMat-${def.id}`);
      tag.billboardMode = Mesh.BILLBOARDMODE_ALL;
      tag.position.set(spot.x, spot.y + 2.7, spot.z);
      tag.isPickable = false;
      const marker = CreatePlane(`marker-${def.id}`, { size: 0.9 }, scene);
      marker.material = markerMat;
      marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
      marker.position.set(spot.x, spot.y + 3.55, spot.z);
      marker.isPickable = false;
      marker.setEnabled(false);
      this.list.push({ def, island, char, tag, marker, pos: new Vector3(spot.x, spot.y, spot.z), baseYaw: spot.yaw });
    }
  }

  /** Görünürlük, animasyon; oyuncuya en yakın etkileşilebilir NPC'yi döndürür. */
  update(dt: number, player: Vector3, quests: QuestLog, interactRange = 3.6): NpcEntity | null {
    this.t += dt;
    let nearest: NpcEntity | null = null;
    let nd = interactRange;
    for (const n of this.list) {
      const d = Vector3.Distance(player, n.pos);
      const visible = d < 170;
      n.char.setEnabled(visible);
      n.tag.setEnabled(visible && d < 60);
      const hasQuest = n.def.role === 'quest' && npcHasAvailableQuest(n.def.id, quests);
      n.marker.setEnabled(visible && hasQuest);
      if (!visible) continue;
      if (hasQuest) n.marker.position.y = n.pos.y + 3.55 + Math.sin(this.t * 3) * 0.15;
      const targetYaw = d < 10 ? Math.atan2(player.x - n.pos.x, player.z - n.pos.z) : n.baseYaw;
      n.char.root.rotation.y = lerpAngle(n.char.root.rotation.y, targetYaw, 1 - Math.exp(-dt * 5));
      n.char.animate(dt, 0, 'idle');
      if (d < nd) {
        nd = d;
        nearest = n;
      }
    }
    return nearest;
  }
}
