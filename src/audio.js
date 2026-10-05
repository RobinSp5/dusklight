// Procedural sound: every effect is synthesised with WebAudio, no files.
const CHORDS = [
  [110.0, 164.81, 261.63], // Glut: A minor, warm
  [87.31, 130.81, 220.0],  // Frost: F major 7 colour, cold
];
const SCALES = [
  [440, 523.25, 587.33, 659.25, 783.99],
  [392, 440, 523.25, 659.25, 698.46],
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.phase = 0;
    this.bellT = 3;
    this.vol = { master: 80, music: 60, sfx: 80, muted: false };
  }

  // Volumes are 0-100; master is silenced when muted.
  apply(v) {
    this.vol = { ...this.vol, ...v };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : (this.vol.master / 100) * 0.9, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music / 100, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx / 100, t, 0.03);
  }

  get silent() { return this.vol.muted || this.vol.master === 0; }

  init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.connect(this.master);
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.musicBus.connect(comp);
    this.sfxBus.connect(comp);
    this.master.gain.value = 0;
    this.apply({});

    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.startPad();
  }

  startPad() {
    const c = this.ctx;
    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 800;
    this.padFilter.Q.value = 0.8;
    this.padGain = c.createGain();
    this.padGain.gain.value = 0;
    this.padGain.gain.linearRampToValueAtTime(0.055, c.currentTime + 4);
    this.padFilter.connect(this.padGain).connect(this.musicBus);
    this.padOsc = [0, 1, 2].map((i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.detune.value = [-8, 8, 0][i];
      o.connect(this.padFilter);
      o.start();
      return o;
    });
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.07;
    lg.gain.value = 260;
    lfo.connect(lg).connect(this.padFilter.frequency);
    lfo.start();
    this.setPhase(this.phase);
  }

  setPhase(p) {
    this.phase = p;
    if (!this.ctx || !this.padOsc) return;
    const t = this.ctx.currentTime;
    this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[p][i], t, 0.25));
    this.padFilter.frequency.setTargetAtTime(p ? 620 : 900, t, 0.4);
  }

  tick(dt) {
    if (!this.ctx || this.silent || this.vol.music === 0) return;
    this.bellT -= dt;
    if (this.bellT <= 0) {
      this.bellT = 2.2 + Math.random() * 3.5;
      const sc = SCALES[this.phase];
      this.tone(sc[(Math.random() * sc.length) | 0] * (Math.random() < 0.3 ? 2 : 1), 2.2, { g: 0.025, type: 'sine', attack: 0.02, bus: this.musicBus });
    }
  }

  tone(f, d, { type = 'sine', g = 0.15, to = null, at = 0, attack = 0.005, bus = this.sfxBus } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const v = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.linearRampToValueAtTime(g, t + attack);
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v).connect(bus);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  noise(d, { g = 0.2, f = 1200, type = 'bandpass', q = 1, to = null, at = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
    fl.Q.value = q;
    const v = c.createGain();
    v.gain.setValueAtTime(g, t);
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl).connect(v).connect(this.sfxBus);
    s.start(t);
    s.stop(t + d + 0.05);
  }

  play(name, e = {}) {
    if (!this.ctx || this.silent) return;
    switch (name) {
      case 'jump':
        this.tone(300, 0.14, { type: 'square', g: 0.045, to: 560 });
        break;
      case 'dash':
        this.noise(0.22, { g: 0.22, f: 3000, to: 600, type: 'bandpass', q: 0.7 });
        this.tone(160, 0.16, { type: 'sawtooth', g: 0.04, to: 80 });
        break;
      case 'swap': {
        const [a, b] = e.phase ? [659.25, 987.77] : [392, 587.33];
        this.tone(a, 0.3, { type: 'triangle', g: 0.1 });
        this.tone(b, 0.4, { type: 'sine', g: 0.07, at: 0.045 });
        this.noise(0.25, { g: 0.06, f: e.phase ? 5000 : 900, type: 'bandpass', q: 2 });
        break;
      }
      case 'deny':
        this.tone(150, 0.1, { type: 'square', g: 0.06 });
        this.tone(118, 0.14, { type: 'square', g: 0.06, at: 0.07 });
        break;
      case 'collect': {
        const base = 880 * Math.pow(2, (((e.n || 1) - 1) % 8) / 12);
        this.tone(base, 0.16, { type: 'triangle', g: 0.08 });
        this.tone(base * 1.5, 0.3, { type: 'sine', g: 0.06, at: 0.06 });
        break;
      }
      case 'land':
        this.noise(0.09, { g: Math.min(0.25, (e.v || 0) / 3000), f: 380, type: 'lowpass' });
        break;
      case 'spring':
        this.tone(180, 0.38, { type: 'sine', g: 0.14, to: 980 });
        break;
      case 'die':
        this.tone(320, 0.5, { type: 'sawtooth', g: 0.08, to: 50 });
        this.noise(0.45, { g: 0.25, f: 900, to: 120, type: 'lowpass' });
        break;
      case 'respawn':
        this.tone(520, 0.25, { type: 'sine', g: 0.06, to: 880 });
        break;
      case 'checkpoint':
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', g: 0.07, at: i * 0.08 }));
        break;
      case 'win':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.9, { type: 'triangle', g: 0.08, at: i * 0.09 }));
        break;
      case 'crumble':
        this.noise(0.12, { g: 0.12, f: 700, type: 'bandpass', q: 1.4 });
        break;
      case 'crumbleFall':
        this.noise(0.35, { g: 0.22, f: 420, to: 120, type: 'lowpass' });
        this.tone(90, 0.25, { type: 'sine', g: 0.08, to: 50 });
        break;
      case 'orb':
        this.tone(1318.5, 0.18, { type: 'triangle', g: 0.08 });
        this.tone(1975.5, 0.32, { type: 'sine', g: 0.05, at: 0.05 });
        break;
      case 'pulseWarn':
        this.tone(e.phase ? 523.25 : 659.25, 0.08, { type: 'square', g: 0.035 });
        this.tone(e.phase ? 523.25 : 659.25, 0.08, { type: 'square', g: 0.035, at: 0.2 });
        break;
      case 'ui':
        this.tone(700, 0.06, { type: 'sine', g: 0.04 });
        break;
      default:
    }
  }
}
