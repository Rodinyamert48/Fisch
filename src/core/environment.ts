import { pickWeighted, randRange, type Rng } from './rng';
import type { SeasonId, TimeOfDay, WeatherId } from './types';

/** Bir oyun gününün gerçek süresi (saniye). */
export const DAY_LENGTH_SEC = 720;
export const DAYS_PER_SEASON = 2;
export const SEASONS: SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_NAMES: Record<SeasonId, string> = {
  spring: 'İlkbahar',
  summer: 'Yaz',
  autumn: 'Sonbahar',
  winter: 'Kış',
};

export const WEATHER_NAMES: Record<WeatherId, string> = {
  clear: 'Açık',
  rain: 'Yağmurlu',
  fog: 'Sisli',
  aurora: 'Kutup Işıkları',
};

export const WEATHER_EFFECTS: Record<WeatherId, string> = {
  clear: 'Normal koşullar',
  rain: '+%20 yem hızı',
  fog: '+%15 şans',
  aurora: '+%40 şans',
};

export interface EnvSnapshot {
  totalSeconds: number;
  weather: WeatherId;
  weatherTimer: number;
  nukeTimer: number;
}

export interface EnvChanges {
  weather?: WeatherId;
  nukeStarted?: boolean;
  nukeEnded?: boolean;
  season?: SeasonId;
  timeOfDay?: TimeOfDay;
}

export const NUKE_DURATION = 110;
export const NUKE_CHANCE = 0.06;

export class EnvironmentSim {
  totalSeconds: number;
  weather: WeatherId = 'clear';
  weatherTimer: number;
  nukeTimer = 0;

  constructor(
    private readonly rng: Rng,
    snapshot?: Partial<EnvSnapshot>,
  ) {
    // 1. gün, saat 08:00'de başla
    this.totalSeconds = snapshot?.totalSeconds ?? (8 / 24) * DAY_LENGTH_SEC;
    this.weather = snapshot?.weather ?? 'clear';
    this.weatherTimer = snapshot?.weatherTimer ?? randRange(rng, 150, 240);
    this.nukeTimer = snapshot?.nukeTimer ?? 0;
  }

  snapshot(): EnvSnapshot {
    return { totalSeconds: this.totalSeconds, weather: this.weather, weatherTimer: this.weatherTimer, nukeTimer: this.nukeTimer };
  }

  /** 0-24 arası saat. */
  get hour(): number {
    return ((this.totalSeconds % DAY_LENGTH_SEC) / DAY_LENGTH_SEC) * 24;
  }

  get day(): number {
    return Math.floor(this.totalSeconds / DAY_LENGTH_SEC) + 1;
  }

  get season(): SeasonId {
    const idx = Math.floor((this.day - 1) / DAYS_PER_SEASON) % SEASONS.length;
    return SEASONS[idx];
  }

  get timeOfDay(): TimeOfDay {
    const h = this.hour;
    return h >= 6 && h < 19 ? 'day' : 'night';
  }

  get nukeActive(): boolean {
    return this.nukeTimer > 0;
  }

  /** Güneşin yönü (birim vektör, y yukarı). Saat 6'da doğu, 12'de tepe, 18'de batı. */
  sunDirection(): { x: number; y: number; z: number } {
    const a = ((this.hour - 6) / 24) * Math.PI * 2;
    const x = Math.cos(a);
    const y = Math.sin(a);
    const z = 0.35;
    const l = Math.hypot(x, y, z);
    return { x: x / l, y: y / l, z: z / l };
  }

  /** 0 (gece) - 1 (gündüz) arası gün ışığı. */
  daylight(): number {
    const y = this.sunDirection().y;
    return Math.min(1, Math.max(0, (y + 0.22) / 0.5));
  }

  update(dt: number): EnvChanges {
    const changes: EnvChanges = {};
    const prevSeason = this.season;
    const prevTod = this.timeOfDay;
    this.totalSeconds += dt;
    if (this.season !== prevSeason) changes.season = this.season;
    if (this.timeOfDay !== prevTod) {
      changes.timeOfDay = this.timeOfDay;
      if (this.timeOfDay === 'day' && this.weather === 'aurora') {
        this.setWeather('clear');
        changes.weather = 'clear';
      }
    }

    if (this.nukeTimer > 0) {
      this.nukeTimer -= dt;
      if (this.nukeTimer <= 0) {
        this.nukeTimer = 0;
        changes.nukeEnded = true;
      }
    }

    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const next = this.chooseWeather();
      this.setWeather(next);
      changes.weather = next;
      if (!this.nukeActive && this.rng() < NUKE_CHANCE) {
        this.nukeTimer = NUKE_DURATION;
        changes.nukeStarted = true;
      }
    }
    return changes;
  }

  setWeather(w: WeatherId): void {
    this.weather = w;
    this.weatherTimer = randRange(this.rng, 120, 260);
  }

  startNuke(): void {
    this.nukeTimer = NUKE_DURATION;
  }

  setHour(h: number): void {
    const dayStart = Math.floor(this.totalSeconds / DAY_LENGTH_SEC) * DAY_LENGTH_SEC;
    this.totalSeconds = dayStart + (h / 24) * DAY_LENGTH_SEC;
  }

  private chooseWeather(): WeatherId {
    const night = this.timeOfDay === 'night';
    const s = this.season;
    const options: { w: WeatherId; weight: number }[] = [
      { w: 'clear', weight: s === 'summer' ? 60 : 45 },
      { w: 'rain', weight: s === 'autumn' ? 30 : s === 'summer' ? 12 : 20 },
      { w: 'fog', weight: s === 'autumn' || s === 'spring' ? 18 : 12 },
      { w: 'aurora', weight: night ? (s === 'winter' ? 35 : 16) : 0 },
    ];
    const pickOne = pickWeighted(
      this.rng,
      options.filter((o) => o.w !== this.weather || o.w === 'clear'),
      (o) => o.weight,
    );
    return pickOne.w;
  }
}

export function formatClock(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
