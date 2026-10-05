/** Basit, deterministik 2B değer gürültüsü (arazi şekillendirme için). */

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** [-1, 1] aralığında yumuşak değer gürültüsü. */
export function valueNoise2(x: number, z: number, seed = 0): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = fade(fx);
  const v = fade(fz);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return (top + (bottom - top) * v) * 2 - 1;
}

/** Fraktal gürültü (fBm). */
export function fbm2(x: number, z: number, seed = 0, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, z * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Tohumlu sabit rastgele değer (prop yerleşimi için). */
export function hashFloat(n: number, seed = 0): number {
  return hash2(Math.floor(n), 7919, seed);
}
