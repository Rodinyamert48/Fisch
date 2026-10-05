import { WaterMaterial } from '@babylonjs/materials/water/waterMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** Döşenebilir (tileable) normal haritası üretir: tam sayı frekanslı sinüs dalgalarının toplamı. */
function makeWaterNormalMap(scene: Scene, size = 256): Texture {
  const waves: { kx: number; ky: number; amp: number; phase: number }[] = [];
  let seed = 1234;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 14; i++) {
    const kx = Math.round((rnd() * 2 - 1) * (3 + i * 1.5));
    const ky = Math.round((rnd() * 2 - 1) * (3 + i * 1.5)) || 1;
    waves.push({ kx, ky, amp: 1 / (1 + i * 0.6), phase: rnd() * Math.PI * 2 });
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 0.045;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const a = 2 * Math.PI * (w.kx * u + w.ky * v) + w.phase;
        const c = Math.cos(a) * w.amp;
        dx += c * w.kx;
        dy += c * w.ky;
      }
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Yansıma ve kırılma destekli okyanus yüzeyi. */
export class Water {
  readonly mesh: Mesh;
  readonly material: WaterMaterial;
  private baseColor = new Color3(0.08, 0.32, 0.45);

  constructor(scene: Scene, size: number, rtSize: number) {
    this.mesh = CreateGround('water', { width: size, height: size, subdivisions: 96 }, scene);
    this.mesh.position.y = 0;
    this.mesh.isPickable = false;
    const mat = new WaterMaterial('waterMat', scene, new Vector2(rtSize, rtSize));
    mat.bumpTexture = makeWaterNormalMap(scene);
    mat.windForce = -6;
    mat.waveHeight = 0.03;
    mat.waveCount = 0.08;
    mat.waveSpeed = 40;
    mat.bumpHeight = 0.35;
    mat.waveLength = 0.0035;
    mat.windDirection = new Vector2(1, 0.6);
    mat.waterColor = this.baseColor.clone();
    mat.waterColor2 = new Color3(0.1, 0.4, 0.5);
    mat.colorBlendFactor = 0.32;
    mat.colorBlendFactor2 = 0.15;
    mat.specularColor = new Color3(0.9, 0.85, 0.7);
    mat.specularPower = 180;
    mat.bumpSuperimpose = true;
    mat.bumpAffectsReflection = true;
    mat.fresnelSeparate = true;
    this.material = mat;
    this.mesh.material = mat;
  }

  /** Düşük kalitede yansıma/kırılma dokularını her iki karede bir güncelle. */
  setRefreshRate(rate: number): void {
    if (this.material.reflectionTexture) this.material.reflectionTexture.refreshRate = rate;
    if (this.material.refractionTexture) this.material.refractionTexture.refreshRate = rate;
  }

  addToRenderList(mesh: AbstractMesh): void {
    this.material.addToRenderList(mesh);
  }

  removeFromRenderList(mesh: AbstractMesh): void {
    const list = this.material.getRenderList();
    if (!list) return;
    const i = list.indexOf(mesh);
    if (i >= 0) list.splice(i, 1);
  }

  /** Hava durumu ve ışığa göre su rengini ve dalgaları ayarla. */
  setMood(opts: { color: Color3; daylight: number; storm: number; deep: number }): void {
    const m = this.material;
    const light = 0.25 + 0.75 * opts.daylight;
    m.waterColor = opts.color.scale(light);
    m.waterColor2 = opts.color.scale(light * 1.1);
    m.colorBlendFactor = 0.3 + opts.storm * 0.15 + opts.deep * 0.3;
    m.windForce = -6 - opts.storm * 8;
    m.bumpHeight = 0.35 + opts.storm * 0.25;
    m.specularColor = new Color3(0.9, 0.85, 0.7).scale(opts.daylight * (1 - opts.storm * 0.7) + 0.08);
  }
}
