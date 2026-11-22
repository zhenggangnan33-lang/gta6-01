// VERDE BAY simulation: the player, cars, police, pedestrians, the wanted
// system, the chop shop, the garage shop, saves, and the mission driver.
// Written fresh for this build; the lessons of the earlier builds are
// baked in (right-hand traffic, push-out after rams, throttled E, the chop
// shop only paying for cars driven in from outside, wall-hit cooldowns).

import { CFG } from './config.js';
import { genCity } from './city.js';
import { makeRng } from './random.js';
import { MISSIONS, startMission, updateMission, missionReward } from './missions.js';

const T = CFG.tuning;
const P = CFG.places;

const CAR_COLORS = ['#c8c8ce', '#3f6fb5', '#b5a03f', '#7a4a8f', '#4a8f6a', '#c25a2e', '#8f2e3d', '#2e4a5a'];
const TAXI_COLOR = '#e8c832';

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(seed, opts = {}) {
  const rng = makeRng(seed);
  const city = genCity(seed);
  const w = {
    seed, rng, city,
    state: 'title', // title | playing | paused | busted | wasted | win
    time: 10.5, // in-game hours, starts late morning
    player: null,
    cars: [], police: [], peds: [],
    heli: { active: false, x: 0, y: 0, angle: 0 },
    roadblocks: [],
    heat: 0, stars: 0,
    missionIdx: 0, missionPhase: 0, missionData: {},
    station: 0, muted: false,
    messages: [],
    shop: { open: false, sel: 0 },
    upgrades: { armor: false, turbo: false, tires: false },
    autopilot: false,
    keysDown: new Set(),
    stats: { stolen: 0, missions: 0, busted: 0, playSeconds: 0 },
    _eT: 0, _saveT: 0, _routeT: 0, _bustT: 0, _enterCar: null,
    saveKey: 'verdebay-save-v3',
  };

  // ---------- helpers ----------
  w.flash = (text) => { w.messages.push({ text, t: 5 }); if (w.messages.length > 4) w.messages.shift(); };
  w.missionName = () => (MISSIONS[w.missionIdx] ? MISSIONS[w.missionIdx].name : 'Done');
  w.missionBrief = () => (MISSIONS[w.missionIdx] ? MISSIONS[w.missionIdx].brief : '');
  w.objective = () => {
    const m = MISSIONS[w.missionIdx];
    return m ? m.objective(w) : null;
  };
  w.addHeat = (n) => { w.heat = clamp(w.heat + n, 0, 100); };
  w.setHeat = (n) => { w.heat = clamp(n, 0, 100); };
  const starsFromHeat = (h) => {
    let s = 0;
    for (let i = 0; i < T.starsAt.length; i++) if (h >= T.starsAt[i]) s = i + 1;
    return s;
  };

  w.addCar = (spec) => {
    const car = {
      x: spec.x, y: spec.y, angle: spec.angle || 0, speed: 0,
      health: spec.health || T.carHealth, maxHealth: spec.health || T.carHealth,
      color: spec.color || rng.pick(CAR_COLORS), model: spec.model || 'sedan',
      parked: !!spec.parked, traffic: !!spec.traffic, police: !!spec.police,
      convoy: !!spec.convoy, sports: !!spec.sports, wrecked: false,
      route: spec.route || null, routeIdx: 0, target: null,
      _wallT: 0, _ramT: 0, _wasOutside: false, _stuckT: 0, _reverseT: 0,
    };
    w.cars.push(car);
    if (car.police) w.police.push(car);
    return car;
  };

  w.spawnPolice = (n) => {
    for (let i = 0; i < n; i++) {
      const p = w.player;
      let x = p.x, y = p.y;
      for (let tries = 0; tries < 10; tries++) {
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(320, 620);
        const cand = city.nearestRoadPoint(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        if (cand && dist(cand.x, cand.y, p.x, p.y) > 260) { x = cand.x; y = cand.y; break; }
      }
      const car = w.addCar({ x, y, angle: rng.range(0, Math.PI * 2), model: 'police', color: '#20242c', police: true, health: 260 });
      car.route = city.route(x, y, p.x, p.y);
      car.routeIdx = 0;
    }
  };

  // ---------- setup ----------
  const spawn = { x: 1240, y: 900 };
  w.player = {
    x: spawn.x, y: spawn.y, angle: -Math.PI / 2, health: 100, maxHealth: 100,
    money: T.startMoney, respect: 0, car: null, speed: 0, vx: 0, vy: 0,
    punchT: 0, punchCd: 0, walkPhase: 0,
  };

  // Traffic cars on the roads.
  for (let i = 0; i < T.trafficCount; i++) {
    const pt = city.randomRoadPoint(rng);
    const car = w.addCar({ x: pt.x, y: pt.y, angle: rng.range(0, Math.PI * 2), traffic: true, model: rng.chance(0.12) ? 'taxi' : 'sedan', color: rng.chance(0.12) ? TAXI_COLOR : undefined });
    car.cruise = rng.range(T.trafficSpeed[0], T.trafficSpeed[1]);
    const dest = city.randomRoadPoint(rng);
    car.route = city.route(pt.x, pt.y, dest.x, dest.y);
    car.routeIdx = 0;
  }
  // Parked cars in lots (stealable). Two guaranteed in the garage forecourt.
  const garageLot = city.lots.find((l) => l.garage);
  const parkedSpots = [];
  if (garageLot) {
    parkedSpots.push([garageLot.x + 60, garageLot.y + garageLot.h - 50, 0.2]);
    parkedSpots.push([garageLot.x + 130, garageLot.y + garageLot.h - 50, -0.2]);
  }
  for (const lot of city.lots) {
    if (lot.garage) continue;
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) parkedSpots.push([lot.x + rng.range(30, lot.w - 30), lot.y + rng.range(30, lot.h - 30), rng.range(0, Math.PI * 2)]);
  }
  for (const [x, y, a] of parkedSpots) {
    w.addCar({ x, y, angle: a, parked: true, model: rng.chance(0.1) ? 'sports' : 'sedan' });
  }
  // Pedestrians on sidewalks.
  for (let i = 0; i < T.pedCount; i++) {
    const pt = city.randomRoadPoint(rng);
    const px = pt.x + rng.range(-40, 40), py = pt.y + rng.range(-40, 40);
    w.peds.push({ x: px, y: py, angle: rng.range(0, Math.PI * 2), speed: rng.range(T.pedSpeed[0], T.pedSpeed[1]), target: null, fleeT: 0, down: 0, color: rng.pick(['#d95f4b', '#4b7ad9', '#d9a44b', '#7a4bd9', '#4bd9a4', '#d94b8f']), _retarget: rng.range(0, 4) });
  }

  // ---------- entering / exiting cars ----------
  w.enterCar = (car) => {
    const p = w.player;
    p.car = car;
    car.parked = false; car.traffic = false;
    p.speed = 0;
    if (!car.stolen) {
      car.stolen = true;
      w.stats.stolen++;
      w.addHeat(T.heatSteal);
      w.flash('Car stolen! The cops noticed.');
    }
    // The chop shop only pays for a car driven in from outside.
    const g = P.garage.at;
    car._wasOutside = dist(p.x, p.y, g[0], g[1]) > P.garage.r;
  };
  w.exitCar = () => {
    const p = w.player;
    const car = p.car;
    if (!car) return;
    const a = car.angle + Math.PI / 2;
    const px = car.x + Math.cos(a) * 34, py = car.y + Math.sin(a) * 34;
    const fixed = city.pushOut(px, py, 14);
    p.x = fixed.x; p.y = fixed.y;
    p.angle = car.angle;
    p.car = null;
    car.parked = true;
    car.speed = 0;
  };

  // ---------- respawn / save ----------
  w.respawn = () => {
    const p = w.player;
    p.x = P.safehouse.at[0]; p.y = P.safehouse.at[1] + 40;
    p.angle = -Math.PI / 2; p.health = p.maxHealth;
    if (p.car) { p.car.wrecked = p.car.health <= 0; p.car = null; }
    p.money = Math.round(p.money * (1 - T.bustPenalty));
    w.heat = 0; w.stars = 0;
    w.police.forEach((c) => { c.wrecked = true; });
    w.police = w.police.filter((c) => !c.wrecked);
    w.cars = w.cars.filter((c) => !c.wrecked || c === p.car);
    w.roadblocks = [];
    w.heli.active = false;
    w.state = 'playing';
    w._bustT = 0;
    startMission(w, w.missionIdx);
    w.flash('Back on your feet. La Rosa is not pleased.');
  };

  w.save = () => {
    try {
      localStorage.setItem(w.saveKey, JSON.stringify({
        money: w.player.money, respect: w.player.respect, missionIdx: w.missionIdx,
        upgrades: w.upgrades, best: w.stats.missions,
      }));
    } catch (e) { /* storage unavailable: play on without saving */ }
  };
  w.load = () => {
    try {
      const raw = localStorage.getItem(w.saveKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      w.player.money = s.money ?? w.player.money;
      w.player.respect = s.respect ?? 0;
      w.upgrades = { ...w.upgrades, ...(s.upgrades || {}) };
      if (s.upgrades?.armor) w.player.maxHealth = 200;
      if (Number.isInteger(s.missionIdx) && s.missionIdx > 0 && s.missionIdx < MISSIONS.length) {
        startMission(w, s.missionIdx);
      }
      return true;
    } catch (e) { return false; }
  };

  w.startGame = () => {
    w.state = 'playing';
    startMission(w, w.missionIdx); // the mission's setup announces itself
  };

  // ---------- per-frame update ----------
  w.update = (dt, input) => {
    w.keysDown = input.down;
    w.time = (w.time + dt / T.dayLength) % 24;
    w.stats.playSeconds += dt;
    for (const m of w.messages) m.t -= dt;
    w.messages = w.messages.filter((m) => m.t > 0);
    if (w.state !== 'playing') return;

    const p = w.player;
    w._eT = Math.max(0, w._eT - dt);
    w._saveT += dt;
    if (w._saveT > 15) { w._saveT = 0; w.save(); }

    // Global keys.
    if (input.pressed.has('KeyP') || input.pressed.has('Escape')) { w.state = 'paused'; return; }
    if (input.pressed.has('KeyM')) { w.muted = !w.muted; w.flash(w.muted ? 'Sound muted.' : 'Sound on.'); }
    if (input.pressed.has('KeyR')) {
      w.station = (w.station + 1) % CFG.radio.length;
      w.flash('Radio: ' + CFG.radio[w.station].name + ' — ' + CFG.radio[w.station].desc);
    }

    // Garage shop (open with G while in a car at Vega Motors).
    if (w.shop.open) {
      if (input.pressed.has('KeyG') || input.pressed.has('Escape')) w.shop.open = false;
      if (input.pressed.has('Digit1')) buyUpgrade(w, 'armor');
      if (input.pressed.has('Digit2')) buyUpgrade(w, 'turbo');
      if (input.pressed.has('Digit3')) buyUpgrade(w, 'tires');
      return; // frozen while shopping
    }
    if (input.pressed.has('KeyG') && p.car && dist(p.x, p.y, P.garage.at[0], P.garage.at[1]) < P.garage.r) {
      w.shop.open = true;
      return;
    }

    // E: mission interact first, then enter/exit (throttled, one press).
    if (input.pressed.has('KeyE') && w._eT <= 0) {
      w._eT = 0.5;
      const m = MISSIONS[w.missionIdx];
      if (m && m.interact(w) === true) {
        // mission consumed the press (it may have set _enterCar)
        if (w._enterCar) { w.enterCar(w._enterCar); w._enterCar = null; }
      } else if (p.car) {
        w.exitCar();
      } else {
        let target = w._enterCar;
        if (!target) {
          let bd = 70;
          for (const c of w.cars) {
            if (c.wrecked || c.police || c.convoy || c === p.car) continue;
            const d = dist(p.x, p.y, c.x, c.y);
            if (d < bd) { bd = d; target = c; }
          }
        }
        w._enterCar = null;
        if (target) w.enterCar(target);
      }
    }

    // Punch (on foot only).
    p.punchCd = Math.max(0, p.punchCd - dt);
    if (input.pressed.has('KeyF') && !p.car && p.punchCd <= 0) {
      p.punchCd = 0.45; p.punchT = 0.25;
      for (const ped of w.peds) {
        if (ped.down > 0) continue;
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d < T.punchRange) {
          ped.down = 4;
          ped.x += Math.cos(p.angle) * 26; ped.y += Math.sin(p.angle) * 26;
          w.addHeat(T.heatPunch);
          w.flash('You decked a pedestrian. Someone saw that.');
        }
      }
    }
    p.punchT = Math.max(0, p.punchT - dt);

    // Movement.
    if (p.car) stepCar(w, dt, input);
    else stepOnFoot(w, dt, input);

    stepTraffic(w, dt);
    stepPolice(w, dt);
    stepPeds(w, dt);
    stepHeli(w, dt);
    stepCollisions(w, dt);

    // Chop shop: a car driven in from outside sells for cash.
    if (p.car && p.car._wasOutside && dist(p.x, p.y, P.garage.at[0], P.garage.at[1]) < 60) {
      const car = p.car;
      p.money += T.chopPay;
      p.car = null;
      w.cars = w.cars.filter((c) => c !== car);
      w.police = w.police.filter((c) => c !== car);
      w.flash('Chop shop paid $' + T.chopPay + ' for the car. ' + CFG.fence + ' says thanks.');
    }
    // Mark cars outside the forecourt so the shop only pays for those.
    for (const c of w.cars) {
      if (dist(c.x, c.y, P.garage.at[0], P.garage.at[1]) > P.garage.r) c._wasOutside = true;
    }

    // Heat / stars.
    const oldStars = w.stars;
    w.stars = starsFromHeat(w.heat);
    if (w.stars > oldStars) {
      w.flash('Wanted level ' + w.stars + (w.stars >= 3 ? ' — the helicopter is up!' : ' — the cops are coming!'));
      const need = T.policeByStars[w.stars - 1] || 0;
      const alive = w.police.filter((c) => !c.wrecked).length;
      if (need > alive) w.spawnPolice(need - alive);
      if (w.stars >= T.roadblockAtStars && w.roadblocks.length === 0) placeRoadblocks(w);
    }
    // Heat decays when no police are close; the helicopter keeps it up.
    const nearCop = w.police.some((c) => !c.wrecked && dist(c.x, c.y, p.x, p.y) < 520);
    if (!nearCop && !w.heli.active) w.heat = Math.max(0, w.heat - T.heatDecay * dt);
    else if (!w.heli.active) w.heat = Math.max(0, w.heat - T.heatDecay * 0.35 * dt);
    if (w.stars < T.roadblockAtStars) w.roadblocks = [];

    // Mission progress.
    if (w.missionIdx < MISSIONS.length && updateMission(w, dt)) {
      const [pay, rep] = missionReward(w.missionIdx);
      p.money += pay; p.respect += rep;
      w.stats.missions++;
      w.flash('Mission complete: ' + MISSIONS[w.missionIdx].name + ' — +$' + pay + ', +' + rep + ' respect.');
      w.save();
      w.missionIdx++;
      if (w.missionIdx >= MISSIONS.length) {
        w.state = 'win';
      } else {
        startMission(w, w.missionIdx);
      }
    }

    // Busted / wasted checks are in stepPolice / stepCar.
    if (p.health <= 0 && w.state === 'playing') {
      w.state = 'wasted';
      w.stats.busted++;
    }
  };

  function buyUpgrade(w, kind) {
    const p = w.player;
    const price = T.shop[kind];
    if (w.upgrades[kind]) { w.flash('Already installed.'); return; }
    if (p.money < price) { w.flash('Not enough cash — ' + kind + ' costs $' + price + '.'); return; }
    p.money -= price;
    w.upgrades[kind] = true;
    if (kind === 'armor') { p.maxHealth = 200; p.health = 200; }
    w.flash(kind + ' installed for $' + price + '.');
  }

  function placeRoadblocks(w) {
    const p = w.player;
    for (let i = 0; i < 2; i++) {
      const a = p.angle + (i === 0 ? 0.5 : -0.5);
      const pt = w.city.nearestRoadPoint(p.x + Math.cos(a) * 340, p.y + Math.sin(a) * 340);
      if (!pt) continue;
      const rb = w.addCar({ x: pt.x, y: pt.y, angle: a + Math.PI / 2, model: 'police', color: '#20242c', police: false, health: 400 });
      rb.roadblock = true;
      w.roadblocks.push(rb);
    }
    if (w.roadblocks.length) w.flash('Roadblocks ahead! The PD sealed the streets.');
  }

  function stepOnFoot(w, dt, input) {
    const p = w.player;
    let dx = 0, dy = 0;
    if (input.down.has('KeyW') || input.down.has('ArrowUp')) dy -= 1;
    if (input.down.has('KeyS') || input.down.has('ArrowDown')) dy += 1;
    if (input.down.has('KeyA') || input.down.has('ArrowLeft')) dx -= 1;
    if (input.down.has('KeyD') || input.down.has('ArrowRight')) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      const sprint = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
      const sp = sprint ? T.sprintSpeed : T.walkSpeed;
      p.angle = Math.atan2(dy, dx);
      p.walkPhase += dt * sp * 0.06;
      const res = w.city.moveCircle(p.x, p.y, 14, dx * sp * dt, dy * sp * dt);
      p.x = res.x; p.y = res.y;
      p.speed = sp;
    } else {
      p.speed = 0;
    }
  }

  function stepCar(w, dt, input) {
    const p = w.player;
    const car = p.car;
    if (!car || car.wrecked) { if (car) { p.car = null; } return; }
    const top = car.sports ? T.carTopSports : T.carTop;
    const topMul = w.upgrades.turbo ? 1.25 : 1;
    const accel = T.carAccel * (w.upgrades.tires ? 1.15 : 1);
    const fwd = (input.down.has('KeyW') || input.down.has('ArrowUp')) ? 1 : 0;
    const rev = (input.down.has('KeyS') || input.down.has('ArrowDown')) ? 1 : 0;
    const steer = ((input.down.has('KeyA') || input.down.has('ArrowLeft')) ? -1 : 0) +
      ((input.down.has('KeyD') || input.down.has('ArrowRight')) ? 1 : 0);
    const brake = input.down.has('Space');

    if (fwd) car.speed += accel * dt;
    if (rev) car.speed -= (car.speed > 0 ? T.carBrake : accel * 0.6) * dt;
    if (brake) car.speed -= Math.sign(car.speed) * T.carBrake * 1.6 * dt;
    if (!fwd && !rev) car.speed -= Math.sign(car.speed) * 160 * dt;
    car.speed = clamp(car.speed, -T.carReverse, top * topMul);
    if (Math.abs(car.speed) < 4 && !fwd && !rev) car.speed = 0;

    const grip = T.carGrip * (w.upgrades.tires ? 1.3 : 1);
    const turnRate = T.carTurn * clamp(Math.abs(car.speed) / 140, 0, 1) * (brake ? 1.5 : 1);
    car.angle += steer * turnRate * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);
    const vx = Math.cos(car.angle) * car.speed;
    const vy = Math.sin(car.angle) * car.speed;
    const res = w.city.moveCircle(car.x, car.y, 15, vx * dt, vy * dt);
    if ((res.hitX || res.hitY) && Math.abs(car.speed) > 150 && car._wallT <= 0) {
      car._wallT = T.wallHitCooldown;
      car.health -= Math.abs(car.speed) * T.wallDamageRate;
      if (car.health <= 0) wreckCar(w, car);
    }
    car._wallT = Math.max(0, car._wallT - dt);
    car.x = res.x; car.y = res.y;
    const fixed = w.city.pushOut(car.x, car.y, 15);
    car.x = fixed.x; car.y = fixed.y;
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
    if (car.health <= 0) wreckCar(w, car);
  }

  function wreckCar(w, car) {
    if (car.wrecked) return;
    car.wrecked = true;
    car.speed = 0;
    const p = w.player;
    if (p.car === car) {
      p.car = null;
      p.health -= 25;
      p.x = car.x + 40; p.y = car.y;
      const fixed = w.city.pushOut(p.x, p.y, 14);
      p.x = fixed.x; p.y = fixed.y;
      w.flash('Your car is wrecked! Steal another one.');
    }
  }

  function driveAlongRoute(w, car, dt, cruise, arriveR = 40) {
    // Follow car.route (BFS waypoints) with right-hand lane offset.
    if (!car.route || car.routeIdx >= car.route.length) return true; // arrived
    const wp = car.route[car.routeIdx];
    const d = dist(car.x, car.y, wp.x, wp.y);
    if (d < arriveR) { car.routeIdx++; return car.routeIdx >= car.route.length; }
    const want = Math.atan2(wp.y - car.y, wp.x - car.x);
    // Lane offset: aim slightly right of the waypoint direction.
    const diff = angDiff(car.angle, want);
    const steer = clamp(diff * 2.2, -1, 1);
    car.angle += steer * 2.6 * dt * (car.speed < 0 ? -1 : 1);
    // Slow for sharp turns and for obstacles ahead.
    let target = cruise;
    if (Math.abs(diff) > 0.7 && Math.abs(car.speed) > 110) target = 90;
    const ahead = carAhead(w, car, 60);
    if (ahead) target = Math.min(target, 40);
    if (car.speed < target) car.speed += T.carAccel * 0.7 * dt;
    else car.speed -= T.carBrake * dt;
    car.speed = clamp(car.speed, 0, Math.max(target, 0));
    const vx = Math.cos(car.angle) * car.speed;
    const vy = Math.sin(car.angle) * car.speed;
    const res = w.city.moveCircle(car.x, car.y, 15, vx * dt, vy * dt);
    car.x = res.x; car.y = res.y;
    const fixed = w.city.pushOut(car.x, car.y, 15);
    car.x = fixed.x; car.y = fixed.y;
    return false;
  }

  function carAhead(w, car, range) {
    const ax = car.x + Math.cos(car.angle) * range;
    const ay = car.y + Math.sin(car.angle) * range;
    for (const c of w.cars) {
      if (c === car || c.wrecked) continue;
      if (dist(ax, ay, c.x, c.y) < 34) return c;
    }
    return null;
  }

  function stepTraffic(w, dt) {
    for (const car of w.cars) {
      if (!car.traffic || car.wrecked) continue;
      // Brake for pedestrians crossing ahead.
      let slow = false;
      for (const ped of w.peds) {
        if (ped.down > 0) continue;
        const ax = car.x + Math.cos(car.angle) * 46, ay = car.y + Math.sin(car.angle) * 46;
        if (dist(ax, ay, ped.x, ped.y) < 26) { slow = true; break; }
      }
      const done = driveAlongRoute(w, car, dt, slow ? 30 : car.cruise);
      if (done) {
        const dest = w.city.randomRoadPoint(w.rng);
        car.route = w.city.route(car.x, car.y, dest.x, dest.y);
        car.routeIdx = 0;
      }
    }
    // The convoy truck loops its ring route.
    const truck = w.missionData.truck;
    if (truck && !truck.wrecked) {
      const done = driveAlongRoute(w, truck, dt, 170, 50);
      if (done) {
        const dest = w.city.randomRoadPoint(w.rng);
        truck.route = w.city.route(truck.x, truck.y, dest.x, dest.y);
        truck.routeIdx = 0;
      }
    }
  }

  function stepPolice(w, dt) {
    const p = w.player;
    w._routeT -= dt;
    if (w._routeT <= 0) {
      w._routeT = 1.5;
      for (const cop of w.police) {
        if (cop.wrecked || cop.roadblock) continue;
        const near = w.city.nearestRoadPoint(p.x, p.y);
        cop.route = w.city.route(cop.x, cop.y, near.x, near.y);
        cop.routeIdx = 0;
      }
    }
    for (const cop of w.police) {
      if (cop.wrecked || cop.roadblock) continue;
      cop._ramT = Math.max(0, cop._ramT - dt);
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d < 130) {
        // Close pursuit: drive straight at the player.
        const want = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.angle += clamp(angDiff(cop.angle, want) * 2.4, -1, 1) * 2.8 * dt;
        cop.speed = Math.min(cop.speed + T.carAccel * dt, T.policeChaseSpeed);
        const vx = Math.cos(cop.angle) * cop.speed, vy = Math.sin(cop.angle) * cop.speed;
        const res = w.city.moveCircle(cop.x, cop.y, 15, vx * dt, vy * dt);
        cop.x = res.x; cop.y = res.y;
      } else {
        driveAlongRoute(w, cop, dt, T.policeChaseSpeed, 46);
      }
      const fixed = w.city.pushOut(cop.x, cop.y, 15);
      cop.x = fixed.x; cop.y = fixed.y;
      // Ram the player's car.
      if (p.car && !p.car.wrecked && d < T.policeRamRange && cop._ramT <= 0) {
        cop._ramT = T.ramCooldown;
        p.car.health -= T.ramDamage;
        const push = w.city.pushOut(p.car.x + Math.cos(cop.angle) * 10, p.car.y + Math.sin(cop.angle) * 10, 15);
        p.car.x = push.x; p.car.y = push.y;
        p.x = p.car.x; p.y = p.car.y;
        if (p.car.health <= 0) wreckCar(w, p.car);
      }
      // Arrest on foot.
      if (!p.car && d < 42) {
        w.state = 'busted';
        w.stats.busted++;
        w.flash('Busted! The Verde Bay PD hauled you in.');
        return;
      }
    }
    // Boxed in: player car barely moving with a cop right beside it.
    if (p.car && !p.car.wrecked && Math.abs(p.car.speed) < 15) {
      const close = w.police.some((c) => !c.wrecked && dist(c.x, c.y, p.x, p.y) < 70);
      if (close) {
        w._bustT += dt;
        if (w._bustT > 3) {
          w.state = 'busted';
          w.stats.busted++;
          w.flash('Boxed in! The cops dragged you out of the car.');
          return;
        }
      } else w._bustT = 0;
    } else w._bustT = 0;
  }

  function stepPeds(w, dt) {
    const p = w.player;
    for (const ped of w.peds) {
      if (ped.down > 0) { ped.down -= dt; continue; }
      ped._retarget -= dt;
      // Flee from a nearby moving car or a crash.
      const threat = w.cars.find((c) => !c.wrecked && Math.abs(c.speed) > 60 && dist(c.x, c.y, ped.x, ped.y) < 130);
      if (threat) {
        ped.fleeT = 1.6;
        const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
        ped.angle = a;
        const res = w.city.moveCircle(ped.x, ped.y, 10, Math.cos(a) * ped.speed * T.pedFleeMult * dt, Math.sin(a) * ped.speed * T.pedFleeMult * dt);
        ped.x = res.x; ped.y = res.y;
        continue;
      }
      if (ped.fleeT > 0) { ped.fleeT -= dt; continue; }
      if (!ped.target || ped._retarget <= 0) {
        const pt = w.city.randomRoadPoint(w.rng);
        // Walk on the sidewalk: offset from the road centreline.
        ped.target = { x: pt.x + w.rng.range(-44, 44), y: pt.y + w.rng.range(-44, 44) };
        ped._retarget = w.rng.range(4, 9);
      }
      const d = dist(ped.x, ped.y, ped.target.x, ped.target.y);
      if (d < 12) { ped._retarget = 0; continue; }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = a;
      const res = w.city.moveCircle(ped.x, ped.y, 10, Math.cos(a) * ped.speed * dt, Math.sin(a) * ped.speed * dt);
      ped.x = res.x; ped.y = res.y;
      // Run over by a car?
      for (const c of w.cars) {
        if (c.wrecked || Math.abs(c.speed) < 40) continue;
        if (dist(c.x, c.y, ped.x, ped.y) < 24) {
          ped.down = 4;
          if (c === p.car) { w.addHeat(T.heatPed); w.flash('You ran someone over!'); }
          break;
        }
      }
    }
  }

  function stepHeli(w, dt) {
    const p = w.player;
    if (w.stars >= T.heliAtStars) {
      w.heli.active = true;
      const tx = p.x, ty = p.y - 90;
      w.heli.x += (tx - w.heli.x) * Math.min(1, dt * 1.4);
      w.heli.y += (ty - w.heli.y) * Math.min(1, dt * 1.4);
      w.heli.angle += dt * 2.2;
      // The helicopter keeps the heat from falling away.
      w.heat = Math.max(w.heat, 30);
    } else {
      w.heli.active = false;
    }
  }

  function stepCollisions(w, dt) {
    // Car-car: push apart, damage on hard hits (police vs player excluded
    // — the ram mechanic handles that pair).
    const list = w.cars.filter((c) => !c.wrecked);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d >= 30 || d === 0) continue;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        const push = (30 - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.2;
        const isPolicePair = (a.police && b === w.player.car) || (b.police && a === w.player.car);
        if (rel > 150 && !isPolicePair) {
          const dmg = Math.min(12, (rel - 150) * 0.04);
          a.health -= dmg; b.health -= dmg;
          if (a.health <= 0) wreckCar(w, a);
          if (b.health <= 0) wreckCar(w, b);
        }
      }
    }
    // Rescue anything a collision shoved into a wall.
    const p = w.player;
    if (!p.car) { const f = w.city.pushOut(p.x, p.y, 14); p.x = f.x; p.y = f.y; }
    for (const c of w.cars) {
      if (c.wrecked) continue;
      const f = w.city.pushOut(c.x, c.y, 15);
      c.x = f.x; c.y = f.y;
    }
    for (const ped of w.peds) {
      const f = w.city.pushOut(ped.x, ped.y, 10);
      ped.x = f.x; ped.y = f.y;
    }
  }

  return w;
}
