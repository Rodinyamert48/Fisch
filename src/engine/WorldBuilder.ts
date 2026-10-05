import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { ISLANDS, SEA_FLOOR, TRENCH, type BuildingDef, type IslandDef } from '../core/data/world';
import { valueNoise2 } from '../core/noise';
import { mulberry32, type Rng } from '../core/rng';
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
import { GeometryBuilder, hex, mixColor } from './geometry';
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
  props: Mesh[];
  lamps: Mesh[];
  labels: Mesh[];
  lava: Mesh[];
  seabed: Mesh;
}

/** Ada ve dekor üretimi. Tüm geometri prosedüreldir; dış varlık gerekmez. */
export class WorldBuilder {
  readonly colliders: Collider[] = [];
  readonly npcSpots: NpcSpot[] = [];
  readonly lavaPoints: Vector3[] = [];
  readonly lighthouseLamps: Vector3[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly mats: Materials,
    private readonly quality: 'low' | 'high',
  ) {}

  build(): WorldMeshes {
    const out: WorldMeshes = { terrain: [], props: [], lamps: [], labels: [], lava: [], seabed: this.buildSeabed() };
    const lamps = new GeometryBuilder();
    for (const isl of ISLANDS) {
      const props = new GeometryBuilder();
      if (isl.style === 'station') {
        this.buildStation(isl, props, lamps);
      } else {
        out.terrain.push(this.buildTerrain(isl));
        this.buildVegetation(isl, props);
        this.buildTownDecor(isl, props, lamps);
        if (isl.style === 'volcanic') out.lava.push(this.buildLava(isl));
      }
      for (const b of isl.buildings) this.buildBuilding(isl, b, props, lamps, out.labels);
      const mesh = props.build(`props-${isl.id}`, this.scene);
      mesh.material = this.mats.vertexColor;
      mesh.isPickable = false;
      out.props.push(mesh);
      isl.npcs.forEach((n, i) => {
        const p = isl.style === 'station' ? this.stationToWorld(isl, n.x, n.f) : townToWorld(isl, n.x, n.f);
        const y = isl.style === 'station' ? isl.townHeight : terrainHeight(p.x, p.z);
        this.npcSpots.push({ islandId: isl.id, npcIndex: i, x: p.x, y, z: p.z, yaw: isl.dockAngle });
        this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.7 });
      });
    }
    const docks = new GeometryBuilder();
    for (const p of PLATFORMS) if (p.kind === 'dock') this.buildDock(p, docks, lamps);
    this.buildOceanDecor(docks, lamps);
    const dockMesh = docks.build('docks', this.scene);
    dockMesh.material = this.mats.vertexColor;
    dockMesh.isPickable = false;
    out.props.push(dockMesh);

    const lampMesh = lamps.build('lamps', this.scene);
    lampMesh.material = this.mats.lamps;
    lampMesh.isPickable = false;
    out.lamps.push(lampMesh);
    out.terrain.push(this.buildTrench());
    for (const m of [...out.terrain, ...out.props]) m.freezeWorldMatrix();
    return out;
  }

  // ───────────── Arazi ─────────────
  private buildTerrain(isl: IslandDef): Mesh {
    const n = this.quality === 'high' ? 120 : 84;
    const ext = isl.radius * 1.8;
    const step = (ext * 2) / n;
    const x0 = isl.cx - ext;
    const z0 = isl.cz - ext;
    const H = new Float32Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        H[j * (n + 1) + i] = islandHeight(isl, x0 + i * step, z0 + j * step);
      }
    }
    const P = isl.palette;
    const tc = townCenter(isl);
    const pathColor = mixColor(P.sand, '#8a7a6a', 0.35);
    const g = new GeometryBuilder();
    const rng = mulberry32(isl.seed * 7);
    const faceColor = (a: Vector3, b: Vector3, c: Vector3): Color3 => {
      const avgH = (a.y + b.y + c.y) / 3;
      const cx = (a.x + b.x + c.x) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      const e1 = b.subtract(a);
      const e2 = c.subtract(a);
      const nrm = Vector3.Cross(e1, e2).normalize();
      const slope = 1 - Math.abs(nrm.y);
      let col: Color3;
      if (avgH < -0.35) {
        col = mixColor(P.sand, P.seabed, Math.min(1, -avgH / 8)).scale(0.92);
      } else if (avgH < BEACH_HEIGHT + 0.45 && slope < 0.55) {
        col = hex(P.sand);
      } else {
        const nz = valueNoise2(cx * 0.045, cz * 0.045, isl.seed + 5) * 0.5 + 0.5;
        col = mixColor(P.grass, P.grass2, isl.style === 'volcanic' ? Math.max(0, nz - 0.55) * 1.6 : nz);
        const dTown = Math.hypot(cx - tc.x, cz - tc.z);
        if (dTown < isl.townRadius * 0.62) col = pathColor;
        if (isl.style === 'temperate' && avgH > isl.peak * 0.8) col = mixColor(col, P.rock, 0.6);
        if (isl.style === 'volcanic') {
          if (avgH > isl.peak * 0.42) col = mixColor(P.rock, '#2a1d1d', Math.min(1, (avgH - isl.peak * 0.42) / 10));
        }
        if (isl.style === 'snow' && avgH > 16) col = hex(P.snow);
        if (slope > 0.5) col = mixColor(col, P.rock, Math.min(1, (slope - 0.5) * 3));
      }
      const j = 1 + (rng() * 2 - 1) * 0.035;
      return col.scale(j);
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const h00 = H[j * (n + 1) + i];
        const h10 = H[j * (n + 1) + i + 1];
        const h01 = H[(j + 1) * (n + 1) + i];
        const h11 = H[(j + 1) * (n + 1) + i + 1];
        if (Math.max(h00, h10, h01, h11) < SEA_FLOOR + 0.3) continue;
        const xa = x0 + i * step;
        const xb = xa + step;
        const za = z0 + j * step;
        const zb = za + step;
        const p00 = new Vector3(xa, h00, za);
        const p10 = new Vector3(xb, h10, za);
        const p01 = new Vector3(xa, h01, zb);
        const p11 = new Vector3(xb, h11, zb);
        g.triangle(p10, p11, p01, faceColor(p10, p11, p01));
        g.triangle(p00, p10, p01, faceColor(p00, p10, p01));
      }
    }
    const mesh = g.build(`terrain-${isl.id}`, this.scene);
    mesh.material = this.mats.vertexColor;
    mesh.isPickable = false;
    return mesh;
  }

  private buildSeabed(): Mesh {
    const m = CreateGround('seabed', { width: 3200, height: 3200, subdivisions: 1 }, this.scene);
    m.position.y = SEA_FLOOR - 0.4;
    m.material = this.mats.solid('#3d6a78');
    m.isPickable = false;
    m.freezeWorldMatrix();
    return m;
  }

  /** Derinlikler çukurunu sudan koyu gösteren degrade disk. */
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
    const disc = CreateDisc(`lava-${isl.id}`, { radius: isl.radius * 0.14, tessellation: 9 }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(isl.cx, y + 0.5, isl.cz);
    const m = new StandardMaterial('lavaMat', this.scene);
    m.diffuseColor = new Color3(1, 0.35, 0.05);
    m.emissiveColor = new Color3(1, 0.4, 0.05);
    m.disableLighting = true;
    disc.material = m;
    this.lavaPoints.push(new Vector3(isl.cx, y + 0.8, isl.cz));
    return disc;
  }

  // ───────────── Bitki örtüsü ve kayalar ─────────────
  private buildVegetation(isl: IslandDef, g: GeometryBuilder): void {
    const rng = mulberry32(isl.seed * 31 + 7);
    const tc = townCenter(isl);
    const count = Math.round((this.quality === 'high' ? 1 : 0.65) * (isl.style === 'volcanic' ? 110 : isl.style === 'snow' ? 120 : 150));
    let placed = 0;
    for (let tries = 0; tries < count * 6 && placed < count; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * isl.radius * 1.05;
      const x = isl.cx + Math.cos(a) * r;
      const z = isl.cz + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < BEACH_HEIGHT + 0.6) continue;
      if (Math.hypot(x - tc.x, z - tc.z) < isl.townRadius + 3) continue;
      if (platformAt(x, z, 4)) continue;
      const slope = Math.abs(terrainHeight(x + 1.5, z) - h) + Math.abs(terrainHeight(x, z + 1.5) - h);
      if (slope > 2.6) continue;
      if (isl.style === 'volcanic' && h > isl.peak * 0.45) continue;
      if (isl.style === 'snow' && h > 30) continue;
      const s = 0.8 + rng() * 0.6;
      g.setBase(Matrix.Compose(new Vector3(s, s, s), Quaternion_Y(rng() * Math.PI * 2), new Vector3(x, h - 0.2, z)));
      const kind = rng();
      if (isl.style === 'temperate') {
        if (kind < 0.6) this.pine(g, rng, false);
        else this.roundTree(g, rng, ['#4f9a3a', '#6aae3f', '#3f8a4a']);
      } else if (isl.style === 'volcanic') {
        if (kind < 0.65) this.palm(g, rng);
        else this.roundTree(g, rng, ['#e86a9a', '#ff8ab0', '#4fae6a']);
      } else {
        this.pine(g, rng, true);
      }
      g.setBase(null);
      this.colliders.push({ kind: 'circle', x, z, r: 0.6 * s });
      placed++;
    }
    // Kayalar
    const rocks = isl.style === 'snow' ? 40 : 30;
    for (let i = 0; i < rocks; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * isl.radius * 1.15;
      const x = isl.cx + Math.cos(a) * r;
      const z = isl.cz + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < -3 || Math.hypot(x - tc.x, z - tc.z) < isl.townRadius + 2 || platformAt(x, z, 4)) continue;
      const s = 0.6 + rng() * 1.8;
      const col = isl.style === 'snow' && rng() < 0.4 ? isl.palette.snow : isl.palette.rock;
      g.ico(col, { radius: 1, subdivisions: 0 }, { pos: [x, h + s * 0.2, z], rot: [rng(), rng() * 6, rng()], scale: [s * 1.2, s * 0.8, s] }, 0.05);
      if (h > 0) this.colliders.push({ kind: 'circle', x, z, r: s * 0.9 });
    }
    // Ada özel deniz dekoru
    if (isl.style === 'volcanic') {
      for (let i = 0; i < 70; i++) {
        const a = rng() * Math.PI * 2;
        const r = isl.radius * (0.95 + rng() * 0.35);
        const x = isl.cx + Math.cos(a) * r;
        const z = isl.cz + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        if (h > -0.8 || h < -9) continue;
        const cols = ['#ff6a8a', '#ffb03a', '#a05aff', '#3ae0c0', '#ff8a3a'];
        const c = cols[Math.floor(rng() * cols.length)];
        const s = 0.6 + rng() * 1.2;
        g.cylinder(c, { top: 0.05, bottom: 0.5 * s, height: 1.8 * s, tess: 5 }, { pos: [x, h + 0.8 * s, z], rot: [rng() * 0.4, 0, rng() * 0.4] });
        g.ico(c, { radius: 0.5 * s, subdivisions: 0 }, { pos: [x + 0.8, h + 0.3, z], scale: [1, 0.6, 1] });
      }
    }
    if (isl.style === 'snow') {
      for (let i = 0; i < 16; i++) {
        const a = rng() * Math.PI * 2;
        const r = isl.radius * (1.35 + rng() * 0.8);
        const x = isl.cx + Math.cos(a) * r;
        const z = isl.cz + Math.sin(a) * r;
        if (platformAt(x, z, 10)) continue;
        const s = 2 + rng() * 5;
        g.ico(rng() < 0.5 ? '#f4fbff' : '#d8eefa', { radius: 1, subdivisions: 1 }, { pos: [x, -s * 0.25, z], rot: [rng(), rng() * 6, 0], scale: [s * 1.4, s * 0.9, s] }, 0.03);
        this.colliders.push({ kind: 'circle', x, z, r: s * 1.2 });
      }
    }
  }

  private pine(g: GeometryBuilder, rng: Rng, snowy: boolean): void {
    g.cylinder('#6a4a2a', { top: 0.28, bottom: 0.42, height: 1.6, tess: 5 }, { pos: [0, 0.8, 0] });
    const greens = snowy ? ['#2f5a44', '#3a6a50'] : ['#2f7a3a', '#3a8a40', '#2a6a36'];
    const green = greens[Math.floor(rng() * greens.length)];
    const layers = [
      { d: 3.4, h: 2.4, y: 2.2 },
      { d: 2.7, h: 2.2, y: 3.5 },
      { d: 1.9, h: 2.0, y: 4.7 },
    ];
    for (const l of layers) {
      g.cylinder(green, { top: 0, bottom: l.d, height: l.h, tess: 6 }, { pos: [0, l.y, 0], rot: [0, rng(), 0] }, 0.05);
      if (snowy) g.cylinder('#f4f8ff', { top: 0, bottom: l.d * 0.45, height: l.h * 0.42, tess: 6 }, { pos: [0, l.y + l.h * 0.3, 0] });
    }
  }

  private roundTree(g: GeometryBuilder, rng: Rng, colors: string[]): void {
    g.cylinder('#7a5434', { top: 0.3, bottom: 0.45, height: 2.4, tess: 5 }, { pos: [0, 1.2, 0] });
    const c = colors[Math.floor(rng() * colors.length)];
    g.ico(c, { radius: 1.7, subdivisions: 1 }, { pos: [0, 3.4, 0], rot: [rng(), rng(), 0], scale: [1, 0.85, 1] }, 0.06);
    g.ico(c, { radius: 1.1, subdivisions: 0 }, { pos: [0.9, 2.9, 0.4], rot: [rng(), 0, 0] }, 0.06);
  }

  private palm(g: GeometryBuilder, rng: Rng): void {
    const lean = 0.25 + rng() * 0.25;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 5; i++) {
      const h = 1.2;
      g.cylinder(i % 2 ? '#b08a5a' : '#9a7448', { top: 0.32 - i * 0.03, bottom: 0.4 - i * 0.03, height: h, tess: 5 }, {
        pos: [x, y + h / 2, 0], rot: [0, 0, -lean * (i / 5)],
      });
      x += Math.sin(lean * (i / 5)) * h;
      y += Math.cos(lean * (i / 5)) * h;
    }
    const top = new Vector3(x, y, 0);
    const leafCol = ['#3aa04a', '#4ab85a', '#2f8a3f'];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng() * 0.3;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new Vector3(-dir.z, 0, dir.x).scale(0.45);
      const mid = top.add(dir.scale(1.6)).add(new Vector3(0, 0.35, 0));
      const tip = top.add(dir.scale(3.1)).add(new Vector3(0, -0.9, 0));
      const c = leafCol[i % 3];
      g.doubleTriangle(top, mid.add(side), mid.subtract(side), c);
      g.doubleTriangle(mid.add(side), tip, mid.subtract(side), c);
    }
    g.sphere('#6a4a2a', { segments: 2, diameter: 0.4 }, { pos: [x + 0.2, y - 0.2, 0.2] });
    g.sphere('#6a4a2a', { segments: 2, diameter: 0.4 }, { pos: [x - 0.2, y - 0.25, -0.1] });
  }

  // ───────────── Kasaba ─────────────
  private buildTownDecor(isl: IslandDef, g: GeometryBuilder, lamps: GeometryBuilder): void {
    const tc = townCenter(isl);
    const rng = mulberry32(isl.seed * 13);
    // Lamba direkleri plaza çevresinde
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const r = isl.townRadius * 0.62;
      const x = tc.x + Math.cos(a) * r;
      const z = tc.z + Math.sin(a) * r;
      if (platformAt(x, z, 1)) continue;
      const y = terrainHeight(x, z);
      this.lampPost(g, lamps, x, y, z);
    }
    // Varil ve sandıklar
    for (let i = 0; i < 10; i++) {
      const p = townToWorld(isl, (rng() * 2 - 1) * isl.townRadius * 0.8, isl.townRadius * (0.1 + rng() * 0.5));
      if (platformAt(p.x, p.z, 1.5)) continue;
      const y = terrainHeight(p.x, p.z);
      if (rng() < 0.5) g.cylinder('#8a5a32', { top: 0.8, bottom: 0.8, height: 1.1, tess: 7 }, { pos: [p.x, y + 0.55, p.z] }, 0.05);
      else g.box('#a87a4a', { pos: [p.x, y + 0.45, p.z], size: [0.9, 0.9, 0.9], rot: [0, rng() * 3, 0] }, 0.06);
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.6 });
    }
  }

  private lampPost(g: GeometryBuilder, lamps: GeometryBuilder, x: number, y: number, z: number): void {
    g.cylinder('#2a2a2e', { top: 0.12, bottom: 0.18, height: 3.4, tess: 5 }, { pos: [x, y + 1.7, z] });
    g.box('#2a2a2e', { pos: [x, y + 3.45, z], size: [0.5, 0.12, 0.5] });
    lamps.box('#ffd27a', { pos: [x, y + 3.75, z], size: [0.38, 0.5, 0.38] });
    g.cylinder('#2a2a2e', { top: 0, bottom: 0.6, height: 0.3, tess: 4 }, { pos: [x, y + 4.15, z], rot: [0, Math.PI / 4, 0] });
    this.colliders.push({ kind: 'circle', x, z, r: 0.3 });
  }

  private buildBuilding(isl: IslandDef, b: BuildingDef, g: GeometryBuilder, lamps: GeometryBuilder, labels: Mesh[]): void {
    const p = isl.style === 'station' ? this.stationToWorld(isl, b.x, b.f) : townToWorld(isl, b.x, b.f);
    const yaw = isl.dockAngle;
    let y: number;
    if (isl.style === 'station') y = isl.townHeight;
    else {
      // Binayı zemindeki en alçak noktaya otur, temel ekle
      const hw = b.w / 2;
      const hd = b.d / 2;
      const samples = [terrainHeight(p.x, p.z)];
      for (const [sx, sz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        samples.push(terrainHeight(p.x + sx * c + sz * s, p.z - sx * s + sz * c));
      }
      y = Math.min(...samples);
      const top = Math.max(...samples);
      if (top - y > 0.1) g.box('#8a8078', { pos: [p.x, y + (top - y) / 2 - 0.3, p.z], size: [b.w + 0.4, top - y + 0.6, b.d + 0.4], rot: [0, yaw, 0] });
      y = top;
    }
    const base = Matrix.Compose(Vector3.One(), Quaternion_Y(yaw), new Vector3(p.x, y, p.z));
    g.setBase(base);
    lamps.setBase(base);
    if (b.kind === 'lighthouse') {
      const seg = 6;
      for (let i = 0; i < seg; i++) {
        const h = b.h / seg;
        const r0 = b.w * (1 - (i / seg) * 0.35);
        const r1 = b.w * (1 - ((i + 1) / seg) * 0.35);
        g.cylinder(i % 2 ? b.roof : b.color, { top: r1, bottom: r0, height: h, tess: 8 }, { pos: [0, i * h + h / 2, 0] });
      }
      g.cylinder('#3a3a3a', { top: b.w * 0.9, bottom: b.w * 0.9, height: 0.3, tess: 8 }, { pos: [0, b.h + 0.15, 0] });
      lamps.cylinder('#fff2a0', { top: b.w * 0.5, bottom: b.w * 0.5, height: 1.4, tess: 8 }, { pos: [0, b.h + 1, 0] });
      g.cylinder(b.roof, { top: 0, bottom: b.w * 0.8, height: 1.4, tess: 8 }, { pos: [0, b.h + 2.4, 0] });
      this.lighthouseLamps.push(new Vector3(p.x, y + b.h + 1, p.z));
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: b.w * 0.7 });
    } else if (b.kind === 'tower') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.box(b.color, { pos: [sx * b.w * 0.5, b.h / 2, sz * b.d * 0.5], size: [0.3, b.h, 0.3] });
      }
      g.box(b.color, { pos: [0, b.h, 0], size: [b.w * 1.6, 0.3, b.d * 1.6] });
      g.cylinder(b.roof, { top: 0, bottom: b.w * 2.2, height: 1.6, tess: 4 }, { pos: [0, b.h + 1.6, 0], rot: [0, Math.PI / 4, 0] });
      lamps.sphere('#ff4a3a', { segments: 3, diameter: 0.6 }, { pos: [0, b.h + 2.6, 0] });
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: b.w });
    } else {
      // Gövde
      g.box(b.color, { pos: [0, b.h / 2, 0], size: [b.w, b.h, b.d] }, 0.02);
      if (b.kind === 'container') {
        for (let i = -2; i <= 2; i++) g.box(mixColor(b.color, '#000000', 0.15), { pos: [i * (b.w / 5), b.h / 2, b.d / 2 + 0.05], size: [0.15, b.h * 0.95, 0.12] });
        g.box(b.roof, { pos: [0, b.h + 0.15, 0], size: [b.w + 0.3, 0.3, b.d + 0.3] });
      } else {
        this.pyramidRoof(g, b.roof, b.w * 1.18, b.d * 1.18, b.h * 0.55, b.h);
        // baca
        if (b.kind === 'house') g.box('#6a5a50', { pos: [b.w * 0.25, b.h + b.h * 0.35, -b.d * 0.15], size: [0.6, b.h * 0.6, 0.6] });
      }
      // Kapı ve pencereler
      g.box('#4a2e1a', { pos: [0, 1.1, b.d / 2 + 0.03], size: [1.3, 2.2, 0.12] });
      const winY = Math.min(b.h - 1.2, 2.2);
      for (const sx of [-1, 1]) {
        if (b.w < 5) continue;
        lamps.box('#ffe08a', { pos: [sx * b.w * 0.3, winY, b.d / 2 + 0.04], size: [1.1, 0.9, 0.1] });
        g.box('#3a2a1a', { pos: [sx * b.w * 0.3, winY, b.d / 2 + 0.02], size: [1.35, 1.15, 0.08] });
      }
      if (b.kind === 'shop') {
        // tente
        g.box(b.roof, { pos: [0, 2.7, b.d / 2 + 0.9], size: [b.w * 0.8, 0.15, 1.8], rot: [0.25, 0, 0] });
      }
      this.colliders.push({ kind: 'box', x: p.x, z: p.z, hw: b.w / 2 + 0.3, hd: b.d / 2 + 0.3, angle: yaw });
    }
    g.setBase(null);
    lamps.setBase(null);

    if (b.label) {
      const tex = this.mats.textTexture(b.label, { width: 512, height: 128, bg: 'rgba(40,28,18,0.92)', color: '#ffe9b0' });
      const sign = CreatePlane(`sign-${b.label}`, { width: Math.min(b.w * 0.9, 6), height: Math.min(b.w * 0.9, 6) / 4 }, this.scene);
      const fw = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const signY = b.kind === 'container' ? b.h + 1 : Math.min(b.h - 0.5, 3.6);
      sign.position.set(p.x + fw.x * (b.d / 2 + (b.kind === 'shop' ? 1.9 : 0.2)), y + signY, p.z + fw.z * (b.d / 2 + (b.kind === 'shop' ? 1.9 : 0.2)));
      sign.rotation.y = yaw + Math.PI;
      sign.material = this.mats.labelMaterial(tex, `signMat-${b.label}`);
      sign.isPickable = false;
      labels.push(sign);
    }
  }

  private pyramidRoof(g: GeometryBuilder, color: string, w: number, d: number, h: number, y: number): void {
    const vd = CreateCylinderVertexData({ diameterTop: 0, diameterBottom: Math.SQRT2, height: 1, tessellation: 4 });
    vd.transform(Matrix.RotationY(Math.PI / 4));
    g.addVertexData(vd, color, { pos: [0, y + h / 2, 0], scale: [w, h, d] });
  }

  // ───────────── İskele ─────────────
  private buildDock(p: Platform, g: GeometryBuilder, lamps: GeometryBuilder): void {
    const base = Matrix.Compose(Vector3.One(), Quaternion_Y(p.angle), new Vector3(p.cx, 0, p.cz));
    g.setBase(base);
    const len = p.halfL * 2;
    const planks = Math.floor(len / 1.1);
    for (let i = 0; i < planks; i++) {
      const f = -p.halfL + (i + 0.5) * (len / planks);
      g.box(i % 3 === 0 ? '#9a7048' : i % 3 === 1 ? '#a87a50' : '#8f6842', {
        pos: [0, p.top - 0.15, f], size: [p.halfW * 2, 0.28, len / planks - 0.08],
      });
    }
    for (let f = -p.halfL + 1; f <= p.halfL; f += 5) {
      for (const sx of [-1, 1]) {
        g.cylinder('#6a4a2e', { top: 0.32, bottom: 0.36, height: 9, tess: 6 }, { pos: [sx * (p.halfW - 0.2), p.top - 4.2, f] });
      }
    }
    // Uçta lamba
    g.setBase(null);
    lamps.setBase(null);
    const fw = { x: Math.sin(p.angle), z: Math.cos(p.angle) };
    const rt = { x: Math.cos(p.angle), z: -Math.sin(p.angle) };
    const endX = p.cx + fw.x * (p.halfL - 1) + rt.x * (p.halfW - 0.5);
    const endZ = p.cz + fw.z * (p.halfL - 1) + rt.z * (p.halfW - 0.5);
    this.lampPost(g, lamps, endX, p.top, endZ);
  }

  // ───────────── Derin Deniz İstasyonu ─────────────
  private stationToWorld(isl: IslandDef, x: number, f: number): { x: number; z: number } {
    const fw = islandForward(isl);
    return { x: isl.cx + fw.z * x + fw.x * f, z: isl.cz - fw.x * x + fw.z * f };
  }

  private buildStation(isl: IslandDef, g: GeometryBuilder, lamps: GeometryBuilder): void {
    const top = isl.townHeight;
    const base = Matrix.Compose(Vector3.One(), Quaternion_Y(isl.dockAngle), new Vector3(isl.cx, 0, isl.cz));
    g.setBase(base);
    lamps.setBase(base);
    g.box('#5a6470', { pos: [0, top - 0.3, 0], size: [40, 0.6, 40] });
    for (let i = -2; i <= 2; i++) {
      g.box('#4a525c', { pos: [i * 8, top + 0.02, 0], size: [0.2, 0.05, 40] });
    }
    for (const x of [-18, -6, 6, 18]) {
      for (const z of [-18, -6, 6, 18]) {
        g.cylinder('#3a424c', { top: 1, bottom: 1.2, height: 40, tess: 6 }, { pos: [x, top - 20.6, z] });
      }
    }
    // Korkuluklar (iskele tarafı açık)
    for (let i = -19; i <= 19; i += 2) {
      g.box('#e8b83a', { pos: [i, top + 0.55, -19.8], size: [0.15, 1.1, 0.15] });
      g.box('#e8b83a', { pos: [-19.8, top + 0.55, i], size: [0.15, 1.1, 0.15] });
      g.box('#e8b83a', { pos: [19.8, top + 0.55, i], size: [0.15, 1.1, 0.15] });
      if (Math.abs(i) > 3) g.box('#e8b83a', { pos: [i, top + 0.55, 19.8], size: [0.15, 1.1, 0.15] });
    }
    g.box('#e8b83a', { pos: [0, top + 1.1, -19.8], size: [40, 0.12, 0.15] });
    g.box('#e8b83a', { pos: [-19.8, top + 1.1, 0], size: [0.15, 0.12, 40] });
    g.box('#e8b83a', { pos: [19.8, top + 1.1, 0], size: [0.15, 0.12, 40] });
    // Vinç
    g.box('#e8b83a', { pos: [-14, top + 5, 12], size: [1, 10, 1] });
    g.box('#e8b83a', { pos: [-10, top + 10, 12], size: [9, 0.8, 0.8] });
    g.cylinder('#2a2a2a', { top: 0.05, bottom: 0.05, height: 6, tess: 3 }, { pos: [-6, top + 7, 12] });
    for (const [x, z] of [[-19, -19], [19, -19], [-19, 19], [19, 19]]) {
      lamps.sphere('#7ad0ff', { segments: 3, diameter: 0.5 }, { pos: [x, top + 1.5, z] });
    }
    g.setBase(null);
    lamps.setBase(null);
  }

  // ───────────── Açık deniz dekoru ─────────────
  private buildOceanDecor(g: GeometryBuilder, lamps: GeometryBuilder): void {
    // Derinlikler şamandıraları
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = TRENCH.cx + Math.cos(a) * TRENCH.radius;
      const z = TRENCH.cz + Math.sin(a) * TRENCH.radius;
      g.cylinder('#e83a3a', { top: 0.6, bottom: 1.2, height: 1.6, tess: 6 }, { pos: [x, 0.4, z] });
      g.cylinder('#ffffff', { top: 0.3, bottom: 0.6, height: 0.8, tess: 6 }, { pos: [x, 1.6, z] });
      g.cylinder('#2a2a2a', { top: 0.08, bottom: 0.08, height: 1.4, tess: 4 }, { pos: [x, 2.6, z] });
      lamps.sphere('#ffd23a', { segments: 3, diameter: 0.45 }, { pos: [x, 3.4, z] });
    }
    // Açık denizde kaya adacıkları (yön bulmak için)
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
        g.ico(rng() < 0.3 ? '#8a8478' : '#6a645a', { radius: 1, subdivisions: 0 }, {
          pos: [x, s * 0.25, z], rot: [rng(), rng() * 6, rng()], scale: [s * 1.3, s, s * 1.1],
        }, 0.05);
        this.colliders.push({ kind: 'circle', x, z, r: s * 1.1 });
      }
    }
  }
}

function Quaternion_Y(yaw: number): Quaternion {
  return Quaternion.RotationYawPitchRoll(yaw, 0, 0);
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
      // yerel: sağ = (cos, -sin), ileri = (sin, cos)
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
