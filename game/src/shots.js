// Staged screenshots for the VERDE BAY v2 dossier. Four shots, all
// 1280×720 and small enough for the gate (each ≤ 256 KiB): the cover
// is a 4-star chase at the bank with the helicopter overhead; the
// chase shot is a police ram by the marina; the mission shot is the
// courier run; the city shot is the title screen over the dusk city.
// Each shot teleports the player and the world into the staged state,
// renders one frame, then restores nothing — the page is reloaded
// between shots by the runner.

import { CFG } from './config.js';
import { createWorld } from './world.js';
import { MISSIONS, startMission } from './missions.js';

const P = CFG.places;

function placeCarNear(w, x, y, angle) {
  const car = w.cars.find((c) => !c.wrecked && !c.police && c.parked) || w.cars[0];
  car.x = x; car.y = y; car.angle = angle; car.parked = false;
  w.player.x = x; w.player.y = y;
  w.enterCar(car);
  return car;
}

function addCopAt(w, x, y, angle) {
  const cop = w.addCar({ x, y, angle, model: 'police', color: '#20242c', police: true, health: 260 });
  cop.speed = 320;
  return cop;
}

export const SHOTS = [
  {
    id: 'cover',
    name: 'Four-star chase at Banco Verde',
    setup(w) {
      w.state = 'playing';
      w.time = 18.4; // dusk: neon on, chase reads
      placeCarNear(w, P.bank.at[0] + 150, P.bank.at[1] - 40, -0.4);
      w.player.car.speed = 380;
      w.setHeat(72);
      w.stars = 4;
      w.spawnPolice(3);
      w.police.forEach((c, i) => {
        c.x = w.player.x - 90 - i * 70; c.y = w.player.y + 40 + i * 50;
        c.angle = -0.4; c.speed = 340;
      });
      w.heli.active = true;
      w.heli.x = w.player.x; w.heli.y = w.player.y - 120;
      w.missionIdx = 3;
      startMission(w, 3);
      w.flash('Four stars — the whole city is after you.');
    },
  },
  {
    id: 'chase',
    name: 'Police ram by the marina',
    setup(w) {
      w.state = 'playing';
      w.time = 12.0;
      // Place the car at the marina FIRST: startMission spawns its
      // police near the player, and they must be in the shot.
      const car = placeCarNear(w, CFG.marina.x0 - 140, CFG.marina.y0 + 70, 0.2);
      car.speed = 300;
      w.missionIdx = 2;
      startMission(w, 2); // Hot Pursuit: two stars, two cops, run for La Rosa House
      w.setHeat(48);
      w.stars = 3;
      // A third cop rams the player: placed a car-length behind, same heading.
      const cop = addCopAt(w, car.x - Math.cos(0.2) * 34, car.y - Math.sin(0.2) * 34, 0.2);
      cop.speed = 340;
      cop._ramT = 0;
      w.flash('They rammed you by the marina!');
    },
  },
  {
    id: 'mission',
    name: 'Night courier — package run',
    setup(w) {
      w.state = 'playing';
      w.time = 21.5; // night: neon signs glow
      w.missionIdx = 1;
      startMission(w, 1);
      placeCarNear(w, P.cafe.at[0] + 90, P.cafe.at[1] + 60, -Math.PI / 2);
      w.player.car.speed = 240;
      w.flash('Package collected. Deliver it to Hotel Miramar.');
      w.missionPhase = 1; // package already in hand for the shot
    },
  },
  {
    id: 'city',
    name: 'Title over the dusk city',
    setup(w) {
      w.state = 'title';
      w.time = 18.6;
      w.player.x = 1300; w.player.y = 1050;
      w.player.money = 4500; w.player.respect = 115;
      // The HUD reads the live stats, the title reads the save: keep
      // them consistent (mission 6/8, 4/10 stashes).
      w.missionIdx = 5;
      w.stats.stashes = 4;
      w.saveInfo = { money: 4500, respect: 115, missionIdx: 5, stashes: 4 };
    },
  },
];

export function makeShotWorld(seed, shotId) {
  const w = createWorld(seed, { shots: true });
  const shot = SHOTS.find((s) => s.id === shotId);
  if (!shot) throw new Error('unknown shot: ' + shotId);
  shot.setup(w);
  return { w, shot };
}
