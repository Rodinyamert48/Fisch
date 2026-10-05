import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateIcoSphereVertexData } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import type { Scene } from '@babylonjs/core/scene';

export type ColorLike = string | Color3;

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

/**
 * Düşük poligonlu modeller için birleştirici: ilkel şekilleri tek bir köşe-renkli,
 * düz gölgelendirilmiş (flat shaded) mesh'te toplar. Böylece çizim çağrısı sayısı düşük kalır.
 */
export class GeometryBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  /** Ek dönüşüm (ör. ağaç konumu) tüm parçalara uygulanır. */
  private base: Matrix | null = null;

  setBase(m: Matrix | null): void {
    this.base = m;
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  /** İndeksli VertexData'yı, yüz başına ayrı köşelerle ekler (düz gölgelendirme için). */
  addVertexData(vd: VertexData, color: ColorLike | ((x: number, y: number, z: number) => Color3), t: PartTransform = {}, jitter = 0): void {
    let m = composeMatrix(t);
    if (this.base) m = m.multiply(this.base);
    vd.transform(m);
    const pos = vd.positions!;
    const idx = vd.indices!;
    for (let i = 0; i < idx.length; i += 3) {
      let c: Color3;
      if (typeof color === 'function') {
        const a = idx[i] * 3;
        c = color(pos[a], pos[a + 1], pos[a + 2]);
      } else {
        c = hex(color);
      }
      const j = jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1;
      for (let k = 0; k < 3; k++) {
        const v = idx[i + k] * 3;
        this.positions.push(pos[v], pos[v + 1], pos[v + 2]);
        this.colors.push(c.r * j, c.g * j, c.b * j, 1);
      }
    }
  }

  box(color: ColorLike, t: PartTransform & { size?: [number, number, number] } = {}, jitter = 0): void {
    const s = t.size ?? [1, 1, 1];
    const vd = CreateBoxVertexData({ width: s[0], height: s[1], depth: s[2] });
    this.addVertexData(vd, color, t, jitter);
  }

  cylinder(
    color: ColorLike,
    opts: { top: number; bottom: number; height: number; tess?: number },
    t: PartTransform = {},
    jitter = 0,
  ): void {
    const vd = CreateCylinderVertexData({
      diameterTop: opts.top,
      diameterBottom: opts.bottom,
      height: opts.height,
      tessellation: opts.tess ?? 6,
    });
    this.addVertexData(vd, color, t, jitter);
  }

  sphere(color: ColorLike | ((x: number, y: number, z: number) => Color3), opts: { segments?: number; diameter?: number }, t: PartTransform = {}, jitter = 0): void {
    const vd = CreateSphereVertexData({ segments: opts.segments ?? 4, diameter: opts.diameter ?? 1 });
    this.addVertexData(vd, color, t, jitter);
  }

  ico(color: ColorLike, opts: { radius?: number; subdivisions?: number }, t: PartTransform = {}, jitter = 0): void {
    const vd = CreateIcoSphereVertexData({ radius: opts.radius ?? 0.5, subdivisions: opts.subdivisions ?? 1, flat: true });
    this.addVertexData(vd, color, t, jitter);
  }

  /** Ham üçgen ekler (köşe sırası Babylon'un ön yüz sırasına uygun olmalı). */
  triangle(a: Vector3, b: Vector3, c: Vector3, color: ColorLike): void {
    const col = hex(color);
    for (const p of [a, b, c]) {
      let v = p;
      if (this.base) v = Vector3.TransformCoordinates(p, this.base);
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(col.r, col.g, col.b, 1);
    }
  }

  /** Çift taraflı üçgen (yüzgeçler gibi ince parçalar için). */
  doubleTriangle(a: Vector3, b: Vector3, c: Vector3, color: ColorLike): void {
    this.triangle(a, b, c, color);
    this.triangle(a, c, b, color);
  }

  build(name: string, scene: Scene, updatable = false): Mesh {
    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    const count = this.positions.length / 3;
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    const normals: number[] = [];
    VertexData.ComputeNormals(this.positions, indices, normals);
    vd.positions = this.positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.colors = this.colors;
    vd.applyToMesh(mesh, updatable);
    return mesh;
  }
}

export function color4(c: ColorLike, a = 1): Color4 {
  const h = hex(c);
  return new Color4(h.r, h.g, h.b, a);
}

export function mixColor(a: ColorLike, b: ColorLike, t: number): Color3 {
  return Color3.Lerp(hex(a), hex(b), t);
}
