// VERDE BAY v2 — entry point. Boots the canvas, wires input, audio
// and the render loop, and exposes the game to the make.fun harness
// through `window.__game`. In shot mode (?shot=<id>) it stages one
// screenshot scene and renders a single frame.

import { CFG } from './config.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { makeShotWorld } from './shots.js';

const params = new URLSearchParams(location.search);
const shotId = params.get('shot');
const seed = CFG.seed;

const canvas = document.getElementById('game');
canvas.width = 1280;
canvas.height = 720;

let world, renderer, input, audio;

if (shotId) {
  const made = makeShotWorld(seed, shotId);
  world = made.w;
  renderer = createRenderer(canvas);
  // One still frame for the screenshot.
  renderer.draw(world, 0);
  window.__game = { world, shot: made.shot.id, ready: true };
} else {
  world = createWorld(seed);
  renderer = createRenderer(canvas);
  input = createInput();
  audio = createAudio();
  world.load();

  window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  window.addEventListener('keydown', () => audio.ensure(), { once: true });

  let last = performance.now();
  let acc = 0;
  let lastStation = -1;
  const STEP = 1 / 60;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // tab was in the background
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      // Enter starts the game, and recovers from busted / wasted / win.
      if (input.pressed.has('Enter')) {
        if (world.state === 'title') world.startGame();
        else if (world.state === 'busted' || world.state === 'wasted') world.respawn();
        else if (world.state === 'win') world.state = 'playing';
      }
      world.update(STEP, input);
      input.endFrame();
    }
    renderer.draw(world, dt);
    // Sound follows the world.
    const p = world.player;
    audio.engine(p.car ? Math.abs(p.car.speed) / 500 : 0, !!p.car && world.state === 'playing');
    audio.siren(world.stars >= 2 && world.state === 'playing');
    if (world.station !== lastStation) { lastStation = world.station; audio.setStation(world.station); }
    audio.setMuted(world.muted);
  }
  requestAnimationFrame(frame);

  window.__game = { world, ready: true };
}
