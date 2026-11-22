// Staged screenshots + the road-following autopilot for VERDE BAY.
// Shots are deterministic set-ups (fixed positions, fixed seed) so the
// four images are stable across runs. The autopilot drives the game the
// way a player would — route along the roads, brake for turns and
// traffic, reverse out when stuck, enter cars and press E where the
// mission needs it — and it is what the interactive play test uses.

import { CFG } from './config.js';
import { startMission } from './missions.js';

const P = CFG.places;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Give the player a car at a fixed spot (used by the staged shots).
function putPlayerInCar(w, x, y, angle, model, color) {
  const car = w.addCar({ x, y, angle, model: model || 'sedan', color: color || '#3f6fb5', parked: false });
  car.stolen = true; // no heat for a staged car
  w.player.car = car;
  w.player.x = x; w.player.y = y; w.player.angle = angle;
  car.speed = 0;
  return car;
}

export function stageShot(w, name) {
  const p = w.player;
  if (name === 'cover') {
    // Four-star chase at Meridian Bank, mission 1 already done.
    w.startGame();
    startMission(w, 1); // Night Courier in progress
    w.player.money = 700; w.player.respect = 10;
    putPlayerInCar(w, 960, 600, 0.1, 'sedan', '#3f6fb5'); // on the road below the bank
    p.car.speed = 210;
    w.setHeat(78);
    w.spawnPolice(4);
    w.heli.active = true;
    w.heli.x = p.x; w.heli.y = p.y - 90;
    w.time = 17.4;
  } else if (name === 'chase') {
    // Police ramming the player's taxi on the beach road.
    w.startGame();
    putPlayerInCar(w, 1500, 1800, 0.05, 'taxi', '#e8c832');
    p.car.speed = 260;
    w.setHeat(55);
    const cop1 = w.addCar({ x: 1440, y: 1800, angle: 0.05, model: 'police', color: '#20242c', police: true, health: 260 });
    cop1.speed = 300;
    const cop2 = w.addCar({ x: 1380, y: 1796, angle: 0.1, model: 'police', color: '#20242c', police: true, health: 260 });
    cop2.speed = 290;
    w.time = 11.0;
  } else if (name === 'mission') {
    // Courier run: package collected, delivering to Hotel Miramar.
    w.startGame();
    startMission(w, 1);
    w.missionPhase = 1; // package already collected
    w.player.money = 1200; w.player.respect = 18;
    putPlayerInCar(w, 1700, 360, -0.4, 'sedan', '#7a4a8f'); // on the road by the hotel, still en route
    p.car.speed = 180;
    w.setHeat(12);
    w.spawnPolice(1);
    w.time = 12.5;
  } else if (name === 'city') {
    // Title screen over the city at dusk.
    w.state = 'title';
    p.x = 1280; p.y = 1000; p.angle = -Math.PI / 2;
    w.time = 18.2;
  }
  // Let the world settle for a few steps so cars/peds are placed.
  const idle = { down: new Set(), pressed: new Set() };
  if (w.state === 'playing') {
    for (let i = 0; i < 12; i++) w.update(1 / 60, idle);
  }
}

export function createAutopilot() {
  const ap = {
    route: null, routeIdx: 0, goalKey: '',
    lastX: 0, lastY: 0, lastT: 0, reverseT: 0, sideT: 0, sideDir: 1,
    eT: 0, footStuckT: 0,
    step(w, input, dt) {
      const p = w.player;
      if (w.state !== 'playing') return;
      ap.eT = Math.max(0, ap.eT - dt);
      // The autopilot owns the driving keys while it runs.
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyE']) input.down.delete(k);

      // ---- choose a goal ----
      let goal = null;
      let goalKind = 'objective';
      const obj = w.objective();
      const mIdx = w.missionIdx;
      if (mIdx === 7) {
        // King of Verde Bay: keep moving — pick a fresh road point.
        if (!ap.route || ap.routeIdx >= ap.route.length) {
          const pt = w.city.randomRoadPoint(w.rng);
          goal = { x: pt.x, y: pt.y };
          goalKind = 'roam';
        }
      } else if (!p.car) {
        if (mIdx === 4) {
          // Hot Wheels: go straight for the sports car.
          const s = w.missionData.sports;
          if (s && !s.wrecked) { goal = { x: s.x, y: s.y }; goalKind = 'car'; }
        }
        if (!goal) {
          // Far objective? Steal a car first.
          const far = obj && dist(p.x, p.y, obj.x, obj.y) > 380;
          if (far) {
            let best = null, bd = 520;
            for (const c of w.cars) {
              if (c.wrecked || c.police || c.convoy || c.traffic) continue;
              const d = dist(p.x, p.y, c.x, c.y);
              if (d < bd) { bd = d; best = c; }
            }
            if (best) { goal = { x: best.x, y: best.y }; goalKind = 'car'; }
          }
        }
        if (!goal && obj) { goal = { x: obj.x, y: obj.y }; goalKind = 'objective'; }
      } else {
        // In a car: mission 5 without the sports car means go get it.
        if (mIdx === 4 && p.car !== w.missionData.sports) {
          goal = { x: CFG.places.dealer.at[0], y: CFG.places.dealer.at[1] };
          goalKind = 'dealer';
        } else if (obj) {
          goal = { x: obj.x, y: obj.y };
          goalKind = 'objective';
        }
      }
      if (!goal) return;

      // ---- E presses (throttled, mission-aware) ----
      const nearGoal = dist(p.x, p.y, goal.x, goal.y);
      if (!p.car) {
        // Hold E to crack the case (mission 6, phase 0) — only when
        // actually standing at the jewels. The old code tested nearGoal
        // (distance to the current goal), so standing next to a car to
        // steal held E down forever instead of pressing it to get in:
        // `down` never fires the world's `pressed` check, and the
        // arrive-radius return meant no movement keys either — the
        // player froze beside the car for the rest of the run.
        const atJewels = mIdx === 5 && w.missionPhase === 0 &&
          dist(p.x, p.y, CFG.places.jewels.at[0], CFG.places.jewels.at[1]) < CFG.places.jewels.r;
        if (atJewels) {
          input.down.add('KeyE');
        } else if (ap.eT <= 0 && nearGoal < 64) {
          // Walk right up to the sports car before pressing E (mission 5):
          // pressing from too far away re-enters the car just left.
          if (mIdx === 4 && nearGoal > 48) {
            // too far — keep walking, do not press yet
          } else {
            input.pressed.add('KeyE');
            ap.eT = 0.45;
          }
        }
      } else {
        // Exit near the sports car (mission 5) or the jewels (mission 6),
        // or press E where the mission needs it (courier pickup, convoy
        // cash grab). The world tries the mission's interact first, so
        // pressing E here is safe: if the mission does not need it, the
        // player simply steps out of the car.
        const near = dist(p.x, p.y, goal.x, goal.y);
        const wantPress =
          (mIdx === 1 && w.missionPhase === 0 && near < 80) ||
          (mIdx === 4 && goalKind === 'dealer' && near < 90) ||
          (mIdx === 5 && w.missionPhase === 0 && near < CFG.places.jewels.r + 20) ||
          (mIdx === 6 && w.missionPhase === 0 && near < 80);
        if (wantPress && ap.eT <= 0) {
          input.pressed.add('KeyE');
          ap.eT = 0.45;
        }
      }

      // ---- follow the route ----
      const key = goalKind + ':' + Math.round(goal.x / 40) + ',' + Math.round(goal.y / 40);
      if (key !== ap.goalKey || !ap.route || ap.routeIdx >= ap.route.length) {
        ap.goalKey = key;
        ap.route = w.city.route(p.x, p.y, goal.x, goal.y);
        ap.routeIdx = 0;
      }
      if (!ap.route || ap.routeIdx >= ap.route.length) {
        // Final approach: head straight at the goal.
        steerToward(w, input, dt, goal.x, goal.y, p.car ? 160 : 120);
        return;
      }
      const wp = ap.route[ap.routeIdx];
      if (dist(p.x, p.y, wp.x, wp.y) < (p.car ? 42 : 26)) {
        ap.routeIdx++;
        return;
      }
      if (p.car) driveToward(ap, w, input, dt, wp.x, wp.y);
      else walkToward(ap, w, input, dt, wp.x, wp.y);
    },
  };
  return ap;
}

function steerToward(w, input, dt, tx, ty, speed) {
  const p = w.player;
  const want = Math.atan2(ty - p.y, tx - p.x);
  const diff = angDiff(p.angle, want);
  if (p.car) {
    const steer = clamp(diff * 2.2, -1, 1);
    if (steer < -0.15) input.down.add('KeyA');
    if (steer > 0.15) input.down.add('KeyD');
    if (Math.abs(diff) < 1.9) input.down.add('KeyW');
  } else {
    const dx = Math.cos(want), dy = Math.sin(want);
    if (dy < -0.3) input.down.add('KeyW');
    if (dy > 0.3) input.down.add('KeyS');
    if (dx < -0.3) input.down.add('KeyA');
    if (dx > 0.3) input.down.add('KeyD');
    if (Math.abs(dx) + Math.abs(dy) > 0.5) input.down.add('ShiftLeft');
  }
}

function driveToward(ap, w, input, dt, tx, ty) {
  const p = w.player;
  const car = p.car;
  const want = Math.atan2(ty - p.y, tx - p.x);
  const diff = angDiff(car.angle, want);
  const d = dist(p.x, p.y, tx, ty);

  // Stuck detection: barely moving while trying to drive.
  ap.lastT += dt;
  if (ap.lastT > 0.6) {
    const moved = dist(p.x, p.y, ap.lastX, ap.lastY);
    if (moved < 9 && Math.abs(car.speed) < 30) {
      ap.reverseT = 1.2;
      ap.route = null; // re-route from here after reversing
    }
    ap.lastX = p.x; ap.lastY = p.y; ap.lastT = 0;
  }
  if (ap.reverseT > 0) {
    ap.reverseT -= dt;
    input.down.add('KeyS');
    input.down.add(Math.sign(diff) >= 0 ? 'KeyA' : 'KeyD');
    return;
  }

  const steer = clamp(diff * 2.2, -1, 1);
  if (steer < -0.15) input.down.add('KeyA');
  if (steer > 0.15) input.down.add('KeyD');
  // Brake for sharp turns, for the final approach, and for cars ahead.
  const carAhead = (() => {
    const ax = p.x + Math.cos(car.angle) * 64, ay = p.y + Math.sin(car.angle) * 64;
    for (const c of w.cars) {
      if (c === car || c.wrecked) continue;
      if (dist(ax, ay, c.x, c.y) < 36) return true;
    }
    return false;
  })();
  const needBrake = (Math.abs(diff) > 0.7 && Math.abs(car.speed) > 110) ||
    (d < 150 && Math.abs(car.speed) > 120) || carAhead;
  if (needBrake) {
    if (Math.abs(car.speed) > 60) input.down.add('Space');
  } else {
    input.down.add('KeyW');
  }
}

function walkToward(ap, w, input, dt, tx, ty) {
  const p = w.player;
  // Stuck on foot: sidestep for a while, then resume.
  ap.lastT += dt;
  if (ap.lastT > 0.8) {
    const moved = dist(p.x, p.y, ap.lastX, ap.lastY);
    if (moved < 6) {
      ap.sideT = 0.9;
      ap.sideDir = -ap.sideDir;
    }
    ap.lastX = p.x; ap.lastY = p.y; ap.lastT = 0;
  }
  const want = Math.atan2(ty - p.y, tx - p.x);
  let a = want;
  if (ap.sideT > 0) {
    ap.sideT -= dt;
    a = want + (Math.PI / 2) * ap.sideDir;
  }
  const dx = Math.cos(a), dy = Math.sin(a);
  if (dy < -0.3) input.down.add('KeyW');
  if (dy > 0.3) input.down.add('KeyS');
  if (dx < -0.3) input.down.add('KeyA');
  if (dx > 0.3) input.down.add('KeyD');
  if (dist(p.x, p.y, tx, ty) > 320) input.down.add('ShiftLeft');
}
