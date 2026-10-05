import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import { ISLANDS, SEA_FLOOR, TRENCH, type BuildingDef, type IslandDef } from '../core/data/world';
import { valueNoise2 } from '../core/noise';
import { mulberry32, smoothstep, type Rng } from '../core/rng';
import {
  BEACH_HEIGHT,
  PLATFORMS,
  islandForward,
  islandHeight,
  platformAt,
  terrainHeight,
  townCenter,
  townToWorld,
  type Platform,
} from '../core/worldMap';
import { GeometryBuilder, hex, mixColor, type ColorLike } from './geometry';
import type { Materials } from './materials';

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'box'; x: number; z: number; hw: number; hd: number; angle: number };

export interface NpcSpot {
  islandId: string;
  npcIndex: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface WorldMeshes {
  terrain: Mesh[];
  /** Yansımaya ve gölgeye katılan dekor (binalar, ağaçlar, iskeleler). */
  props: Mesh[];
  /** Yalnızca yakından görünen ince detay (çimen, çiçek): yansıma/gölge dışı. */
  grass: Mesh[];
  lamps: Mesh[];
  labels: Mesh[];
  lava: Mesh[];
  foam: Mesh[];
  seabed: Mesh;
}

interface Builders {
  nature: GeometryBuilder;
  wood: GeometryBuilder;
  roof: GeometryBuilder;
  wall: GeometryBuilder;
  stone: GeometryBuilder;
  metal: GeometryBuilder;
  lamps: GeometryBuilder;
  grass: GeometryBuilder;
}

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const qY = (yaw: number) => Quaternion.RotationYawPitchRoll(yaw, 0, 0);

/** Ada ve dekor üretimi. Tüm geometri ve dokular prosedüreldir; dış varlık gerekmez. */
export class WorldBuilder {
  readonly colliders: Collider[] = [];
  readonly npcSpots: NpcSpot[] = [];
  readonly lavaPoints: Vector3[] = [];
  readonly lighthouseLamps: Vector3[] = [];
  private readonly high: boolean;

  constructor(
    private readonly scene: Scene,
    private readonly mats: Materials,
    quality: 'low' | 'high',
  ) {
    this.high = quality === 'high';
  }

  private newBuilders(): Builders {
    return {
      nature: new GeometryBuilder({ smooth: true, uvScale: 0.5 }),
      wood: new GeometryBuilder({ smooth: true, uvScale: 0.45 }),
      roof: new GeometryBuilder({ smooth: false, uvScale: 0.5 }),
      wall: new GeometryBuilder({ smooth: true, uvScale: 0.35 }),
      stone: new GeometryBuilder({ smooth: false, uvScale: 0.4 }),
      metal: new GeometryBuilder({ smooth: true, uvScale: 0.3 }),
      lamps: new GeometryBuilder({ smooth: true }),
      grass: new GeometryBuilder({ smooth: false, uvScale: 1 }),
    };
  }

  private finish(b: Builders, name: string, out: WorldMeshes): void {
    const pairs: [GeometryBuilder, 'nature' | 'wood' | 'roof' | 'wall' | 'stone' | 'metal'][] = [
      [b.nature, 'nature'], [b.wood, 'wood'], [b.roof, 'roof'], [b.wall, 'wall'], [b.stone, 'stone'], [b.metal, 'metal'],
    ];
    for (const [g, key] of pairs) {
      if (g.vertexCount === 0) continue;
      const m = g.build(`${name}-${key}`, this.scene);
      m.material = this.mats[key];
      m.isPickable = false;
      out.props.push(m);
    }
    if (b.lamps.vertexCount) {
      const m = b.lamps.build(`${name}-lamps`, this.scene);
      m.material = this.mats.lamps;
      m.isPickable = false;
      out.lamps.push(m);
    }
    if (b.grass.vertexCount) {
      const m = b.grass.build(`${name}-grass`, this.scene);
      m.material = this.mats.nature;
      m.isPickable = false;
      out.grass.push(m);
    }
  }

  private setBaseAll(b: Builders, m: Matrix | null): void {
    for (const g of Object.values(b) as GeometryBuilder[]) g.setBase(m);
  }

  build(): WorldMeshes {
    const out: WorldMeshes = { terrain: [], props: [], grass: [], lamps: [], labels: [], lava: [], foam: [], seabed: this.buildSeabed() };
    for (const isl of ISLANDS) {
      const b = this.newBuilders();
      if (isl.style === 'station') {
        this.buildStation(isl, b);
      } else {
        out.terrain.push(this.buildTerrain(isl));
        out.foam.push(this.buildShoreFoam(isl));
        this.buildVegetation(isl, b);
        this.buildTownDecor(isl, b);
        if (isl.style === 'volcanic') out.lava.push(this.buildLava(isl));
      }
      for (const bd of isl.buildings) this.buildBuilding(isl, bd, b, out.labels);
      this.finish(b, `isl-${isl.id}`, out);
      isl.npcs.forEach((n, i) => {
        const p = isl.style === 'station' ? this.stationToWorld(isl, n.x, n.f) : townToWorld(isl, n.x, n.f);
        const y = isl.style === 'station' ? isl.townHeight : terrainHeight(p.x, p.z);
        this.npcSpots.push({ islandId: isl.id, npcIndex: i, x: p.x, y, z: p.z, yaw: isl.dockAngle });
        this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.6 });
      });
    }
    const b = this.newBuilders();
    for (const p of PLATFORMS) if (p.kind === 'dock') this.buildDock(p, b);
    this.buildOceanDecor(b);
    this.finish(b, 'world', out);
    out.terrain.push(this.buildTrench());
    for (const m of [...out.terrain, ...out.props, ...out.grass, ...out.foam]) m.freezeWorldMatrix();
    return out;
  }

  // ───────────── Arazi (yumuşak, dokulu, ortam kapatmalı) ─────────────
  private buildTerrain(isl: IslandDef): Mesh {
    const n = this.high ? 190 : 110;
    const ext = isl.radius * 1.8;
    const step = (ext * 2) / n;
    const x0 = isl.cx - ext;
    const z0 = isl.cz - ext;
    const N = n + 1;
    const H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = islandHeight(isl, x0 + i * step, z0 + j * step);

    const positions = new Float32Array(N * N * 3);
    const uvs = new Float32Array(N * N * 2);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const x = x0 + i * step;
        const z = z0 + j * step;
        positions[k * 3] = x;
        positions[k * 3 + 1] = H[k];
        positions[k * 3 + 2] = z;
        uvs[k * 2] = x / 7;
        uvs[k * 2 + 1] = z / 7;
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k00 = j * N + i;
        const k10 = k00 + 1;
        const k01 = k00 + N;
        const k11 = k01 + 1;
        if (Math.max(H[k00], H[k10], H[k01], H[k11]) < SEA_FLOOR + 0.3) continue;
        indices.push(k10, k11, k01, k00, k10, k01);
      }
    }
    const normals = new Float32Array(N * N * 3);
    VertexData.ComputeNormals(positions, indices, normals);

    // Köşe renkleri: yükseklik, eğim, gürültü ve ortam kapatma (çukurlar koyu)
    const P = isl.palette;
    const tc = townCenter(isl);
    const pathColor = mixColor(P.sand, '#7a6a58', 0.45);
    const dry = mixColor(P.grass2, '#b8a868', 0.5);
    const colors = new Float32Array(N * N * 4);
    const R = 3;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const h = H[k];
        const x = positions[k * 3];
        const z = positions[k * 3 + 2];
        const slope = 1 - normals[k * 3 + 1];
        const nz = valueNoise2(x * 0.04, z * 0.04, isl.seed + 5) * 0.5 + 0.5;
        const nz2 = valueNoise2(x * 0.15, z * 0.15, isl.seed + 9) * 0.5 + 0.5;
        let col: Color3;
        if (h < -0.3) {
          col = mixColor(P.sand, P.seabed, -h / 7).scale(0.78 + 0.22 * Math.max(0, 1 + h / 18));
        } else if (h < BEACH_HEIGHT + 0.3 + nz2 * 0.5 && slope < 0.5) {
          const wet = smoothstep(0.45, -0.1, h);
          col = Color3.Lerp(hex(P.sand), hex(P.sand).scale(0.72), wet);
        } else {
          col = mixColor(P.grass, P.grass2, isl.style === 'volcanic' ? Math.max(0, nz - 0.55) * 1.8 : nz);
          if (isl.style !== 'snow') col = Color3.Lerp(col, dry, Math.min(1, Math.max(0, nz2 - 0.6) * 1.2));
          col = Color3.Lerp(col, hex(P.sand), smoothstep(BEACH_HEIGHT + 1.3, BEACH_HEIGHT + 0.3, h));
          const dTown = Math.hypot(x - tc.x, z - tc.z);
          col = Color3.Lerp(col, pathColor.scale(0.9 + nz2 * 0.2), smoothstep(isl.townRadius * 0.7, isl.townRadius * 0.5, dTown));
          if (isl.style === 'temperate') col = Color3.Lerp(col, hex(P.rock), smoothstep(isl.peak * 0.7, isl.peak * 0.95, h));
          if (isl.style === 'volcanic') {
            col = Color3.Lerp(col, hex(P.rock), smoothstep(isl.peak * 0.32, isl.peak * 0.48, h));
            col = Color3.Lerp(col, hex('#231818'), smoothstep(isl.peak * 0.5, isl.peak * 0.75, h));
          }
          if (isl.style === 'snow') col = Color3.Lerp(col, hex(P.snow), smoothstep(10, 18, h + nz2 * 4));
          col = Color3.Lerp(col, hex(P.rock).scale(0.9 + nz2 * 0.2), smoothstep(0.28, 0.5, slope));
          if (isl.style === 'snow' && slope < 0.35) col = Color3.Lerp(col, hex(P.snow), smoothstep(14, 20, h));
        }
        let sum = 0;
        let cnt = 0;
        for (const [di, dj] of [[-R, 0], [R, 0], [0, -R], [0, R]]) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
          sum += H[jj * N + ii];
          cnt++;
        }
        const cavity = cnt ? sum / cnt - h : 0;
        const ao = Math.max(0.62, Math.min(1.05, 1 - cavity * 0.09));
        colors[k * 4] = col.r * ao;
        colors[k * 4 + 1] = col.g * ao;
        colors[k * 4 + 2] = col.b * ao;
        colors[k * 4 + 3] = 1;
      }
    }
    const vd = new VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.colors = colors;
    vd.uvs = uvs;
    vd.indices = new Uint32Array(indices);
    const mesh = new Mesh(`terrain-${isl.id}`, this.scene);
    vd.applyToMesh(mesh);
    mesh.material = this.mats.terrain;
    mesh.isPickable = false;
    return mesh;
  }

  /** Kıyı çizgisi boyunca köpük şeridi (doku kaydırılarak canlandırılır). */
  private buildShoreFoam(isl: IslandDef): Mesh {
    const segs = 220;
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const rows = [
      { off: -2.2, a: 0 },
      { off: -0.4, a: 0.75 },
      { off: 1.2, a: 0.5 },
      { off: 4.5, a: 0 },
    ];
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      let r = isl.radius * 0.4;
      while (r < isl.radius * 2 && islandHeight(isl, isl.cx + ca * r, isl.cz + sa * r) > 0) r += 0.4;
      for (const row of rows) {
        const rr = r + row.off;
        positions.push(isl.cx + ca * rr, 0.14, isl.cz + sa * rr);
        normals.push(0, 1, 0);
        colors.push(1, 1, 1, row.a);
        uvs.push((s / segs) * isl.radius * 0.6, row.off * 0.12);
      }
    }
    const rc = rows.length;
    for (let s = 0; s < segs; s++) {
      for (let k = 0; k < rc - 1; k++) {
        const a = s * rc + k;
        const b = (s + 1) * rc + k;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const vd = new VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.colors = colors;
    vd.uvs = uvs;
    vd.indices = indices;
    const mesh = new Mesh(`foam-${isl.id}`, this.scene);
    vd.applyToMesh(mesh);
    mesh.hasVertexAlpha = true;
    mesh.material = this.mats.foam;
    mesh.isPickable = false;
    return mesh;
  }

  private buildSeabed(): Mesh {
    const m = CreateGround('seabed', { width: 3200, height: 3200, subdivisions: 1 }, this.scene);
    m.position.y = SEA_FLOOR - 0.4;
    const mat = new StandardMaterial('seabedMat', this.scene);
    mat.diffuseColor = hex('#4a7480');
    mat.specularColor = Color3.Black();
    m.material = mat;
    m.isPickable = false;
    m.freezeWorldMatrix();
    return m;
  }

  /** Abis Çukuru'nu sudan koyu gösteren degrade disk. */
  private buildTrench(): Mesh {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5;
        const dy = (y + 0.5) / size - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;
        const a = d > 1 ? 0 : 1 - Math.pow(Math.max(0, (d - 0.55) / 0.45), 1.5);
        const i = (y * size + x) * 4;
        data[i] = 2;
        data[i + 1] = 8;
        data[i + 2] = 22;
        data[i + 3] = Math.round(a * 255);
      }
    }
    const tex = RawTexture.CreateRGBATexture(data, size, size, this.scene, true, false, Texture.BILINEAR_SAMPLINGMODE);
    tex.hasAlpha = true;
    const mat = new StandardMaterial('trenchMat', this.scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = new Color3(0.01, 0.03, 0.08);
    mat.disableLighting = true;
    const disc = CreateDisc('trench', { radius: TRENCH.radius * 1.05, tessellation: 48 }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(TRENCH.cx, -2.2, TRENCH.cz);
    disc.material = mat;
    disc.isPickable = false;
    return disc;
  }

  private buildLava(isl: IslandDef): Mesh {
    const y = islandHeight(isl, isl.cx, isl.cz);
    const disc = CreateDisc(`lava-${isl.id}`, { radius: isl.radius * 0.14, tessellation: 24 }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(isl.cx, y + 0.5, isl.cz);
    const m = new StandardMaterial('lavaMat', this.scene);
    m.diffuseColor = new Color3(1, 0.35, 0.05);
    m.emissiveColor = new Color3(1.4, 0.5, 0.08);
    m.disableLighting = true;
    disc.material = m;
    this.lavaPoints.push(new Vector3(isl.cx, y + 0.8, isl.cz));
    return disc;
  }

  // ───────────── Bitki örtüsü, kayalar ve çimen ─────────────
  private buildVegetation(isl: IslandDef, b: Builders): void {
    const rng = mulberry32(isl.seed * 31 + 7);
    const tc = townCenter(isl);
    const count = Math.round((this.high ? 1 : 0.6) * (isl.style === 'volcanic' ? 120 : isl.style === 'snow' ? 130 : 170));
    let placed = 0;
    const g = b.nature;
    for (let tries = 0; tries < count * 6 && placed < count; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * isl.radius * 1.05;
      const x = isl.cx + Math.cos(a) * r;
      const z = isl.cz + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < BEACH_HEIGHT + 0.7) continue;
      if (Math.hypot(x - tc.x, z - tc.z) < isl.townRadius + 3) continue;
      if (platformAt(x, z, 4)) continue;
      const slope = Math.abs(terrainHeight(x + 1.5, z) - h) + Math.abs(terrainHeight(x, z + 1.5) - h);
      if (slope > 2.4) continue;
      if (isl.style === 'volcanic' && h > isl.peak * 0.42) continue;
      if (isl.style === 'snow' && h > 30) continue;
      const s = 0.8 + rng() * 0.7;
      g.setBase(Matrix.Compose(new Vector3(s, s, s), qY(rng() * Math.PI * 2), new Vector3(x, h - 0.25, z)));
      const kind = rng();
      if (isl.style === 'temperate') {
        if (kind < 0.55) this.pine(g, rng, false);
        else if (kind < 0.9) this.broadleaf(g, rng, ['#4f8a3a', '#5f9a40', '#3f7a3a', '#6a9a3a']);
        else this.bush(g, rng, '#4a7a34');
      } else if (isl.style === 'volcanic') {
        if (kind < 0.62) this.palm(g, rng);
        else if (kind < 0.85) this.broadleaf(g, rng, ['#d86a9a', '#e88ab0', '#c85a8a']);
        else this.bush(g, rng, '#3f8a4a');
      } else {
        this.pine(g, rng, true);
      }
      g.setBase(null);
      this.colliders.push({ kind: 'circle', x, z, r: 0.55 * s });
      placed++;
    }

    // Kayalar (yüzeyli, taş dokulu)
    const rocks = isl.style === 'snow' ? 46 : 36;
    for (let i = 0; i < rocks; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * isl.radius * 1.15;
      const x = isl.cx + Math.cos(a) * r;
      const z = isl.cz + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < -3 || Math.hypot(x - tc.x, z - tc.z) < isl.townRadius + 2 || platformAt(x, z, 4)) continue;
      const s = 0.5 + rng() * 1.8;
      const col = isl.style === 'snow' && rng() < 0.35 ? '#e8eef4' : isl.style === 'volcanic' ? '#5a4a48' : '#8a8478';
      b.stone.ico(col, { radius: 1, subdivisions: 2, noise: 0.28, seed: i * 7 + isl.seed }, {
        pos: [x, h + s * 0.15, z], rot: [rng() * 0.5, rng() * 6, rng() * 0.5], scale: [s * 1.25, s * 0.75, s],
      }, 0.06);
      if (h > 0) this.colliders.push({ kind: 'circle', x, z, r: s * 0.95 });
    }

    if (this.high && isl.style !== 'snow') this.buildGrass(isl, b.grass, rng);

    // Ada özel deniz dekoru
    if (isl.style === 'volcanic') {
      const cols = ['#ff6a8a', '#ffb03a', '#a05aff', '#3ae0c0', '#ff8a3a'];
      for (let i = 0; i < 80; i++) {
        const a = rng() * Math.PI * 2;
        const r = isl.radius * (0.95 + rng() * 0.35);
        const x = isl.cx + Math.cos(a) * r;
        const z = isl.cz + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        if (h > -0.8 || h < -9) continue;
        const c = cols[Math.floor(rng() * cols.length)];
        const s = 0.6 + rng() * 1.2;
        g.cylinder(c, { top: 0.08, bottom: 0.45 * s, height: 1.8 * s, tess: 7 }, { pos: [x, h + 0.8 * s, z], rot: [rng() * 0.4, 0, rng() * 0.4] });
        g.sphere(c, { segments: 5, diameter: 1.1 * s, noise: 0.15, seed: i }, { pos: [x + 0.8, h + 0.3, z], scale: [1, 0.6, 1] });
      }
    }
    if (isl.style === 'snow') {
      for (let i = 0; i < 18; i++) {
        const a = rng() * Math.PI * 2;
        const r = isl.radius * (1.35 + rng() * 0.8);
        const x = isl.cx + Math.cos(a) * r;
        const z = isl.cz + Math.sin(a) * r;
        if (platformAt(x, z, 10)) continue;
        const s = 2 + rng() * 5;
        g.ico(rng() < 0.5 ? '#f4fbff' : '#d0e8f6', { radius: 1, subdivisions: 2, noise: 0.22, seed: i * 13, flat: true }, {
          pos: [x, -s * 0.25, z], rot: [rng() * 0.4, rng() * 6, 0], scale: [s * 1.4, s * 0.9, s],
        }, 0.03);
        this.colliders.push({ kind: 'circle', x, z, r: s * 1.2 });
      }
    }
  }

  private buildGrass(isl: IslandDef, g: GeometryBuilder, rng: Rng): void {
    const tc = townCenter(isl);
    const clusters = 1100;
    const flowerCols = isl.style === 'volcanic' ? ['#ff5a8a', '#ffd23f', '#ffffff'] : ['#ffffff', '#ffd23f', '#e85a5a', '#9a7aff'];
    const up = V(0, 1, 0);
    for (let c = 0; c < clusters; c++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * isl.radius;
      const cx = isl.cx + Math.cos(a) * r;
      const cz = isl.cz + Math.sin(a) * r;
      const h = terrainHeight(cx, cz);
      if (h < BEACH_HEIGHT + 0.9 || h > isl.peak * 0.6) continue;
      if (Math.hypot(cx - tc.x, cz - tc.z) < isl.townRadius * 0.62) continue;
      if (platformAt(cx, cz, 2)) continue;
      const slope = Math.abs(terrainHeight(cx + 1, cz) - h) + Math.abs(terrainHeight(cx, cz + 1) - h);
      if (slope > 1.2) continue;
      const base = mixColor(isl.palette.grass, isl.palette.grass2, rng() * 0.6);
      const blades = 7 + Math.floor(rng() * 6);
      for (let k = 0; k < blades; k++) {
        const bx = cx + (rng() * 2 - 1) * 0.7;
        const bz = cz + (rng() * 2 - 1) * 0.7;
        const by = terrainHeight(bx, bz) - 0.05;
        const ang = rng() * Math.PI;
        const w = 0.07 + rng() * 0.05;
        const hh = 0.35 + rng() * 0.45;
        const lean = (rng() * 2 - 1) * 0.25;
        const dx = Math.cos(ang) * w;
        const dz = Math.sin(ang) * w;
        const tip = V(bx + Math.sin(ang) * lean, by + hh, bz - Math.cos(ang) * lean);
        g.rawTriangle(V(bx - dx, by, bz - dz), V(bx + dx, by, bz + dz), tip, [base.scale(0.55), base.scale(0.55), base.scale(1.15)], up, true);
      }
      if (rng() < 0.18) {
        const fc = hex(flowerCols[Math.floor(rng() * flowerCols.length)]);
        g.sphere(fc, { segments: 2, diameter: 0.16, flat: true }, { pos: [cx, h + 0.3, cz] });
      }
    }
  }

  /** Çam: katmanlı koni; katmanların altı koyu, karlıysa üstü beyaz. */
  private pine(g: GeometryBuilder, rng: Rng, snowy: boolean): void {
    g.cylinder('#5a3d26', { top: 0.24, bottom: 0.42, height: 2.2, tess: 7 }, { pos: [0, 1.1, 0] });
    const greens = snowy ? ['#2f5444', '#355e4c'] : ['#2b5f33', '#336b38', '#2a5a30', '#3b7040'];
    const green = hex(greens[Math.floor(rng() * greens.length)]);
    const snow = hex('#f2f6fa');
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const d = 3.8 - t * 2.5 + rng() * 0.3;
      const hh = 2.3 - t * 0.6;
      const y = 1.9 + i * 1.05;
      const bottom = y - hh / 2;
      const color = (_x: number, ly: number) => {
        const rel = Math.max(0, Math.min(1, (ly - bottom) / hh));
        let c = green.scale(0.6 + rel * 0.55);
        if (snowy && rel > 0.4) c = Color3.Lerp(c, snow, Math.min(1, (rel - 0.4) * 2.2));
        return c;
      };
      g.cylinder(color, { top: 0.05, bottom: d, height: hh, tess: 11 }, { pos: [0, y, 0], rot: [(rng() - 0.5) * 0.08, rng(), (rng() - 0.5) * 0.08] });
    }
  }

  /** Geniş yapraklı ağaç: dallar ve gürültüyle şekillendirilmiş yaprak kümeleri. */
  private broadleaf(g: GeometryBuilder, rng: Rng, colors: string[]): void {
    g.cylinder('#6a4a30', { top: 0.26, bottom: 0.45, height: 2.6, tess: 7 }, { pos: [0, 1.3, 0] });
    g.cylinder('#6a4a30', { top: 0.1, bottom: 0.2, height: 1.4, tess: 6 }, { pos: [0.45, 2.6, 0], rot: [0, 0, -0.7] });
    g.cylinder('#6a4a30', { top: 0.1, bottom: 0.2, height: 1.3, tess: 6 }, { pos: [-0.4, 2.7, 0.2], rot: [0.3, 0, 0.7] });
    const c = hex(colors[Math.floor(rng() * colors.length)]);
    const blobs = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + rng();
      const rr = i === 0 ? 0 : 0.9 + rng() * 0.5;
      const y = 3.6 + (i === 0 ? 0.6 : rng() * 0.8);
      const size = i === 0 ? 2.6 : 1.7 + rng() * 0.7;
      const shade = 0.85 + rng() * 0.3;
      const bottom = y - size * 0.45;
      g.sphere(
        (_x: number, ly: number) => c.scale(shade * (0.62 + Math.max(0, Math.min(1, (ly - bottom) / size)) * 0.55)),
        { segments: 7, diameter: size, noise: 0.18, seed: i * 17 + Math.floor(rng() * 100) },
        { pos: [Math.cos(a) * rr, y, Math.sin(a) * rr], scale: [1, 0.85, 1] },
      );
    }
  }

  private bush(g: GeometryBuilder, rng: Rng, color: string): void {
    const c = hex(color);
    for (let i = 0; i < 3; i++) {
      g.sphere(c.scale(0.85 + rng() * 0.3), { segments: 6, diameter: 1.2 + rng() * 0.6, noise: 0.15, seed: i * 5 }, {
        pos: [(rng() - 0.5) * 1.2, 0.5, (rng() - 0.5) * 1.2], scale: [1, 0.75, 1],
      });
    }
  }

  /** Palmiye: halkalı gövde ve sarkık, şeritli yapraklar. */
  private palm(g: GeometryBuilder, rng: Rng): void {
    const lean = 0.25 + rng() * 0.25;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 6; i++) {
      const h = 1.05;
      g.cylinder(i % 2 ? '#a8865a' : '#8e6c44', { top: 0.3 - i * 0.025, bottom: 0.36 - i * 0.025, height: h, tess: 8 }, {
        pos: [x, y + h / 2, 0], rot: [0, 0, -lean * (i / 6)],
      });
      x += Math.sin(lean * (i / 6)) * h;
      y += Math.cos(lean * (i / 6)) * h;
    }
    const top = V(x, y, 0);
    const leafCols = ['#3a9a48', '#48a856', '#2f8a3f'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng() * 0.3;
      const dir = V(Math.cos(a), 0, Math.sin(a));
      const side = V(-dir.z, 0, dir.x);
      const col = hex(leafCols[i % 3]);
      const segs = 6;
      const len = 3.2 + rng() * 0.6;
      let prevL = top;
      let prevR = top;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const w = Math.sin(t * Math.PI) * 0.55;
        const center = top.add(dir.scale(len * t)).add(V(0, t * 0.7 - t * t * 2.0, 0));
        const L = center.add(side.scale(w));
        const R = center.subtract(side.scale(w));
        const c = col.scale(0.75 + t * 0.35);
        g.doubleTriangle(prevL, L, prevR, c);
        g.doubleTriangle(prevR, L, R, c);
        prevL = L;
        prevR = R;
      }
    }
    g.sphere('#5a4028', { segments: 4, diameter: 0.4 }, { pos: [x + 0.2, y - 0.2, 0.2] });
    g.sphere('#5a4028', { segments: 4, diameter: 0.4 }, { pos: [x - 0.2, y - 0.25, -0.1] });
  }

  // ───────────── Kasaba ─────────────
  private buildTownDecor(isl: IslandDef, b: Builders): void {
    const tc = townCenter(isl);
    const rng = mulberry32(isl.seed * 13);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const r = isl.townRadius * 0.62;
      const x = tc.x + Math.cos(a) * r;
      const z = tc.z + Math.sin(a) * r;
      if (platformAt(x, z, 1)) continue;
      this.lampPost(b, x, terrainHeight(x, z), z);
    }
    for (let i = 0; i < 12; i++) {
      const p = townToWorld(isl, (rng() * 2 - 1) * isl.townRadius * 0.8, isl.townRadius * (0.1 + rng() * 0.5));
      if (platformAt(p.x, p.z, 1.5)) continue;
      if (Math.hypot(p.x - tc.x, p.z - tc.z) < 3) continue;
      const y = terrainHeight(p.x, p.z);
      const k = rng();
      if (k < 0.45) {
        b.wood.cylinder('#8a5a32', { top: 0.75, bottom: 0.75, height: 1.1, tess: 12 }, { pos: [p.x, y + 0.55, p.z] });
        b.metal.cylinder('#3a3a3a', { top: 0.79, bottom: 0.79, height: 0.08, tess: 12 }, { pos: [p.x, y + 0.25, p.z] });
        b.metal.cylinder('#3a3a3a', { top: 0.79, bottom: 0.79, height: 0.08, tess: 12 }, { pos: [p.x, y + 0.85, p.z] });
      } else if (k < 0.85) {
        b.wood.box('#b08a5a', { pos: [p.x, y + 0.45, p.z], size: [0.9, 0.9, 0.9], rot: [0, rng() * 3, 0] }, 0.08);
      } else {
        b.nature.sphere('#6a7a5a', { segments: 5, diameter: 1.2, noise: 0.2, seed: i }, { pos: [p.x, y + 0.2, p.z], scale: [1.2, 0.4, 1] });
      }
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.6 });
    }
    // Meydan çeşmesi (kamera yolunu kapatmasın diye meydanın kenarında)
    const fp = townToWorld(isl, -10, 3);
    const wy = terrainHeight(fp.x, fp.z);
    b.stone.cylinder('#9a948a', { top: 2.2, bottom: 2.4, height: 0.9, tess: 14, flat: true }, { pos: [fp.x, wy + 0.45, fp.z] });
    b.metal.cylinder('#2a6a94', { top: 1.8, bottom: 1.8, height: 0.05, tess: 14 }, { pos: [fp.x, wy + 0.82, fp.z] });
    b.stone.cylinder('#a8a298', { top: 0.3, bottom: 0.5, height: 1.6, tess: 10, flat: true }, { pos: [fp.x, wy + 1.4, fp.z] });
    b.stone.cylinder('#a8a298', { top: 1.0, bottom: 0.4, height: 0.3, tess: 10, flat: true }, { pos: [fp.x, wy + 2.3, fp.z] });
    this.colliders.push({ kind: 'circle', x: fp.x, z: fp.z, r: 1.4 });
  }

  private lampPost(b: Builders, x: number, y: number, z: number): void {
    b.metal.cylinder('#2a2a2e', { top: 0.1, bottom: 0.16, height: 3.4, tess: 8 }, { pos: [x, y + 1.7, z] });
    b.metal.cylinder('#2a2a2e', { top: 0.3, bottom: 0.3, height: 0.1, tess: 8 }, { pos: [x, y + 3.45, z] });
    b.lamps.cylinder('#ffd27a', { top: 0.32, bottom: 0.22, height: 0.5, tess: 8 }, { pos: [x, y + 3.75, z] });
    b.metal.cylinder('#2a2a2e', { top: 0.05, bottom: 0.55, height: 0.3, tess: 8 }, { pos: [x, y + 4.15, z] });
    this.colliders.push({ kind: 'circle', x, z, r: 0.3 });
  }

  /** Beşik çatı: mahya x ekseni boyunca, saçak altı ve alınlıklarla. */
  private gableRoof(b: Builders, w: number, d: number, h: number, rh: number, o: number, roofCol: ColorLike, wallCol: ColorLike): void {
    const X = w / 2 + o;
    const Z = d / 2 + o;
    const A = V(-X, h - 0.1, -Z);
    const B = V(X, h - 0.1, -Z);
    const C = V(X, h + rh, 0);
    const D = V(-X, h + rh, 0);
    const E = V(-X, h - 0.1, Z);
    const F = V(X, h - 0.1, Z);
    b.roof.quad(A, B, C, D, roofCol);
    b.roof.quad(F, E, D, C, roofCol);
    b.wood.quad(D, C, B, A, '#5a4030');
    b.wood.quad(C, D, E, F, '#5a4030');
    const W = w / 2;
    const Zw = d / 2;
    const peak = h + rh * (1 - o / Z) + 0.05;
    b.wall.doubleTriangle(V(-W, h, -Zw), V(-W, h, Zw), V(-W, peak, 0), wallCol);
    b.wall.doubleTriangle(V(W, h, -Zw), V(W, h, Zw), V(W, peak, 0), wallCol);
    b.wood.box('#4a3020', { pos: [0, h + rh + 0.05, 0], size: [w + o * 2 + 0.1, 0.18, 0.22] });
  }

  private buildBuilding(isl: IslandDef, bd: BuildingDef, b: Builders, labels: Mesh[]): void {
    const p = isl.style === 'station' ? this.stationToWorld(isl, bd.x, bd.f) : townToWorld(isl, bd.x, bd.f);
    const yaw = isl.dockAngle;
    let y: number;
    if (isl.style === 'station') y = isl.townHeight;
    else {
      const hw = bd.w / 2;
      const hd = bd.d / 2;
      const samples = [terrainHeight(p.x, p.z)];
      for (const [sx, sz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        samples.push(terrainHeight(p.x + sx * c + sz * s, p.z - sx * s + sz * c));
      }
      const low = Math.min(...samples);
      y = Math.max(...samples) + 0.25;
      b.stone.box('#8a8478', { pos: [p.x, (low + y) / 2 - 0.3, p.z], size: [bd.w + 0.5, y - low + 0.6, bd.d + 0.5], rot: [0, yaw, 0] });
    }
    this.setBaseAll(b, Matrix.Compose(Vector3.One(), qY(yaw), new Vector3(p.x, y, p.z)));

    if (bd.kind === 'lighthouse') {
      const seg = 8;
      for (let i = 0; i < seg; i++) {
        const h = bd.h / seg;
        const r0 = bd.w * (1 - (i / seg) * 0.35);
        const r1 = bd.w * (1 - ((i + 1) / seg) * 0.35);
        b.wall.cylinder(i % 2 ? bd.roof : bd.color, { top: r1, bottom: r0, height: h, tess: 20 }, { pos: [0, i * h + h / 2, 0] });
      }
      b.metal.cylinder('#3a3a3a', { top: bd.w * 1.0, bottom: bd.w * 0.9, height: 0.3, tess: 20 }, { pos: [0, bd.h + 0.15, 0] });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        b.metal.box('#2a2a2a', { pos: [Math.cos(a) * bd.w * 0.95, bd.h + 0.65, Math.sin(a) * bd.w * 0.95], size: [0.06, 0.8, 0.06] });
      }
      b.lamps.cylinder('#fff2a0', { top: bd.w * 0.5, bottom: bd.w * 0.5, height: 1.4, tess: 16 }, { pos: [0, bd.h + 1, 0] });
      b.roof.cylinder(bd.roof, { top: 0.1, bottom: bd.w * 0.85, height: 1.4, tess: 16 }, { pos: [0, bd.h + 2.4, 0] });
      this.lighthouseLamps.push(new Vector3(p.x, y + bd.h + 1, p.z));
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: bd.w * 0.75 });
    } else if (bd.kind === 'tower') {
      const g = isl.style === 'station' ? b.metal : b.wood;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.box(bd.color, { pos: [sx * bd.w * 0.5, bd.h / 2, sz * bd.d * 0.5], size: [0.3, bd.h, 0.3] });
      }
      for (let k = 1; k < 4; k++) g.box(bd.color, { pos: [0, (bd.h * k) / 4, bd.d * 0.5], size: [bd.w, 0.12, 0.12], rot: [0, 0, k % 2 ? 0.5 : -0.5] });
      g.box(bd.color, { pos: [0, bd.h, 0], size: [bd.w * 1.6, 0.3, bd.d * 1.6] });
      b.roof.cylinder(bd.roof, { top: 0, bottom: bd.w * 2.2, height: 1.6, tess: 4, flat: true }, { pos: [0, bd.h + 1.6, 0], rot: [0, Math.PI / 4, 0] });
      b.lamps.sphere('#ff4a3a', { segments: 6, diameter: 0.5 }, { pos: [0, bd.h + 2.6, 0] });
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: bd.w });
    } else if (bd.kind === 'container') {
      b.metal.box(bd.color, { pos: [0, bd.h / 2, 0], size: [bd.w, bd.h, bd.d] });
      const rib = mixColor(bd.color, '#000000', 0.18);
      for (let i = -4; i <= 4; i++) {
        b.metal.box(rib, { pos: [(i * bd.w) / 9, bd.h / 2, bd.d / 2 + 0.05], size: [0.12, bd.h * 0.92, 0.1] });
        b.metal.box(rib, { pos: [(i * bd.w) / 9, bd.h / 2, -bd.d / 2 - 0.05], size: [0.12, bd.h * 0.92, 0.1] });
      }
      b.metal.box(bd.roof, { pos: [0, bd.h + 0.1, 0], size: [bd.w + 0.2, 0.2, bd.d + 0.2] });
      b.metal.box('#2a2a2a', { pos: [0, 1.1, bd.d / 2 + 0.08], size: [1.4, 2.2, 0.1] });
      b.lamps.box('#bfe8ff', { pos: [bd.w * 0.3, 2.4, bd.d / 2 + 0.08], size: [1.4, 0.8, 0.06] });
      this.colliders.push({ kind: 'box', x: p.x, z: p.z, hw: bd.w / 2 + 0.3, hd: bd.d / 2 + 0.3, angle: yaw });
    } else {
      const wallCol = bd.color;
      b.wall.box(wallCol, { pos: [0, bd.h / 2, 0], size: [bd.w, bd.h, bd.d] });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        b.wood.box('#5a4030', { pos: [sx * (bd.w / 2), bd.h / 2, sz * (bd.d / 2)], size: [0.28, bd.h, 0.28] });
      }
      b.wood.box('#5a4030', { pos: [0, bd.h - 0.1, bd.d / 2 + 0.05], size: [bd.w + 0.1, 0.2, 0.14] });
      b.wood.box('#5a4030', { pos: [0, bd.h - 0.1, -bd.d / 2 - 0.05], size: [bd.w + 0.1, 0.2, 0.14] });
      this.gableRoof(b, bd.w, bd.d, bd.h, Math.min(bd.d * 0.45, 2.6), 0.55, bd.roof, wallCol);
      // Kapı
      b.wood.box('#5a3a22', { pos: [0, 1.15, bd.d / 2 + 0.06], size: [1.25, 2.3, 0.1] });
      b.wood.box('#f2ead8', { pos: [0, 2.36, bd.d / 2 + 0.08], size: [1.5, 0.14, 0.12] });
      b.metal.sphere('#d8b84a', { segments: 4, diameter: 0.1 }, { pos: [0.4, 1.15, bd.d / 2 + 0.14] });
      b.stone.box('#9a948a', { pos: [0, 0.08, bd.d / 2 + 0.5], size: [1.8, 0.16, 0.9] });
      // Pencereler: çerçeve, ışıklı cam, kayıt, panjurlar, çiçeklik
      const winY = Math.min(bd.h - 1.3, 2.1);
      const winXs = bd.w >= 9 ? [-0.32, 0.32] : bd.w >= 6 ? [-0.3, 0.3] : [];
      const shutter = mixColor(bd.roof, '#000000', 0.15);
      for (const fx of winXs) {
        const wx = fx * bd.w;
        b.wood.box('#f2ead8', { pos: [wx, winY, bd.d / 2 + 0.05], size: [1.25, 1.05, 0.08] });
        b.lamps.box('#ffe2a0', { pos: [wx, winY, bd.d / 2 + 0.09], size: [1.0, 0.82, 0.04] });
        b.wood.box('#f2ead8', { pos: [wx, winY, bd.d / 2 + 0.11], size: [0.06, 0.82, 0.04] });
        b.wood.box(shutter, { pos: [wx - 0.78, winY, bd.d / 2 + 0.07], size: [0.3, 1.05, 0.06] });
        b.wood.box(shutter, { pos: [wx + 0.78, winY, bd.d / 2 + 0.07], size: [0.3, 1.05, 0.06] });
        b.wood.box('#5a4030', { pos: [wx, winY - 0.58, bd.d / 2 + 0.16], size: [1.35, 0.1, 0.25] });
        b.nature.sphere('#d84a6a', { segments: 4, diameter: 0.3, noise: 0.1 }, { pos: [wx - 0.35, winY - 0.45, bd.d / 2 + 0.2], scale: [1.4, 0.7, 0.7] });
        b.nature.sphere('#4a8a3a', { segments: 4, diameter: 0.3, noise: 0.1 }, { pos: [wx + 0.3, winY - 0.45, bd.d / 2 + 0.2], scale: [1.4, 0.7, 0.7] });
      }
      for (const sx of [-1, 1]) {
        b.lamps.box('#ffe2a0', { pos: [sx * (bd.w / 2 + 0.03), winY, 0], size: [0.04, 0.8, 0.9] });
        b.wood.box('#f2ead8', { pos: [sx * (bd.w / 2 + 0.02), winY, 0], size: [0.05, 1.0, 1.1] });
      }
      if (bd.kind === 'house') {
        b.stone.box('#7a7068', { pos: [bd.w * 0.28, bd.h + 1.2, -bd.d * 0.18], size: [0.7, 2.2, 0.7] });
      }
      if (bd.kind === 'shop') {
        const aw = bd.w * 0.8;
        const stripes = 7;
        for (let i = 0; i < stripes; i++) {
          const sx = -aw / 2 + (i + 0.5) * (aw / stripes);
          b.wall.box(i % 2 ? '#f4f0e6' : bd.roof, { pos: [sx, 2.75, bd.d / 2 + 0.95], size: [aw / stripes + 0.01, 0.08, 1.9], rot: [0.28, 0, 0] });
        }
        b.wood.box('#8a6a48', { pos: [-aw / 2, 1.3, bd.d / 2 + 1.75], size: [0.12, 2.6, 0.12] });
        b.wood.box('#8a6a48', { pos: [aw / 2, 1.3, bd.d / 2 + 1.75], size: [0.12, 2.6, 0.12] });
        b.wood.box('#a07a50', { pos: [-bd.w * 0.3, 0.55, bd.d / 2 + 1.0], size: [1.6, 1.1, 0.8] });
      }
      this.colliders.push({ kind: 'box', x: p.x, z: p.z, hw: bd.w / 2 + 0.3, hd: bd.d / 2 + 0.3, angle: yaw });
    }
    this.setBaseAll(b, null);

    if (bd.label) {
      const tex = this.mats.textTexture(bd.label, { width: 512, height: 128, color: '#fff4d6', stroke: '#3a2412' });
      const w = Math.min(bd.w * 0.8, 5.4);
      const fw = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const out = bd.kind === 'shop' ? 2.05 : 0.25;
      const signY = bd.kind === 'container' ? bd.h + 0.9 : Math.min(bd.h + 0.4, 3.55);
      const back = { x: p.x + fw.x * (bd.d / 2 + out - 0.09), z: p.z + fw.z * (bd.d / 2 + out - 0.09) };
      b.wood.setBase(Matrix.Compose(Vector3.One(), qY(yaw), new Vector3(back.x, y + signY, back.z)));
      b.wood.box('#6a4528', { size: [w + 0.3, w / 4 + 0.25, 0.12] });
      b.wood.setBase(null);
      const sign = CreatePlane(`sign-${bd.label}`, { width: w, height: w / 4 }, this.scene);
      sign.position.set(p.x + fw.x * (bd.d / 2 + out), y + signY, p.z + fw.z * (bd.d / 2 + out));
      sign.rotation.y = yaw + Math.PI;
      sign.material = this.mats.labelMaterial(tex, `signMat-${bd.label}`);
      sign.isPickable = false;
      labels.push(sign);
    }
  }

  // ───────────── İskele ─────────────
  private buildDock(p: Platform, b: Builders): void {
    const base = Matrix.Compose(Vector3.One(), qY(p.angle), new Vector3(p.cx, 0, p.cz));
    b.wood.setBase(base);
    b.metal.setBase(base);
    const len = p.halfL * 2;
    const planks = Math.floor(len / 0.6);
    const rng = mulberry32(Math.floor(Math.abs(p.cx * 7 + p.cz)) + 1);
    for (let i = 0; i < planks; i++) {
      const f = -p.halfL + (i + 0.5) * (len / planks);
      b.wood.box(hex('#a07a52').scale(0.85 + rng() * 0.25), { pos: [0, p.top - 0.12, f], size: [p.halfW * 2, 0.2, len / planks - 0.06] });
    }
    for (const sx of [-1, 1]) b.wood.box('#6a4a30', { pos: [sx * (p.halfW - 0.3), p.top - 0.35, 0], size: [0.3, 0.3, len] });
    for (let f = -p.halfL + 1; f <= p.halfL; f += 4) {
      for (const sx of [-1, 1]) {
        b.wood.cylinder('#5a4030', { top: 0.32, bottom: 0.38, height: 9, tess: 10 }, { pos: [sx * (p.halfW - 0.15), p.top - 4.3, f] });
      }
    }
    for (let f = -p.halfL + 3; f <= p.halfL; f += 8) {
      for (const sx of [-1, 1]) {
        b.metal.cylinder('#2e2e30', { top: 0.22, bottom: 0.3, height: 0.5, tess: 10 }, { pos: [sx * (p.halfW - 0.35), p.top + 0.25, f] });
      }
    }
    b.wood.setBase(null);
    b.metal.setBase(null);
    const fw = { x: Math.sin(p.angle), z: Math.cos(p.angle) };
    const rt = { x: Math.cos(p.angle), z: -Math.sin(p.angle) };
    const endX = p.cx + fw.x * (p.halfL - 1) + rt.x * (p.halfW - 0.5);
    const endZ = p.cz + fw.z * (p.halfL - 1) + rt.z * (p.halfW - 0.5);
    this.lampPost(b, endX, p.top, endZ);
  }

  // ───────────── Derinlik Üssü ─────────────
  private stationToWorld(isl: IslandDef, x: number, f: number): { x: number; z: number } {
    const fw = islandForward(isl);
    return { x: isl.cx + fw.z * x + fw.x * f, z: isl.cz - fw.x * x + fw.z * f };
  }

  private buildStation(isl: IslandDef, b: Builders): void {
    const top = isl.townHeight;
    const base = Matrix.Compose(Vector3.One(), qY(isl.dockAngle), new Vector3(isl.cx, 0, isl.cz));
    const m = b.metal;
    m.setBase(base);
    b.lamps.setBase(base);
    m.box('#5a6470', { pos: [0, top - 0.3, 0], size: [40, 0.6, 40] });
    for (let i = -4; i <= 4; i++) m.box('#4a525c', { pos: [i * 4.5, top + 0.01, 0], size: [0.12, 0.04, 40] });
    m.cylinder('#e8b83a', { top: 9, bottom: 9, height: 0.05, tess: 32 }, { pos: [8, top + 0.03, 8] });
    m.cylinder('#5a6470', { top: 8.4, bottom: 8.4, height: 0.06, tess: 32 }, { pos: [8, top + 0.04, 8] });
    for (const x of [-18, -6, 6, 18]) {
      for (const z of [-18, -6, 6, 18]) {
        m.cylinder('#3a424c', { top: 1, bottom: 1.2, height: 40, tess: 12 }, { pos: [x, top - 20.6, z] });
      }
    }
    for (let i = -19; i <= 19; i += 2) {
      m.box('#e8b83a', { pos: [i, top + 0.55, -19.8], size: [0.12, 1.1, 0.12] });
      m.box('#e8b83a', { pos: [-19.8, top + 0.55, i], size: [0.12, 1.1, 0.12] });
      m.box('#e8b83a', { pos: [19.8, top + 0.55, i], size: [0.12, 1.1, 0.12] });
      if (Math.abs(i) > 3) m.box('#e8b83a', { pos: [i, top + 0.55, 19.8], size: [0.12, 1.1, 0.12] });
    }
    m.box('#e8b83a', { pos: [0, top + 1.1, -19.8], size: [40, 0.1, 0.12] });
    m.box('#e8b83a', { pos: [-19.8, top + 1.1, 0], size: [0.12, 0.1, 40] });
    m.box('#e8b83a', { pos: [19.8, top + 1.1, 0], size: [0.12, 0.1, 40] });
    m.box('#e8b83a', { pos: [-15, top + 5, 13], size: [0.9, 10, 0.9] });
    m.box('#e8b83a', { pos: [-11, top + 10, 13], size: [9, 0.7, 0.7] });
    m.cylinder('#2a2a2a', { top: 0.05, bottom: 0.05, height: 6, tess: 4 }, { pos: [-7, top + 7, 13] });
    for (const [x, z] of [[-19, -19], [19, -19], [-19, 19], [19, 19]]) {
      b.lamps.sphere('#7ad0ff', { segments: 6, diameter: 0.5 }, { pos: [x, top + 1.5, z] });
    }
    m.setBase(null);
    b.lamps.setBase(null);
  }

  // ───────────── Açık deniz dekoru ─────────────
  private buildOceanDecor(b: Builders): void {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = TRENCH.cx + Math.cos(a) * TRENCH.radius;
      const z = TRENCH.cz + Math.sin(a) * TRENCH.radius;
      b.wall.cylinder('#d83a3a', { top: 0.7, bottom: 1.3, height: 1.6, tess: 12 }, { pos: [x, 0.4, z] });
      b.wall.cylinder('#f4f4f4', { top: 0.35, bottom: 0.7, height: 0.8, tess: 12 }, { pos: [x, 1.6, z] });
      b.metal.cylinder('#2a2a2a', { top: 0.08, bottom: 0.08, height: 1.4, tess: 6 }, { pos: [x, 2.6, z] });
      b.lamps.sphere('#ffd23a', { segments: 6, diameter: 0.45 }, { pos: [x, 3.4, z] });
    }
    const rng = mulberry32(999);
    const spots = [
      [200, 190], [-220, 170], [260, -160], [-240, -200], [0, -330], [-120, 520], [300, 560], [560, 40], [-600, 40],
    ];
    for (const [sx, sz] of spots) {
      if (platformAt(sx, sz, 10)) continue;
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const x = sx + (rng() * 2 - 1) * 8;
        const z = sz + (rng() * 2 - 1) * 8;
        const s = 1.5 + rng() * 3.5;
        b.stone.ico(rng() < 0.3 ? '#8a8478' : '#6a645a', { radius: 1, subdivisions: 2, noise: 0.3, seed: i + sx }, {
          pos: [x, s * 0.25, z], rot: [rng(), rng() * 6, rng()], scale: [s * 1.3, s, s * 1.1],
        }, 0.05);
        this.colliders.push({ kind: 'circle', x, z, r: s * 1.1 });
      }
    }
  }
}

export function collidersPushOut(colliders: Collider[], x: number, z: number, radius: number): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    if (c.kind === 'circle') {
      const dx = px - c.x;
      const dz = pz - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        px = c.x + (dx / d) * min;
        pz = c.z + (dz / d) * min;
      }
    } else {
      const dx = px - c.x;
      const dz = pz - c.z;
      if (Math.abs(dx) > c.hw + c.hd + radius + 1 || Math.abs(dz) > c.hw + c.hd + radius + 1) continue;
      const s = Math.sin(c.angle);
      const co = Math.cos(c.angle);
      const lr = dx * co - dz * s;
      const lf = dx * s + dz * co;
      const hw = c.hw + radius;
      const hd = c.hd + radius;
      if (Math.abs(lr) < hw && Math.abs(lf) < hd) {
        const pen = [hw - Math.abs(lr), hd - Math.abs(lf)];
        let nr = lr;
        let nf = lf;
        if (pen[0] < pen[1]) nr = Math.sign(lr || 1) * hw;
        else nf = Math.sign(lf || 1) * hd;
        px = c.x + nr * co + nf * s;
        pz = c.z - nr * s + nf * co;
      }
    }
  }
  return { x: px, z: pz };
}
