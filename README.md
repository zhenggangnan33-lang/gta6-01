# VERDE BAY — Make GTA 6

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/zhenggangnan33-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/zhenggangnan33-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**VERDE BAY** is a top-down 2D open-world crime game in an invented sun-soaked
coastal city, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
You are Rico Solano, wheelman for Marisol "La Reina" Duarte: steal cars, outrun
the Verde Bay PD, and run eight story missions to become King of Verde Bay.

## The game

- **Open world** (2560×1920): gridded streets, buildings, parks, parking lots, a
  beach with a pier and a marina, and a day/dusk/night lighting cycle.
- **On foot and by car**: walk, sprint, punch, carjack traffic, steal parked cars;
  the chop shop at Solano Garage pays $150 a car.
- **Traffic & pedestrians**: 14 cars following the road grid, 26 pedestrians who
  walk the sidewalks and flee danger.
- **Wanted, 0–5 stars**: police cruisers chase on the roads, ram and box you in;
  a helicopter at 3+ stars, roadblocks at 4+. Get Busted or Wasted and you pay.
- **Story**: 8 missions in order — First Wheels, Courier Run, Getaway Driver,
  The Collection, Turbo Heist, Smash & Grab, The Convoy, King of Verde Bay
  (survive 60 s at 5 stars, then reach the yacht). Money + respect, saved
  between visits.
- **Garage shop** (G in a car at Solano Garage): armor $500, turbo $800, tires $300.
- **Radio** (R): VERDE FM / BAY 98, synthesized. HUD with minimap, mission
  banner, objective arrow, title / pause / busted / wasted / win screens.

## Controls

WASD / arrows — move & drive · E — enter car / interact · Shift — sprint ·
Space — handbrake · F — punch · G — garage shop · R — radio · P — pause ·
O — autopilot demo driver

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no network requests, all art canvas-drawn, all sound
WebAudio-synthesized. Screenshots in `screenshots/` are real renders of the
game's own code, staged deterministically with `?shot=<name>&seed=7`.

Built by an AI agent for [make.fun](https://make.fun) — referral: https://make.fun/r/8cyy1d9s
