// VERDE BAY — boot, game loop, screens, shot mode, autopilot toggle.
// Entry point: game/index.html loads this module. It owns the canvas,
// the clock, the save, and the bridge the test harness reads
// (window.__game and window.__shotReady).

import { CFG } from './config.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld } from './render.js';
import { stageShot, createAutopilot } from './shots.js';

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed'));
const SEED = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 23;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const world = createWorld(SEED);
const input = createInput(canvas);
input.attach();
const audio = createAudio();
const autopilot = createAutopilot();

// What the harness and the dossier screenshots read.
window.__game = { world };
window.__shotReady = false;

if (shotName) {
  // Staged screenshot: a fixed set-up, no save, no title wait.
  stageShot(world, shotName);
} else {
  // Normal play: pick up where the player left off, if there is a save.
  world.load();
}

let last = performance.now();
let shotFlagged = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // Screen transitions on Enter.
  if (input.pressed.has('Enter')) {
    audio.ensure();
    if (world.state === 'title') world.startGame();
    else if (world.state === 'busted' || world.state === 'wasted') world.respawn();
    else if (world.state === 'win') world.state = 'playing';
    else if (world.state === 'paused') world.state = 'playing';
  }
  // Autopilot demo driver.
  if (input.pressed.has('KeyO')) {
    world.autopilot = !world.autopilot;
    world.flash(world.autopilot ? 'Autopilot driving.' : 'Autopilot off — you drive.');
  }

  if (world.autopilot && world.state === 'playing') {
    autopilot.step(world, input, dt);
  }

  world.update(dt, input);
  audio.update(dt, world);
  drawWorld(ctx, world, canvas.width, canvas.height);
  input.endFrame();

  if (shotName && !shotFlagged) {
    shotFlagged = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Keep the save fresh when the tab closes mid-run.
window.addEventListener('beforeunload', () => { if (world.state === 'playing') world.save(); });
