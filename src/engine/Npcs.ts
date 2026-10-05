import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
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
  boats: 'Tersane',
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
      const tex = mats.textTexture(def.name, { width: 512, height: 96, bg: 'rgba(10,20,35,0.7)', color: '#ffffff' });
      const tag = CreatePlane(`tag-${def.id}`, { width: 2.6, height: 0.49 }, scene);
      tag.material = mats.labelMaterial(tex, `tagMat-${def.id}`);
      tag.billboardMode = Mesh.BILLBOARDMODE_ALL;
      tag.position.set(spot.x, spot.y + 2.75, spot.z);
      tag.isPickable = false;
      const roleTex = mats.textTexture(ROLE_LABEL[def.role], { width: 256, height: 64, color: ROLE_COLOR[def.role], stroke: '#000000' });
      const role = CreatePlane(`role-${def.id}`, { width: 1.3, height: 0.33 }, scene);
      role.material = mats.labelMaterial(roleTex, `roleMat-${def.id}`);
      role.parent = tag;
      role.position.y = -0.38;
      role.isPickable = false;
      const marker = CreatePlane(`marker-${def.id}`, { size: 0.9 }, scene);
      marker.material = markerMat;
      marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
      marker.position.set(spot.x, spot.y + 3.6, spot.z);
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
      if (hasQuest) n.marker.position.y = n.pos.y + 3.6 + Math.sin(this.t * 3) * 0.15;
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
