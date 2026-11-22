// VERDE BAY boot + loop: screens, save/load, garage shop, shot mode,
// autopilot demo toggle. The game runs from its own files only.
import { CFG } from './config.js';
import { createWorld, stepWorld, respawn, saveGame, loadSave, currentObjective } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld, drawHUD, drawScreen } from './render.js';
import { createAutopilot, stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || (shotName ? '7' : String(Date.now() % 100000)), 10) || 7;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = createInput();
input.attach();
const audio = createAudio();
const save = loadSave();
const world = createWorld(seed, { state: shotName ? 'play' : 'title', save });
const auto = createAutopilot(world);
let autoOn = params.get('auto') === '1';
let autoTarget = null;

window.__game = { world, input, version: 'verde-bay-2' };
window.__shotReady = false;

if (shotName) {
  stageShot(world, shotName);
  // One render, then the harness screenshots.
  renderFrame();
  window.__shotReady = true;
}

function renderFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld(ctx, world, canvas.width, canvas.height);
  if (world.state === 'play' || world.state === 'pause') drawHUD(ctx, world, canvas.width, canvas.height);
  if (world.state === 'title') {
    drawScreen(ctx, world, canvas.width, canvas.height, 'VERDE BAY', [
      'An open-world crime story — Rico Solano, wheelman for La Reina.',
      'Steal cars, outrun the cops, run 8 missions, and become King of Verde Bay.',
      '',
      'WASD / arrows — move & drive      E — enter car / interact',
      'Shift — sprint      Space — handbrake      F — punch',
      'G — garage shop (in a car at Solano Garage)      R — radio      P — pause',
      'O — autopilot demo driver',
      '',
      save && save.missionIdx > 0
        ? `Save found: mission ${save.missionIdx + 1}/8, $${save.money} — press Enter to continue.`
        : 'Press Enter to play.',
    ]);
  } else if (world.state === 'pause') {
    drawScreen(ctx, world, canvas.width, canvas.height, 'PAUSED', ['Press P or Escape to keep playing.']);
  } else if (world.state === 'busted') {
    drawScreen(ctx, world, canvas.width, canvas.height, 'BUSTED', ['The Verde Bay PD got you. -$150.', 'Press Enter to walk free and try again.']);
  } else if (world.state === 'wasted') {
    drawScreen(ctx, world, canvas.width, canvas.height, 'WASTED', ['That one hurt. -$150.', 'Press Enter to get back on your feet.']);
  } else if (world.state === 'win') {
    drawScreen(ctx, world, canvas.width, canvas.height, 'KING OF VERDE BAY', [
      `All 8 missions done. $${world.player.money} in the bank, ${world.player.respect} respect.`,
      'Marisol pours the champagne on the yacht. You own this city.',
      'Press Enter to play again.',
    ]);
  }
}

function tryBuy(i) {
  const item = CFG.SHOP[i];
  if (!item) return;
  const p = world.player;
  if (world.upgrades[item.id]) return;
  if (p.money < item.price) return;
  p.money -= item.price;
  world.upgrades[item.id] = true;
  if (item.id === 'armor' && p.car && !p.car._armored) {
    p.car.health += 100;
    p.car._armored = true;
  }
  audio.sfx('cash');
  saveGame(world);
}

let lastStation = -1;
let lastCarPress = -10;
let lastObjPress = -10;
let lastPunchPress = -10;
function syncStation() {
  if (world.station !== lastStation) {
    lastStation = world.station;
    audio.setStation(world.station);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  audio.resume();

  const snap = input.snapshot(autoOn && world.state === 'play' ? auto.input(dt) : null);
  // Autopilot interactions. E is a toggle (enter/exit a car), so every
  // press here is throttled and aimed: pressing it every frame while near
  // a car flickers enter/exit and racks up a steal charge per frame.
  if (autoOn && world.state === 'play') {
    const p = world.player;
    const t = world.stats.playTime;
    let goal = null;
    if (!p.car) {
      // Prefer a parked car (it stays put while the player walks to it).
      let best = null;
      let bestD = Infinity;
      // Turbo Heist: the sports car is the one to steal, not the nearest
      // parked car — walk to it and enter it specifically.
      const turbo = world.missionIdx === 4 && world.missionState.phase === 0 && world.missionState.sport;
      if (turbo) {
        best = world.missionState.sport;
        bestD = (best.x - p.x) * (best.x - p.x) + (best.y - p.y) * (best.y - p.y);
      } else {
        for (const c of world.cars) {
          if (c.wrecked || !c.parked) continue;
          const d = (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (!best || bestD > 800 * 800) {
        for (const c of [...world.cars, ...world.police]) {
          if (c.wrecked) continue;
          const d = (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best) {
        goal = { x: best.x, y: best.y };
        if (bestD < 56 * 56 && t - lastCarPress > 0.5) {
          lastCarPress = t;
          if (turbo) world._enterCar = best;
          input.press('KeyE');
        }
      }
    }
    if (!goal) goal = currentObjective(world);
    if (goal && (!autoTarget || Math.hypot(goal.x - autoTarget.x, goal.y - autoTarget.y) > 120 || auto.isDone())) {
      auto.setTarget(goal.x, goal.y);
      autoTarget = { x: goal.x, y: goal.y };
    }
    // Interact at the objective, only for the missions that need it:
    // courier pickup, cash drops, convoy cash grab, and Turbo Heist
    // (exit the current car at the dealership so the sports car can be
    // stolen). Arrival missions complete on arrival, so pressing E there
    // would just exit the car.
    const needsE =
      (world.missionIdx === 1 && world.missionState.phase === 0) ||
      (world.missionIdx === 3 && (world.missionState.drops || []).some((d) => !d.got)) ||
      (world.missionIdx === 4 && world.missionState.phase === 0) ||
      (world.missionIdx === 6 && world.missionState.phase === 1);
    const objNow = currentObjective(world);
    if (needsE && objNow && Math.hypot(p.x - objNow.x, p.y - objNow.y) < 70 && t - lastObjPress > 0.5) {
      lastObjPress = t;
      input.press('KeyE');
    }
    // Smash & Grab needs a punch at the jewelry window, not E.
    if (world.missionIdx === 5 && world.missionState.phase === 0 && objNow &&
        Math.hypot(p.x - objNow.x, p.y - objNow.y) < 70 && t - lastPunchPress > 0.5) {
      lastPunchPress = t;
      input.press('KeyF');
    }
  }
  if (input.takeEdge('KeyO')) {
    autoOn = !autoOn;
    autoTarget = null;
    if (autoOn) {
      const obj = currentObjective(world);
      if (obj) auto.setTarget(obj.x, obj.y);
    }
  }

  if (world.state === 'title') {
    if (snap.confirm || input.takeClick()) {
      world.state = 'play';
      syncStation();
    }
  } else if (world.state === 'pause') {
    if (snap.pause || snap.confirm) world.state = 'play';
  } else if (world.state === 'busted' || world.state === 'wasted') {
    if (snap.confirm) respawn(world);
  } else if (world.state === 'win') {
    if (snap.confirm) {
      try { localStorage.removeItem('verdebay-save'); } catch (e) {}
      location.reload();
    }
  } else if (world.state === 'play') {
    if (snap.pause) {
      world.state = 'pause';
    } else if (world.shopOpen) {
      if (snap.shop) world.shopOpen = false;
      if (input.takeEdge('Digit1')) tryBuy(0);
      if (input.takeEdge('Digit2')) tryBuy(1);
      if (input.takeEdge('Digit3')) tryBuy(2);
    } else {
      if (snap.shop && world.player.car) {
        const g = CFG.GARAGE;
        const c = world.player.car;
        if (c.x > g.x && c.x < g.x + g.w && c.y > g.y && c.y < g.y + g.h) world.shopOpen = true;
      }
      stepWorld(world, snap, dt);
      const p = world.player;
      audio.engine(p.car ? p.car.speed : 0, p.car ? p.car.top : 300);
      audio.siren(world.stars >= 1 && world.police.some((c) => !c.wrecked));
      syncStation();
    }
  }

  renderFrame();
  requestAnimationFrame(frame);
}

if (!shotName) requestAnimationFrame(frame);
