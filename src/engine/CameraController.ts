import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { clamp } from '../core/rng';

/**
 * Üçüncü şahıs yörünge kamerası. Sağ tık sürükle (masaüstü) veya tek parmak sürükle (mobil) ile döner,
 * tekerlek / iki parmak ile yakınlaşır. Sol tık balık tutmaya ayrılmıştır.
 */
export class CameraController {
  readonly camera: ArcRotateCamera;
  yaw = -Math.PI / 2;
  pitch = 1.2;
  radius = 15;
  private target = new Vector3();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private touches = new Map<number, { x: number; y: number }>();
  /** Son kullanıcı döndürmesinden bu yana geçen süre (otomatik takip için). */
  private idleTime = 10;
  private pinchDist = 0;
  private shake = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new ArcRotateCamera('cam', this.yaw, this.pitch, this.radius, Vector3.Zero(), scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 4000;
    this.camera.fov = 0.9;
    this.camera.inputs.clear();

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 2 || e.button === 1) {
          this.dragging = true;
          this.lastX = e.clientX;
          this.lastY = e.clientY;
          canvas.setPointerCapture(e.pointerId);
        }
      } else {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.touches.size === 2) this.pinchDist = this.touchDistance();
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (!this.dragging) return;
        this.rotate(e.clientX - this.lastX, e.clientY - this.lastY);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      } else {
        const t = this.touches.get(e.pointerId);
        if (!t) return;
        if (this.touches.size === 1) {
          this.rotate((e.clientX - t.x) * 1.3, (e.clientY - t.y) * 1.3);
        }
        t.x = e.clientX;
        t.y = e.clientY;
        if (this.touches.size === 2) {
          const d = this.touchDistance();
          if (this.pinchDist > 0) this.radius = clamp(this.radius * (this.pinchDist / d), 5, 40);
          this.pinchDist = d;
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 2 || e.button === 1) this.dragging = false;
      } else {
        this.touches.delete(e.pointerId);
        this.pinchDist = 0;
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.radius = clamp(this.radius * (1 + Math.sign(e.deltaY) * 0.1), 5, 40);
      },
      { passive: false },
    );
  }

  private touchDistance(): number {
    const pts = [...this.touches.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  rotate(dx: number, dy: number): void {
    this.idleTime = 0;
    this.yaw -= dx * 0.006;
    this.pitch = clamp(this.pitch - dy * 0.005, 0.35, 1.5);
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /** Kameranın yatay ileri yönü (birim). */
  forward(): { x: number; z: number } {
    return { x: -Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  /** Kullanıcı kamerayı son 1.5 sn içinde döndürmediyse hedef yöne yumuşakça döner. */
  followBehind(yaw: number, dt: number): void {
    if (this.idleTime < 1.5) return;
    const target = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 1.2);
  }

  snapBehind(yaw: number): void {
    // Oyuncunun baktığı yönün arkasına yerleş (yaw: oyuncu yönü, +z'den)
    this.yaw = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
  }

  update(dt: number, follow: Vector3, groundAt: (x: number, z: number) => number, heightOffset = 1.7): void {
    this.idleTime += dt;
    const goal = follow.add(new Vector3(0, heightOffset, 0));
    const k = 1 - Math.exp(-dt * 12);
    this.target = Vector3.Lerp(this.target.lengthSquared() === 0 ? goal : this.target, goal, k);
    if (Vector3.DistanceSquared(this.target, goal) > 400) this.target.copyFrom(goal);

    let r = this.radius;
    const sinP = Math.sin(this.pitch);
    const cosP = Math.cos(this.pitch);
    for (let i = 0; i < 12; i++) {
      const px = this.target.x + r * Math.cos(this.yaw) * sinP;
      const py = this.target.y + r * cosP;
      const pz = this.target.z + r * Math.sin(this.yaw) * sinP;
      const g = Math.max(groundAt(px, pz), 0.2);
      if (py > g + 0.7 || r < 2.5) break;
      r *= 0.85;
    }
    this.shake = Math.max(0, this.shake - dt * 2);
    const sx = (Math.random() - 0.5) * this.shake * 0.3;
    const sy = (Math.random() - 0.5) * this.shake * 0.3;
    this.camera.target.set(this.target.x + sx, this.target.y + sy, this.target.z);
    this.camera.alpha = this.yaw;
    this.camera.beta = this.pitch;
    this.camera.radius = r;
  }
}
