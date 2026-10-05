import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Materials } from './materials';

export interface CharacterColors {
  shirt: string;
  pants: string;
  skin: string;
  hat?: string;
}

/** Roblox benzeri blok karakter: kalça/omuz pivotları ile basit animasyon. */
export class Character {
  readonly root: TransformNode;
  readonly body: TransformNode;
  readonly armL: TransformNode;
  readonly armR: TransformNode;
  readonly legL: TransformNode;
  readonly legR: TransformNode;
  readonly head: Mesh;
  readonly hand: TransformNode;
  readonly meshes: Mesh[] = [];
  private phase = 0;

  constructor(scene: Scene, mats: Materials, name: string, colors: CharacterColors) {
    const S = 0.8;
    this.root = new TransformNode(`${name}-root`, scene);
    this.body = new TransformNode(`${name}-body`, scene);
    this.body.parent = this.root;
    this.body.scaling.setAll(S);

    const skin = mats.solid(colors.skin);
    const shirt = mats.solid(colors.shirt);
    const pants = mats.solid(colors.pants);

    const torso = CreateBox(`${name}-torso`, { width: 1, height: 1, depth: 0.5 }, scene);
    torso.material = shirt;
    torso.position.y = 1.5;
    torso.parent = this.body;

    this.head = CreateBox(`${name}-head`, { width: 0.62, height: 0.62, depth: 0.62 }, scene);
    this.head.material = skin;
    this.head.position.y = 2.33;
    this.head.parent = this.body;
    // Yüz: gözler
    const eyeMat = mats.solid('#1a1a1a');
    for (const sx of [-0.13, 0.13]) {
      const eye = CreateBox(`${name}-eye`, { width: 0.08, height: 0.12, depth: 0.02 }, scene);
      eye.material = eyeMat;
      eye.position.set(sx, 0.06, 0.315);
      eye.parent = this.head;
      this.meshes.push(eye);
    }
    const mouth = CreateBox(`${name}-mouth`, { width: 0.22, height: 0.04, depth: 0.02 }, scene);
    mouth.material = eyeMat;
    mouth.position.set(0, -0.12, 0.315);
    mouth.parent = this.head;
    this.meshes.push(mouth);

    if (colors.hat) {
      const hatMat = mats.solid(colors.hat);
      const brim = CreateCylinder(`${name}-brim`, { diameter: 0.95, height: 0.06, tessellation: 10 }, scene);
      brim.material = hatMat;
      brim.position.y = 0.33;
      brim.parent = this.head;
      const crown = CreateCylinder(`${name}-crown`, { diameterTop: 0.52, diameterBottom: 0.62, height: 0.3, tessellation: 10 }, scene);
      crown.material = hatMat;
      crown.position.y = 0.5;
      crown.parent = this.head;
      this.meshes.push(brim, crown);
    }

    const makeLimb = (limbName: string, mat: typeof skin, x: number, y: number, w: number, h: number, sleeve?: typeof skin) => {
      const pivot = new TransformNode(`${name}-${limbName}`, scene);
      pivot.parent = this.body;
      pivot.position.set(x, y, 0);
      const m = CreateBox(`${name}-${limbName}-m`, { width: w, height: h, depth: 0.45 }, scene);
      m.material = mat;
      m.position.y = -h / 2;
      m.parent = pivot;
      this.meshes.push(m);
      if (sleeve) {
        const sl = CreateBox(`${name}-${limbName}-s`, { width: w + 0.02, height: h * 0.4, depth: 0.47 }, scene);
        sl.material = sleeve;
        sl.position.y = -h * 0.2;
        sl.parent = pivot;
        this.meshes.push(sl);
      }
      return pivot;
    };
    this.armL = makeLimb('armL', skin, -0.73, 1.95, 0.45, 0.95, shirt);
    this.armR = makeLimb('armR', skin, 0.73, 1.95, 0.45, 0.95, shirt);
    this.legL = makeLimb('legL', pants, -0.25, 1.0, 0.48, 1.0);
    this.legR = makeLimb('legR', pants, 0.25, 1.0, 0.48, 1.0);

    this.hand = new TransformNode(`${name}-hand`, scene);
    this.hand.parent = this.armR;
    this.hand.position.set(0, -0.9, 0.05);

    this.meshes.push(torso, this.head);
  }

  /** Yürüme/yüzme/boşta animasyonu. speed: 0..1 normalize hız. */
  animate(dt: number, speed: number, mode: 'idle' | 'walk' | 'swim' | 'sit', armOverrideR?: number): void {
    this.phase += dt * (mode === 'swim' ? 4 : 2 + speed * 8);
    const s = Math.sin(this.phase);
    let legSwing = 0;
    let armSwing = 0;
    let bob = 0;
    if (mode === 'walk') {
      legSwing = s * 0.8 * Math.min(1, speed);
      armSwing = -s * 0.7 * Math.min(1, speed);
      bob = Math.abs(Math.cos(this.phase)) * 0.08 * speed;
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
    } else if (mode === 'swim') {
      legSwing = s * 0.5;
      this.armL.rotation.x = -Math.PI * 0.6 + Math.sin(this.phase) * 1.2;
      this.armR.rotation.x = armOverrideR ?? -Math.PI * 0.6 - Math.sin(this.phase) * 1.2;
      this.legL.rotation.x = legSwing;
      this.legR.rotation.x = -legSwing;
      this.body.position.y = 0;
      return;
    } else if (mode === 'sit') {
      this.legL.rotation.x = -Math.PI / 2;
      this.legR.rotation.x = -Math.PI / 2;
      this.armL.rotation.x = -0.6;
      this.armR.rotation.x = armOverrideR ?? -0.6;
      this.body.position.y = -0.55;
      return;
    } else {
      armSwing = Math.sin(this.phase * 0.5) * 0.04;
      bob = Math.sin(this.phase * 0.5) * 0.015;
    }
    this.legL.rotation.x = legSwing;
    this.legR.rotation.x = -legSwing;
    this.armL.rotation.x = armSwing;
    this.armR.rotation.x = armOverrideR ?? -armSwing;
    this.body.position.y = bob;
  }

  setEnabled(v: boolean): void {
    this.root.setEnabled(v);
  }
}
