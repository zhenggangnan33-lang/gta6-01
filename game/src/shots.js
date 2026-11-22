// Staged screenshot scenes and the road-following autopilot.
// Shots run the real simulation forward in fixed steps from a seeded world,
// so the same staging always produces the same scene.
import { CFG } from './config.js';
import { isSolid, route } from './city.js';
import { angleDiff, clamp } from './random.js';
import { addCar, spawnPolice, startMission, setHeat, stepWorld } from './world.js';

// Autopilot: drives the player (in a car, or on foot) along the road grid
// toward a target, using the same routing as traffic and police.
export function createAutopilot(w) {
  const auto = { route: null, idx: 0, reverseT: 0, target: null, lastX: 0, lastY: 0, stuckT: 0 };
  return {
    setTarget(x, y) {
      auto.target = { x, y };
      auto.route = route(w.city, { x: w.player.x, y: w.player.y }, { x, y });
      auto.idx = 0;
      auto.reverseT = 0;
      auto.lastX = w.player.x;
      auto.lastY = w.player.y;
      auto.stuckT = 0;
    },
    // True when there is no route or the route is finished. The driver
    // in main.js re-targets when this is true, so a stale finished route
    // can never leave the player standing still.
    isDone() {
      return !auto.route || auto.idx >= auto.route.length;
    },
    // Returns {up, down, left, right} for this frame.
    input(dt) {
      const p = w.player;
      if (!auto.route || auto.idx >= auto.route.length) return { up: false, down: false, left: false, right: false };
      // Stuck detection: in a car, crawling under 15 px/s while trying to
      // drive means wedged against a building; on foot, barely moving
      // means the same. Reverse out and re-route from here (a police ram
      // or a wide turn can wedge the car; the waypoint alone never
      // recovers it).
      const moved = Math.hypot(p.x - auto.lastX, p.y - auto.lastY);
      if (moved > 6) {
        auto.lastX = p.x;
        auto.lastY = p.y;
      }
      const crawling = p.car ? Math.abs(p.car.speed) < 15 : moved < 6;
      if (crawling) auto.stuckT += dt;
      else auto.stuckT = 0;
      if (auto.stuckT > 1.2) {
        auto.stuckT = 0;
        auto.reverseT = 1.2;
        if (auto.target) {
          auto.route = route(w.city, { x: p.x, y: p.y }, auto.target);
          auto.idx = 0;
        }
      }
      const wp = auto.route[auto.idx];
      const d = Math.hypot(wp.x - p.x, wp.y - p.y);
      if (d < 40) {
        auto.idx++;
        return { up: false, down: false, left: false, right: false };
      }
      if (!p.car) {
        // On foot, movement is absolute screen directions (WASD), not
        // "forward + steer": aim straight at the waypoint.
        const nx = (wp.x - p.x) / d;
        const ny = (wp.y - p.y) / d;
        return { up: ny < -0.3, down: ny > 0.3, left: nx < -0.3, right: nx > 0.3 };
      }
      const want = Math.atan2(wp.y - p.y, wp.x - p.x);
      const diff = angleDiff(p.angle, want);
      const speed = Math.abs(p.speed || 0);
      if (auto.reverseT > 0) {
        auto.reverseT -= dt;
        return { up: false, down: true, left: diff > 0, right: diff < 0 };
      }
      // Wall ahead and nearly stopped: reverse out.
      if (p.car) {
        const px = p.x + Math.cos(p.angle) * 52;
        const py = p.y + Math.sin(p.angle) * 52;
        if (isSolid(w.city, px, py, 12) && speed < 12) {
          auto.reverseT = 0.8;
          return { up: false, down: true, left: false, right: false };
        }
      }
      // Brake for turns instead of cutting the corner at full speed:
      // a 300 px/s turn through an intersection clips the building.
      // Also slow for the final approach: objectives sit inside blocks,
      // not on roads, and arriving at 300 means grinding the wall.
      // And brake for a car directly ahead instead of ramming through
      // traffic at 300 (each hit is 12 damage; a busy road wrecks the car).
      // (Braking overrides the throttle: drivePlayerCar reads up first.)
      const aheadX = p.x + Math.cos(p.angle) * 70;
      const aheadY = p.y + Math.sin(p.angle) * 70;
      const carAhead = [...w.cars, ...w.police].some((c) => c !== p.car && !c.wrecked &&
        Math.hypot(c.x - aheadX, c.y - aheadY) < 34);
      const brake = (Math.abs(diff) > 0.7 && speed > 100) || (Math.abs(diff) > 1.3 && speed > 60) ||
        (auto.idx === auto.route.length - 1 && d < 150 && speed > 120) ||
        (carAhead && speed > 100);
      return {
        up: (Math.abs(diff) < 0.95 || speed < 40) && !brake,
        down: brake,
        left: diff < -0.07,
        right: diff > 0.07,
      };
    },
  };
}

function putPlayerInCar(w, x, y, angle, color) {
  const car = addCar(w, { kind: 'traffic', x, y, angle, parked: false, color, top: 320 });
  car.driver = false;
  w.player.car = car;
  w.player.x = x;
  w.player.y = y;
  w.player.angle = angle;
  return car;
}

function fastForward(w, auto, seconds) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const a = auto.input(dt);
    stepWorld(w, {
      up: a.up, down: a.down, left: a.left, right: a.right,
      sprint: false, handbrake: false, action: false, punch: false,
      radio: false, shop: false, pause: false, confirm: false,
    }, dt);
    if (w.state !== 'play') break;
  }
}

// Stage one named scene. The world must already be in 'play' (except
// 'city', which keeps the title screen). Deterministic for a seeded world.
export function stageShot(w, name) {
  const auto = createAutopilot(w);
  if (name === 'cover') {
    // 4-star chase at Banco Verde, mission 1 already done.
    startMission(w, 1);
    w.player.money = 650;
    w.player.respect = 10;
    w.time = 0.32;
    putPlayerInCar(w, 1280, 800, 0, '#e8b13c');
    setHeat(w, 75);
    spawnPolice(w, 3);
    w.police[0].x = 1080; w.police[0].y = 800;
    w.police[1].x = 1120; w.police[1].y = 880;
    w.police[2].x = 1000; w.police[2].y = 760;
    auto.setTarget(2080, 800);
    fastForward(w, auto, 5);
  } else if (name === 'chase') {
    // Police ramming the player's taxi on the beach road.
    startMission(w, 1);
    w.time = 0.3;
    putPlayerInCar(w, 2080, 420, Math.PI / 2, '#d8b400');
    setHeat(w, 55);
    spawnPolice(w, 2);
    w.police[0].x = 2080; w.police[0].y = 320;
    w.police[1].x = 2044; w.police[1].y = 350;
    auto.setTarget(2080, 1250);
    fastForward(w, auto, 4);
  } else if (name === 'mission') {
    // Courier run, package picked up, driving to the safehouse.
    startMission(w, 1);
    w.missionState.phase = 1;
    w.time = 0.28;
    putPlayerInCar(w, 1280, 800, Math.PI, '#2e6fb0');
    auto.setTarget(CFG.SAFEHOUSE.doorX, CFG.SAFEHOUSE.doorY);
    fastForward(w, auto, 4);
  } else if (name === 'city') {
    // Title over the city at dusk. The title screen is drawn by main.js.
    w.time = 0.5;
    w.player.x = 1120;
    w.player.y = 800;
    w.state = 'title';
  }
  w.shotStaged = name;
}
