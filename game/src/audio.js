// Procedural sound for VERDE BAY v2: a WebAudio synth for engine,
// impacts, sirens, horns and pickups, plus three radio stations —
// chiptune synthwave, Latin pop and a new lo-fi jazz channel — all
// generated from note tables, no audio files. Music starts only after
// the first user gesture (browser autoplay rules).

import { CFG } from './config.js';

export function createAudio() {
  const a = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    station: 0, muted: false, _nextNote: 0, _step: 0, _timer: null,
    _osc: null, _oscGain: null, _siren: null, _sirenGain: null,
  };

  a.ensure = () => {
    if (a.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.6;
    a.master.connect(a.ctx.destination);
    a.musicGain = a.ctx.createGain();
    a.musicGain.gain.value = 0.16;
    a.musicGain.connect(a.master);
    a.sfxGain = a.ctx.createGain();
    a.sfxGain.gain.value = 0.5;
    a.sfxGain.connect(a.master);
    a._startMusic();
  };

  a.setMuted = (m) => {
    a.muted = m;
    if (a.master) a.master.gain.value = m ? 0 : 0.6;
  };

  a.setStation = (n) => {
    a.station = n;
    a._step = 0;
  };

  a._startMusic = () => {
    const st = CFG.radio[a.station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    a._nextNote = a.ctx.currentTime + 0.1;
    // Scales and 16-step patterns are derived from the station's own
    // root / minor / bpm: no note tables in the config, no audio files.
    const minorScale = [0, 3, 5, 7, 10, 12, 15];
    const majorScale = [0, 2, 4, 7, 9, 12, 14];
    const patterns = [
      [0, 2, 4, 2, 5, 4, 2, 0, 0, 2, 4, 5, 4, 2, 1, 0],
      [0, 1, 2, 4, 2, 1, 0, 2, 5, 4, 2, 1, 0, 1, 2, 4],
      [0, 4, 2, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 1, 0],
    ];
    const waves = ['square', 'triangle', 'sine'];
    const tick = () => {
      if (!a.ctx) return;
      const now = a.ctx.currentTime;
      while (a._nextNote < now + 0.25) {
        const stNow = CFG.radio[a.station];
        const scale = stNow.minor ? minorScale : majorScale;
        const pat = patterns[a.station % patterns.length];
        const idx = pat[a._step % pat.length];
        const midi = stNow.root + scale[idx % scale.length] + 12 * Math.floor(idx / scale.length);
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        a._note(freq, a._nextNote, stepDur * 0.9, waves[a.station % waves.length]);
        a._nextNote += stepDur;
        a._step++;
      }
    };
    a._timer = setInterval(tick, 80);
  };

  a._note = (freq, when, dur, wave) => {
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = wave || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.5, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(a.musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  };

  // Continuous engine drone, pitch follows the player's speed.
  a.engine = (speed01, on) => {
    if (!a.ctx) return;
    if (on && !a._osc) {
      a._osc = a.ctx.createOscillator();
      a._oscGain = a.ctx.createGain();
      a._osc.type = 'sawtooth';
      a._oscGain.gain.value = 0.03;
      const f = a.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900;
      a._osc.connect(f); f.connect(a._oscGain); a._oscGain.connect(a.sfxGain);
      a._osc.start();
    }
    if (a._osc) {
      a._osc.frequency.value = 55 + speed01 * 130;
      a._oscGain.gain.value = on ? 0.03 + speed01 * 0.05 : 0;
    }
  };

  a._sfx = (freq, dur, type, vol, slide) => {
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.sfxGain);
    o.start(t); o.stop(t + dur);
  };

  a.crash = () => { a._sfx(110, 0.22, 'sawtooth', 0.3, 45); };
  a.horn = () => { a._sfx(330, 0.16, 'square', 0.16, 300); };
  a.pickup = () => { a._sfx(660, 0.12, 'sine', 0.22, 990); a._sfx(990, 0.14, 'sine', 0.16, 1320); };
  a.busted = () => { a._sfx(220, 0.7, 'sawtooth', 0.25, 110); };

  // Two-tone police siren, follows the wanted level.
  a.siren = (on) => {
    if (!a.ctx) return;
    if (on && !a._siren) {
      a._siren = a.ctx.createOscillator();
      a._sirenGain = a.ctx.createGain();
      a._siren.type = 'triangle';
      a._sirenGain.gain.value = 0.04;
      a._siren.connect(a._sirenGain);
      a._sirenGain.connect(a.sfxGain);
      a._siren.start();
      const L = a._siren;
      const flip = () => {
        if (!a._siren) return;
        L.frequency.value = L.frequency.value < 800 ? 950 : 650;
        a._siren._t = setTimeout(flip, 420);
      };
      flip();
    }
    if (!on && a._siren) {
      clearTimeout(a._siren._t);
      try { a._siren.stop(); } catch (e) { /* already stopped */ }
      a._siren = null;
    }
  };

  return a;
}
