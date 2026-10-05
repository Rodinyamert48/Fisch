import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Görüntü kalitesi katmanı:
 * - Yüksek kalite: HDR işleme hattı (ACES ton eşleme, bloom, MSAA, keskinleştirme, vinyet) ve kademeli gölgeler.
 * - Düşük kalite: yalnızca FXAA kenar yumuşatma.
 * - Her iki modda kare hızına göre otomatik çözünürlük ayarı.
 */
export class Graphics {
  readonly pipeline: DefaultRenderingPipeline;
  readonly shadows: CascadedShadowGenerator | null = null;
  /** Gökyüzü shader'ının doğrusal renk uzayında çıktı vermesi gerekiyor mu? */
  readonly linearOutput: boolean;
  private baseScale: number;
  private scale: number;
  private fpsTimer = 0;
  private cooldown = 3;
  private fpsSamples: number[] = [];

  constructor(
    private readonly engine: Engine,
    scene: Scene,
    camera: Camera,
    sun: DirectionalLight,
    readonly high: boolean,
  ) {
    this.baseScale = engine.getHardwareScalingLevel();
    this.scale = this.baseScale;
    this.pipeline = new DefaultRenderingPipeline('pipeline', high, scene, [camera]);
    const p = this.pipeline;
    if (high) {
      p.samples = 4;
      p.fxaaEnabled = false;
      p.bloomEnabled = true;
      p.bloomThreshold = 0.82;
      p.bloomWeight = 0.28;
      p.bloomKernel = 48;
      p.bloomScale = 0.5;
      p.sharpenEnabled = true;
      p.sharpen.edgeAmount = 0.18;
      p.imageProcessingEnabled = true;
      const ip = p.imageProcessing;
      ip.toneMappingEnabled = true;
      ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      ip.exposure = 1.1;
      ip.contrast = 1.08;
      ip.vignetteEnabled = true;
      ip.vignetteWeight = 1.4;
      ip.vignetteStretch = 0.15;
      ip.vignetteColor = new Color4(0.02, 0.04, 0.08, 0);
      this.linearOutput = true;

      const csm = new CascadedShadowGenerator(2048, sun);
      csm.numCascades = 3;
      csm.lambda = 0.78;
      csm.shadowMaxZ = 150;
      csm.stabilizeCascades = true;
      csm.autoCalcDepthBounds = false;
      csm.depthClamp = true;
      csm.usePercentageCloserFiltering = true;
      csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      csm.bias = 0.0006;
      csm.normalBias = 0.012;
      // Dev birleşik ada mesh'leri derinlik aralığını büyütmesin: gölge kutusu oyuncuyu takip eder
      csm.freezeShadowCastersBoundingInfo = true;
      csm.darkness = 0.3;
      csm.cascadeBlendPercentage = 0.08;
      this.shadows = csm;
    } else {
      p.samples = 1;
      p.fxaaEnabled = true;
      p.bloomEnabled = false;
      p.imageProcessingEnabled = false;
      this.linearOutput = false;
    }
  }

  private lastFocus = new Vector3(1e9, 0, 0);

  /** Gölge düşürenlerin sınır kutusunu oyuncunun çevresine taşır. */
  focus(p: Vector3): void {
    if (!this.shadows) return;
    if (Vector3.DistanceSquared(p, this.lastFocus) < 400) return;
    this.lastFocus.copyFrom(p);
    const r = 120;
    this.shadows.shadowCastersBoundingInfo = new BoundingInfo(new Vector3(p.x - r, -12, p.z - r), new Vector3(p.x + r, 45, p.z + r));
  }

  addCasters(meshes: AbstractMesh[]): void {
    if (!this.shadows) return;
    for (const m of meshes) this.shadows.addShadowCaster(m, false);
  }

  addReceivers(meshes: AbstractMesh[]): void {
    if (!this.shadows) return;
    for (const m of meshes) m.receiveShadows = true;
  }

  removeCasters(meshes: AbstractMesh[]): void {
    if (!this.shadows) return;
    for (const m of meshes) this.shadows.removeShadowCaster(m, false);
  }

  /** Gün ışığına göre gölge koyuluğu ve bloom ayarı. */
  setDaylight(daylight: number, storm: number): void {
    if (this.shadows) this.shadows.darkness = 1 - (0.25 + 0.5 * daylight * (1 - storm * 0.7));
    if (this.high) {
      this.pipeline.bloomWeight = 0.22 + (1 - daylight) * 0.18;
      this.pipeline.imageProcessing.exposure = 1.05 + (1 - daylight) * 0.3;
    }
  }

  /** Kare hızı düşerse çözünürlüğü düşür, yükselirse geri artır. */
  adapt(dt: number): void {
    this.fpsSamples.push(1 / Math.max(dt, 1e-3));
    this.fpsTimer += dt;
    this.cooldown -= dt;
    if (this.fpsTimer < 1.5) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fpsSamples = [];
    this.fpsTimer = 0;
    if (this.cooldown > 0) return;
    const max = this.baseScale * (this.high ? 1.6 : 2);
    if (avg < 32 && this.scale < max) {
      this.scale = Math.min(max, this.scale * 1.15);
      this.engine.setHardwareScalingLevel(this.scale);
      this.cooldown = 2.5;
    } else if (avg > 56 && this.scale > this.baseScale + 0.01) {
      this.scale = Math.max(this.baseScale, this.scale / 1.1);
      this.engine.setHardwareScalingLevel(this.scale);
      this.cooldown = 4;
    }
  }
}
