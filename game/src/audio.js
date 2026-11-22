// Synthesised sound for VERDE BAY — WebAudio only, no audio files.
// Two radio stations (step-sequenced bass + lead), an engine hum that
// follows the player's speed, a two-tone police siren, and one-shot
// effects (cash, crash, pickup, punch, alarm). Everything is created
// lazily on the first user gesture so the AudioContext is allowed.

import { CFG } from './config.js';

export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    station: 0, muted: false, step: 0, nextNote: 0,
    ensure() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      // Engine: a low sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const lp = audio.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      audio.engineOsc.connect(lp); lp.connect(audio.engineGain); audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: a triangle wave wobbling between two tones.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenOsc.frequency.value = 660;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain); audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.sirenLfo = audio.ctx.createOscillator();
      audio.sirenLfo.frequency.value = 0.55;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 220;
      audio.sirenLfo.connect(lfoGain); lfoGain.connect(audio.sirenOsc.frequency);
      audio.sirenLfo.start();
    },
    setMuted(m) {
      audio.muted = m;
      if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
    },
    // One-shot blip. `notes` is [[midi, seconds], ...] played in order.
    blip(freq, dur, type = 'square', vol = 0.2) {
      if (!audio.ctx || audio.muted) return;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      o.connect(g); g.connect(audio.master);
      o.start(); o.stop(audio.ctx.currentTime + dur + 0.02);
    },
    cash() { audio.blip(880, 0.09); setTimeout(() => audio.blip(1318, 0.14), 80); },
    pickup() { audio.blip(660, 0.08, 'sine', 0.25); setTimeout(() => audio.blip(990, 0.1, 'sine', 0.25), 70); },
    crash() {
      if (!audio.ctx || audio.muted) return;
      const len = audio.ctx.sampleRate * 0.18;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain(); g.gain.value = 0.4;
      src.connect(g); g.connect(audio.master);
      src.start();
    },
    punch() { audio.blip(140, 0.12, 'sine', 0.5); },
    alarm() { audio.blip(1180, 0.22, 'square', 0.16); setTimeout(() => audio.blip(1180, 0.22, 'square', 0.16), 260); },
    // Step-sequencer tick for the current radio station.
    tick(step) {
      if (!audio.ctx || audio.muted) return;
      const st = CFG.radio[audio.station];
      const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
      const bassLine = st.minor ? [0, 0, 7, 0, 3, 0, 5, 7] : [0, 4, 5, 4, 0, 4, 7, 5];
      const leadLine = st.minor ? [12, -1, 15, -1, 12, -1, 10, 12] : [12, 16, 19, 16, 14, 12, 14, 19];
      const beat = step % 8;
      const bass = bassLine[beat];
      if (bass !== -1) audio.note(midi(st.root + bass), 0.22, 'triangle', 0.22);
      const lead = leadLine[beat];
      if (lead !== -1 && step % 2 === 0) audio.note(midi(st.root + 24 + lead), 0.12, 'square', 0.05);
    },
    note(freq, dur, type, vol) {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      o.connect(g); g.connect(audio.musicGain);
      o.start(); o.stop(audio.ctx.currentTime + dur + 0.02);
    },
    update(dt, w) {
      if (!audio.ctx) return;
      const p = w.player;
      const speed = p.car ? Math.abs(p.car.speed) : Math.abs(p.speed || 0);
      audio.engineGain.gain.value = p.car ? 0.05 + Math.min(0.09, speed / 5000) : 0;
      if (audio.engineOsc) audio.engineOsc.frequency.value = 48 + speed * 0.22;
      const sirenOn = w.police.some((c) => !c.wrecked) && w.stars >= 1;
      audio.sirenGain.gain.value = sirenOn ? 0.035 : 0;
      // Radio sequencer.
      const st = CFG.radio[audio.station];
      const stepDur = 60 / st.bpm / 2;
      audio.nextNote -= dt;
      if (audio.nextNote <= 0) {
        audio.nextNote = stepDur;
        audio.tick(audio.step++);
      }
    },
  };
  return audio;
}
