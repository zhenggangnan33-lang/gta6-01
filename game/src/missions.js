// The eight story missions of VERDE BAY v2. Dante Vega, wheelman for
// Carmen "La Rosa" Ibarra, works his way from stealing a first car to
// becoming King of Verde Bay. Each mission is a small state machine:
// setup(w) runs once when the mission starts, update(w, dt) returns true
// when it is done, interact(w) handles the E key, and objective(w) gives
// the HUD arrow its target. The world object carries the scratch state
// (w.missionPhase, w.missionData). v2 keeps v1's eight missions and
// shortens the finale's survive timer from 60 s to 45 s, so the win is
// reachable inside one autopilot run.

import { CFG, MISSION_REWARDS } from './config.js';

const P = CFG.places;
const SURVIVE = CFG.tuning.surviveSeconds;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export const MISSIONS = [
  {
    id: 'first-ride', name: 'First Ride',
    brief: 'Steal any car and bring it to Vega Motors.',
    setup(w) { w.missionPhase = 0; w.flash('Steal a car — any car — and bring it to Vega Motors.'); },
    update(w) {
      const p = w.player;
      if (p.car && dist(p.x, p.y, P.garage.at[0], P.garage.at[1]) < P.garage.r) return true;
      return false;
    },
    interact() { return false; },
    objective() { return { x: P.garage.at[0], y: P.garage.at[1], label: 'Vega Motors' }; },
  },
  {
    id: 'night-courier', name: 'Night Courier',
    brief: 'Pick up the package at Café Luna, deliver it to Hotel Miramar.',
    setup(w) { w.missionPhase = 0; w.flash('Pick up the package at Café Luna.'); },
    update(w) {
      const p = w.player;
      if (w.missionPhase === 1 && dist(p.x, p.y, P.hotel.at[0], P.hotel.at[1]) < P.hotel.r) return true;
      return false;
    },
    interact(w) {
      const p = w.player;
      if (w.missionPhase === 0 && dist(p.x, p.y, P.cafe.at[0], P.cafe.at[1]) < P.cafe.r) {
        w.missionPhase = 1;
        w.flash('Package collected. Deliver it to Hotel Miramar — no questions.');
        return true;
      }
      return false;
    },
    objective(w) {
      return w.missionPhase === 0
        ? { x: P.cafe.at[0], y: P.cafe.at[1], label: 'Café Luna' }
        : { x: P.hotel.at[0], y: P.hotel.at[1], label: 'Hotel Miramar' };
    },
  },
  {
    id: 'hot-pursuit', name: 'Hot Pursuit',
    brief: 'The cops are onto you. Reach La Rosa House — do not get caught.',
    setup(w) {
      w.missionPhase = 0;
      w.setHeat(35);
      w.spawnPolice(2);
      w.flash('Two stars! Lose them at La Rosa House.');
    },
    update(w) {
      const p = w.player;
      if (dist(p.x, p.y, P.safehouse.at[0], P.safehouse.at[1]) < P.safehouse.r) return true;
      return false;
    },
    interact() { return false; },
    objective() { return { x: P.safehouse.at[0], y: P.safehouse.at[1], label: 'La Rosa House' }; },
  },
  {
    id: 'vault-job', name: 'The Vault Job',
    brief: 'Grab the three cash bags — bank, plaza, docks — then return to the garage.',
    setup(w) {
      w.missionPhase = 0;
      w.missionData.bags = [
        { x: P.bank.at[0], y: P.bank.at[1], label: 'Meridian Bank', taken: false },
        { x: P.plaza.at[0], y: P.plaza.at[1], label: 'Palma Plaza', taken: false },
        { x: P.docks.at[0], y: P.docks.at[1], label: 'The Docks', taken: false },
      ];
      w.flash('Three bags. Bank, plaza, docks. Then back to the garage.');
    },
    update(w) {
      const p = w.player;
      for (const bag of w.missionData.bags) {
        if (!bag.taken && dist(p.x, p.y, bag.x, bag.y) < 60) {
          bag.taken = true;
          w.flash('Bag grabbed — ' + w.missionData.bags.filter((b) => b.taken).length + ' of 3.');
          w.addHeat(8);
        }
      }
      const got = w.missionData.bags.filter((b) => b.taken).length;
      if (got === 3 && dist(p.x, p.y, P.garage.at[0], P.garage.at[1]) < P.garage.r) return true;
      return false;
    },
    interact() { return false; },
    objective(w) {
      const next = w.missionData.bags.find((b) => !b.taken);
      if (next) return { x: next.x, y: next.y, label: next.label };
      return { x: P.garage.at[0], y: P.garage.at[1], label: 'Vega Motors' };
    },
  },
  {
    id: 'hot-wheels', name: 'Hot Wheels',
    brief: 'Steal the Cometa GT from the dealership and bring it to Vega Motors.',
    setup(w) {
      w.missionPhase = 0;
      // The sports car waits in the dealership lot (reuse it if a respawn
      // re-ran this setup — never spawn a second one).
      const existing = w.cars.find((c) => c.sports && !c.wrecked);
      const car = existing || w.addCar({
        x: P.dealer.at[0] + 30, y: P.dealer.at[1] + 20, angle: 0.4,
        model: 'sports', color: '#c22e2e', parked: true, sports: true,
      });
      w.missionData.sports = car;
      w.flash('The Cometa GT is at the dealership. Take it — quietly.');
    },
    update(w) {
      const p = w.player;
      // If the Cometa GT is gone (wrecked or otherwise lost), the
      // dealership gets another one in — the job must stay doable.
      let s = w.missionData.sports;
      if (!s || s.wrecked || !w.cars.includes(s)) {
        s = w.addCar({
          x: P.dealer.at[0] + 30, y: P.dealer.at[1] + 20, angle: 0.4,
          model: 'sports', color: '#c22e2e', parked: true, sports: true,
        });
        w.missionData.sports = s;
        w.flash('Cometa Motors just got another GT in. It is still at the dealership.');
      }
      if (p.car === s &&
        dist(p.x, p.y, P.garage.at[0], P.garage.at[1]) < P.garage.r) return true;
      return false;
    },
    interact(w) {
      // Near the sports car on foot: E enters that car, not the nearest.
      // Generous radius: the player steps out of their old car right next
      // to it, and the press must reach the sports car, not re-enter the
      // car they just left.
      const p = w.player;
      const s = w.missionData.sports;
      if (!p.car && s && !s.wrecked && dist(p.x, p.y, s.x, s.y) < 110) {
        w._enterCar = s;
        return true;
      }
      return false;
    },
    objective(w) {
      // Before the steal: the dealership. Once Rico is in the Cometa GT,
      // the objective is the garage — pointing at the dealership forever
      // would drive the stolen car in circles around the lot.
      const p = w.player;
      if (p.car === w.missionData.sports) {
        return { x: P.garage.at[0], y: P.garage.at[1], label: 'Vega Motors — deliver the Cometa GT' };
      }
      return { x: P.dealer.at[0], y: P.dealer.at[1], label: 'Cometa Motors' };
    },
  },
  {
    id: 'smash-grab', name: 'Smash and Grab',
    brief: 'Crack the case at Casa Diamante (hold E), then get the jewels to the garage.',
    setup(w) {
      w.missionPhase = 0; w.missionData.crack = 0;
      w.flash('Casa Diamante. Hold E by the door to crack the case.');
    },
    update(w, dt) {
      const p = w.player;
      const near = dist(p.x, p.y, P.jewels.at[0], P.jewels.at[1]) < P.jewels.r;
      if (w.missionPhase === 0 && near && w.keysDown.has('KeyE')) {
        w.missionData.crack += dt;
        if (w.missionData.crack >= 3) {
          w.missionPhase = 1;
          w.setHeat(55);
          w.spawnPolice(2);
          w.flash('Jewels grabbed! The alarm is screaming — run to the garage!');
        }
      }
      if (w.missionPhase === 1 && dist(p.x, p.y, P.garage.at[0], P.garage.at[1]) < P.garage.r) return true;
      return false;
    },
    interact() { return false; },
    objective(w) {
      return w.missionPhase === 0
        ? { x: P.jewels.at[0], y: P.jewels.at[1], label: 'Casa Diamante' }
        : { x: P.garage.at[0], y: P.garage.at[1], label: 'Vega Motors' };
    },
  },
  {
    id: 'convoy', name: 'The Convoy',
    brief: 'Intercept the armored truck, grab the cash (E), escape to La Rosa House.',
    setup(w) {
      w.missionPhase = 0;
      // An armored truck loops the outer ring road (reuse it on respawn).
      const existing = w.cars.find((c) => c.convoy && !c.wrecked);
      const truck = existing || w.addCar({
        x: 160, y: 120, angle: 0, model: 'truck', color: '#3a5a7a',
        parked: false, convoy: true, health: 600,
      });
      if (!existing) {
        truck.route = w.city.route(160, 120, 2400, 1800);
        truck.routeIdx = 0;
      }
      w.missionData.truck = truck;
      w.flash('An armored truck is running the ring road. Hit it and grab the cash.');
    },
    update(w) {
      const p = w.player;
      // If the truck is gone (wrecked or otherwise lost), the convoy
      // sends another one — the job must stay doable.
      let t = w.missionData.truck;
      if (w.missionPhase === 0 && t && (t.wrecked || !w.cars.includes(t))) {
        const pt = w.city.randomRoadPoint(w.rng);
        const repl = w.addCar({
          x: pt.x, y: pt.y, angle: 0, model: 'truck', color: '#3a5a7a',
          parked: false, convoy: true, health: 600,
        });
        repl.route = w.city.route(pt.x, pt.y, 2400, 1800);
        repl.routeIdx = 0;
        w.missionData.truck = repl;
        w.flash('The convoy sent another truck. It is still running the ring road.');
      }
      if (w.missionPhase === 1 && dist(p.x, p.y, P.safehouse.at[0], P.safehouse.at[1]) < P.safehouse.r) return true;
      return false;
    },
    interact(w) {
      const p = w.player;
      const t = w.missionData.truck;
      if (w.missionPhase === 0 && t && !t.wrecked && dist(p.x, p.y, t.x, t.y) < 80) {
        w.missionPhase = 1;
        w.setHeat(70);
        w.spawnPolice(3);
        w.flash('Cash grabbed! Get to La Rosa House — now!');
        return true;
      }
      return false;
    },
    objective(w) {
      const t = w.missionData.truck;
      if (w.missionPhase === 0 && t) return { x: t.x, y: t.y, label: 'Armored truck' };
      return { x: P.safehouse.at[0], y: P.safehouse.at[1], label: 'La Rosa House' };
    },
  },
  {
    id: 'king', name: 'King of Verde Bay',
    brief: 'Survive ' + SURVIVE + ' seconds at five stars, then reach the yacht at the marina.',
    setup(w) {
      w.missionPhase = 0; w.missionData.timer = 0;
      w.setHeat(95);
      w.spawnPolice(4);
      w.flash('Five stars! Survive ' + SURVIVE + ' seconds — then the yacht.');
    },
    update(w, dt) {
      const p = w.player;
      if (w.missionPhase === 0) {
        // If the heat ever drops, the heat is back on.
        if (w.stars < 5) { w.setHeat(95); w.spawnPolice(2); }
        if (w.stars >= 5) w.missionData.timer += dt;
        if (w.missionData.timer >= SURVIVE) {
          w.missionPhase = 1;
          w.flash('You made it. The yacht is waiting at the marina.');
        }
      } else if (dist(p.x, p.y, P.yacht.at[0], P.yacht.at[1]) < P.yacht.r) {
        return true;
      }
      return false;
    },
    interact() { return false; },
    objective(w) {
      return w.missionPhase === 0
        ? { x: w.player.x, y: w.player.y, label: 'Survive — ' + Math.max(0, Math.ceil(SURVIVE - w.missionData.timer)) + 's' }
        : { x: P.yacht.at[0], y: P.yacht.at[1], label: 'Yacht La Rosa' };
    },
  },
];

export function missionReward(idx) {
  return MISSION_REWARDS[idx] || [0, 0];
}

export function startMission(w, idx) {
  w.missionIdx = idx;
  w.missionPhase = 0;
  w.missionData = {};
  MISSIONS[idx].setup(w);
}

export function updateMission(w, dt) {
  const m = MISSIONS[w.missionIdx];
  if (!m) return false;
  return m.update(w, dt) === true;
}
