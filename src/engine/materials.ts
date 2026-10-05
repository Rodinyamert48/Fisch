import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { hex, type ColorLike } from './geometry';

/** Paylaşılan materyaller ve prosedürel dokular. */
export class Materials {
  readonly vertexColor: StandardMaterial;
  /** Gece yanan lambalar vb. için köşe renkli, yayıcı materyal. */
  readonly lamps: StandardMaterial;
  private cache = new Map<string, StandardMaterial>();
  private _flare: Texture | null = null;

  constructor(private readonly scene: Scene) {
    this.vertexColor = new StandardMaterial('vcol', scene);
    this.vertexColor.diffuseColor = Color3.White();
    this.vertexColor.specularColor = new Color3(0.06, 0.06, 0.06);

    this.lamps = new StandardMaterial('lamps', scene);
    this.lamps.diffuseColor = Color3.White();
    this.lamps.specularColor = Color3.Black();
    this.lamps.emissiveColor = new Color3(0.2, 0.2, 0.2);
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
    ctx.font = opts.font ?? `bold ${Math.round(h * 0.5)}px Fredoka, "Segoe UI", sans-serif`;
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
