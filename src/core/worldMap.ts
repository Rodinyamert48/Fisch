import { fbm2, valueNoise2 } from './noise';
import { lerp, smoothstep } from './rng';
import type { RegionId } from './types';
import { ISLANDS, SEA_FLOOR, TRENCH, type IslandDef } from './data/world';

export interface Vec2 {
  x: number;
  z: number;
}

/** Yürünebilir platform (iskele, istasyon) — y ekseni etrafında döndürülmüş dikdörtgen. */
export interface Platform {
  cx: number;
  cz: number;
  halfW: number;
  halfL: number;
  angle: number;
  top: number;
  kind: 'dock' | 'station';
}

export const BEACH_HEIGHT = 1.1;

export function islandForward(isl: IslandDef): Vec2 {
  return { x: Math.sin(isl.dockAngle), z: Math.cos(isl.dockAngle) };
}

export function islandRight(isl: IslandDef): Vec2 {
  const f = islandForward(isl);
  return { x: f.z, z: -f.x };
}

export function townCenter(isl: IslandDef): Vec2 {
  const f = islandForward(isl);
  const d = isl.radius * isl.townDist;
  return { x: isl.cx + f.x * d, z: isl.cz + f.z * d };
}

/** Kasabanın yerel (sağ, ileri) koordinatını dünya koordinatına çevirir. */
export function townToWorld(isl: IslandDef, x: number, f: number): Vec2 {
  const t = townCenter(isl);
  const fw = islandForward(isl);
  const r = islandRight(isl);
  return { x: t.x + r.x * x + fw.x * f, z: t.z + r.z * x + fw.z * f };
}

/** Tek bir ada için arazi yüksekliği. */
export function islandHeight(isl: IslandDef, x: number, z: number): number {
  if (isl.style === 'station') return SEA_FLOOR;
  const dx = x - isl.cx;
  const dz = z - isl.cz;
  const d = Math.hypot(dx, dz);
  const R = isl.radius;
  if (d > R * 2) return SEA_FLOOR;

  const ang = Math.atan2(dz, dx);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const wobble =
    1 + 0.15 * valueNoise2(ca * 1.6 + isl.seed, sa * 1.6, isl.seed) + 0.06 * valueNoise2(ca * 4.5, sa * 4.5 + isl.seed, isl.seed + 3);
  const t = d / (R * wobble);

  let h: number;
  if (t < 1) {
    const inland = 1 - t;
    let exponent = 1.7;
    if (isl.style === 'volcanic') exponent = 1.15;
    if (isl.style === 'snow') exponent = 1.9;
    h = BEACH_HEIGHT * smoothstep(0, 0.1, inland) + isl.peak * Math.pow(smoothstep(0.07, 1, inland), exponent);
    const rough = isl.style === 'snow' ? 6 : isl.style === 'volcanic' ? 3.5 : 4;
    h += fbm2(x * 0.03, z * 0.03, isl.seed, 4) * rough * smoothstep(0.06, 0.45, inland);
    if (isl.style === 'volcanic') {
      // Krater
      h -= isl.peak * 0.55 * smoothstep(0.8, 0.97, inland);
    }
  } else {
    h = -(t - 1) * R * 0.42;
    h += fbm2(x * 0.05, z * 0.05, isl.seed + 9, 2) * 1.5;
    h = Math.max(h, SEA_FLOOR);
  }

  // Kasaba düzlüğü
  const tc = townCenter(isl);
  const dt = Math.hypot(x - tc.x, z - tc.z);
  const w = smoothstep(isl.townRadius * 1.2, isl.townRadius * 0.82, dt);
  if (w > 0) h = lerp(h, isl.townHeight, w);
  return h;
}

/** Dünyadaki arazi yüksekliği (deniz tabanı dahil). */
export function terrainHeight(x: number, z: number): number {
  let h = SEA_FLOOR;
  for (const isl of ISLANDS) {
    if (isl.style === 'station') continue;
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    if (dx * dx + dz * dz > isl.radius * isl.radius * 4) continue;
    h = Math.max(h, islandHeight(isl, x, z));
  }
  // Abis Çukuru çukuru
  const dTrench = Math.hypot(x - TRENCH.cx, z - TRENCH.cz);
  if (dTrench < TRENCH.radius) {
    h = Math.min(h, lerp(SEA_FLOOR - 40, SEA_FLOOR, smoothstep(TRENCH.radius * 0.5, TRENCH.radius, dTrench)));
  }
  return h;
}

function buildPlatforms(): Platform[] {
  const list: Platform[] = [];
  for (const isl of ISLANDS) {
    if (isl.style === 'station') {
      list.push({ cx: isl.cx, cz: isl.cz, halfW: 20, halfL: 20, angle: isl.dockAngle, top: isl.townHeight, kind: 'station' });
      // istasyon iskelesi
      const f = islandForward(isl);
      list.push({
        cx: isl.cx + f.x * 30, cz: isl.cz + f.z * 30, halfW: 2.5, halfL: 10, angle: isl.dockAngle, top: 1.3, kind: 'dock',
      });
      continue;
    }
    const f = islandForward(isl);
    const start = isl.radius * isl.townDist + isl.townRadius * 0.75;
    const end = isl.radius * 1.0 + 30;
    const len = end - start;
    const mid = start + len / 2;
    list.push({
      cx: isl.cx + f.x * mid, cz: isl.cz + f.z * mid, halfW: 2.6, halfL: len / 2, angle: isl.dockAngle, top: 1.35, kind: 'dock',
    });
  }
  return list;
}

export const PLATFORMS: Platform[] = buildPlatforms();

export function platformAt(x: number, z: number, margin = 0): Platform | null {
  for (const p of PLATFORMS) {
    const dx = x - p.cx;
    const dz = z - p.cz;
    // yerel eksenler: ileri = (sin a, cos a), sağ = (cos a, -sin a)
    const s = Math.sin(p.angle);
    const c = Math.cos(p.angle);
    const lf = dx * s + dz * c;
    const lr = dx * c - dz * s;
    if (Math.abs(lr) <= p.halfW + margin && Math.abs(lf) <= p.halfL + margin) return p;
  }
  return null;
}

/** Yürünebilir zemin yüksekliği (arazi veya platform). */
export function groundHeight(x: number, z: number): number {
  const t = terrainHeight(x, z);
  const p = platformAt(x, z);
  return p ? Math.max(t, p.top) : t;
}

export function islandAt(x: number, z: number, useFishRadius = true): IslandDef | null {
  let best: IslandDef | null = null;
  let bestD = Infinity;
  for (const isl of ISLANDS) {
    if (isl.style === 'station') continue;
    const d = Math.hypot(x - isl.cx, z - isl.cz);
    const r = useFishRadius ? isl.fishRadius : isl.radius * 1.3;
    if (d < r && d < bestD) {
      best = isl;
      bestD = d;
    }
  }
  return best;
}

export function inTrench(x: number, z: number): boolean {
  return Math.hypot(x - TRENCH.cx, z - TRENCH.cz) < TRENCH.radius;
}

/**
 * Balık tutma bölgesi. Abis Çukuru yalnızca Batiskaf ile; aksi halde çukurda Açık Deniz havuzu kullanılır.
 */
export function regionAt(x: number, z: number, deepCapable: boolean): RegionId {
  const isl = islandAt(x, z, true);
  if (isl) return isl.id;
  if (inTrench(x, z)) return deepCapable ? 'abis' : 'acikdeniz';
  return 'acikdeniz';
}

/** Konumdaki bölge adı (HUD için). */
export function zoneNameAt(x: number, z: number): { name: string; region: RegionId | 'trench' } {
  const isl = islandAt(x, z, true);
  if (isl) return { name: isl.name, region: isl.id };
  if (inTrench(x, z)) return { name: 'Abis Çukuru', region: 'trench' };
  return { name: 'Açık Deniz', region: 'acikdeniz' };
}

/** Bir noktanın etrafında tekne için yeterince derin su arar. */
export function findWaterNear(x: number, z: number, minDepth = -1.6, clearance = 4.5): Vec2 | null {
  for (let r = 4; r <= 30; r += 2) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (terrainHeight(px, pz) < minDepth && !platformAt(px, pz, clearance)) {
        // Teknenin gövdesi için çevreyi de kontrol et
        let ok = true;
        for (let j = 0; j < 8 && ok; j++) {
          const b = (j / 8) * Math.PI * 2;
          if (terrainHeight(px + Math.cos(b) * clearance, pz + Math.sin(b) * clearance) > -1.0) ok = false;
        }
        if (ok) return { x: px, z: pz };
      }
    }
  }
  return null;
}

/** Bir noktaya en yakın yürünebilir (kuru) zemini arar. */
export function findLandNear(x: number, z: number, maxR = 9): { x: number; z: number; y: number } | null {
  let best: { x: number; z: number; y: number } | null = null;
  let bestD = Infinity;
  for (let r = 1; r <= maxR; r += 1) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      const g = groundHeight(px, pz);
      if (g > 0.15) {
        const d = r;
        if (d < bestD) {
          bestD = d;
          best = { x: px, z: pz, y: g };
        }
      }
    }
    if (best) return best;
  }
  return best;
}
