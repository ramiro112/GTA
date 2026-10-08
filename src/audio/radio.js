// Autoradio: vier Sender mit prozedural erzeugter Musik (Step-Sequencer, eigene Kompositionsregeln).
// Keine Samples, keine fremde Musik – alles wird live mit Oszillatoren und Rauschen synthetisiert.

const STATIONS = [
  { id: 'off', name: 'Radio aus' },
  { id: 'aurelia', name: 'Aurelia FM – Synthpop', bpm: 112, scale: [0, 2, 4, 7, 9], root: 57, wave: 'sawtooth', drums: 'pop' },
  { id: 'hafen', name: 'Hafenfunk – Lo-Fi', bpm: 80, scale: [0, 3, 5, 7, 10], root: 52, wave: 'triangle', drums: 'lofi' },
  { id: 'rostfeld', name: 'Rostfeld Radio – Techno', bpm: 128, scale: [0, 3, 7, 10], root: 45, wave: 'square', drums: 'techno' },
  { id: 'klassik', name: 'Klassik Bay – Arpeggien', bpm: 90, scale: [0, 2, 4, 5, 7, 9, 11], root: 60, wave: 'sine', drums: 'none' },
];

const CHORDS = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [9, 12, 16], [2, 5, 9]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Radio {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.55;
    this.out.connect(out);
    this.station = 1;
    this.on = false;
    this.step = 0;
    this.nextTime = 0;
    this.seed = 1;
    this.timer = null;
    this.noise = this._noiseBuffer();
    this.progression = [0, 3, 1, 2];
  }

  get stations() { return STATIONS; }
  get current() { return STATIONS[this.station]; }

  _noiseBuffer() {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  setStation(i) {
    this.station = (i + STATIONS.length) % STATIONS.length;
    this.step = 0;
    this.seed = this.station * 1000 + 7;
    this.progression = [0, 1 + Math.floor(this._rand() * 4), Math.floor(this._rand() * 5), 1 + Math.floor(this._rand() * 3)];
    return this.current;
  }

  next() { return this.setStation(this.station + 1); }

  start() {
    if (this.on) return;
    this.on = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.on = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _schedule() {
    const st = this.current;
    if (!this.on || st.id === 'off') return;
    const spb = 60 / st.bpm / 4; // 16tel
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this._playStep(st, this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
  }

  _playStep(st, step, t, spb) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = CHORDS[this.progression[bar] % CHORDS.length];
    const root = st.root;
    // Schlagzeug
    if (st.drums !== 'none') {
      const kick = st.drums === 'techno' ? s % 4 === 0 : st.drums === 'lofi' ? (s === 0 || s === 10) : (s % 8 === 0);
      const snare = st.drums === 'techno' ? false : s === 4 || s === 12;
      const hat = st.drums === 'techno' ? s % 4 === 2 : st.drums === 'lofi' ? s % 2 === 0 : s % 2 === 1;
      const clap = st.drums === 'techno' && (s === 4 || s === 12);
      if (kick) this._kick(t);
      if (snare || clap) this._snare(t, clap ? 0.25 : 0.35);
      if (hat) this._hat(t, st.drums === 'lofi' ? 0.06 : 0.09);
    }
    // Bass
    if (st.id === 'rostfeld' ? s % 2 === 0 : s % 4 === 0) this._tone(mtof(root - 12 + chord[0]), t, spb * (st.id === 'hafen' ? 3.5 : 1.8), st.id === 'rostfeld' ? 'sawtooth' : 'triangle', 0.22, 600);
    // Akkorde (Pad)
    if (s === 0 && st.id !== 'rostfeld') for (const n of chord) this._tone(mtof(root + n), t, spb * 15, st.id === 'klassik' ? 'triangle' : 'sawtooth', st.id === 'hafen' ? 0.05 : 0.04, st.id === 'hafen' ? 900 : 1800, 0.3);
    // Melodie / Arpeggio
    if (st.id === 'klassik') {
      const n = chord[s % 3] + (Math.floor(s / 3) % 2) * 12;
      this._tone(mtof(root + n), t, spb * 1.6, 'sine', 0.1, 4000);
    } else if (st.id === 'rostfeld') {
      if (s % 4 === 3) this._tone(mtof(root + 12 + chord[(s >> 2) % 3]), t, spb * 0.8, 'square', 0.06, 1200 + 800 * Math.sin(step / 16));
    } else if (this._rand() < (st.id === 'hafen' ? 0.28 : 0.45) && s % 2 === 0) {
      const deg = st.scale[Math.floor(this._rand() * st.scale.length)];
      this._tone(mtof(root + 12 + deg), t, spb * (1 + Math.floor(this._rand() * 3)), st.wave, 0.08, st.id === 'hafen' ? 1500 : 3000);
    }
  }

  _tone(freq, t, dur, type, vol, cutoff, attack = 0.01) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.3);
  }

  _snare(t, vol) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(this.out);
    n.start(t); n.stop(t + 0.2);
  }

  _hat(t, vol) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f).connect(g).connect(this.out);
    n.start(t); n.stop(t + 0.06);
  }
}
