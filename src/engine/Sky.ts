import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

Effect.ShadersStore['fischSkyVertexShader'] = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

Effect.ShadersStore['fischSkyFragmentShader'] = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir;
uniform vec3 moonDir;
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform vec3 cloudColor;
uniform float night;
uniform float aurora;
uniform float time;
uniform float cloudCover;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise2(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main(void) {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.5);
  vec3 col = mix(horizonColor, zenithColor, t);
  if (h < 0.0) col = mix(horizonColor, horizonColor * 0.8, clamp(-h * 3.0, 0.0, 1.0));

  // Güneş
  float sd = max(dot(d, sunDir), 0.0);
  col += sunColor * (smoothstep(0.9985, 0.9993, sd) * 2.5 + pow(sd, 16.0) * 0.35) * (1.0 - night * 0.95);

  // Ay
  float md = max(dot(d, moonDir), 0.0);
  col += vec3(0.86, 0.9, 1.0) * (smoothstep(0.9990, 0.9995, md) * 1.1 + pow(md, 80.0) * 0.12) * night;

  // Yıldızlar
  if (night > 0.01 && h > 0.0) {
    vec3 sp = floor(d * 240.0);
    float st = hash3(sp);
    float star = smoothstep(0.9968, 1.0, st);
    float tw = 0.55 + 0.45 * sin(time * 2.5 + st * 300.0);
    col += vec3(star * tw * 1.4) * night * smoothstep(0.02, 0.3, h) * (1.0 - cloudCover * 0.8);
  }

  // Kutup ışıkları (perde şeklinde bantlar)
  if (aurora > 0.01 && h > 0.02) {
    float a = atan(d.x, d.z);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float wave = sin(a * (3.0 + fi) + time * (0.12 + fi * 0.05) + sin(a * 7.0 - time * 0.3) * 0.7) * 0.07;
      float center = 0.28 + fi * 0.16 + wave;
      float curtain = exp(-pow((h - center) / (0.075 + fi * 0.02), 2.0));
      float rays = 0.55 + 0.45 * sin(a * 90.0 + time * 1.6 + sin(a * 17.0 + fi) * 4.0);
      vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(center - 0.02, center + 0.12, h) + fi * 0.3);
      col += ac * curtain * rays * aurora * (0.9 - fi * 0.3);
    }
  }

  // Bulutlar
  if (h > 0.0 && cloudCover > 0.01) {
    vec2 cp = d.xz / (h + 0.15) * 1.3 + vec2(time * 0.01, time * 0.004);
    float c = fbm(cp);
    float cov = smoothstep(0.75 - cloudCover * 0.45, 0.95 - cloudCover * 0.3, c);
    col = mix(col, cloudColor, cov * smoothstep(0.0, 0.18, h) * 0.9);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface SkyState {
  sunDir: Vector3;
  zenith: Color3;
  horizon: Color3;
  sunColor: Color3;
  cloudColor: Color3;
  night: number;
  aurora: number;
  cloudCover: number;
}

/** Dinamik gökyüzü küresi: gündüz-gece geçişi, güneş, ay, yıldızlar, bulutlar ve kutup ışıkları. */
export class Sky {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private time = 0;

  constructor(scene: Scene, radius = 1400) {
    this.mesh = CreateSphere('sky', { diameter: radius * 2, segments: 24, sideOrientation: 1 }, scene);
    this.mesh.infiniteDistance = true;
    this.mesh.isPickable = false;
    this.material = new ShaderMaterial(
      'skyMat',
      scene,
      { vertex: 'fischSky', fragment: 'fischSky' },
      {
        attributes: ['position'],
        uniforms: [
          'worldViewProjection', 'sunDir', 'moonDir', 'zenithColor', 'horizonColor', 'sunColor', 'cloudColor',
          'night', 'aurora', 'time', 'cloudCover',
        ],
      },
    );
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
    this.mesh.renderingGroupId = 0;
    this.mesh.applyFog = false;
  }

  update(dt: number, s: SkyState): void {
    this.time += dt;
    const m = this.material;
    m.setVector3('sunDir', s.sunDir);
    m.setVector3('moonDir', s.sunDir.scale(-1).add(new Vector3(0, 0.25, 0)).normalize());
    m.setColor3('zenithColor', s.zenith);
    m.setColor3('horizonColor', s.horizon);
    m.setColor3('sunColor', s.sunColor);
    m.setColor3('cloudColor', s.cloudColor);
    m.setFloat('night', s.night);
    m.setFloat('aurora', s.aurora);
    m.setFloat('time', this.time);
    m.setFloat('cloudCover', s.cloudCover);
  }
}
