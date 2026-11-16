// All sound is synthesised on the fly with Web Audio: no audio files.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (root, i) => root * Math.pow(2, PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length] / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.drone = null;
    this.chargeNodes = null;
    this.pendingDrone = null;
  }

  /** Browsers only allow audio after a tap or key press, so this is called from those. */
  wake() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.pendingDrone) this.ambient(this.pendingDrone);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.wake();
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.08);
  }

  get ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  tone({ freq = 440, to = null, type = 'sine', dur = 0.6, gain = 0.18, attack = 0.012, delay = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 1, gain = 0.25, from = 300, to = 3000, q = 0.8, type = 'bandpass', delay = 0, attack = 0.05 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  /** A soft bell on a pentatonic scale. */
  chime(i = 0, root = 261.6, gain = 0.16, delay = 0) {
    const f = note(root, i);
    this.tone({ freq: f, dur: 1.6, gain, delay });
    this.tone({ freq: f * 2.005, dur: 0.9, gain: gain * 0.35, delay });
    this.tone({ freq: f * 3.01, dur: 0.4, gain: gain * 0.12, delay });
  }

  blip() { this.tone({ freq: 880, to: 1320, dur: 0.12, gain: 0.07, type: 'triangle' }); }

  whoosh(dur = 1.4, up = true) {
    this.noise({ dur, gain: 0.3, from: up ? 180 : 5200, to: up ? 5200 : 180, q: 0.7, attack: dur * 0.35 });
    this.tone({ freq: up ? 70 : 240, to: up ? 320 : 50, dur, gain: 0.12, type: 'sawtooth', attack: dur * 0.4 });
  }

  boom(size = 1) {
    this.tone({ freq: 110, to: 24, dur: 2.6 * size, gain: 0.5, attack: 0.01 });
    this.tone({ freq: 55, to: 18, dur: 3.4 * size, gain: 0.4, attack: 0.02, type: 'triangle' });
    this.noise({ dur: 3.2 * size, gain: 0.45, from: 2400, to: 60, type: 'lowpass', q: 0.3, attack: 0.01 });
  }

  /** A rising hum for hold-to-charge actions. Call setCharge(0..1) while held. */
  startCharge(base = 60) {
    if (!this.ready || this.chargeNodes) return;
    const t = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sine';
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 4;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.2);
    o1.connect(f); o2.connect(f); f.connect(g).connect(this.master);
    o1.start(); o2.start();
    this.chargeNodes = { o1, o2, f, g, base };
    this.setCharge(0);
  }

  setCharge(v) {
    const n = this.chargeNodes; if (!n) return;
    const t = this.ctx.currentTime, hz = n.base * (1 + v * 3);
    n.o1.frequency.setTargetAtTime(hz, t, 0.05);
    n.o2.frequency.setTargetAtTime(hz * 1.503, t, 0.05);
    n.f.frequency.setTargetAtTime(300 + v * 2600, t, 0.05);
    n.g.gain.setTargetAtTime(0.06 + v * 0.12, t, 0.05);
  }

  stopCharge() {
    const n = this.chargeNodes; if (!n) return;
    const t = this.ctx.currentTime;
    n.g.gain.setTargetAtTime(0.0001, t, 0.08);
    n.o1.stop(t + 0.5); n.o2.stop(t + 0.5);
    this.chargeNodes = null;
  }

  /** A quiet background drone; each place has its own root note. */
  ambient(root) {
    this.pendingDrone = root;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.drone) {
      const old = this.drone;
      old.g.gain.setTargetAtTime(0.0001, t, 0.6);
      old.os.forEach((o) => o.stop(t + 3));
      this.drone = null;
    }
    if (!root) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(0.085, t, 1.5);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 180;
    lfo.connect(lg).connect(f.frequency);
    const os = [1, 1.498, 2.004, 3.01].map((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = i < 2 ? 'sine' : 'triangle';
      o.frequency.value = root * m;
      o.detune.value = (i - 1.5) * 5;
      const og = this.ctx.createGain(); og.gain.value = [1, 0.6, 0.3, 0.12][i];
      o.connect(og).connect(f);
      o.start();
      return o;
    });
    os.push(lfo); lfo.start();
    f.connect(g).connect(this.master);
    this.drone = { g, os };
  }
}
