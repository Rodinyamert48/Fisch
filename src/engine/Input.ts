/** Klavye, fare ve dokunmatik girişlerini birleştirir. */
export class Input {
  readonly keys = new Set<string>();
  /** Mobil sanal joystick (-1..1). y = ileri. */
  readonly joystick = { x: 0, y: 0 };
  primaryHeld = false;
  readonly isTouch: boolean;
  onPrimaryDown: (() => void) | null = null;
  onPrimaryUp: (() => void) | null = null;
  onKeyDown: ((code: string, e: KeyboardEvent) => void) | null = null;
  /** UI bir paneli açıkken oyun girişlerini engeller. */
  blocked = () => false;

  constructor(canvas: HTMLCanvasElement) {
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) {
        e.preventDefault();
        this.setPrimary(true);
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.setPrimary(false);
    });
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.onKeyDown?.(e.code, e);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.setPrimary(false);
    });
  }

  setPrimary(v: boolean): void {
    if (v === this.primaryHeld) return;
    this.primaryHeld = v;
    if (v) this.onPrimaryDown?.();
    else this.onPrimaryUp?.();
  }

  key(code: string): boolean {
    return this.keys.has(code);
  }

  /** Hareket vektörü: x = sağ, y = ileri (−1..1). */
  move(): { x: number; y: number } {
    if (this.blocked()) return { x: 0, y: 0 };
    let x = this.joystick.x;
    let y = this.joystick.y;
    if (this.key('KeyW') || this.key('ArrowUp')) y += 1;
    if (this.key('KeyS') || this.key('ArrowDown')) y -= 1;
    if (this.key('KeyD') || this.key('ArrowRight')) x += 1;
    if (this.key('KeyA') || this.key('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  get running(): boolean {
    return this.key('ShiftLeft') || this.key('ShiftRight') || Math.hypot(this.joystick.x, this.joystick.y) > 0.92;
  }
}
