import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { hex } from './geometry';
import type { Materials } from './materials';

interface Timed {
  update(dt: number): boolean;
}

/** Parçacık ve ışık efektleri: sıçrama, ışık sütunu, yağmur, kar, köpük izi. */
export class Effects {
  private timed: Timed[] = [];
  readonly rain: ParticleSystem;
  readonly snow: ParticleSystem;
  readonly smoke: ParticleSystem[] = [];
  private pillarTex: Texture;
  /** Yağmur/kar yayıcısı kamerayı takip eder. */
  private readonly weatherEmitter = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly mats: Materials,
    camera: Camera,
    lowQuality: boolean,
  ) {
    this.weatherEmitter.copyFrom(camera.position);
    this.rain = this.makeRain(lowQuality ? 1200 : 3500);
    this.snow = this.makeSnow(lowQuality ? 500 : 1500);
    this.pillarTex = this.makePillarTexture();
  }

  update(dt: number, cameraPos: Vector3): void {
    this.weatherEmitter.copyFrom(cameraPos);
    this.timed = this.timed.filter((t) => t.update(dt));
  }

  private burst(
    pos: Vector3,
    opts: {
      count: number; color1: Color4; color2: Color4; size: [number, number]; power: [number, number];
      life: [number, number]; gravity?: number; spread?: number; up?: number; additive?: boolean; duration?: number;
    },
  ): ParticleSystem {
    const ps = new ParticleSystem('burst', opts.count, this.scene);
    ps.particleTexture = this.mats.flare;
    ps.emitter = pos.clone();
    const sp = opts.spread ?? 0.3;
    ps.minEmitBox = new Vector3(-sp, 0, -sp);
    ps.maxEmitBox = new Vector3(sp, 0.1, sp);
    ps.color1 = opts.color1;
    ps.color2 = opts.color2;
    ps.colorDead = new Color4(opts.color2.r, opts.color2.g, opts.color2.b, 0);
    ps.minSize = opts.size[0];
    ps.maxSize = opts.size[1];
    ps.minLifeTime = opts.life[0];
    ps.maxLifeTime = opts.life[1];
    ps.minEmitPower = opts.power[0];
    ps.maxEmitPower = opts.power[1];
    const up = opts.up ?? 1;
    ps.direction1 = new Vector3(-1, up, -1);
    ps.direction2 = new Vector3(1, up * 1.6, 1);
    ps.gravity = new Vector3(0, opts.gravity ?? -9.8, 0);
    ps.manualEmitCount = opts.count;
    ps.blendMode = opts.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    ps.disposeOnStop = true;
    ps.targetStopDuration = opts.duration ?? 0.2;
    ps.start();
    return ps;
  }

  splash(pos: Vector3, scale = 1): void {
    this.burst(pos, {
      count: Math.round(40 * scale), color1: new Color4(0.85, 0.95, 1, 0.9), color2: new Color4(0.6, 0.85, 1, 0.8),
      size: [0.12 * scale, 0.32 * scale], power: [2 * scale, 4.5 * scale], life: [0.4, 0.9], spread: 0.25 * scale, up: 3,
    });
    this.ring(pos, new Color3(0.85, 0.95, 1), 0.9 * scale, 1.2);
  }

  bubbles(pos: Vector3, strong: boolean): void {
    this.burst(pos.add(new Vector3(0, -0.1, 0)), {
      count: strong ? 14 : 5, color1: new Color4(0.8, 0.95, 1, 0.8), color2: new Color4(1, 1, 1, 0.6),
      size: [0.05, strong ? 0.16 : 0.1], power: [0.3, 0.8], life: [0.4, 0.8], gravity: 1.5, spread: 0.35, up: 2,
    });
  }

  /** Su yüzeyinde genişleyen halka. */
  ring(pos: Vector3, color: Color3, size: number, duration: number): void {
    const torus = CreateTorus('ring', { diameter: 1, thickness: 0.06, tessellation: 24 }, this.scene);
    torus.position = pos.clone();
    torus.position.y = Math.max(0.05, pos.y);
    const mat = new StandardMaterial('ringMat', this.scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    mat.alpha = 0.8;
    torus.material = mat;
    torus.isPickable = false;
    let t = 0;
    this.timed.push({
      update: (dt) => {
        t += dt;
        const k = t / duration;
        torus.scaling.setAll(size * (0.4 + k * 2.2));
        torus.scaling.y = 1;
        mat.alpha = 0.8 * (1 - k);
        if (k >= 1) {
          torus.dispose();
          mat.dispose();
          return false;
        }
        return true;
      },
    });
  }

  /** Nadir balık yakalandığında gökyüzüne uzanan ışık sütunu. */
  lightPillar(pos: Vector3, colorHex: string, duration = 6, height = 60): void {
    const color = hex(colorHex);
    const cyl = CreateCylinder('pillar', { diameterTop: 1.4, diameterBottom: 2.4, height, tessellation: 16, cap: 0 }, this.scene);
    cyl.position = new Vector3(pos.x, height / 2 - 0.5, pos.z);
    const mat = new StandardMaterial('pillarMat', this.scene);
    mat.emissiveColor = color;
    mat.diffuseColor = Color3.Black();
    mat.disableLighting = true;
    mat.opacityTexture = this.pillarTex;
    mat.backFaceCulling = false;
    mat.alpha = 0;
    mat.fogEnabled = false;
    cyl.material = mat;
    cyl.isPickable = false;
    const ps = this.burst(new Vector3(pos.x, 0.2, pos.z), {
      count: 600, color1: Color4.FromColor3(color, 0.9), color2: new Color4(1, 1, 1, 0.7), size: [0.15, 0.4],
      power: [4, 14], life: [1.2, 2.6], gravity: 0, spread: 1.2, up: 6, additive: true, duration: duration * 0.7,
    });
    ps.manualEmitCount = -1;
    ps.emitRate = 70;
    ps.direction1 = new Vector3(-0.15, 1, -0.15);
    ps.direction2 = new Vector3(0.15, 1, 0.15);
    let t = 0;
    this.timed.push({
      update: (dt) => {
        t += dt;
        const fadeIn = Math.min(1, t / 0.5);
        const fadeOut = Math.min(1, (duration - t) / 1.5);
        mat.alpha = 0.32 * Math.max(0, Math.min(fadeIn, fadeOut)) * (0.85 + Math.sin(t * 6) * 0.15);
        cyl.rotation.y += dt * 0.6;
        if (t >= duration) {
          cyl.dispose();
          mat.dispose();
          return false;
        }
        return true;
      },
    });
  }

  /** Kusursuz yakalama / seviye atlama için konfeti patlaması. */
  confetti(pos: Vector3, colors: string[] = ['#ffd23f', '#ff5a8a', '#4ae0ff', '#7aff6a']): void {
    for (const c of colors) {
      const col = hex(c);
      this.burst(pos, {
        count: 30, color1: Color4.FromColor3(col, 1), color2: Color4.FromColor3(col.scale(0.8), 1), size: [0.12, 0.25],
        power: [4, 8], life: [0.8, 1.6], gravity: -6, spread: 0.3, up: 2.5, additive: true,
      });
    }
  }

  /** Teknenin arkasında köpük izi (dönen değer her karede çağrılır). */
  wake(emitter: AbstractMesh): ParticleSystem {
    const ps = new ParticleSystem('wake', 400, this.scene);
    ps.particleTexture = this.mats.flare;
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.8, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.8, 0.1, 0.2);
    ps.color1 = new Color4(0.95, 0.98, 1, 0.8);
    ps.color2 = new Color4(0.8, 0.92, 1, 0.6);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.4;
    ps.maxSize = 1.1;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 1.6;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-0.5, 0.4, -1);
    ps.direction2 = new Vector3(0.5, 0.8, -0.5);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1.5;
    ps.gravity = new Vector3(0, -2, 0);
    ps.isLocal = false;
    ps.start();
    return ps;
  }

  /** Volkan dumanı. */
  addSmoke(pos: Vector3): void {
    const ps = new ParticleSystem('smoke', 150, this.scene);
    ps.particleTexture = this.mats.flare;
    ps.emitter = pos;
    ps.minEmitBox = new Vector3(-4, 0, -4);
    ps.maxEmitBox = new Vector3(4, 1, 4);
    ps.color1 = new Color4(0.35, 0.3, 0.3, 0.35);
    ps.color2 = new Color4(0.5, 0.45, 0.45, 0.25);
    ps.colorDead = new Color4(0.6, 0.6, 0.6, 0);
    ps.minSize = 4;
    ps.maxSize = 9;
    ps.minLifeTime = 5;
    ps.maxLifeTime = 9;
    ps.emitRate = 10;
    ps.direction1 = new Vector3(-0.3, 1, -0.3);
    ps.direction2 = new Vector3(0.5, 1.5, 0.3);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 2.5;
    ps.gravity = new Vector3(0.4, 0.2, 0);
    ps.minAngularSpeed = -0.3;
    ps.maxAngularSpeed = 0.3;
    ps.start();
    this.smoke.push(ps);
  }

  private makeRain(capacity: number): ParticleSystem {
    const ps = new ParticleSystem('rain', capacity, this.scene);
    ps.particleTexture = this.mats.flare;
    ps.emitter = this.weatherEmitter;
    ps.minEmitBox = new Vector3(-40, 14, -40);
    ps.maxEmitBox = new Vector3(40, 24, 40);
    ps.color1 = new Color4(0.75, 0.82, 0.95, 0.32);
    ps.color2 = new Color4(0.8, 0.88, 1, 0.24);
    ps.colorDead = new Color4(0.8, 0.88, 1, 0);
    ps.minSize = 0.025;
    ps.maxSize = 0.04;
    ps.minScaleY = 12;
    ps.maxScaleY = 18;
    ps.minLifeTime = 0.9;
    ps.maxLifeTime = 1.1;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-0.1, -1, 0);
    ps.direction2 = new Vector3(0.1, -1, 0.1);
    ps.minEmitPower = 22;
    ps.maxEmitPower = 26;
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.gravity = new Vector3(0, -5, 0);
    ps.start();
    return ps;
  }

  private makeSnow(capacity: number): ParticleSystem {
    const ps = new ParticleSystem('snow', capacity, this.scene);
    ps.particleTexture = this.mats.flare;
    ps.emitter = this.weatherEmitter;
    ps.minEmitBox = new Vector3(-35, 10, -35);
    ps.maxEmitBox = new Vector3(35, 20, 35);
    ps.color1 = new Color4(1, 1, 1, 0.9);
    ps.color2 = new Color4(0.9, 0.95, 1, 0.8);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.1;
    ps.maxSize = 0.25;
    ps.minLifeTime = 5;
    ps.maxLifeTime = 8;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-0.5, -1, -0.3);
    ps.direction2 = new Vector3(0.5, -1, 0.3);
    ps.minEmitPower = 1.5;
    ps.maxEmitPower = 3;
    ps.gravity = new Vector3(0.3, -0.5, 0);
    ps.start();
    return ps;
  }

  private makePillarTexture(): Texture {
    const w = 4;
    const h = 64;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const a = Math.pow(1 - v, 1.3) * Math.min(1, v * 8 + 0.2);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    }
    const tex = RawTexture.CreateRGBATexture(data, w, h, this.scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
    tex.hasAlpha = true;
    tex.getAlphaFromRGB = false;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
  }

  setRain(intensity: number): void {
    this.rain.emitRate = intensity * 2500;
  }

  setSnow(intensity: number): void {
    this.snow.emitRate = intensity * 220;
  }
}

