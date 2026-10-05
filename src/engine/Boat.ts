import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { WORLD_LIMIT } from '../core/data/world';
import { platformAt, terrainHeight } from '../core/worldMap';
import type { BoatDef } from '../core/types';
import { GeometryBuilder, mixColor } from './geometry';
import type { Materials } from './materials';
import type { Effects } from './Effects';

interface BoatShape {
  length: number;
  width: number;
  seat: [number, number, number];
}

function buildHull(g: GeometryBuilder, color: string, w: number, h: number, l: number, y: number): void {
  const dark = mixColor(color, '#000000', 0.25);
  g.box(color, { pos: [0, y, -l * 0.1], size: [w, h, l * 0.8] });
  // pruva (üçgen prizma, tepe +z'ye bakar)
  g.cylinder(color, { top: w * 1.15, bottom: w * 1.15, height: h, tess: 3 }, { pos: [0, y, l * 0.3], rot: [0, -Math.PI / 2, 0], scale: [1, 1, 0.9] });
  g.box(dark, { pos: [0, y - h * 0.45, -l * 0.05], size: [w * 0.9, h * 0.2, l * 0.85] });
  g.box('#f4f0e8', { pos: [0, y + h * 0.45, -l * 0.1], size: [w + 0.06, h * 0.12, l * 0.8] });
}

function buildBoatMesh(def: BoatDef, scene: Scene): { mesh: Mesh; shape: BoatShape } {
  const g = new GeometryBuilder({ smooth: true, uvScale: 0.6 });
  const c = def.color;
  let shape: BoatShape;
  switch (def.id) {
    case 'surat': {
      buildHull(g, c, 2.2, 0.9, 6, 0.3);
      g.box('#f4f4f4', { pos: [0, 0.8, -1], size: [2, 0.2, 3.4] });
      g.box('#a8d8ff', { pos: [0, 1.25, 0.6], size: [1.9, 0.7, 0.1], rot: [-0.5, 0, 0] });
      g.box('#2a2a2a', { pos: [0, 0.9, -3.05], size: [0.7, 1.0, 0.6] });
      g.box('#e8e8e8', { pos: [0, 0.85, -0.6], size: [0.8, 0.5, 0.6] });
      shape = { length: 6, width: 2.2, seat: [0, 0.95, -0.9] };
      break;
    }
    case 'trol': {
      buildHull(g, c, 3.2, 1.4, 8.5, 0.4);
      g.box('#f4f4f4', { pos: [0, 1.1, -0.5], size: [3, 0.15, 6.5] });
      g.box('#f8f8f8', { pos: [0, 2.2, -1.8], size: [2.2, 2, 2.4] });
      g.box('#a8d8ff', { pos: [0, 2.6, -0.6], size: [1.8, 0.7, 0.08] });
      g.box('#3a3a3a', { pos: [0, 3.3, -1.8], size: [2.4, 0.2, 2.6] });
      g.cylinder('#5a4a3a', { top: 0.12, bottom: 0.16, height: 5, tess: 5 }, { pos: [0, 3.5, 1.4] });
      g.box('#5a4a3a', { pos: [0, 4.6, 1.4], size: [2.8, 0.12, 0.12] });
      shape = { length: 8.5, width: 3.2, seat: [0, 1.25, 1.2] };
      break;
    }
    case 'batiskaf': {
      g.sphere(c, { segments: 5, diameter: 1 }, { pos: [0, 0.4, 0], scale: [2.6, 2.2, 5] }, 0.02);
      g.sphere('#1a3a5a', { segments: 4, diameter: 1 }, { pos: [0, 0.6, 2.1], scale: [1.4, 1.1, 1] });
      g.box('#3a3a3a', { pos: [0, 0.4, -2.6], size: [0.15, 1.8, 0.8] });
      g.box('#3a3a3a', { pos: [0, 0.4, -2.6], size: [2.2, 0.15, 0.8] });
      g.cylinder('#3a3a3a', { top: 0.6, bottom: 0.6, height: 0.5, tess: 8 }, { pos: [0, 0.4, -2.9], rot: [Math.PI / 2, 0, 0] });
      g.box(c, { pos: [0, 1.6, -0.4], size: [1, 0.6, 1.6] });
      g.cylinder('#5a5a5a', { top: 0.1, bottom: 0.1, height: 1.2, tess: 5 }, { pos: [0.3, 2.3, -0.2] });
      g.box('#5a5a5a', { pos: [0.3, 2.9, 0], size: [0.18, 0.18, 0.5] });
      for (const s of [-1, 1]) g.sphere('#ffffff', { segments: 3, diameter: 0.3 }, { pos: [s * 0.9, 0.2, 2.3] });
      shape = { length: 5, width: 2.6, seat: [0, 1.85, -0.5] };
      break;
    }
    default: {
      // Kayık
      buildHull(g, c, 1.1, 0.55, 4.4, 0.15);
      g.box('#8a5a32', { pos: [0, 0.35, -0.6], size: [1.0, 0.1, 0.5] });
      g.cylinder('#6a4a2a', { top: 0.06, bottom: 0.06, height: 2.4, tess: 4 }, { pos: [0.45, 0.5, -0.4], rot: [0.3, 0, 1.2] });
      g.box('#6a4a2a', { pos: [1.5, 0.05, -0.1], size: [0.35, 0.05, 0.6], rot: [0.3, 0, 1.2] });
      shape = { length: 4.4, width: 1.1, seat: [0, 0.45, -0.6] };
    }
  }
  return { mesh: g.build(`boat-${def.id}`, scene), shape };
}

/** Sürülebilir tekne: basit sürtünmeli fizik, kara çarpışması, sallanma ve köpük izi. */
export class Boat {
  readonly root: TransformNode;
  readonly mesh: Mesh;
  readonly shape: BoatShape;
  private seat: TransformNode;
  private sternEmitter: Mesh;
  private wake: ParticleSystem;
  x: number;
  z: number;
  heading: number;
  speed = 0;
  private t = Math.random() * 10;
  private roll = 0;

  constructor(
    scene: Scene,
    mats: Materials,
    effects: Effects,
    readonly def: BoatDef,
    x: number,
    z: number,
    heading: number,
  ) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.root = new TransformNode(`boatRoot-${def.id}`, scene);
    const built = buildBoatMesh(def, scene);
    this.mesh = built.mesh;
    this.shape = built.shape;
    this.mesh.material = def.id === 'kayik' ? mats.wood : mats.wall;
    this.mesh.parent = this.root;
    this.seat = new TransformNode('seat', scene);
    this.seat.parent = this.root;
    this.seat.position.set(...this.shape.seat);
    this.sternEmitter = CreateBox('stern', { size: 0.1 }, scene);
    this.sternEmitter.isVisible = false;
    this.sternEmitter.parent = this.root;
    this.sternEmitter.position.set(0, 0, -this.shape.length / 2);
    this.wake = effects.wake(this.sternEmitter);
    this.applyTransform();
  }

  seatWorld(): Vector3 {
    this.root.computeWorldMatrix(true);
    this.seat.computeWorldMatrix(true);
    return this.seat.getAbsolutePosition().clone();
  }

  get position(): Vector3 {
    return new Vector3(this.x, 0, this.z);
  }

  forward(): { x: number; z: number } {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  private blockedAt(x: number, z: number): boolean {
    const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    const r = { x: f.z, z: -f.x };
    const L = this.shape.length / 2;
    const W = this.shape.width / 2;
    const pts = [
      [x + f.x * L, z + f.z * L],
      [x - f.x * L, z - f.z * L],
      [x + r.x * W, z + r.z * W],
      [x - r.x * W, z - r.z * W],
      [x, z],
    ];
    for (const [px, pz] of pts) {
      if (terrainHeight(px, pz) > -0.9) return true;
      if (platformAt(px, pz, 0.3)) return true;
    }
    return Math.hypot(x, z) > WORLD_LIMIT;
  }

  /** throttle, steer: -1..1 */
  update(dt: number, throttle: number, steer: number, driven: boolean): void {
    this.t += dt;
    const d = this.def;
    if (driven) {
      const target = throttle * d.maxSpeed * (throttle < 0 ? 0.4 : 1);
      const a = Math.abs(target) > Math.abs(this.speed) ? d.accel : d.accel * 1.4;
      this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), a * dt);
      const turnFactor = Math.min(1, Math.abs(this.speed) / 4 + 0.25) * (this.speed < -0.1 ? -1 : 1);
      this.heading += steer * d.turnRate * dt * turnFactor;
    } else {
      this.speed *= Math.exp(-dt * 1.2);
    }
    const f = this.forward();
    const nx = this.x + f.x * this.speed * dt;
    const nz = this.z + f.z * this.speed * dt;
    // Zaten bir engelin içindeyse (ör. kıyıya sıkıştıysa) kurtulabilmesi için harekete izin ver
    const stuck = this.blockedAt(this.x, this.z);
    if (!stuck && this.blockedAt(nx, nz)) {
      this.speed = -this.speed * 0.25;
    } else {
      this.x = nx;
      this.z = nz;
    }
    this.roll += (steer * Math.min(1, Math.abs(this.speed) / d.maxSpeed) * 0.12 - this.roll) * Math.min(1, dt * 3);
    this.wake.emitRate = Math.abs(this.speed) > 1 ? Math.abs(this.speed) * 12 : 0;
    this.applyTransform();
  }

  private applyTransform(): void {
    const bob = Math.sin(this.t * 1.6) * 0.07;
    this.root.position.set(this.x, bob + (this.def.id === 'batiskaf' ? -0.3 : 0), this.z);
    this.root.rotation.y = this.heading;
    this.root.rotation.z = this.roll + Math.sin(this.t * 1.1) * 0.025;
    this.root.rotation.x = -Math.min(0.08, Math.abs(this.speed) / this.def.maxSpeed * 0.06) + Math.sin(this.t * 1.3) * 0.015;
  }

  dispose(): void {
    this.wake.stop();
    this.wake.dispose();
    this.root.dispose();
  }
}
