export type CastRating = 'meh' | 'good' | 'perfect';

export const CAST_RATING_TEXT: Record<CastRating, string> = {
  meh: 'Meh..',
  good: 'İyi',
  perfect: 'Mükemmel!',
};

/**
 * Atış güç çubuğu: basılı tutulduğunda 0→1→0 gidip gelir.
 * "Mükemmel!" için çubuğun tepesine yakın küçük yeşil alana denk getirmek gerekir.
 */
export class CastMeter {
  /** Tam bir dolma süresi (saniye). */
  static readonly FILL_TIME = 1.05;
  static readonly PERFECT_MIN = 0.86;
  static readonly PERFECT_MAX = 0.96;
  static readonly GOOD_MIN = 0.55;

  power = 0;
  private dir = 1;
  active = false;

  start(): void {
    this.power = 0;
    this.dir = 1;
    this.active = true;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.power += (this.dir * dt) / CastMeter.FILL_TIME;
    if (this.power >= 1) {
      this.power = 2 - this.power;
      this.dir = -1;
    } else if (this.power <= 0) {
      this.power = -this.power;
      this.dir = 1;
    }
  }

  release(): { power: number; rating: CastRating } {
    this.active = false;
    return { power: this.power, rating: CastMeter.rate(this.power) };
  }

  static rate(power: number): CastRating {
    if (power >= CastMeter.PERFECT_MIN && power <= CastMeter.PERFECT_MAX) return 'perfect';
    if (power >= CastMeter.GOOD_MIN) return 'good';
    return 'meh';
  }

  /** Güce göre atış mesafesi (dünya birimi). */
  static distance(power: number): number {
    return 6 + power * 24;
  }
}
