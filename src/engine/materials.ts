import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { mulberry32 } from '../core/rng';
import { hex, type ColorLike } from './geometry';

// ─────────────── Prosedürel doku üretimi ───────────────

/** Döşenebilir (periyodik) değer gürültüsü. */
function tileNoise(size: number, period: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const lattice = new Float32Array(period * period);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period;
      const fy = (y / size) * period;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      let tx = fx - ix;
      let ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx);
      ty = ty * ty * (3 - 2 * ty);
      const a = lattice[(iy % period) * period + (ix % period)];
      const b = lattice[(iy % period) * period + ((ix + 1) % period)];
      const c = lattice[((iy + 1) % period) * period + (ix % period)];
      const d = lattice[((iy + 1) % period) * period + ((ix + 1) % period)];
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

function fbmTile(size: number, seed: number, octaves = 5, basePeriod = 4): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(size, basePeriod << o, seed + o * 31);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    norm += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** Yükseklik alanından (0-1) normal haritası. */
function normalFromHeight(h: Float32Array, size: number, strength: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
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
  return data;
}

function grayToRGBA(v: Float32Array, size: number, tint: [number, number, number] = [1, 1, 1]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const g = Math.max(0, Math.min(1, v[i]));
    data[i * 4] = Math.round(g * tint[0] * 255);
    data[i * 4 + 1] = Math.round(g * tint[1] * 255);
    data[i * 4 + 2] = Math.round(g * tint[2] * 255);
    data[i * 4 + 3] = 255;
  }
  return data;
}

interface TexPair {
  diffuse: Float32Array;
  height: Float32Array;
  size: number;
}

function makeDetail(size: number, seed: number): TexPair {
  const n = fbmTile(size, seed, 6, 4);
  const fine = tileNoise(size, 64, seed + 99);
  const diffuse = new Float32Array(size * size);
  for (let i = 0; i < diffuse.length; i++) diffuse[i] = 0.74 + n[i] * 0.22 + (fine[i] - 0.5) * 0.08;
  return { diffuse, height: n, size };
}

function makePlanks(size: number, seed: number): TexPair {
  const rnd = mulberry32(seed);
  const grain = fbmTile(size, seed + 5, 4, 2);
  const diffuse = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  const rows = 8;
  const rowH = size / rows;
  const rowShade: number[] = [];
  const rowOffset: number[] = [];
  for (let r = 0; r < rows; r++) {
    rowShade.push(0.78 + rnd() * 0.18);
    rowOffset.push(Math.floor(rnd() * size));
  }
  for (let y = 0; y < size; y++) {
    const r = Math.floor(y / rowH);
    const inRow = (y % rowH) / rowH;
    for (let x = 0; x < size; x++) {
      const xx = (x + rowOffset[r]) % size;
      const g = grain[y * size + ((xx * 3) % size)];
      const streak = Math.sin((xx / size) * Math.PI * 2 * 3 + g * 9 + inRow * 2) * 0.5 + 0.5;
      let v = rowShade[r] * (0.86 + streak * 0.1 + g * 0.08);
      let h = 0.6 + g * 0.2;
      // Tahta arası boşluk ve uç birleşimleri
      const gap = inRow < 0.06 || inRow > 0.96;
      const joint = xx % (size / 2) < 3;
      if (gap || joint) {
        v *= 0.45;
        h = 0.1;
      }
      diffuse[y * size + x] = v;
      height[y * size + x] = h;
    }
  }
  return { diffuse, height, size };
}

function makeShingles(size: number, seed: number): TexPair {
  const rnd = mulberry32(seed);
  const n = fbmTile(size, seed + 3, 4, 4);
  const diffuse = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  const rows = 8;
  const cols = 8;
  const rh = size / rows;
  const cw = size / cols;
  const shade: number[] = [];
  for (let i = 0; i < rows * cols; i++) shade.push(0.75 + rnd() * 0.25);
  for (let y = 0; y < size; y++) {
    const r = Math.floor(y / rh);
    const ty = (y % rh) / rh;
    for (let x = 0; x < size; x++) {
      const xx = (x + (r % 2) * (cw / 2)) % size;
      const c = Math.floor(xx / cw);
      const tx = (xx % cw) / cw;
      // Alt kenarı yuvarlatılmış kiremit
      const edge = Math.min(tx, 1 - tx);
      const bottom = ty > 0.86 - Math.pow(Math.abs(tx - 0.5) * 2, 2) * 0.12;
      let v = shade[r * cols + c] * (0.85 + n[y * size + x] * 0.2) * (0.75 + ty * 0.25);
      let h = 0.4 + ty * 0.5;
      if (edge < 0.04 || bottom) {
        v *= 0.5;
        h = 0.05;
      }
      diffuse[y * size + x] = v;
      height[y * size + x] = h;
    }
  }
  return { diffuse, height, size };
}

function makeSiding(size: number, seed: number): TexPair {
  const n = fbmTile(size, seed, 5, 4);
  const diffuse = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  const boards = 8;
  const bh = size / boards;
  for (let y = 0; y < size; y++) {
    const t = (y % bh) / bh;
    for (let x = 0; x < size; x++) {
      const g = n[y * size + x];
      // Yatay ahşap kaplama: her tahtanın altında gölge çizgisi
      let v = 0.9 + g * 0.1 - t * 0.06;
      let h = 0.3 + t * 0.6;
      if (t > 0.92) {
        v *= 0.6;
        h = 0;
      }
      diffuse[y * size + x] = v;
      height[y * size + x] = h;
    }
  }
  return { diffuse, height, size };
}

function makeStone(size: number, seed: number): TexPair {
  const rnd = mulberry32(seed);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 34; i++) pts.push([rnd() * size, rnd() * size, 0.7 + rnd() * 0.3]);
  const n = fbmTile(size, seed + 7, 5, 4);
  const diffuse = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      let shade = 1;
      for (const [px, py, s] of pts) {
        let dx = Math.abs(x - px);
        let dy = Math.abs(y - py);
        dx = Math.min(dx, size - dx);
        dy = Math.min(dy, size - dy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          shade = s;
        } else if (d < d2) d2 = d;
      }
      const edge = Math.min(1, (d2 - d1) / 6);
      const g = n[y * size + x];
      diffuse[y * size + x] = shade * (0.55 + edge * 0.35) * (0.85 + g * 0.25);
      height[y * size + x] = edge * 0.8 + g * 0.2;
    }
  }
  return { diffuse, height, size };
}

/** Paylaşılan materyaller ve prosedürel dokular. */
export class Materials {
  /** Dokusuz, köşe renkli genel materyal. */
  readonly vertexColor: StandardMaterial;
  readonly terrain: StandardMaterial;
  readonly nature: StandardMaterial;
  readonly wood: StandardMaterial;
  readonly roof: StandardMaterial;
  readonly wall: StandardMaterial;
  readonly stone: StandardMaterial;
  readonly metal: StandardMaterial;
  readonly character: StandardMaterial;
  readonly foam: StandardMaterial;
  /** Gece yanan lambalar vb. için köşe renkli, yayıcı materyal. */
  readonly lamps: StandardMaterial;
  private cache = new Map<string, StandardMaterial>();
  private _flare: Texture | null = null;

  constructor(
    private readonly scene: Scene,
    quality: 'low' | 'high',
  ) {
    const S = quality === 'high' ? 512 : 256;
    const detail = makeDetail(S, 11);
    const detailTex = this.rawTex(grayToRGBA(detail.diffuse, S), S);
    const detailNrm = this.rawTex(normalFromHeight(detail.height, S, 3), S);

    this.vertexColor = this.make('vcol', { specular: 0.06 });
    this.terrain = this.make('terrain', { diffuse: detailTex, bump: detailNrm, bumpLevel: 0.6, specular: 0.04, diffuseBoost: 1.22 });
    this.nature = this.make('nature', { diffuse: detailTex, bump: detailNrm, bumpLevel: 0.5, specular: 0.05, diffuseBoost: 1.2 });

    const planks = makePlanks(S, 21);
    this.wood = this.make('wood', {
      diffuse: this.rawTex(grayToRGBA(planks.diffuse, S, [1, 0.97, 0.92]), S),
      bump: this.rawTex(normalFromHeight(planks.height, S, 2.5), S),
      bumpLevel: 0.7,
      specular: 0.08,
      diffuseBoost: 1.1,
    });
    const shingles = makeShingles(S, 31);
    this.roof = this.make('roof', {
      diffuse: this.rawTex(grayToRGBA(shingles.diffuse, S), S),
      bump: this.rawTex(normalFromHeight(shingles.height, S, 3), S),
      bumpLevel: 0.8,
      specular: 0.1,
      diffuseBoost: 1.15,
    });
    const siding = makeSiding(S, 41);
    this.wall = this.make('wall', {
      diffuse: this.rawTex(grayToRGBA(siding.diffuse, S), S),
      bump: this.rawTex(normalFromHeight(siding.height, S, 2), S),
      bumpLevel: 0.5,
      specular: 0.05,
      diffuseBoost: 1.05,
    });
    const stone = makeStone(S, 51);
    this.stone = this.make('stone', {
      diffuse: this.rawTex(grayToRGBA(stone.diffuse, S), S),
      bump: this.rawTex(normalFromHeight(stone.height, S, 3), S),
      bumpLevel: 0.9,
      specular: 0.06,
      diffuseBoost: 1.25,
    });
    this.metal = this.make('metal', { diffuse: detailTex, specular: 0.45, specularPower: 48, diffuseBoost: 1.15 });
    this.character = this.make('character', { specular: 0.12, specularPower: 24 });

    // Kıyı köpüğü: beyaz, gürültü desenli saydam doku
    const foamN = fbmTile(256, 61, 5, 8);
    const foamData = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < 256 * 256; i++) {
      const a = Math.max(0, Math.min(1, (foamN[i] - 0.38) * 2.6));
      foamData[i * 4] = foamData[i * 4 + 1] = foamData[i * 4 + 2] = 255;
      foamData[i * 4 + 3] = Math.round(a * 255);
    }
    const foamTex = this.rawTex(foamData, 256);
    foamTex.hasAlpha = true;
    this.foam = new StandardMaterial('foam', scene);
    this.foam.diffuseTexture = foamTex;
    this.foam.useAlphaFromDiffuseTexture = true;
    this.foam.diffuseColor = new Color3(1, 1, 1);
    this.foam.specularColor = Color3.Black();
    this.foam.emissiveColor = new Color3(0.25, 0.28, 0.3);
    this.foam.backFaceCulling = false;

    this.lamps = new StandardMaterial('lamps', scene);
    this.lamps.diffuseColor = Color3.White();
    this.lamps.specularColor = Color3.Black();
    this.lamps.emissiveColor = new Color3(0.2, 0.2, 0.2);
  }

  /** Tüm dokulu materyaller (mevsim/aydınlatma ayarı için). */
  get tintable(): StandardMaterial[] {
    return [this.terrain, this.nature];
  }

  private rawTex(data: Uint8Array, size: number): Texture {
    const t = RawTexture.CreateRGBATexture(data, size, size, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    t.wrapV = Texture.WRAP_ADDRESSMODE;
    t.anisotropicFilteringLevel = 8;
    return t;
  }

  private make(
    name: string,
    o: { diffuse?: Texture; bump?: Texture; bumpLevel?: number; specular?: number; specularPower?: number; diffuseBoost?: number },
  ): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    const b = o.diffuseBoost ?? 1;
    m.diffuseColor = new Color3(b, b, b);
    if (o.diffuse) m.diffuseTexture = o.diffuse;
    if (o.bump) {
      m.bumpTexture = o.bump;
      m.bumpTexture.level = o.bumpLevel ?? 0.6;
    }
    const sp = o.specular ?? 0.05;
    m.specularColor = new Color3(sp, sp, sp);
    m.specularPower = o.specularPower ?? 32;
    return m;
  }

  solid(c: ColorLike, opts: { emissive?: number; specular?: number; alpha?: number; fog?: boolean } = {}): StandardMaterial {
    const key = `${typeof c === 'string' ? c : c.toHexString()}|${opts.emissive ?? 0}|${opts.specular ?? 0.05}|${opts.alpha ?? 1}|${opts.fog ?? true}`;
    let m = this.cache.get(key);
    if (!m) {
      const col = hex(c);
      m = new StandardMaterial(`m-${key}`, this.scene);
      m.diffuseColor = col;
      m.specularColor = new Color3(opts.specular ?? 0.05, opts.specular ?? 0.05, opts.specular ?? 0.05);
      if (opts.emissive) m.emissiveColor = col.scale(opts.emissive);
      if (opts.alpha !== undefined && opts.alpha < 1) m.alpha = opts.alpha;
      if (opts.fog === false) m.fogEnabled = false;
      this.cache.set(key, m);
    }
    return m;
  }

  /** Yumuşak yuvarlak parçacık dokusu. */
  get flare(): Texture {
    if (this._flare) return this._flare;
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5;
        const dy = (y + 0.5) / size - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;
        const a = Math.max(0, 1 - d);
        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(Math.pow(a, 1.6) * 255);
      }
    }
    this._flare = RawTexture.CreateRGBATexture(data, size, size, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    this._flare.hasAlpha = true;
    return this._flare;
  }

  /** Metin dokusu (isim etiketleri, tabelalar). */
  textTexture(
    text: string,
    opts: { width?: number; height?: number; font?: string; color?: string; bg?: string; stroke?: string } = {},
  ): DynamicTexture {
    const w = opts.width ?? 512;
    const h = opts.height ?? 128;
    const tex = new DynamicTexture(`txt-${text}`, { width: w, height: h }, this.scene, true);
    tex.hasAlpha = true;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, w, h);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      const r = h * 0.3;
      ctx.beginPath();
      ctx.moveTo(r, 4);
      ctx.lineTo(w - r, 4);
      ctx.quadraticCurveTo(w - 4, 4, w - 4, r);
      ctx.lineTo(w - 4, h - r);
      ctx.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
      ctx.lineTo(r, h - 4);
      ctx.quadraticCurveTo(4, h - 4, 4, h - r);
      ctx.lineTo(4, r);
      ctx.quadraticCurveTo(4, 4, r, 4);
      ctx.fill();
    }
    ctx.font = opts.font ?? `600 ${Math.round(h * 0.48)}px Fredoka, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.stroke) {
      ctx.lineWidth = h * 0.1;
      ctx.strokeStyle = opts.stroke;
      ctx.strokeText(text, w / 2, h / 2 + 2);
    }
    ctx.fillStyle = opts.color ?? '#ffffff';
    ctx.fillText(text, w / 2, h / 2 + 2);
    tex.update(true);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
  }

  /** Tablo/etiket materyali (ışıktan etkilenmez). */
  labelMaterial(tex: DynamicTexture, name: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseTexture = tex;
    m.emissiveTexture = tex;
    m.opacityTexture = tex;
    m.disableLighting = true;
    m.backFaceCulling = false;
    m.useAlphaFromDiffuseTexture = true;
    m.alphaMode = Engine.ALPHA_COMBINE;
    return m;
  }
}
