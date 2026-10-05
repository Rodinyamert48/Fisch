import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { WORLD_LIMIT } from '../core/data/world';
import { groundHeight } from '../core/worldMap';
import { Character } from './Character';
import { hex } from './geometry';
import type { Materials } from './materials';
import { collidersPushOut, type Collider } from './WorldBuilder';
import type { Boat } from './Boat';

export type FishingPose = 'none' | 'charge' | 'cast' | 'wait' | 'reel' | 'hold';

export const SWIM_Y = -1.15;

/** Oyuncu karakteri: yürüme, koşma, zıplama, yüzme ve tekne sürme. */
export class Player {
  readonly char: Character;
  readonly position: Vector3;
  yaw = 0;
  velY = 0;
  grounded = true;
  swimming = false;
  boat: Boat | null = null;
  pose: FishingPose = 'none';
  /** Balık tutarken bakış yönü (null = hareket yönü). */
  aimYaw: number | null = null;
  speedNorm = 0;
  readonly rodRoot: TransformNode;
  readonly rodTip: TransformNode;
  private rodMesh: Mesh;
  private rodMat: StandardMaterial;
  private reelKnob: Mesh;
  private shadow: Mesh;
  private poseTime = 0;
  private armAngle = -0.15;

  constructor(
    scene: Scene,
    mats: Materials,
    private readonly colliders: Collider[],
    spawn: Vector3,
  ) {
    this.char = new Character(scene, mats, 'player', {
      shirt: '#3a6ea8', pants: '#3a4150', skin: '#e9bf98', hair: '#4a3020', hat: '#d8a23a', hatStyle: 'bucket', vest: '#5a6a3a', boots: '#4a3020',
    });
    this.position = spawn.clone();

    // Olta
    this.rodRoot = new TransformNode('rodRoot', scene);
    this.rodRoot.parent = this.char.hand;
    this.rodRoot.rotation.x = -0.35;
    const len = 2.8;
    this.rodMat = new StandardMaterial('rodMat', scene);
    this.rodMat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.rodMesh = CreateCylinder('rod', { height: len, diameterTop: 0.018, diameterBottom: 0.055, tessellation: 8 }, scene);
    this.rodMesh.material = this.rodMat;
    this.rodMesh.parent = this.rodRoot;
    this.rodMesh.rotation.x = Math.PI / 2;
    this.rodMesh.position.z = len / 2 - 0.3;
    this.reelKnob = CreateSphere('reel', { diameter: 0.22, segments: 4 }, scene);
    this.reelKnob.material = mats.solid('#3a3a3a', { specular: 0.4 });
    this.reelKnob.parent = this.rodRoot;
    this.reelKnob.position.set(0, -0.12, 0.05);
    this.rodTip = new TransformNode('rodTip', scene);
    this.rodTip.parent = this.rodRoot;
    this.rodTip.position.z = len - 0.3;

    // Blob gölge
    this.shadow = CreateDisc('shadow', { radius: 0.7, tessellation: 16 }, scene);
    this.shadow.rotation.x = Math.PI / 2;
    const sm = new StandardMaterial('shadowMat', scene);
    sm.diffuseColor = Color3.Black();
    sm.specularColor = Color3.Black();
    sm.opacityTexture = mats.flare;
    sm.alpha = 0.5;
    sm.disableLighting = true;
    this.shadow.material = sm;
    this.shadow.isPickable = false;
  }

  get meshes(): Mesh[] {
    return [...this.char.meshes, this.rodMesh, this.reelKnob];
  }

  setRod(color: string, tier: number): void {
    const c = hex(color);
    this.rodMat.diffuseColor = c;
    this.rodMat.emissiveColor = tier >= 6 ? c.scale(0.35) : Color3.Black();
    this.rodMesh.scaling.setAll(1 + tier * 0.03);
  }

  /** Dünya uzayında olta ucunun konumu. */
  tipPosition(): Vector3 {
    this.rodTip.computeWorldMatrix(true);
    return this.rodTip.getAbsolutePosition().clone();
  }

  forward(): Vector3 {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  setPose(p: FishingPose): void {
    if (p !== this.pose) this.poseTime = 0;
    this.pose = p;
  }

  update(dt: number, move: { x: number; y: number }, run: boolean, jump: boolean, camFwd: { x: number; z: number }, locked: boolean): void {
    this.poseTime += dt;
    const showRod = !this.swimming && !(this.boat && this.pose === 'none');
    this.rodRoot.setEnabled(showRod);

    if (this.boat) {
      const seat = this.boat.seatWorld();
      this.position.copyFrom(seat);
      this.yaw = this.aimYaw ?? this.boat.heading;
      this.char.root.position.copyFrom(seat);
      this.char.root.rotation.y = this.yaw;
      this.char.animate(dt, 0, 'sit', this.armForPose());
      this.shadow.setEnabled(false);
      this.speedNorm = 0;
      return;
    }

    let mx = 0;
    let mz = 0;
    if (!locked) {
      const right = { x: camFwd.z, z: -camFwd.x };
      mx = right.x * move.x + camFwd.x * move.y;
      mz = right.z * move.x + camFwd.z * move.y;
    }
    const mlen = Math.hypot(mx, mz);
    const speed = this.swimming ? 5.2 : run ? 12 : 7.5;
    if (mlen > 0.01) {
      this.position.x += mx * speed * dt;
      this.position.z += mz * speed * dt;
      const targetYaw = Math.atan2(mx, mz);
      if (this.aimYaw === null) this.yaw = lerpAngle(this.yaw, targetYaw, 1 - Math.exp(-dt * 14));
    }
    if (this.aimYaw !== null) this.yaw = lerpAngle(this.yaw, this.aimYaw, 1 - Math.exp(-dt * 16));
    this.speedNorm = Math.min(1, mlen) * (run ? 1.4 : 1);

    // Çarpışmalar ve dünya sınırı
    const pushed = collidersPushOut(this.colliders, this.position.x, this.position.z, 0.45);
    this.position.x = pushed.x;
    this.position.z = pushed.z;
    const dc = Math.hypot(this.position.x, this.position.z);
    if (dc > WORLD_LIMIT) {
      this.position.x *= WORLD_LIMIT / dc;
      this.position.z *= WORLD_LIMIT / dc;
    }

    // Dikey hareket
    const ground = groundHeight(this.position.x, this.position.z);
    const deepWater = ground < SWIM_Y - 0.1;
    if (this.swimming) {
      if (!deepWater) {
        this.swimming = false;
        this.position.y = Math.max(this.position.y, ground);
      } else {
        this.position.y += (SWIM_Y + Math.sin(this.poseTime * 2) * 0.06 - this.position.y) * Math.min(1, dt * 6);
        this.velY = 0;
      }
    }
    if (!this.swimming) {
      if (jump && this.grounded) {
        this.velY = 11;
        this.grounded = false;
      }
      this.velY -= 32 * dt;
      this.position.y += this.velY * dt;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velY = 0;
        this.grounded = true;
      } else if (this.position.y - ground > 0.25) {
        this.grounded = false;
      }
      if (deepWater && this.position.y <= SWIM_Y) {
        this.swimming = true;
        this.position.y = SWIM_Y;
        this.velY = 0;
        this.grounded = false;
      }
    }

    this.char.root.position.copyFrom(this.position);
    this.char.root.rotation.y = this.yaw;
    const mode = this.swimming ? 'swim' : this.speedNorm > 0.05 ? 'walk' : 'idle';
    this.char.animate(dt, this.speedNorm, mode, this.swimming ? undefined : this.armForPose());

    this.shadow.setEnabled(!this.swimming);
    this.shadow.position.set(this.position.x, Math.max(ground, 0.02) + 0.04, this.position.z);
    const h = this.position.y - ground;
    this.shadow.scaling.setAll(Math.max(0.4, 1 - h * 0.08));
  }

  private armForPose(): number | undefined {
    const t = this.poseTime;
    let target: number;
    switch (this.pose) {
      case 'charge':
        target = -3.3 + Math.sin(t * 20) * 0.03;
        break;
      case 'cast':
        target = t < 0.12 ? -3.3 + (t / 0.12) * 2.5 : -0.75;
        break;
      case 'wait':
        target = -0.6 + Math.sin(t * 1.5) * 0.03;
        break;
      case 'reel':
        target = -0.95 + Math.sin(t * 30) * 0.05;
        break;
      case 'hold':
        target = -2.6;
        break;
      default:
        target = -0.15;
        if (this.speedNorm > 0.05) return undefined;
    }
    const k = this.pose === 'cast' ? 1 : 1 - Math.exp(-0.016 * 18);
    this.armAngle += (target - this.armAngle) * k;
    return this.armAngle;
  }
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
