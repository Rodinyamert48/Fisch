import type { RegionId } from '../core/types';

type Mood = RegionId | 'menu';

const SCALES: Record<Mood, { root: number; scale: number[]; chords: number[][]; tempo: number; wave: OscillatorType }> = {
  // Kök frekans (Hz), yarım ton aralıkları, akor dizisi (ölçek dereceleri)
  moosewood: { root: 261.63, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], tempo: 3.2, wave: 'triangle' },
  roslit: { root: 293.66, scale: [0, 2, 4, 6, 7, 9, 11, 12], chords: [[0, 4, 7], [2, 6, 9], [-1, 2, 7], [4, 7, 11]], tempo: 2.8, wave: 'triangle' },
  snowcap: { root: 220, scale: [0, 3, 5, 7, 10, 12, 15, 17], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], tempo: 4, wave: 'sine' },
  ocean: { root: 196, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [2, 5, 9]], tempo: 3.6, wave: 'sine' },
  deep: { root: 146.83, scale: [0, 1, 5, 7, 8, 12, 13, 15], chords: [[0, 3, 7], [1, 5, 8], [-4, 0, 3], [-2, 1, 5]], tempo: 5, wave: 'sine' },
  menu: { root: 261.63, scale: [0, 2, 4, 7, 9, 12], chords: [[0, 4, 7]], tempo: 4, wave: 'sine' },
};

const semis = (root: number, n: number) => root * Math.pow(2, n / 12);

/**
 * Tamamen prosedürel ses sistemi (WebAudio). Ses dosyası gerekmez.
 * Atış vınlaması, suya düşme, nadirliğe göre oltaya gelme perdesi, makara sesi,
 * yakalama fanfarı, ortam (dalga, martı, yağmur, rüzgâr) ve üretken ada müziği.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private amb!: GainNode;
  private noise!: AudioBuffer;
  private waves?: { gain: GainNode; filter: BiquadFilterNode };
  private wind?: { gain: GainNode };
  private rain?: { gain: GainNode };
  private reel?: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode; nextClick: number };
  private musicTimer = 0;
  private gullTimer = 6;
  private cricketTimer = 2;
  private mood: Mood = 'moosewood';
  private chordIndex = 0;
  private fanfareUntil = 0;
  private volume = 0.8;
  private musicVolume = 0.6;
  private muted = false;
  private ambState = { daylight: 1, rain: 0, wind: 0, nearLand: 1, deep: 0 };

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** İlk kullanıcı etkileşiminde çağrılmalı (tarayıcı otomatik oynatma kuralları). */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(comp);
    this.music = ctx.createGain();
    this.music.connect(comp);
    this.amb = ctx.createGain();
    this.amb.connect(comp);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b = (b + 0.02 * white) / 1.02; // kahverengi gürültü karışımı
      d[i] = white * 0.5 + b * 3.5;
    }
    this.startAmbience();
  }

  setVolumes(volume: number, music: number, muted: boolean): void {
    this.volume = volume;
    this.musicVolume = music;
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.05);
    this.music.gain.setTargetAtTime(this.musicVolume * 0.35, t, 0.2);
    this.amb.gain.setTargetAtTime(0.5, t, 0.2);
    this.sfx.gain.setTargetAtTime(0.9, t, 0.05);
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ───────────── Yardımcılar ─────────────
  private noiseSource(loop = false): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    if (loop) src.loopStart = Math.random();
    return src;
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; attack?: number; at?: number; slideTo?: number; bus?: GainNode; vibrato?: number } = {},
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = opts.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    const atk = opts.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const lg = ctx.createGain();
      lg.gain.value = opts.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    osc.connect(g).connect(opts.bus ?? this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, opts: { type?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; gain?: number; at?: number; attack?: number } = {}): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = opts.at ?? ctx.currentTime;
    const src = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 1000, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  // ───────────── Balık tutma sesleri ─────────────
  castCharge(): void {
    this.tone(220, 0.12, { type: 'triangle', gain: 0.05 });
  }

  /** Atış: vınlama. */
  whoosh(power: number): void {
    this.noiseBurst(0.45 + power * 0.2, { type: 'bandpass', freq: 2400, freqTo: 500, q: 2.5, gain: 0.35, attack: 0.05 });
    this.tone(900, 0.35, { type: 'sine', gain: 0.03, slideTo: 300 });
  }

  /** Suya düşme. */
  splash(size = 1): void {
    this.noiseBurst(0.35 * size + 0.15, { type: 'lowpass', freq: 1800, freqTo: 300, gain: 0.4 * size });
    this.tone(180, 0.18, { type: 'sine', gain: 0.18 * size, slideTo: 70 });
  }

  castRating(rating: 'meh' | 'good' | 'perfect'): void {
    if (rating === 'perfect') {
      [880, 1108, 1318].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.12, at: this.now + i * 0.06 }));
    } else if (rating === 'good') {
      this.tone(660, 0.18, { type: 'triangle', gain: 0.1 });
    } else {
      this.tone(330, 0.2, { type: 'triangle', gain: 0.08, slideTo: 280 });
    }
  }

  /** Bekleme sırasında küçük dokunuş. Nadir balıklarda daha belirgin. */
  nibble(intensity: number): void {
    this.tone(500 + Math.random() * 200, 0.08, { type: 'sine', gain: 0.05 + intensity * 0.12, slideTo: 300 });
    if (intensity > 0.5) this.noiseBurst(0.12, { type: 'bandpass', freq: 900, q: 3, gain: 0.08 * intensity });
  }

  shakeClick(): void {
    this.tone(1200, 0.06, { type: 'square', gain: 0.05 });
    this.noiseBurst(0.08, { type: 'highpass', freq: 2500, gain: 0.08 });
  }

  /** Balık oltaya geldi: nadirliğe göre farklı perde. */
  bite(pitch: number, rarityOrder: number): void {
    this.splash(0.7);
    this.tone(pitch, 0.35, { type: 'square', gain: 0.1 });
    this.tone(pitch * 1.5, 0.35, { type: 'triangle', gain: 0.08, at: this.now + 0.08 });
    if (rarityOrder >= 4) {
      const steps = [1, 1.25, 1.5, 2];
      steps.forEach((m, i) => this.tone(pitch * m, 0.4, { type: 'triangle', gain: 0.09, at: this.now + 0.18 + i * 0.07 }));
    }
    if (rarityOrder >= 6) this.tone(pitch * 0.5, 1.2, { type: 'sawtooth', gain: 0.06, attack: 0.05, vibrato: 6 });
  }

  // ───────────── Çekme (makara) ─────────────
  reelStart(): void {
    if (!this.ctx || this.reel) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 160;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter).connect(gain).connect(this.sfx);
    osc.start();
    this.reel = { osc, gain, filter, nextClick: ctx.currentTime };
  }

  /** İlerleme dolarken ton yükselir; basılı tutarken dişli/makara tıkırtısı. */
  reelUpdate(progress: number, inside: boolean, holding: boolean): void {
    if (!this.ctx || !this.reel) return;
    const t = this.ctx.currentTime;
    const r = this.reel;
    r.osc.frequency.setTargetAtTime(150 + progress * 380, t, 0.08);
    r.filter.frequency.setTargetAtTime(inside ? 900 + progress * 1200 : 350, t, 0.05);
    r.gain.gain.setTargetAtTime(inside ? 0.045 : 0.02, t, 0.05);
    const interval = holding ? 0.045 : 0.11;
    while (r.nextClick < t + 0.05) {
      const at = Math.max(r.nextClick, t);
      this.tone(holding ? 2200 : 1500, 0.025, { type: 'square', gain: inside ? 0.035 : 0.02, at });
      r.nextClick = at + interval;
    }
  }

  reelStop(): void {
    if (!this.reel || !this.ctx) return;
    const r = this.reel;
    r.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
    r.osc.stop(this.ctx.currentTime + 0.2);
    this.reel = undefined;
  }

  // ───────────── Sonuçlar ─────────────
  success(rarityOrder: number, perfect: boolean): void {
    const base = 523.25;
    const notes = [0, 4, 7, 12];
    notes.forEach((n, i) => this.tone(semis(base, n), 0.35, { type: 'triangle', gain: 0.14, at: this.now + i * 0.08 }));
    if (perfect) {
      [16, 19, 24].forEach((n, i) => this.tone(semis(base, n), 0.4, { type: 'sine', gain: 0.1, at: this.now + 0.35 + i * 0.06 }));
      this.noiseBurst(0.5, { type: 'highpass', freq: 5000, gain: 0.06, at: this.now + 0.35 });
    }
    if (rarityOrder >= 4) this.rareFanfare(rarityOrder);
  }

  /** Nadir balık için özel kısa müzik (BGM). */
  rareFanfare(rarityOrder: number): void {
    if (!this.ctx) return;
    const t0 = this.now + 0.4;
    const root = 261.63 * Math.pow(2, (rarityOrder - 4) / 12);
    const melody = rarityOrder >= 7
      ? [0, 7, 12, 16, 19, 24, 19, 16, 12, 16, 19, 24, 28, 31, 36]
      : rarityOrder >= 5
        ? [0, 4, 7, 12, 7, 12, 16, 19, 24, 19, 24]
        : [0, 4, 7, 12, 16, 12, 19];
    const step = 0.16;
    melody.forEach((n, i) => {
      this.tone(semis(root, n), step * 2.2, { type: 'triangle', gain: 0.1, at: t0 + i * step, bus: this.music });
    });
    const chordLen = melody.length * step + 0.6;
    [0, 4, 7, 12].forEach((n) => this.tone(semis(root / 2, n), chordLen, { type: 'sine', gain: 0.07, attack: 0.3, at: t0, bus: this.music }));
    this.fanfareUntil = this.now + chordLen + 1;
  }

  fail(): void {
    [0, -3, -7].forEach((n, i) => this.tone(semis(330, n), 0.3, { type: 'triangle', gain: 0.12, at: this.now + i * 0.12 }));
  }

  coin(): void {
    this.tone(988, 0.08, { type: 'square', gain: 0.06 });
    this.tone(1318, 0.25, { type: 'square', gain: 0.06, at: this.now + 0.07 });
  }

  levelUp(): void {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(semis(392, n), 0.3, { type: 'triangle', gain: 0.11, at: this.now + i * 0.07 }));
  }

  questComplete(): void {
    [0, 7, 12].forEach((n, i) => this.tone(semis(440, n), 0.5, { type: 'sine', gain: 0.12, at: this.now + i * 0.12 }));
    this.coin();
  }

  click(): void {
    this.tone(700, 0.05, { type: 'triangle', gain: 0.05 });
  }

  error(): void {
    this.tone(220, 0.15, { type: 'square', gain: 0.05, slideTo: 180 });
  }

  boatEngine(on: boolean): void {
    if (on) this.noiseBurst(0.4, { type: 'lowpass', freq: 300, gain: 0.15 });
  }

  // ───────────── Ortam ─────────────
  private startAmbience(): void {
    const ctx = this.ctx!;
    // Dalgalar: alçak geçiren gürültü + yavaş genlik dalgalanması
    {
      const src = this.noiseSource(true);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain).connect(gain.gain);
      src.connect(filter).connect(gain).connect(this.amb);
      src.start();
      lfo.start();
      this.waves = { gain, filter };
    }
    // Rüzgâr
    {
      const src = this.noiseSource(true);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;
      filter.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(filter.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.amb);
      src.start();
      lfo.start();
      this.wind = { gain };
    }
    // Yağmur
    {
      const src = this.noiseSource(true);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.amb);
      src.start();
      this.rain = { gain };
    }
  }

  setMood(mood: Mood): void {
    this.mood = mood;
  }

  updateAmbience(state: { daylight: number; rain: number; wind: number; nearLand: number; deep: number }): void {
    this.ambState = state;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.waves?.gain.gain.setTargetAtTime(0.18 + state.rain * 0.1 + state.wind * 0.08, t, 0.5);
    this.waves?.filter.frequency.setTargetAtTime(400 + state.wind * 400 + state.rain * 300, t, 0.5);
    this.wind?.gain.gain.setTargetAtTime(state.wind * 0.22, t, 0.8);
    this.rain?.gain.gain.setTargetAtTime(state.rain * 0.16, t, 0.8);
  }

  /** Her karede çağrılır: martılar, cırcır böcekleri ve üretken müzik. */
  update(dt: number): void {
    if (!this.ready) return;
    const s = this.ambState;
    this.gullTimer -= dt;
    if (this.gullTimer <= 0) {
      this.gullTimer = 7 + Math.random() * 12;
      if (s.daylight > 0.5 && s.rain < 0.5 && s.nearLand > 0.3 && s.deep < 0.5) this.seagull();
    }
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 0.8 + Math.random() * 2;
      if (s.daylight < 0.25 && s.nearLand > 0.6 && s.rain < 0.3) this.cricket();
    }
    this.musicTimer -= dt;
    if (this.musicTimer <= 0 && this.now > this.fanfareUntil) {
      const sc = SCALES[this.mood];
      this.musicTimer = sc.tempo;
      this.playMusicBar(sc);
    }
  }

  private seagull(): void {
    const t0 = this.now;
    const calls = 2 + Math.floor(Math.random() * 3);
    const base = 1100 + Math.random() * 400;
    for (let i = 0; i < calls; i++) {
      const at = t0 + i * (0.22 + Math.random() * 0.1);
      this.tone(base, 0.2, { type: 'sawtooth', gain: 0.018, at, slideTo: base * 0.7, vibrato: 30, bus: this.amb });
    }
  }

  private cricket(): void {
    const t0 = this.now;
    for (let i = 0; i < 3; i++) this.tone(4200, 0.04, { type: 'sine', gain: 0.015, at: t0 + i * 0.06, bus: this.amb });
  }

  private playMusicBar(sc: (typeof SCALES)[Mood]): void {
    const chord = sc.chords[this.chordIndex % sc.chords.length];
    this.chordIndex++;
    const t0 = this.now + 0.05;
    const night = this.ambState.daylight < 0.3;
    const pad = night || this.mood === 'deep' || this.mood === 'snowcap';
    for (const n of chord) {
      this.tone(semis(sc.root / 2, n), sc.tempo * 1.1, { type: 'sine', gain: pad ? 0.05 : 0.035, attack: 0.6, at: t0, bus: this.music });
    }
    // Melodi notaları (pentatonik, seyrek)
    const notes = night ? 2 : 3;
    for (let i = 0; i < notes; i++) {
      if (Math.random() < 0.35) continue;
      const deg = sc.scale[Math.floor(Math.random() * sc.scale.length)];
      const at = t0 + (i * sc.tempo) / notes + Math.random() * 0.1;
      this.tone(semis(sc.root, deg), 0.9, { type: sc.wave, gain: 0.05, attack: 0.02, at, bus: this.music });
    }
  }
}
