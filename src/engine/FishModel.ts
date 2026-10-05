import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { RARITIES } from '../core/data/rarities';
import type { FishDef, VariantId } from '../core/types';
import { GeometryBuilder, hex, type ColorLike } from './geometry';
import type { Materials } from './materials';

export interface FishModel {
  root: TransformNode;
  mesh: Mesh;
  update(dt: number): void;
  dispose(): void;
}

/** Varyanta göre renk dönüşümü. */
function variantColor(c: ColorLike, variant: VariantId): Color3 {
  const col = hex(c);
  switch (variant) {
    case 'shiny':
      return Color3.Lerp(col, new Color3(0.95, 0.97, 1), 0.55);
    case 'albino':
      return Color3.Lerp(col, new Color3(1, 0.93, 0.95), 0.85);
    case 'golden':
      return Color3.Lerp(col, new Color3(1, 0.8, 0.2), 0.8);
    case 'ghastly':
      return Color3.Lerp(col, new Color3(0.6, 0.9, 1), 0.6);
    case 'celestial':
      return Color3.Lerp(col, new Color3(0.25, 0.15, 0.55), 0.65);
    case 'nuclear':
      return Color3.Lerp(col, new Color3(0.35, 1, 0.2), 0.6);
    case 'sunken':
      return Color3.Lerp(col, new Color3(0.25, 0.5, 0.45), 0.6).scale(0.85);
    case 'prismize':
      return Color3.Lerp(col, new Color3(1, 1, 1), 0.4);
    default:
      return col;
  }
}

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * Düşük poligonlu prosedürel balık modeli. Yaklaşık 1.6 birim uzunluğunda, +x yönüne bakar.
 */
export function buildFishModel(scene: Scene, mats: Materials, fish: FishDef, variant: VariantId, renderingGroupId = 0): FishModel {
  const g = new GeometryBuilder();
  const C = (c: ColorLike | undefined, fallback: ColorLike) => variantColor(c ?? fallback, variant);
  const body = C(fish.colors.body, '#888888');
  const fin = C(fish.colors.fin, fish.colors.body);
  const belly = C(fish.colors.belly, fish.colors.body);
  const accent = C(fish.colors.accent, fish.colors.fin);
  const eyeWhite = variant === 'albino' ? new Color3(1, 0.6, 0.6) : new Color3(0.97, 0.97, 0.97);
  const pupil = variant === 'albino' ? new Color3(0.8, 0.1, 0.15) : new Color3(0.05, 0.05, 0.08);
  const bodyGrad = (top: Color3, bottom: Color3) => (_x: number, y: number) => (y < -0.02 ? bottom : top);

  const eyes = (x: number, y: number, z: number, size = 0.11) => {
    for (const s of [-1, 1]) {
      g.sphere(eyeWhite, { segments: 3, diameter: size }, { pos: [x, y, z * s] });
      g.sphere(pupil, { segments: 2, diameter: size * 0.55 }, { pos: [x + size * 0.18, y, (z + size * 0.32) * s] });
    }
  };
  const tailFork = (x: number, h: number, col: Color3) => {
    g.doubleTriangle(V(x + 0.12, 0, 0), V(x - h * 0.9, h, 0), V(x - h * 0.5, 0.02, 0), col);
    g.doubleTriangle(V(x + 0.12, 0, 0), V(x - h * 0.5, -0.02, 0), V(x - h * 0.9, -h, 0), col);
  };
  const dorsal = (x0: number, x1: number, y: number, h: number, col: Color3) => {
    g.doubleTriangle(V(x0, y, 0), V(x1, y, 0), V((x0 + x1) / 2 - 0.08, y + h, 0), col);
  };
  const pectoral = (x: number, y: number, z: number, col: Color3, size = 0.2) => {
    for (const s of [-1, 1]) g.doubleTriangle(V(x, y, z * s), V(x - size, y - size * 0.4, (z + size * 0.6) * s), V(x - size * 0.7, y + size * 0.15, (z + size * 0.2) * s), col);
  };

  switch (fish.shape) {
    case 'standard':
    case 'sword': {
      g.sphere(bodyGrad(body, belly), { segments: 4, diameter: 1 }, { scale: [1.15, 0.46, 0.28] });
      // yanal çizgi (aksan rengi)
      g.sphere(accent, { segments: 4, diameter: 1 }, { pos: [-0.02, 0.03, 0], scale: [0.95, 0.07, 0.292] });
      tailFork(-0.5, 0.3, fin);
      dorsal(0.25, -0.25, 0.18, 0.24, fin);
      g.doubleTriangle(V(-0.05, -0.18, 0), V(-0.35, -0.15, 0), V(-0.25, -0.33, 0), fin);
      pectoral(0.2, -0.05, 0.13, fin);
      eyes(0.42, 0.06, 0.1);
      if (fish.shape === 'sword') g.cylinder(accent, { top: 0.01, bottom: 0.07, height: 0.75, tess: 4 }, { pos: [0.92, 0.02, 0], rot: [0, 0, -Math.PI / 2] });
      break;
    }
    case 'long': {
      g.sphere(bodyGrad(body, belly), { segments: 4, diameter: 1 }, { scale: [1.6, 0.3, 0.22] });
      tailFork(-0.75, 0.22, fin);
      dorsal(-0.1, -0.55, 0.12, 0.16, fin);
      pectoral(0.4, -0.04, 0.1, fin, 0.16);
      eyes(0.62, 0.05, 0.075, 0.09);
      g.sphere(accent, { segments: 4, diameter: 1 }, { pos: [0, 0.02, 0], scale: [1.35, 0.05, 0.222] });
      break;
    }
    case 'round':
    case 'puffer': {
      const scale: [number, number, number] = fish.shape === 'puffer' ? [0.9, 0.85, 0.8] : [0.95, 0.75, 0.3];
      g.sphere(bodyGrad(body, belly), { segments: 4, diameter: 1 }, { scale });
      tailFork(-0.42, 0.25, fin);
      dorsal(0.25, -0.35, scale[1] * 0.45, 0.25, fin);
      g.doubleTriangle(V(0.15, -scale[1] * 0.45, 0), V(-0.35, -scale[1] * 0.4, 0), V(-0.15, -scale[1] * 0.45 - 0.25, 0), fin);
      eyes(0.3, 0.12, scale[2] * 0.42, 0.13);
      if (fish.shape === 'puffer') {
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const b = ((i * 7) % 18) / 18 * Math.PI - Math.PI / 2;
          const dir = V(Math.cos(a) * Math.cos(b) * 0.45, Math.sin(b) * 0.42, Math.sin(a) * Math.cos(b) * 0.4);
          g.cylinder(accent, { top: 0, bottom: 0.06, height: 0.16, tess: 3 }, {
            pos: [dir.x, dir.y, dir.z], rot: [Math.atan2(dir.z, dir.y), 0, -Math.atan2(dir.x, Math.hypot(dir.y, dir.z))],
          });
        }
      } else {
        // dikey şeritler
        g.box(accent, { pos: [0.12, 0, 0], size: [0.08, scale[1] * 0.9, scale[2] * 1.02] });
        g.box(accent, { pos: [-0.15, 0, 0], size: [0.07, scale[1] * 0.85, scale[2] * 0.98] });
      }
      break;
    }
    case 'flat': {
      g.sphere(body, { segments: 4, diameter: 1 }, { scale: [1.1, 0.16, 0.8] });
      g.sphere(belly, { segments: 3, diameter: 1 }, { pos: [0, -0.03, 0], scale: [1.05, 0.12, 0.76] });
      g.doubleTriangle(V(-0.5, 0, 0), V(-0.85, 0, 0.25), V(-0.85, 0, -0.25), fin);
      for (const s of [-1, 1]) g.doubleTriangle(V(0.35, 0, 0.38 * s), V(-0.4, 0, 0.36 * s), V(0, 0, 0.5 * s), fin);
      g.sphere(eyeWhite, { segments: 3, diameter: 0.1 }, { pos: [0.3, 0.09, 0.08] });
      g.sphere(eyeWhite, { segments: 3, diameter: 0.1 }, { pos: [0.33, 0.09, -0.06] });
      g.sphere(pupil, { segments: 2, diameter: 0.05 }, { pos: [0.32, 0.13, 0.08] });
      g.sphere(pupil, { segments: 2, diameter: 0.05 }, { pos: [0.35, 0.13, -0.06] });
      break;
    }
    case 'eel': {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = 0.75 - t * 1.6;
        const z = Math.sin(t * Math.PI * 1.6) * 0.12;
        const r = 0.24 * (1 - t * 0.55);
        g.sphere(bodyGrad(body, belly), { segments: 3, diameter: 1 }, { pos: [x, 0, z], scale: [r * 1.9, r, r * 0.85] });
        if (i > 0 && i < n - 1) dorsal(x + 0.12, x - 0.12, r * 0.45, 0.1, fin);
      }
      g.doubleTriangle(V(-0.8, 0, 0.05), V(-1.05, 0.14, 0.05), V(-1.05, -0.14, 0.05), fin);
      eyes(0.88, 0.05, 0.08, 0.08);
      break;
    }
    case 'shark': {
      g.sphere(bodyGrad(body, belly), { segments: 5, diameter: 1 }, { scale: [1.7, 0.44, 0.4] });
      g.doubleTriangle(V(0.15, 0.18, 0), V(-0.3, 0.18, 0), V(-0.15, 0.6, 0), fin);
      g.doubleTriangle(V(-0.78, 0, 0), V(-1.15, 0.5, 0), V(-0.95, 0.02, 0), fin);
      g.doubleTriangle(V(-0.78, 0, 0), V(-0.95, -0.02, 0), V(-1.05, -0.3, 0), fin);
      pectoral(0.2, -0.12, 0.17, fin, 0.38);
      eyes(0.6, 0.05, 0.13, 0.07);
      if (fish.id === 'cekic') g.box(body, { pos: [0.82, 0.02, 0], size: [0.14, 0.1, 0.62] });
      for (let i = 0; i < 4; i++) g.box(pupil, { pos: [0.4 - i * 0.05, 0.02, 0.18], size: [0.01, 0.12, 0.02] });
      break;
    }
    case 'squid': {
      g.cylinder(body, { top: 0.02, bottom: 0.42, height: 0.95, tess: 6 }, { pos: [-0.25, 0, 0], rot: [0, 0, Math.PI / 2] });
      g.sphere(belly, { segments: 3, diameter: 0.46 }, { pos: [0.28, 0, 0] });
      g.doubleTriangle(V(-0.65, 0, 0), V(-0.85, 0.22, 0), V(-0.55, 0.05, 0), fin);
      g.doubleTriangle(V(-0.65, 0, 0), V(-0.55, -0.05, 0), V(-0.85, -0.22, 0), fin);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const len = i < 2 ? 0.95 : 0.6;
        g.cylinder(i < 2 ? accent : body, { top: 0.015, bottom: 0.06, height: len, tess: 4 }, {
          pos: [0.45 + len / 2, Math.cos(a) * 0.12, Math.sin(a) * 0.12], rot: [0, 0, -Math.PI / 2 + Math.cos(a) * 0.25],
        });
      }
      eyes(0.33, 0.12, 0.15, 0.12);
      break;
    }
    case 'jelly': {
      g.sphere(body, { segments: 5, diameter: 1 }, { pos: [0, 0.25, 0], scale: [0.9, 0.6, 0.9] });
      g.cylinder(belly, { top: 0.82, bottom: 0.9, height: 0.08, tess: 10 }, { pos: [0, 0.0, 0] });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = i % 2 ? 0.32 : 0.18;
        g.cylinder(i % 2 ? fin : accent, { top: 0.04, bottom: 0.01, height: 0.9, tess: 3 }, {
          pos: [Math.cos(a) * r, -0.45, Math.sin(a) * r], rot: [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2],
        });
      }
      break;
    }
    case 'angler': {
      g.sphere(bodyGrad(body, belly), { segments: 4, diameter: 1 }, { scale: [0.95, 0.75, 0.6] });
      g.box('#e8e8e8', { pos: [0.42, -0.1, 0], size: [0.04, 0.05, 0.35] });
      for (let i = -3; i <= 3; i++) g.cylinder('#f4f4f4', { top: 0, bottom: 0.05, height: 0.14, tess: 3 }, { pos: [0.44, -0.04, i * 0.06], rot: [Math.PI, 0, 0] });
      tailFork(-0.45, 0.25, fin);
      g.cylinder(fin, { top: 0.02, bottom: 0.03, height: 0.6, tess: 3 }, { pos: [0.3, 0.55, 0], rot: [0, 0, -0.7] });
      g.sphere(C(fish.colors.glow, '#c8ff6a'), { segments: 3, diameter: 0.18 }, { pos: [0.55, 0.78, 0] });
      eyes(0.32, 0.18, 0.24, 0.1);
      break;
    }
    case 'seahorse': {
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const y = 0.55 - t * 1.0;
        const x = Math.sin(t * Math.PI) * 0.15;
        g.sphere(body, { segments: 3, diameter: 0.28 * (1 - t * 0.6) + 0.06 }, { pos: [x, y, 0] });
      }
      g.sphere(body, { segments: 3, diameter: 0.3 }, { pos: [0.08, 0.66, 0] });
      g.cylinder(body, { top: 0.06, bottom: 0.09, height: 0.32, tess: 4 }, { pos: [0.3, 0.6, 0], rot: [0, 0, -Math.PI / 2 - 0.3] });
      g.doubleTriangle(V(-0.1, 0.35, 0), V(-0.28, 0.25, 0), V(-0.1, 0.05, 0), fin);
      g.sphere(body, { segments: 3, diameter: 0.14 }, { pos: [0.18, -0.55, 0] });
      eyes(0.15, 0.7, 0.1, 0.08);
      break;
    }
    case 'crab': {
      g.sphere(body, { segments: 4, diameter: 1 }, { scale: [0.75, 0.3, 0.95] });
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.cylinder(fin, { top: 0.03, bottom: 0.05, height: 0.55, tess: 4 }, { pos: [-0.15 + i * 0.13, -0.08, s * 0.55], rot: [s * 1.1, 0, 0] });
        }
        g.cylinder(body, { top: 0.06, bottom: 0.08, height: 0.4, tess: 4 }, { pos: [0.35, 0.02, s * 0.4], rot: [s * 0.6, 0, -1.1] });
        g.sphere(accent, { segments: 3, diameter: 0.28 }, { pos: [0.55, 0.08, s * 0.5], scale: [1.3, 0.8, 0.9] });
      }
      g.cylinder(body, { top: 0.03, bottom: 0.03, height: 0.16, tess: 3 }, { pos: [0.3, 0.2, 0.1] });
      g.cylinder(body, { top: 0.03, bottom: 0.03, height: 0.16, tess: 3 }, { pos: [0.3, 0.2, -0.1] });
      g.sphere(pupil, { segments: 2, diameter: 0.07 }, { pos: [0.3, 0.3, 0.1] });
      g.sphere(pupil, { segments: 2, diameter: 0.07 }, { pos: [0.3, 0.3, -0.1] });
      break;
    }
    case 'turtle': {
      g.sphere(body, { segments: 4, diameter: 1 }, { pos: [0, 0.05, 0], scale: [1.1, 0.45, 0.9] });
      g.cylinder(belly, { top: 0.98, bottom: 1.0, height: 0.08, tess: 8 }, { pos: [0, -0.1, 0], scale: [1.1, 1, 0.9] });
      for (let i = 0; i < 5; i++) g.box(accent, { pos: [-0.3 + i * 0.15, 0.27, 0], size: [0.1, 0.05, 0.4], rot: [0, i, 0] });
      g.sphere(fin, { segments: 3, diameter: 0.3 }, { pos: [0.65, 0.02, 0], scale: [1.3, 0.9, 0.9] });
      for (const s of [-1, 1]) {
        g.box(fin, { pos: [0.3, -0.08, s * 0.5], size: [0.35, 0.05, 0.35], rot: [0, s * 0.6, 0] });
        g.box(fin, { pos: [-0.35, -0.08, s * 0.42], size: [0.25, 0.05, 0.22], rot: [0, -s * 0.5, 0] });
      }
      eyes(0.76, 0.07, 0.1, 0.07);
      break;
    }
    case 'boot': {
      g.box(body, { pos: [0, 0.25, 0], size: [0.4, 0.75, 0.4] });
      g.box(body, { pos: [0.25, -0.05, 0], size: [0.85, 0.32, 0.42] });
      g.box(fin, { pos: [0.25, -0.24, 0], size: [0.9, 0.06, 0.45] });
      g.box(fin, { pos: [0, 0.6, 0], size: [0.44, 0.06, 0.44] });
      break;
    }
    case 'can': {
      g.cylinder(body, { top: 0.4, bottom: 0.4, height: 0.75, tess: 10 }, { rot: [0, 0, 0.3] });
      g.cylinder(fin, { top: 0.41, bottom: 0.41, height: 0.35, tess: 10 }, { rot: [0, 0, 0.3] });
      break;
    }
    case 'weed': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.cylinder(i % 2 ? body : fin, { top: 0.02, bottom: 0.08, height: 1.0, tess: 3 }, {
          pos: [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], rot: [Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45], scale: [1.6, 1, 0.4],
        });
      }
      break;
    }
    case 'bottle': {
      g.cylinder(body, { top: 0.32, bottom: 0.34, height: 0.7, tess: 8 }, { rot: [0, 0, Math.PI / 2] });
      g.cylinder(body, { top: 0.12, bottom: 0.3, height: 0.2, tess: 8 }, { pos: [0.45, 0, 0], rot: [0, 0, -Math.PI / 2] });
      g.cylinder(body, { top: 0.12, bottom: 0.12, height: 0.18, tess: 8 }, { pos: [0.62, 0, 0], rot: [0, 0, -Math.PI / 2] });
      g.cylinder('#a8743a', { top: 0.1, bottom: 0.12, height: 0.12, tess: 6 }, { pos: [0.75, 0, 0], rot: [0, 0, -Math.PI / 2] });
      g.cylinder(fin, { top: 0.18, bottom: 0.18, height: 0.45, tess: 6 }, { rot: [0, 0, Math.PI / 2] });
      break;
    }
  }

  const mesh = g.build(`fish-${fish.id}`, scene);
  const mat = new StandardMaterial(`fishMat-${fish.id}`, scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = new Color3(0.25, 0.25, 0.25);
  mat.specularPower = 32;
  mat.backFaceCulling = false;
  mat.fogEnabled = false;
  const rarity = RARITIES[fish.rarity];
  const glow = fish.colors.glow ? hex(fish.colors.glow) : null;
  const baseEmissive = new Color3(0.26, 0.26, 0.26);
  if (glow && rarity.order >= 5) baseEmissive.addInPlace(glow.scale(0.22));
  switch (variant) {
    case 'shiny':
      mat.specularColor = new Color3(1, 1, 1);
      mat.specularPower = 12;
      baseEmissive.addInPlace(new Color3(0.35, 0.37, 0.42));
      break;
    case 'golden':
      mat.specularColor = new Color3(1, 0.85, 0.4);
      mat.specularPower = 10;
      baseEmissive.addInPlace(new Color3(0.3, 0.22, 0.02));
      break;
    case 'ghastly':
      mat.alpha = 0.55;
      baseEmissive.addInPlace(new Color3(0.2, 0.4, 0.5));
      break;
    case 'celestial':
      baseEmissive.addInPlace(new Color3(0.3, 0.2, 0.55));
      break;
    case 'nuclear':
      baseEmissive.addInPlace(new Color3(0.2, 0.75, 0.1));
      break;
    case 'sunken':
      baseEmissive.addInPlace(new Color3(0.05, 0.18, 0.15));
      break;
    default:
      break;
  }
  mat.emissiveColor = baseEmissive;
  mesh.material = mat;
  mesh.renderingGroupId = renderingGroupId;
  mesh.isPickable = false;

  const root = new TransformNode(`fishRoot-${fish.id}`, scene);
  mesh.parent = root;

  // Parçacıklar: Işıltılı, Göksel, Nükleer, Prizmatik
  let ps: ParticleSystem | null = null;
  const particleColor: Record<string, [Color4, Color4]> = {
    sparkling: [new Color4(1, 0.95, 0.5, 1), new Color4(1, 1, 1, 1)],
    celestial: [new Color4(0.7, 0.6, 1, 1), new Color4(1, 1, 1, 1)],
    nuclear: [new Color4(0.4, 1, 0.3, 1), new Color4(0.8, 1, 0.4, 1)],
    prismize: [new Color4(1, 0.4, 0.9, 1), new Color4(0.4, 0.9, 1, 1)],
    shiny: [new Color4(1, 1, 1, 0.8), new Color4(0.8, 0.9, 1, 0.8)],
    golden: [new Color4(1, 0.85, 0.3, 1), new Color4(1, 1, 0.7, 1)],
  };
  if (particleColor[variant]) {
    ps = new ParticleSystem(`fishPs-${fish.id}`, 120, scene);
    ps.particleTexture = mats.flare;
    ps.emitter = mesh;
    ps.minEmitBox = new Vector3(-0.6, -0.3, -0.3);
    ps.maxEmitBox = new Vector3(0.6, 0.3, 0.3);
    ps.color1 = particleColor[variant][0];
    ps.color2 = particleColor[variant][1];
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.04;
    ps.maxSize = variant === 'shiny' ? 0.09 : 0.14;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.1;
    ps.emitRate = variant === 'shiny' ? 25 : 60;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0.3, 0);
    ps.direction1 = new Vector3(-0.2, 0.3, -0.2);
    ps.direction2 = new Vector3(0.2, 0.6, 0.2);
    ps.minEmitPower = 0.1;
    ps.maxEmitPower = 0.4;
    ps.renderingGroupId = mesh.renderingGroupId;
    ps.start();
  }

  let t = 0;
  return {
    root,
    mesh,
    update(dt: number) {
      t += dt;
      if (variant === 'prismize') {
        const h = (t * 120) % 360;
        const c = Color3.FromHSV(h, 0.7, 1);
        mat.emissiveColor = c.scale(0.55).add(new Color3(0.2, 0.2, 0.2));
      } else if (variant === 'sparkling' || variant === 'celestial') {
        const k = 0.85 + Math.sin(t * 9) * 0.15;
        mat.emissiveColor = baseEmissive.scale(k);
      }
      // Kuyruk sallama hissi
      mesh.rotation.y = Math.sin(t * 6) * 0.08;
    },
    dispose() {
      ps?.dispose();
      mesh.dispose();
      mat.dispose();
      root.dispose();
    },
  };
}
