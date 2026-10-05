import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { HatStyle } from '../core/data/world';
import { GeometryBuilder, hex, mixColor } from './geometry';
import type { Materials } from './materials';

export interface CharacterColors {
  shirt: string;
  pants: string;
  skin: string;
  hair?: string;
  hat?: string;
  hatStyle?: HatStyle;
  beard?: boolean;
  boots?: string;
  vest?: string;
}

/**
 * Orantılı, yumuşak hatlı insan modeli: kapsül uzuvlar, eklemli diz/dirsek,
 * saç, yüz, şapka ve isteğe bağlı sakal. Her eklem tek bir köşe renkli mesh'tir.
 */
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
  private readonly elbowL: TransformNode;
  private readonly elbowR: TransformNode;
  private readonly kneeL: TransformNode;
  private readonly kneeR: TransformNode;
  private readonly torso: TransformNode;
  private phase = Math.random() * 10;

  constructor(scene: Scene, mats: Materials, name: string, c: CharacterColors) {
    const skin = hex(c.skin);
    const shirt = hex(c.shirt);
    const pants = hex(c.pants);
    const hair = hex(c.hair ?? '#3a2a1a');
    const boots = hex(c.boots ?? '#3a2a1e');
    const vest = c.vest ? hex(c.vest) : mixColor(c.shirt, '#000000', 0.25);

    this.root = new TransformNode(`${name}-root`, scene);
    this.body = new TransformNode(`${name}-body`, scene);
    this.body.parent = this.root;

    const part = (partName: string, parent: TransformNode, build: (g: GeometryBuilder) => void): Mesh => {
      const g = new GeometryBuilder({ smooth: true });
      build(g);
      const m = g.build(`${name}-${partName}`, scene);
      m.material = mats.character;
      m.parent = parent;
      m.isPickable = false;
      this.meshes.push(m);
      return m;
    };
    const node = (n: string, parent: TransformNode, x: number, y: number, z: number) => {
      const t = new TransformNode(`${name}-${n}`, scene);
      t.parent = parent;
      t.position.set(x, y, z);
      return t;
    };

    // Kalça ve gövde
    const hips = node('hips', this.body, 0, 0.95, 0);
    part('pelvis', hips, (g) => {
      g.sphere(pants, { segments: 10, diameter: 1 }, { pos: [0, 0.02, 0], scale: [0.34, 0.24, 0.22] });
      g.cylinder(hex('#3a2a1a'), { top: 0.33, bottom: 0.33, height: 0.06, tess: 16 }, { pos: [0, 0.11, 0], scale: [1, 1, 0.7] });
      g.box(hex('#c8a040'), { pos: [0, 0.11, 0.115], size: [0.06, 0.05, 0.02] });
    });
    this.torso = node('torso', hips, 0, 0.1, 0);
    part('chest', this.torso, (g) => {
      // Gövde: göğüs omuzlarda geniş, belde dar
      g.capsule(shirt, { radius: 0.18, height: 0.62, tess: 14 }, { pos: [0, 0.28, 0], scale: [1.12, 1, 0.68] });
      // Balıkçı yeleği
      g.capsule(vest, { radius: 0.185, height: 0.5, tess: 14 }, { pos: [0, 0.24, -0.005], scale: [1.14, 1, 0.7] });
      g.box(shirt, { pos: [0, 0.3, 0.115], size: [0.12, 0.42, 0.04] });
      for (const sx of [-0.1, 0.1]) g.box(mixColor(c.shirt, '#000000', 0.35), { pos: [sx, 0.2, 0.13], size: [0.09, 0.08, 0.03] });
      // Boyun
      g.cylinder(skin, { top: 0.1, bottom: 0.11, height: 0.12, tess: 10 }, { pos: [0, 0.62, 0] });
    });
    // Baş
    const headNode = node('headNode', this.torso, 0, 0.8, 0.01);
    this.head = part('head', headNode, (g) => {
      g.sphere(skin, { segments: 14, diameter: 1 }, { scale: [0.215, 0.255, 0.235] });
      // Kulaklar ve burun
      for (const s of [-1, 1]) g.sphere(skin.scale(0.95), { segments: 6, diameter: 1 }, { pos: [s * 0.108, 0, -0.005], scale: [0.03, 0.06, 0.045] });
      g.sphere(skin.scale(0.96), { segments: 6, diameter: 1 }, { pos: [0, -0.012, 0.118], scale: [0.04, 0.05, 0.05] });
      // Gözler: beyaz, iris, kaş
      for (const s of [-1, 1]) {
        g.sphere(hex('#f4f4f4'), { segments: 6, diameter: 1 }, { pos: [s * 0.045, 0.025, 0.1], scale: [0.04, 0.028, 0.02] });
        g.sphere(hex('#2a1e14'), { segments: 6, diameter: 1 }, { pos: [s * 0.045, 0.025, 0.11], scale: [0.02, 0.022, 0.01] });
        g.box(hair.scale(0.8), { pos: [s * 0.047, 0.062, 0.105], size: [0.05, 0.012, 0.012], rot: [0, 0, s * -0.12] });
      }
      g.box(hex('#a85a4a'), { pos: [0, -0.06, 0.108], size: [0.045, 0.01, 0.01] });
      // Saç
      g.sphere(hair, { segments: 12, diameter: 1, slice: 0.55 }, { pos: [0, 0.018, -0.012], rot: [-0.35, 0, 0], scale: [0.232, 0.27, 0.25] });
      if (c.beard) {
        g.sphere(hair, { segments: 10, diameter: 1, slice: 0.5 }, { pos: [0, -0.04, 0.03], rot: [Math.PI + 0.25, 0, 0], scale: [0.205, 0.2, 0.2] });
      }
      this.buildHat(g, c);
    });

    // Kollar (omuz → dirsek → el)
    const arm = (side: number, label: string) => {
      const shoulder = node(`shoulder${label}`, this.torso, side * 0.235, 0.55, 0);
      part(`upper${label}`, shoulder, (g) => {
        g.sphere(shirt, { segments: 8, diameter: 0.15 }, { pos: [0, 0, 0] });
        g.capsule(shirt, { radius: 0.062, height: 0.33, tess: 10 }, { pos: [0, -0.15, 0] });
      });
      const elbow = node(`elbow${label}`, shoulder, 0, -0.3, 0);
      part(`fore${label}`, elbow, (g) => {
        g.capsule(skin, { radius: 0.052, height: 0.3, tess: 10 }, { pos: [0, -0.13, 0] });
        g.capsule(shirt, { radius: 0.058, height: 0.12, tess: 10 }, { pos: [0, -0.02, 0] });
        g.sphere(skin, { segments: 8, diameter: 1 }, { pos: [0, -0.31, 0.01], scale: [0.075, 0.1, 0.06] });
      });
      return { shoulder, elbow };
    };
    const left = arm(-1, 'L');
    const right = arm(1, 'R');
    this.armL = left.shoulder;
    this.armR = right.shoulder;
    this.elbowL = left.elbow;
    this.elbowR = right.elbow;
    this.hand = node('hand', this.elbowR, 0, -0.31, 0.03);

    // Bacaklar (kalça → diz → bot)
    const leg = (side: number, label: string) => {
      const hip = node(`hip${label}`, hips, side * 0.1, 0, 0);
      part(`thigh${label}`, hip, (g) => g.capsule(pants, { radius: 0.082, height: 0.5, tess: 10 }, { pos: [0, -0.23, 0] }));
      const knee = node(`knee${label}`, hip, 0, -0.46, 0);
      part(`shin${label}`, knee, (g) => {
        g.capsule(pants, { radius: 0.068, height: 0.45, tess: 10 }, { pos: [0, -0.2, 0] });
        g.capsule(boots, { radius: 0.072, height: 0.22, tess: 10 }, { pos: [0, -0.35, 0] });
        g.sphere(boots, { segments: 8, diameter: 1 }, { pos: [0, -0.45, 0.05], scale: [0.13, 0.09, 0.26] });
      });
      return { hip, knee };
    };
    const l = leg(-1, 'L');
    const r = leg(1, 'R');
    this.legL = l.hip;
    this.legR = r.hip;
    this.kneeL = l.knee;
    this.kneeR = r.knee;
  }

  private buildHat(g: GeometryBuilder, c: CharacterColors): void {
    const style = c.hatStyle ?? (c.hat ? 'cap' : 'none');
    if (style === 'none') return;
    const hat = hex(c.hat ?? '#3a3a3a');
    const band = mixColor(hat, '#000000', 0.35);
    switch (style) {
      case 'cap':
        g.sphere(hat, { segments: 12, diameter: 1, slice: 0.5 }, { pos: [0, 0.06, -0.005], scale: [0.245, 0.2, 0.26] });
        g.cylinder(hat, { top: 0.2, bottom: 0.2, height: 0.012, tess: 16 }, { pos: [0, 0.065, 0.13], scale: [1, 1, 0.8] });
        break;
      case 'bucket':
        g.cylinder(hat, { top: 0.36, bottom: 0.44, height: 0.15, tess: 18 }, { pos: [0, 0.14, 0] });
        g.cylinder(hat, { top: 0.6, bottom: 0.66, height: 0.02, tess: 20 }, { pos: [0, 0.065, 0] });
        g.cylinder(band, { top: 0.445, bottom: 0.445, height: 0.03, tess: 18 }, { pos: [0, 0.085, 0] });
        break;
      case 'beanie':
        g.sphere(hat, { segments: 12, diameter: 1, slice: 0.5 }, { pos: [0, 0.035, 0], scale: [0.248, 0.29, 0.26] });
        g.cylinder(band, { top: 0.5, bottom: 0.5, height: 0.06, tess: 18 }, { pos: [0, 0.045, 0], scale: [1, 1, 1.04] });
        g.sphere(band, { segments: 6, diameter: 0.07 }, { pos: [0, 0.2, 0] });
        break;
      case 'captain':
        g.cylinder(hat, { top: 0.5, bottom: 0.46, height: 0.11, tess: 18 }, { pos: [0, 0.15, 0], scale: [1, 1, 1.05] });
        g.cylinder(hex('#f4f4f4'), { top: 0.47, bottom: 0.47, height: 0.04, tess: 18 }, { pos: [0, 0.2, 0] });
        g.cylinder(hex('#1a1a1a'), { top: 0.24, bottom: 0.24, height: 0.012, tess: 16 }, { pos: [0, 0.095, 0.12], scale: [1, 1, 0.6] });
        g.box(hex('#d8b84a'), { pos: [0, 0.16, 0.235], size: [0.06, 0.04, 0.01] });
        break;
      case 'straw':
        g.cylinder(hat, { top: 0.3, bottom: 0.4, height: 0.12, tess: 18 }, { pos: [0, 0.13, 0] });
        g.cylinder(hat, { top: 0.78, bottom: 0.82, height: 0.02, tess: 22 }, { pos: [0, 0.07, 0] });
        g.cylinder(hex('#a83a2a'), { top: 0.405, bottom: 0.405, height: 0.035, tess: 18 }, { pos: [0, 0.09, 0] });
        break;
    }
  }

  /** Yürüme/yüzme/oturma/boşta animasyonu. speed: 0..1 normalize hız. */
  animate(dt: number, speed: number, mode: 'idle' | 'walk' | 'swim' | 'sit', armOverrideR?: number): void {
    this.phase += dt * (mode === 'swim' ? 3.5 : mode === 'walk' ? 3 + speed * 6.5 : 1.6);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    this.body.rotation.x = 0;
    this.torso.rotation.set(0, 0, 0);
    if (mode === 'walk') {
      const k = Math.min(1.2, speed);
      this.legL.rotation.x = s * 0.62 * k;
      this.legR.rotation.x = -s * 0.62 * k;
      this.kneeL.rotation.x = Math.max(0, c) * 0.9 * k;
      this.kneeR.rotation.x = Math.max(0, -c) * 0.9 * k;
      this.armL.rotation.x = -s * 0.5 * k;
      this.armL.rotation.z = -0.08;
      this.armR.rotation.z = 0.08;
      this.elbowL.rotation.x = -0.35 - Math.max(0, -s) * 0.4 * k;
      this.elbowR.rotation.x = -0.35 - Math.max(0, s) * 0.4 * k;
      this.armR.rotation.x = armOverrideR ?? s * 0.5 * k;
      this.torso.rotation.y = s * 0.08 * k;
      this.torso.rotation.x = 0.05 * k;
      this.body.position.y = Math.abs(c) * 0.05 * k - 0.02 * k;
      return;
    }
    if (mode === 'swim') {
      // Gövde öne yatık, serbest stil kulaç ve çırpma
      this.body.rotation.x = 1.15;
      this.body.position.y = 0.55;
      this.armL.rotation.x = -Math.PI * 0.5 + s * 1.5;
      this.armR.rotation.x = armOverrideR ?? -Math.PI * 0.5 - s * 1.5;
      this.armL.rotation.z = -0.2;
      this.armR.rotation.z = 0.2;
      this.elbowL.rotation.x = -0.3;
      this.elbowR.rotation.x = -0.3;
      this.legL.rotation.x = Math.sin(this.phase * 2.2) * 0.35;
      this.legR.rotation.x = -Math.sin(this.phase * 2.2) * 0.35;
      this.kneeL.rotation.x = 0.2;
      this.kneeR.rotation.x = 0.2;
      return;
    }
    if (mode === 'sit') {
      this.legL.rotation.x = -1.45;
      this.legR.rotation.x = -1.45;
      this.kneeL.rotation.x = 1.4;
      this.kneeR.rotation.x = 1.4;
      this.armL.rotation.x = -0.5;
      this.armL.rotation.z = -0.1;
      this.elbowL.rotation.x = -0.6;
      this.armR.rotation.x = armOverrideR ?? -0.5;
      this.armR.rotation.z = 0.05;
      this.elbowR.rotation.x = armOverrideR !== undefined ? -0.15 : -0.6;
      this.body.position.y = -0.48;
      return;
    }
    // Boşta: hafif nefes ve ağırlık aktarma
    this.legL.rotation.x = 0;
    this.legR.rotation.x = 0;
    this.kneeL.rotation.x = 0.03;
    this.kneeR.rotation.x = 0.03;
    this.armL.rotation.x = s * 0.03;
    this.armL.rotation.z = -0.1;
    this.armR.rotation.z = armOverrideR !== undefined ? 0.05 : 0.1;
    this.elbowL.rotation.x = -0.15;
    this.elbowR.rotation.x = armOverrideR !== undefined ? -0.15 : -0.15;
    this.armR.rotation.x = armOverrideR ?? -s * 0.03;
    this.torso.rotation.x = s * 0.015;
    this.body.position.y = s * 0.006;
  }

  setEnabled(v: boolean): void {
    this.root.setEnabled(v);
  }
}

