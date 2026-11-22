// VERDE BAY simulation: player, cars, police, pedestrians, wanted level,
// missions, chop shop, garage shop. All movement is circle-vs-rect against
// the city solids, and every driver (traffic, police, autopilot) uses the
// same road-following steering helper, so nobody drives through buildings.
import { CFG, starsForHeat } from './config.js';
import { buildCity, isSolid, moveCircle, pushOutOfSolids, route, randomRoadPoint, nearestRoadPoint } from './city.js';
import { mulberry32, range, pick, clamp, angleDiff, dist2 } from './random.js';
import { MISSIONS } from './missions.js';

const CAR_COLORS = ['#b03a2e', '#2e6fb0', '#c9c9c9', '#3a3f45', '#7a5a2e', '#4a7a4a', '#8a8a8a', '#b07a2e'];
const PED_COLORS = ['#e0a060', '#c07070', '#70a0c0', '#a0a070', '#d0d0d0', '#9080b0'];

export function createWorld(seed, opts = {}) {
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const w = {
    seed,
    rng,
    city,
    state: opts.state || 'title',
    time: opts.time != null ? opts.time : 0.12, // morning
    timeScale: 1,
    player: {
      x: CFG.SPAWN.x, y: CFG.SPAWN.y, angle: -Math.PI / 2, health: CFG.PLAYER_HEALTH,
      car: null, money: 0, respect: 0, punched: false, speed: 0,
    },
    cars: [],
    police: [],
    peds: [],
    heli: { active: false, x: 0, y: 0, angle: 0 },
    roadblocks: [],
    particles: [],
    heat: 0,
    stars: 0,
    missionIdx: 0,
    missionState: {},
    upgrades: { armor: false, turbo: false, tires: false },
    station: 0,
    shopOpen: false,
    banner: null,
    bannerT: 0,
    boxedT: 0,
    arrestT: 0,
    stats: { carsStolen: 0, missionsDone: 0, playTime: 0 },
    _action: false, // E pressed this step (edge)
    _punch: false, // F pressed this step (edge)
    _save: null,
  };
  // Helpers the missions call as methods on the world.
  w.flash = (text) => flash(w, text);
  w.addHeat = (v) => addHeat(w, v);
  w.setHeat = (v) => setHeat(w, v);
  w.spawnPolice = (n) => spawnPolice(w, n);
  w.addCar = (spec) => addCar(w, spec);
  w.consumeAction = () => consumeAction(w);
  w.cityRoute = (from, to) => route(w.city, from, to);
  // Traffic.
  for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
    const p = randomRoadPoint(rng);
    const c = addCar(w, {
      kind: 'traffic', x: p.x, y: p.y, angle: range(rng, 0, Math.PI * 2),
      parked: false, color: pick(rng, CAR_COLORS), top: range(rng, 220, 280),
    });
    retargetTraffic(w, c);
  }
  // Parked cars in lots and along roads.
  for (let i = 0; i < CFG.PARKED_COUNT; i++) {
    const lot = pick(rng, city.lots);
    const x = range(rng, lot.x + 30, lot.x + lot.w - 30);
    const y = range(rng, lot.y + 30, lot.y + lot.h - 30);
    if (isSolid(city, x, y, CFG.CAR_R + 4)) continue;
    addCar(w, {
      kind: 'parked', x, y, angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      parked: true, color: pick(rng, CAR_COLORS), top: 300,
    });
  }
  // Two cars always wait in the garage forecourt, right by the spawn:
  // mission 1 (steal a car, bring it to the garage) is completable at once.
  addCar(w, { kind: 'parked', x: 620, y: 700, angle: 0, parked: true, color: '#b03a2e', top: 300 });
  addCar(w, { kind: 'parked', x: 700, y: 640, angle: Math.PI / 2, parked: true, color: '#2e6fb0', top: 300 });
  // Pedestrians.
  for (let i = 0; i < CFG.PED_COUNT; i++) {
    const p = randomRoadPoint(rng);
    const ped = {
      x: p.x + range(rng, -30, 30), y: p.y + range(rng, -30, 30),
      angle: range(rng, 0, Math.PI * 2), speed: CFG.PED_SPEED,
      down: 0, color: pick(rng, PED_COLORS), tx: p.x, ty: p.y, flee: 0,
    };
    w.peds.push(ped);
  }
  if (opts.save) applySave(w, opts.save);
  startMission(w, 0);
  return w;
}

export function startMission(w, idx) {
  w.missionIdx = idx;
  w.missionState = {};
  MISSIONS[idx].setup(w);
  const m = MISSIONS[idx];
  flash(w, `Mission ${idx + 1}/8: ${m.name} — ${m.brief}`);
}

export function flash(w, text) {
  w.banner = text;
  w.bannerT = 4;
}

export function addHeat(w, v) {
  w.heat = clamp(w.heat + v, 0, 100);
}

export function setHeat(w, v) {
  w.heat = clamp(v, 0, 100);
}

export function consumeAction(w) {
  if (w._action) {
    w._action = false;
    return true;
  }
  return false;
}

export function addCar(w, spec) {
  const c = {
    kind: spec.kind || 'traffic',
    x: spec.x, y: spec.y, angle: spec.angle || 0,
    speed: 0, health: spec.health || CFG.CAR_HEALTH,
    wrecked: false, parked: !!spec.parked, color: spec.color || '#888888',
    top: spec.top || 300, route: null, routeIdx: 0, stuckT: 0, reverseT: 0,
    ramCd: 0, driver: spec.kind === 'traffic', convoy: !!spec.convoy,
    smokeT: 0,
  };
  w.cars.push(c);
  return c;
}

export function spawnPolice(w, n) {
  for (let i = 0; i < n; i++) {
    if (w.police.length >= 6) return;
    // Spawn on a road at least 420 px away from the player.
    let p = randomRoadPoint(w.rng);
    let tries = 0;
    while (dist2(p.x, p.y, w.player.x, w.player.y) < 420 * 420 && tries++ < 12) {
      p = randomRoadPoint(w.rng);
    }
    const c = {
      kind: 'police', x: p.x, y: p.y, angle: 0, speed: 0,
      health: 400, wrecked: false, parked: false, color: '#20242a',
      top: CFG.POLICE_TOP, route: null, routeIdx: 0, stuckT: 0, reverseT: 0,
      ramCd: 0, retargetT: 0, bounceT: 0,
    };
    w.police.push(c);
  }
}

function retargetTraffic(w, c) {
  const dest = randomRoadPoint(w.rng);
  const r = route(w.city, { x: c.x, y: c.y }, dest);
  // Right-hand traffic: shift each waypoint (after the car's own position)
  // 14 px to the right of the direction of travel, so oncoming cars pass
  // in opposite lanes instead of meeting head-on down the centre line.
  for (let i = 1; i < r.length; i++) {
    const px = r[i - 1].x;
    const py = r[i - 1].y;
    const dx = Math.sign(r[i].x - px);
    const dy = Math.sign(r[i].y - py);
    if (dx !== 0) r[i] = { x: r[i].x, y: r[i].y + dx * 14 };
    else if (dy !== 0) r[i] = { x: r[i].x - dy * 14, y: r[i].y };
  }
  c.route = r;
  c.routeIdx = 0;
}

// Shared road-following driver. Steers `car` toward (tx, ty): turns toward
// the target, brakes for a wall ahead, reverses out when stuck. Returns
// nothing; the car moves itself.
export function steerCar(w, car, tx, ty, dt, top) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  const turnRate = CFG.CAR_TURN * (car.top > 340 ? 1.15 : 1);
  const maxTurn = turnRate * dt * clamp(Math.abs(car.speed) / 90 + 0.35, 0.35, 1.25);
  car.angle += clamp(diff, -maxTurn, maxTurn);
  // Wall ahead? Probe 46 px forward.
  const px = car.x + Math.cos(car.angle) * 46;
  const py = car.y + Math.sin(car.angle) * 46;
  const wallAhead = isSolid(w.city, px, py, 12);
  if (car.reverseT > 0) {
    car.reverseT -= dt;
    car.speed = Math.max(car.speed - CFG.CAR_ACCEL * dt, -CFG.CAR_REVERSE_TOP * 0.7);
  } else if (wallAhead && car.speed > 25) {
    car.speed = Math.max(car.speed - CFG.CAR_ACCEL * 1.6 * dt, 0);
  } else if (Math.abs(diff) > 1.1) {
    car.speed = Math.max(car.speed - CFG.CAR_ACCEL * dt, 0);
  } else {
    car.speed = Math.min(car.speed + CFG.CAR_ACCEL * dt, top);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!moveCircle(w.city, car, nx - car.x, ny - car.y, CFG.CAR_R)) {
    car.speed *= 0.4;
    car.stuckT += dt;
    if (car.stuckT > 1.1) {
      car.reverseT = 0.8;
      car.stuckT = 0;
    }
  } else {
    car.stuckT = Math.max(0, car.stuckT - dt * 2);
  }
}

function followRoute(w, car, dt, top) {
  if (!car.route || car.routeIdx >= car.route.length) return true;
  const wp = car.route[car.routeIdx];
  const d2 = dist2(car.x, car.y, wp.x, wp.y);
  if (d2 < 26 * 26) {
    car.routeIdx++;
    return car.routeIdx >= car.route.length;
  }
  steerCar(w, car, wp.x, wp.y, dt, top);
  return false;
}

function stepPlayer(w, input, dt) {
  const p = w.player;
  p.punched = false;
  if (w._punch) {
    p.punched = true;
    w._punch = false;
  }
  if (p.car) {
    drivePlayerCar(w, input, dt);
    return;
  }
  // On foot.
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const sp = input.sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
    p.angle = Math.atan2(my, mx);
    p.speed = sp;
    moveCircle(w.city, p, mx * sp * dt, my * sp * dt, CFG.PLAYER_R);
  } else {
    p.speed = 0;
  }
  // Punch: knock down a pedestrian in front.
  if (p.punched) {
    for (const ped of w.peds) {
      if (ped.down > 0) continue;
      const d2 = dist2(p.x, p.y, ped.x, ped.y);
      if (d2 < CFG.PUNCH_RANGE * CFG.PUNCH_RANGE) {
        ped.down = 3;
        addHeat(w, CFG.HEAT_PUNCH);
        burst(w, ped.x, ped.y, '#e0e0e0', 6);
      }
    }
  }
  // Enter a car. The autopilot can name a specific car to enter
  // (w._enterCar) — used for Turbo Heist, where the sports car must be
  // the one entered, not whichever car happens to be nearest.
  if (w._action) {
    w._action = false;
    const hint = w._enterCar;
    w._enterCar = null;
    const car = hint && !hint.wrecked && dist2(p.x, p.y, hint.x, hint.y) < 56 * 56
      ? hint
      : nearestCar(w, p.x, p.y, 56);
    if (car && !car.wrecked) enterCar(w, car);
  }
}

function nearestCar(w, x, y, maxD) {
  let best = null;
  let bestD = maxD * maxD;
  for (const c of [...w.cars, ...w.police]) {
    if (c.wrecked) continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function enterCar(w, car) {
  const p = w.player;
  if (car.driver) {
    // Carjacking: the driver bails and the law notices.
    car.driver = false;
    addHeat(w, CFG.HEAT_STEAL);
    w.stats.carsStolen++;
    flash(w, 'Carjacked! The cops will hear about this.');
  } else if (car.kind === 'parked' || car.kind === 'sport') {
    addHeat(w, 10);
    w.stats.carsStolen++;
  }
  car.parked = false;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (w.upgrades.armor && !car._armored) {
    car.health += 100;
    car._armored = true;
  }
}

function drivePlayerCar(w, input, dt) {
  const p = w.player;
  const car = p.car;
  if (!car || car.wrecked) {
    p.car = null;
    return;
  }
  const top = car.top * (w.upgrades.turbo ? 1.25 : 1);
  const turn = CFG.CAR_TURN * (w.upgrades.tires ? 1.25 : 1);
  if (input.up) car.speed = Math.min(car.speed + CFG.CAR_ACCEL * dt, top);
  else if (input.down) car.speed = Math.max(car.speed - CFG.CAR_ACCEL * dt, -CFG.CAR_REVERSE_TOP);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
  const dir = car.speed >= 0 ? 1 : -1;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  car.angle += steer * turn * dt * clamp(Math.abs(car.speed) / 110 + 0.3, 0.3, 1.2) * dir;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!moveCircle(w.city, car, nx - car.x, ny - car.y, CFG.CAR_R)) {
    // Wall crash: damage once per impact, not once per frame — a car
    // grinding along a wall at 60 fps would otherwise lose 12 health
    // every frame (720/s) and wreck in a quarter of a second.
    if (Math.abs(car.speed) > 150 && w.stats.playTime - (car._wallT || -10) > 0.4) {
      car._wallT = w.stats.playTime;
      car.health -= Math.abs(car.speed) * 0.04;
      p.health -= Math.abs(car.speed) * 0.02;
      burst(w, car.x, car.y, '#ffcc44', 8);
    }
    car.speed *= 0.35;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  if (car.health <= 0) {
    car.wrecked = true;
    car.speed = 0;
    p.car = null;
    p.health -= 20;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    flash(w, 'Your car is wrecked!');
    burst(w, car.x, car.y, '#888888', 16);
  }
  // Exit the car.
  if (w._action) {
    w._action = false;
    p.car = null;
    car.parked = true; // stays put instead of driving off as traffic
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    if (isSolid(w.city, p.x, p.y, CFG.PLAYER_R)) {
      p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 30;
    }
  }
}

export function burst(w, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = w.rng() * Math.PI * 2;
    const s = 40 + w.rng() * 120;
    w.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + w.rng() * 0.4, color, size: 2 + w.rng() * 3 });
  }
}

function stepTraffic(w, dt) {
  for (const c of w.cars) {
    if (c.wrecked || c.parked) continue;
    if (c === w.player.car) continue; // the player drives this one
    if (c.convoy) {
      // The armored van loops its route; when wrecked it stops for good.
      if (followRoute(w, c, dt, c.top)) {
        c.route = route(w.city, { x: c.x, y: c.y }, { x: 160, y: 160 });
        c.routeIdx = 0;
      }
      continue;
    }
    // Follow the car ahead, and stop for a pedestrian in the way: slow
    // down instead of rear-ending it or running someone over.
    let top = c.top;
    for (const o of w.cars) {
      if (o === c || o.wrecked) continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 58) {
        const ahead = (dx * Math.cos(c.angle) + dy * Math.sin(c.angle)) / Math.max(d, 1);
        if (ahead > 0.75) top = Math.min(top, Math.max(0, o.speed - 10));
      }
    }
    for (const ped of w.peds) {
      if (ped.down > 0) continue;
      const dx = ped.x - c.x;
      const dy = ped.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 60) {
        const ahead = (dx * Math.cos(c.angle) + dy * Math.sin(c.angle)) / Math.max(d, 1);
        if (ahead > 0.7) top = Math.min(top, d < 30 ? 0 : 50);
      }
    }
    if (followRoute(w, c, dt, top)) retargetTraffic(w, c);
  }
}

function stepPeds(w, dt) {
  const p = w.player;
  for (const ped of w.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    // Flee from a fast car or the police.
    let fx = 0;
    let fy = 0;
    const threats = [];
    if (p.car) threats.push({ x: p.car.x, y: p.car.y, r: 130 });
    for (const c of w.police) threats.push({ x: c.x, y: c.y, r: 130 });
    for (const t of threats) {
      const d = Math.hypot(ped.x - t.x, ped.y - t.y);
      if (d < t.r) {
        fx += (ped.x - t.x) / Math.max(d, 1);
        fy += (ped.y - t.y) / Math.max(d, 1);
      }
    }
    if (fx || fy) {
      // Flee OFF the road, not along it: a pedestrian running straight away
      // from an approaching car stays in its path and gets caught. Step
      // sideways off the road line instead.
      ped.flee = 1.2;
      let ex = 0;
      let ey = 0;
      let bestRoad = null;
      let bestD = 44;
      for (const rx of CFG.ROAD_X) {
        const d = Math.abs(ped.x - rx);
        if (d < bestD) { bestD = d; bestRoad = { axis: 'x', line: rx }; }
      }
      bestD = 44;
      for (const ry of CFG.ROAD_Y) {
        const d = Math.abs(ped.y - ry);
        if (d < bestD) { bestD = d; bestRoad = { axis: 'y', line: ry }; }
      }
      if (bestRoad) {
        if (bestRoad.axis === 'x') ex = ped.x >= bestRoad.line ? 1 : -1;
        else ey = ped.y >= bestRoad.line ? 1 : -1;
      } else {
        const len = Math.hypot(fx, fy) || 1;
        ex = fx / len;
        ey = fy / len;
      }
      ped.angle = Math.atan2(ey, ex);
      moveCircle(w.city, ped, ex * CFG.PED_SPEED * 2.2 * dt, ey * CFG.PED_SPEED * 2.2 * dt, 8);
      continue;
    }
    if (ped.flee > 0) ped.flee -= dt;
    const d2 = dist2(ped.x, ped.y, ped.tx, ped.ty);
    if (d2 < 20 * 20) {
      // Walk the sidewalks, not the middle of the road: offset the next
      // destination 44 px off the road centre line.
      const dest = randomRoadPoint(w.rng);
      const side = w.rng() < 0.5 ? -44 : 44;
      if (CFG.ROAD_X.includes(dest.x)) {
        ped.tx = dest.x + side; // vertical road: step onto the sidewalk
        ped.ty = dest.y;
      } else {
        ped.tx = dest.x;
        ped.ty = dest.y + side; // horizontal road: step onto the sidewalk
      }
    }
    ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    moveCircle(w.city, ped, Math.cos(ped.angle) * CFG.PED_SPEED * dt, Math.sin(ped.angle) * CFG.PED_SPEED * dt, 8);
  }
}

function stepPolice(w, dt) {
  const p = w.player;
  // Keep the cruiser count matched to the wanted level.
  const want = Math.min(w.stars, 5);
  while (w.police.length < want) spawnPolice(w, 1);
  if (w.stars === 0) {
    // Cops give up and drive off: fade them out once far away.
    w.police = w.police.filter((c) => dist2(c.x, c.y, p.x, p.y) < 900 * 900);
  }
  for (const c of w.police) {
    if (c.wrecked || c.blocker) continue;
    if (c === w.player.car) continue; // stolen cruiser: the player drives it
    c.ramCd = Math.max(0, c.ramCd - dt);
    c.retargetT -= dt;
    if (c.retargetT <= 0 || !c.route || c.routeIdx >= c.route.length) {
      c.route = route(w.city, { x: c.x, y: c.y }, { x: p.x, y: p.y });
      c.routeIdx = 0;
      c.retargetT = 2;
    }
    const dPlayer = Math.hypot(p.x - c.x, p.y - c.y);
    if (c.bounceT > 0) {
      c.bounceT -= dt;
      c.speed = Math.max(c.speed - CFG.CAR_ACCEL * dt, -90);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      moveCircle(w.city, c, nx - c.x, ny - c.y, CFG.CAR_R);
      continue;
    }
    if (dPlayer < 240) {
      // Close in: drive straight at the player, then ram and bounce off.
      steerCar(w, c, p.x, p.y, dt, c.top);
      if (dPlayer < 56 && c.ramCd <= 0 && p.car) {
        p.car.health -= CFG.RAM_DMG;
        c.ramCd = CFG.RAM_COOLDOWN;
        c.bounceT = 0.7;
        burst(w, c.x, c.y, '#ffcc44', 6);
      }
    } else {
      followRoute(w, c, dt, c.top);
    }
  }
  // Helicopter at 3+ stars: circles above the player, keeps the heat up.
  if (w.stars >= 3) {
    w.heli.active = true;
    const t = w.stats.playTime;
    const hx = p.x + Math.cos(t * 0.5) * 120;
    const hy = p.y + Math.sin(t * 0.5) * 120 - 60;
    w.heli.x += (hx - w.heli.x) * Math.min(1, dt * 2);
    w.heli.y += (hy - w.heli.y) * Math.min(1, dt * 2);
  } else {
    w.heli.active = false;
  }
  // Roadblocks at 4+ stars: two parked cruisers across a road ahead.
  if (w.stars >= 4 && w.roadblocks.length < 2) {
    const ahead = { x: p.x + Math.cos(p.angle) * 520, y: p.y + Math.sin(p.angle) * 520 };
    const rp = nearestRoadPoint(ahead.x, ahead.y);
    w.roadblocks.push({ x: rp.x, y: rp.y, angle: p.angle });
    const b1 = {
      kind: 'police', x: rp.x - 26, y: rp.y, angle: p.angle + Math.PI / 2, speed: 0,
      health: 400, wrecked: false, parked: true, color: '#20242a', top: 0,
      route: null, routeIdx: 0, stuckT: 0, reverseT: 0, ramCd: 0, retargetT: 0, bounceT: 0, blocker: true,
    };
    const b2 = { ...b1, x: rp.x + 26, y: rp.y };
    w.police.push(b1, b2);
  }
  if (w.stars < 4 && w.roadblocks.length) {
    w.police = w.police.filter((c) => !c.blocker);
    w.roadblocks = [];
  }
}

function stepCollisions(w, dt) {
  const p = w.player;
  const all = [...w.cars, ...w.police];
  // Car vs car: push apart, damage on hard hits, mark wrecks.
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (a.wrecked) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        // Hard hits only, capped: a sideswipe or a rear-end should not
        // total a car. Police rams are handled by the ram mechanic, not here.
        const isPoliceRam = (a.kind === 'police' && b === p.car) || (b.kind === 'police' && a === p.car);
        if (rel > 150 && !isPoliceRam) {
          const dmg = Math.min(12, (rel - 150) * 0.06);
          a.health -= dmg;
          b.health -= dmg;
          burst(w, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffcc44', 5);
        }
        if (a.health <= 0) a.wrecked = true;
        if (b.health <= 0) b.wrecked = true;
      }
    }
  }
  // Cars vs pedestrians: a fast car knocks a ped down.
  for (const ped of w.peds) {
    if (ped.down > 0) continue;
    for (const c of all) {
      if (c.wrecked || Math.abs(c.speed) < 40) continue;
      if (dist2(ped.x, ped.y, c.x, c.y) < 26 * 26) {
        ped.down = 3;
        // Only the player's own driving raises the wanted level.
        if (c === p.car) addHeat(w, CFG.HEAT_HIT_PED);
        burst(w, ped.x, ped.y, '#e0e0e0', 6);
        break;
      }
    }
  }
  // Player car wrecked by a ram or a crash (handled in drivePlayerCar too).
  if (p.car && p.car.health <= 0 && !p.car.wrecked) {
    p.car.wrecked = true;
    p.car.speed = 0;
    p.car = null;
    p.health -= 20;
    flash(w, 'Your car is wrecked!');
  }
  // Wrecked cars smoke.
  for (const c of all) {
    if (c.wrecked) continue;
    if (c.health < 90) {
      c.smokeT -= dt;
      if (c.smokeT <= 0) {
        c.smokeT = 0.25;
        w.particles.push({ x: c.x, y: c.y - 8, vx: (w.rng() - 0.5) * 20, vy: -30, life: 0.9, color: '#666666', size: 5 });
      }
    }
  }
}

function stepChopShop(w) {
  const p = w.player;
  const g = CFG.GARAGE;
  if (!p.car) {
    w._carWasOutside = false;
    return;
  }
  const c = p.car;
  const inside = c.x > g.x && c.x < g.x + g.w && c.y > g.y && c.y < g.y + g.h;
  if (!inside) {
    w._carWasOutside = true;
    return;
  }
  // Only pay for a car driven in from outside: a car the player just got
  // into while it was already parked in the forecourt is not a sale, or
  // entering and leaving the same car would print money forever.
  if (!w._carWasOutside) return;
  w._carWasOutside = false;
  p.car = null;
  c.parked = true;
  c.speed = 0;
  p.money += CFG.CHOP_PAY;
  p.x = c.x + 40;
  p.y = c.y + 40;
  flash(w, `Chop shop paid $${CFG.CHOP_PAY} for the car.`);
}

export function stepWorld(w, input, dt) {
  if (w.state !== 'play') {
    if (w.bannerT > 0) w.bannerT -= dt;
    return;
  }
  w.stats.playTime += dt;
  w.time = (w.time + dt / CFG.DAY_LENGTH) % 1;
  if (input.action) w._action = true;
  if (input.punch) w._punch = true;
  if (input.radio) {
    w.station = (w.station + 1) % 3;
    flash(w, ['Radio off', 'VERDE FM', 'BAY 98'][w.station]);
  }

  // Mission first: a delivery to the garage must count for the job, not
  // be sold to the chop shop a line below.
  const mission = MISSIONS[w.missionIdx];
  if (mission.update(w, dt)) {
    w.player.money += mission.reward;
    w.player.respect += mission.respect;
    w.stats.missionsDone++;
    flash(w, `Mission complete: ${mission.name} — +$${mission.reward}, +${mission.respect} respect.`);
    saveGame(w);
    if (w.missionIdx + 1 >= MISSIONS.length) {
      w.state = 'win';
      saveGame(w);
      return;
    }
    startMission(w, w.missionIdx + 1);
  }

  stepPlayer(w, input, dt);
  w._action = false; // an unconsumed E press dies here, never fires next frame
  stepChopShop(w);
  stepTraffic(w, dt);
  stepPeds(w, dt);
  stepPolice(w, dt);
  stepCollisions(w, dt);

  // Collision pushes ignore walls, so a ram can shove a car or a person
  // inside a building. Eject everyone from solids now, or the wedged
  // one can never move again.
  if (w.player.car) pushOutOfSolids(w.city, w.player.car, 16);
  else pushOutOfSolids(w.city, w.player, 11);
  for (const c of w.cars) pushOutOfSolids(w.city, c, 16);
  for (const pd of w.peds) pushOutOfSolids(w.city, pd, 11);

  // Wanted level.
  w.stars = starsForHeat(w.heat);
  const policeNear = w.police.some((c) => !c.wrecked && dist2(c.x, c.y, w.player.x, w.player.y) < 320 * 320);
  if (!policeNear && !w.heli.active) {
    w.heat = Math.max(0, w.heat - CFG.HEAT_DECAY * dt);
  }

  // Busted: boxed in by cruisers, or arrested on foot.
  const p = w.player;
  if (p.car && Math.abs(p.car.speed) < 8) {
    const near = w.police.filter((c) => !c.wrecked && dist2(c.x, c.y, p.x, p.y) < 70 * 70).length;
    w.boxedT = near >= 2 ? w.boxedT + dt : 0;
    if (w.boxedT > 3) {
      w.state = 'busted';
      p.money = Math.max(0, p.money - 150);
      flash(w, 'Busted! The cops boxed you in. -$150.');
      saveGame(w);
      return;
    }
  } else {
    w.boxedT = 0;
  }
  if (!p.car) {
    const near = w.police.some((c) => !c.wrecked && dist2(c.x, c.y, p.x, p.y) < 45 * 45);
    w.arrestT = near ? w.arrestT + dt : Math.max(0, w.arrestT - dt);
    if (w.arrestT > 2) {
      w.state = 'busted';
      p.money = Math.max(0, p.money - 150);
      flash(w, 'Busted! Arrested on foot. -$150.');
      saveGame(w);
      return;
    }
  }
  if (p.health <= 0) {
    w.state = 'wasted';
    p.money = Math.max(0, p.money - 150);
    saveGame(w);
    return;
  }

  // Particles and banner.
  for (let i = w.particles.length - 1; i >= 0; i--) {
    const pt = w.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) w.particles.splice(i, 1);
  }
  if (w.bannerT > 0) w.bannerT -= dt;
}

export function respawn(w) {
  const p = w.player;
  p.health = CFG.PLAYER_HEALTH;
  p.car = null;
  p.x = CFG.SPAWN.x;
  p.y = CFG.SPAWN.y;
  p.angle = -Math.PI / 2;
  w.heat = 0;
  w.stars = 0;
  w.police = [];
  w.roadblocks = [];
  w.heli.active = false;
  w.state = 'play';
}

export function saveGame(w) {
  try {
    const data = {
      money: w.player.money,
      respect: w.player.respect,
      missionIdx: w.missionIdx,
      upgrades: w.upgrades,
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('verdebay-save', JSON.stringify(data));
    }
    w._save = data;
  } catch (e) {
    // Storage may be unavailable (headless); the run still works.
  }
}

export function loadSave() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('verdebay-save');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function applySave(w, save) {
  w.player.money = save.money || 0;
  w.player.respect = save.respect || 0;
  w.upgrades = { armor: false, turbo: false, tires: false, ...(save.upgrades || {}) };
  if (typeof save.missionIdx === 'number' && save.missionIdx > 0 && save.missionIdx < MISSIONS.length) {
    w.missionIdx = save.missionIdx;
  }
}

export function currentObjective(w) {
  return MISSIONS[w.missionIdx].objective(w);
}

export function missionName(w) {
  return MISSIONS[w.missionIdx].name;
}
