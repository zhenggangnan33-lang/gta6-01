// VERDE BAY story missions — 8 jobs for Rico Solano, wheelman for
// Marisol "La Reina" Duarte. Each mission: setup(w), update(w, dt) -> true
// when done, objective(w) -> {x, y, label} for the HUD marker.
// Missions only touch the world object they are handed; they never import it.
import { CFG } from './config.js';

function near(w, x, y, r) {
  const dx = w.player.x - x;
  const dy = w.player.y - y;
  return dx * dx + dy * dy < r * r;
}

function inRect(w, r) {
  return w.player.x > r.x && w.player.x < r.x + r.w && w.player.y > r.y && w.player.y < r.y + r.h;
}

export const MISSIONS = [
  {
    name: 'First Wheels',
    brief: 'Steal any car and bring it to Solano Garage.',
    reward: 500,
    respect: 10,
    setup(w) { w.missionState = { phase: 0 }; },
    objective(w) { return { x: CFG.GARAGE.cx, y: CFG.GARAGE.cy, label: 'Solano Garage' }; },
    update(w) {
      // Mission update runs before the chop shop in the world step, so the
      // delivered car counts for the job instead of being sold first.
      return !!w.player.car && inRect(w, CFG.GARAGE);
    },
  },
  {
    name: 'Courier Run',
    brief: 'Pick up the package at Banco Verde, deliver it to the safehouse.',
    reward: 650,
    respect: 10,
    setup(w) { w.missionState = { phase: 0 }; },
    objective(w) {
      const s = w.missionState;
      return s.phase === 0
        ? { x: CFG.BANK.doorX, y: CFG.BANK.doorY, label: 'Banco Verde — pick up' }
        : { x: CFG.SAFEHOUSE.doorX, y: CFG.SAFEHOUSE.doorY, label: 'Safehouse — deliver' };
    },
    update(w) {
      const s = w.missionState;
      if (s.phase === 0) {
        if (near(w, CFG.BANK.doorX, CFG.BANK.doorY, CFG.MARKER_R) && w.consumeAction()) {
          s.phase = 1;
          w.flash('Package picked up — lose the tail and run it to the safehouse.');
        }
        return false;
      }
      return near(w, CFG.SAFEHOUSE.doorX, CFG.SAFEHOUSE.doorY, CFG.MARKER_R);
    },
  },
  {
    name: 'Getaway Driver',
    brief: 'Pick up Marisol at the hotel, then drive her to the marina — hot.',
    reward: 900,
    respect: 15,
    setup(w) { w.missionState = { phase: 0 }; },
    objective(w) {
      const s = w.missionState;
      return s.phase === 0
        ? { x: CFG.HOTEL.doorX, y: CFG.HOTEL.doorY, label: 'Hotel — pick up Marisol' }
        : { x: CFG.MARINA.yachtX, y: CFG.MARINA.yachtY, label: 'Marina — drop her off' };
    },
    update(w) {
      const s = w.missionState;
      if (s.phase === 0) {
        if (near(w, CFG.HOTEL.doorX, CFG.HOTEL.doorY, CFG.MARKER_R)) {
          s.phase = 1;
          w.setHeat(32);
          w.spawnPolice(2);
          w.flash('Marisol is in — the cops are already on you. Drive!');
        }
        return false;
      }
      if (near(w, CFG.MARINA.yachtX, CFG.MARINA.yachtY, CFG.MARKER_R)) {
        w.setHeat(10);
        return true;
      }
      return false;
    },
  },
  {
    name: 'The Collection',
    brief: 'Collect the three cash drops: the mart, the park, the pier.',
    reward: 1200,
    respect: 15,
    setup(w) {
      w.missionState = {
        phase: 0,
        drops: [
          { x: CFG.MART.doorX, y: CFG.MART.doorY, got: false, label: 'Mart drop' },
          { x: CFG.PARK.x + CFG.PARK.w / 2, y: CFG.PARK.y + CFG.PARK.h / 2, got: false, label: 'Park drop' },
          { x: CFG.PIER.x + 20, y: CFG.PIER.y + CFG.PIER.h / 2, got: false, label: 'Pier drop' },
        ],
      };
    },
    objective(w) {
      const d = w.missionState.drops.find((d) => !d.got);
      return d ? { x: d.x, y: d.y, label: d.label } : { x: CFG.MART.doorX, y: CFG.MART.doorY, label: 'Collection done' };
    },
    update(w) {
      const s = w.missionState;
      for (const d of s.drops) {
        if (!d.got && near(w, d.x, d.y, CFG.MARKER_R) && w.consumeAction()) {
          d.got = true;
          w.flash(`Cash collected (${s.drops.filter((x) => x.got).length}/3).`);
        }
      }
      return s.drops.every((d) => d.got);
    },
  },
  {
    name: 'Turbo Heist',
    brief: 'Steal the sports car from the dealership lot. Bring it to the garage.',
    reward: 2000,
    respect: 20,
    setup(w) {
      w.missionState = { phase: 0, sport: null };
      const sport = w.addCar({
        kind: 'sport', x: CFG.DEALERSHIP.sportX, y: CFG.DEALERSHIP.sportY,
        angle: 0, parked: true, color: '#d8b400', top: 390,
      });
      w.missionState.sport = sport;
    },
    objective(w) {
      const s = w.missionState;
      return s.phase === 0
        ? { x: CFG.DEALERSHIP.sportX, y: CFG.DEALERSHIP.sportY, label: 'Dealership — the sports car' }
        : { x: CFG.GARAGE.cx, y: CFG.GARAGE.cy, label: 'Solano Garage' };
    },
    update(w) {
      const s = w.missionState;
      if (s.phase === 0) {
        if (w.player.car === s.sport) {
          s.phase = 1;
          w.flash('That is a fast car. Get it to the garage, in one piece.');
        }
        return false;
      }
      return w.player.car === s.sport && inRect(w, CFG.GARAGE);
    },
  },
  {
    name: 'Smash & Grab',
    brief: 'Smash the jewelry store window (F to punch), grab the loot, run to the safehouse.',
    reward: 2500,
    respect: 20,
    setup(w) { w.missionState = { phase: 0 }; },
    objective(w) {
      const s = w.missionState;
      return s.phase === 0
        ? { x: CFG.JEWELRY.doorX, y: CFG.JEWELRY.doorY, label: 'Jewelry store — smash the window' }
        : { x: CFG.SAFEHOUSE.doorX, y: CFG.SAFEHOUSE.doorY, label: 'Safehouse — stash the loot' };
    },
    update(w) {
      const s = w.missionState;
      if (s.phase === 0) {
        if (near(w, CFG.JEWELRY.doorX, CFG.JEWELRY.doorY, CFG.MARKER_R) && w.player.punched) {
          s.phase = 1;
          w.addHeat(CFG.HEAT_ALARM);
          w.spawnPolice(2);
          w.flash('Alarm! Grabbed the loot — run for the safehouse.');
        }
        return false;
      }
      return near(w, CFG.SAFEHOUSE.doorX, CFG.SAFEHOUSE.doorY, CFG.MARKER_R);
    },
  },
  {
    name: 'The Convoy',
    brief: 'Ram the armored van until it stops, then grab the cash on foot.',
    reward: 4000,
    respect: 25,
    setup(w) {
      w.missionState = { phase: 0, van: null };
      const van = w.addCar({
        kind: 'van', x: 160, y: 160, angle: 0, parked: false, color: '#3a3f45',
        health: 120, top: 260, convoy: true,
      });
      van.route = w.cityRoute({ x: 160, y: 160 }, { x: 2080, y: 1440 });
      van.routeIdx = 0;
      w.missionState.van = van;
    },
    objective(w) {
      const s = w.missionState;
      const v = s.van;
      return s.phase === 0
        ? { x: v.x, y: v.y, label: 'Armored van — ram it to a stop' }
        : { x: v.x, y: v.y, label: 'The van — grab the cash' };
    },
    update(w) {
      const s = w.missionState;
      const v = s.van;
      if (s.phase === 0) {
        if (v.wrecked) {
          s.phase = 1;
          w.flash('The van is stopped. Get out and grab the cash.');
        }
        return false;
      }
      if (!w.player.car && near(w, v.x, v.y, CFG.MARKER_R) && w.consumeAction()) {
        w.addHeat(25);
        return true;
      }
      return false;
    },
  },
  {
    name: 'King of Verde Bay',
    brief: 'Survive 60 seconds at 5 stars, then reach the yacht at the marina.',
    reward: 10000,
    respect: 50,
    setup(w) {
      w.missionState = { phase: 0, timer: 60 };
      w.setHeat(95);
      w.spawnPolice(4);
    },
    objective(w) {
      const s = w.missionState;
      return s.phase === 0
        ? { x: w.player.x, y: w.player.y, label: `Survive at 5 stars — ${Math.ceil(s.timer)}s` }
        : { x: CFG.MARINA.yachtX, y: CFG.MARINA.yachtY, label: 'The yacht — you are king' };
    },
    update(w, dt) {
      const s = w.missionState;
      if (s.phase === 0) {
        // A bust resets heat and clears the police, which would freeze
        // the survive timer forever (it only ticks at 5 stars). If the
        // heat is gone, bring the chase back.
        if (w.stars < 5) {
          w.setHeat(95);
          if (w.police.length < 2) w.spawnPolice(2);
        }
        if (w.stars >= 5) s.timer -= dt;
        if (s.timer <= 0) {
          s.phase = 1;
          w.flash('Sixty seconds. Now get to the yacht!');
        }
        return false;
      }
      return near(w, CFG.MARINA.yachtX, CFG.MARINA.yachtY, CFG.MARKER_R);
    },
  },
];
