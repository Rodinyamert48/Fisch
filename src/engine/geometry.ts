import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateIcoSphereVertexData } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { CreateCapsuleVertexData } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { valueNoise2 } from '../core/noise';

export type ColorLike = string | Color3;
export type ColorFn = (x: number, y: number, z: number) => Color3;

const colorCache = new Map<string, Color3>();
export function hex(c: ColorLike): Color3 {
  if (typeof c !== 'string') return c;
  let v = colorCache.get(c);
  if (!v) {
    v = Color3.FromHexString(c);
    colorCache.set(c, v);
  }
  return v;
}

export interface PartTransform {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

function composeMatrix(t: PartTransform): Matrix {
  const s = t.scale ?? [1, 1, 1];
  const r = t.rot ?? [0, 0, 0];
  const p = t.pos ?? [0, 0, 0];
  return Matrix.Compose(
    new Vector3(s[0], s[1], s[2]),
    Quaternion.RotationYawPitchRoll(r[1], r[0], r[2]),
    new Vector3(p[0], p[1], p[2]),
  );
}

/** Köşeleri normal yönünde gürültüyle iter (organik kaya / yaprak kümeleri için). */
function displace(vd: VertexData, amount: number, seed: number): void {
  const p = vd.positions!;
  const n = vd.normals!;
  for (let i = 0; i < p.length; i += 3) {
    const k = valueNoise2(p[i] * 2.3 + seed, p[i + 2] * 2.3 + p[i + 1] * 1.7, seed) * amount;
    p[i] += n[i] * k;
    p[i + 1] += n[i + 1] * k;
    p[i + 2] += n[i + 2] * k;
  }
}

export interface GeometryOptions {
  /** Varsayılan yumuşak gölgelendirme (false = düz/yüzeyli). */
  smooth?: boolean;
  /** Dünya uzayı kutu-izdüşüm UV ölçeği (doku tekrar sıklığı). */
  uvScale?: number;
}

/**
 * Prosedürel model birleştirici: ilkel şekilleri tek bir mesh'te toplar.
 * Yumuşak (doğru normal matrisiyle) veya düz gölgelendirme, köşe renkleri ve
 * dünya uzayında kutu-izdüşümlü UV'ler üretir; böylece dokular her parçada aynı yoğunlukta görünür.
 */
export class GeometryBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];
  private base: Matrix | null = null;
  private readonly smoothDefault: boolean;
  private readonly uvScale: number;

  constructor(opts: GeometryOptions = {}) {
    this.smoothDefault = opts.smooth ?? false;
    this.uvScale = opts.uvScale ?? 0.5;
  }

  setBase(m: Matrix | null): void {
    this.base = m;
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  private pushVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: Color3): void {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.colors.push(c.r, c.g, c.b, 1);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    const s = this.uvScale;
    if (ay >= ax && ay >= az) this.uvs.push(x * s, z * s);
    else if (ax >= az) this.uvs.push(z * s, y * s);
    else this.uvs.push(x * s, y * s);
  }

  /** İndeksli VertexData ekler. */
  addVertexData(
    vd: VertexData,
    color: ColorLike | ColorFn,
    t: PartTransform = {},
    jitter = 0,
    smooth = this.smoothDefault,
  ): void {
    const partM = composeMatrix(t);
    const m = this.base ? partM.multiply(this.base) : partM;
    const pos = vd.positions!;
    const idx = vd.indices!;
    const fn = typeof color === 'function' ? color : null;
    const flatCol = fn ? null : hex(color as ColorLike);
    const tmp = Vector3.Zero();
    const world: number[] = new Array(pos.length);
    // Renk fonksiyonu parça-yerel (taban dönüşümünden önceki) koordinatları alır
    const local: number[] = fn ? new Array(pos.length) : world;
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], m, tmp);
      world[i] = tmp.x;
      world[i + 1] = tmp.y;
      world[i + 2] = tmp.z;
      if (fn) {
        Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], partM, tmp);
        local[i] = tmp.x;
        local[i + 1] = tmp.y;
        local[i + 2] = tmp.z;
      }
    }
    if (smooth && vd.normals) {
      // Doğru normal dönüşümü: ters-devrik matris
      const nm = m.clone().invert().transpose();
      const nrm = vd.normals;
      const offset = this.vertexCount;
      const partJ = jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1;
      for (let i = 0; i < pos.length; i += 3) {
        Vector3.TransformNormalFromFloatsToRef(nrm[i], nrm[i + 1], nrm[i + 2], nm, tmp);
        tmp.normalize();
        const c = (fn ? fn(local[i], local[i + 1], local[i + 2]) : flatCol!).scale(partJ);
        this.pushVertex(world[i], world[i + 1], world[i + 2], tmp.x, tmp.y, tmp.z, c);
      }
      for (const k of idx) this.indices.push(k + offset);
      return;
    }
    // Düz gölgelendirme: her yüz kendi köşelerine sahip
    const e1 = new Vector3();
    const e2 = new Vector3();
    const n = new Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3;
      const b = idx[i + 1] * 3;
      const c = idx[i + 2] * 3;
      // Babylon ön yüz sırasına uygun yüz normali
      e1.set(world[a] - world[b], world[a + 1] - world[b + 1], world[a + 2] - world[b + 2]);
      e2.set(world[c] - world[b], world[c + 1] - world[b + 1], world[c + 2] - world[b + 2]);
      Vector3.CrossToRef(e1, e2, n);
      n.normalize();
      const j = jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1;
      const col = (fn ? fn(local[a], local[a + 1], local[a + 2]) : flatCol!).scale(j);
      const base = this.vertexCount;
      for (const v of [a, b, c]) this.pushVertex(world[v], world[v + 1], world[v + 2], n.x, n.y, n.z, col);
      this.indices.push(base, base + 1, base + 2);
    }
  }

  box(color: ColorLike | ColorFn, t: PartTransform & { size?: [number, number, number] } = {}, jitter = 0): void {
    const s = t.size ?? [1, 1, 1];
    this.addVertexData(CreateBoxVertexData({ width: s[0], height: s[1], depth: s[2] }), color, t, jitter, false);
  }

  cylinder(
    color: ColorLike | ColorFn,
    opts: { top: number; bottom: number; height: number; tess?: number; flat?: boolean; cap?: boolean },
    t: PartTransform = {},
    jitter = 0,
  ): void {
    const vd = CreateCylinderVertexData({
      diameterTop: opts.top,
      diameterBottom: opts.bottom,
      height: opts.height,
      tessellation: opts.tess ?? 8,
      cap: opts.cap === false ? 0 : 3,
    });
    this.addVertexData(vd, color, t, jitter, opts.flat ? false : this.smoothDefault);
  }

  sphere(
    color: ColorLike | ColorFn,
    opts: { segments?: number; diameter?: number; slice?: number; flat?: boolean; noise?: number; seed?: number },
    t: PartTransform = {},
    jitter = 0,
  ): void {
    const vd = CreateSphereVertexData({ segments: opts.segments ?? 6, diameter: opts.diameter ?? 1, slice: opts.slice });
    if (opts.noise) displace(vd, opts.noise, opts.seed ?? 0);
    this.addVertexData(vd, color, t, jitter, opts.flat ? false : this.smoothDefault);
  }

  ico(
    color: ColorLike | ColorFn,
    opts: { radius?: number; subdivisions?: number; flat?: boolean; noise?: number; seed?: number },
    t: PartTransform = {},
    jitter = 0,
  ): void {
    const vd = CreateIcoSphereVertexData({ radius: opts.radius ?? 0.5, subdivisions: opts.subdivisions ?? 1, flat: false });
    if (opts.noise) displace(vd, opts.noise, opts.seed ?? 0);
    this.addVertexData(vd, color, t, jitter, opts.flat === false ? true : opts.flat ? false : this.smoothDefault);
  }

  capsule(color: ColorLike | ColorFn, opts: { radius: number; height: number; tess?: number }, t: PartTransform = {}): void {
    const vd = CreateCapsuleVertexData({
      radius: opts.radius,
      height: Math.max(opts.height, opts.radius * 2.01),
      tessellation: opts.tess ?? 10,
      capSubdivisions: 4,
      subdivisions: 2,
    });
    this.addVertexData(vd, color, t, 0, true);
  }

  /** Ham üçgen (düz). Köşe sırası Babylon ön yüz sırasına uygun olmalı. */
  triangle(a: Vector3, b: Vector3, c: Vector3, color: ColorLike): void {
    const vd = new VertexData();
    vd.positions = [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z];
    vd.indices = [0, 1, 2];
    this.addVertexData(vd, color, {}, 0, false);
  }

  /**
   * Köşe başına renkli üçgen; isteğe bağlı sabit normal (ör. çimen için yukarı) ve çift taraf.
   * Konumlar taban dönüşümünden geçer.
   */
  rawTriangle(a: Vector3, b: Vector3, c: Vector3, cols: [Color3, Color3, Color3], normal?: Vector3, doubleSided = false): void {
    const pts = [a, b, c].map((p) => (this.base ? Vector3.TransformCoordinates(p, this.base) : p));
    let n = normal;
    if (!n) {
      n = Vector3.Cross(pts[0].subtract(pts[1]), pts[2].subtract(pts[1])).normalize();
    }
    const base = this.vertexCount;
    for (let i = 0; i < 3; i++) this.pushVertex(pts[i].x, pts[i].y, pts[i].z, n.x, n.y, n.z, cols[i]);
    this.indices.push(base, base + 1, base + 2);
    if (doubleSided) this.indices.push(base, base + 2, base + 1);
  }

  /** Çift taraflı üçgen (yüzgeç, yaprak gibi ince parçalar). */
  doubleTriangle(a: Vector3, b: Vector3, c: Vector3, color: ColorLike): void {
    this.triangle(a, b, c, color);
    this.triangle(a, c, b, color);
  }

  /** Dörtgen (a-b-c-d saat yönünde, ön yüz). */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: ColorLike): void {
    this.triangle(a, b, c, color);
    this.triangle(a, c, d, color);
  }

  build(name: string, scene: Scene, updatable = false): Mesh {
    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.colors = this.colors;
    vd.uvs = this.uvs;
    vd.indices = new Uint32Array(this.indices);
    vd.applyToMesh(mesh, updatable);
    return mesh;
  }
}

export function color4(c: ColorLike, a = 1): Color4 {
  const h = hex(c);
  return new Color4(h.r, h.g, h.b, a);
}

export function mixColor(a: ColorLike, b: ColorLike, t: number): Color3 {
  return Color3.Lerp(hex(a), hex(b), Math.max(0, Math.min(1, t)));
}
