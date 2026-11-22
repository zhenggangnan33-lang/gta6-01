// Synthesized sound: no audio files, everything is WebAudio oscillators.
// Two radio stations (VERDE FM: mellow latin groove; BAY 98: fast synth),
// engine hum, siren, and one-shot effects. All guarded so a muted or
// headless run never throws.
export function createAudio() {
  let ctx = null;
  let master = null;
  let station = 0; // 0 off, 1 VERDE FM, 2 BAY 98
  let radioTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let step = 0;

  // 16-step patterns: bass notes (Hz, 0 = rest) and lead notes.
  const STATIONS = {
    1: {
      bpm: 96,
      bass: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0],
      lead: [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 329.6, 0],
    },
    2: {
      bpm: 128,
      bass: [55, 55, 0, 55, 0, 55, 65.4, 0, 55, 55, 0, 55, 73.4, 0, 65.4, 0],
      lead: [440, 0, 415.3, 440, 0, 523.3, 0, 440, 392, 0, 440, 0, 493.9, 523.3, 0, 0],
    },
  };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function note(freq, dur, type, vol, when = 0) {
    if (!ctx || !freq) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function radioTick() {
    if (!ctx || station === 0) return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm / 2; // 8th notes
    const i = step % 16;
    note(st.bass[i], beat * 0.9, 'triangle', 0.16);
    note(st.lead[i], beat * 0.9, 'square', 0.05);
    step++;
    radioTimer = setTimeout(radioTick, beat * 1000);
  }

  return {
    resume() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setStation(n) {
      station = n;
      if (!ensure()) return;
      clearTimeout(radioTimer);
      radioTimer = null;
      step = 0;
      if (station !== 0) radioTick();
    },
    engine(speed, top) {
      if (!ensure()) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 500;
        engineOsc.connect(filt);
        filt.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const ratio = Math.abs(speed) / Math.max(top, 1);
      engineOsc.frequency.value = 55 + ratio * 140;
      engineGain.gain.value = speed !== 0 ? 0.03 + ratio * 0.04 : 0;
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.03;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        const flip = () => {
          if (!sirenOsc) return;
          sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 700 : 950;
          setTimeout(flip, 450);
        };
        flip();
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch (e) {}
        sirenOsc = null;
        sirenGain = null;
      }
    },
    sfx(name) {
      if (!ensure()) return;
      if (name === 'punch') note(120, 0.12, 'square', 0.2);
      else if (name === 'crash') { note(70, 0.3, 'sawtooth', 0.25); note(50, 0.35, 'square', 0.2); }
      else if (name === 'pickup') { note(660, 0.1, 'sine', 0.2); note(880, 0.18, 'sine', 0.2, 0.09); }
      else if (name === 'mission') {
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(f, 0.22, 'triangle', 0.18, i * 0.11));
      } else if (name === 'busted') {
        [392, 311, 233].forEach((f, i) => note(f, 0.3, 'sawtooth', 0.15, i * 0.18));
      } else if (name === 'cash') { note(988, 0.1, 'sine', 0.18); note(1318, 0.16, 'sine', 0.18, 0.08); }
    },
  };
}
