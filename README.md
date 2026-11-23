# VERDE BAY — a tiny open-world crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zhenggangnan33-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zhenggangnan33-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on
[make.fun](https://make.fun) — an original 2D open-world crime game
in the spirit of GTA 6, built from scratch in plain JavaScript and
Canvas. No Rockstar names, characters, art or music: the city of
Verde Bay, Dante Vega, and La Rosa are all invented here.

## Play

Serve it locally and open it in a desktop browser:

```
node serve.ts
# http://localhost:8080
```

No build step, no network requests, no libraries — `game/` is plain
static files.

- **WASD / arrows** — drive and walk (Shift to sprint on foot)
- **E** — enter / exit a car, pick up, interact
- **F** — punch (on foot)
- **Space** — handbrake
- **G** — garage shop at Vega Motors (armor, turbo, racing tires)
- **R** — change radio station · **M** — mute · **P** — pause
- **Enter** — start, and recover from busted / wasted / win

## The game

Dante Vega, wheelman for Carmen "La Rosa" Ibarra, works eight story
missions across a 2560×1920 coastal city: steal a first car, run a
night courier job, outrun a two-star pursuit, crack the vault job,
steal the Cometa GT from the dealership, smash-and-grab Casa
Diamante, intercept an armored convoy, and survive five stars to
reach the yacht as King of Verde Bay.

Around the missions: 14 traffic cars (sedans, vans, taxis) driving
the road grid on the right-hand side, 26 pedestrians who flee from
speeding cars, a 0–5 star wanted system with police pursuit, rams,
roadblocks and a searchlight helicopter, a chop shop that pays for
stolen cars, a garage shop with three upgrades, three procedural
radio stations (synthwave, Latin pop, lo-fi jazz), a day/dusk/night
cycle with neon signs, 10 hidden cash stashes worth $150 each, a
clean-getaway bonus, and localStorage saves.

## v2 changes vs v1

- **Every mission verified by autopilot**, including mission 8
  (v1's mission-8 probe was killed by a restart and never verified).
- **New module `game/src/particles.js`** — exhaust puffs, crash
  sparks, damage smoke and persistent skid marks.
- **10 hidden cash stashes** ($150 each, HUD counter, minimap dots).
- **Clean-getaway bonus** (+$100 for losing 2+ stars clean).
- **Third radio station** — VERDE 88, lo-fi jazz.
- **Neon landmark signs** at dusk and night, beach umbrellas and
  palms, van and taxi traffic models.
- **Render culling** — off-camera buildings, parks and lots are
  skipped, so the frame stays fast at full zoom.
- **HUD police count** and a title-screen save progress line.
- **Mission 8 survive timer 60 s → 45 s**, and the autopilot's
  mission-8 phase-1 bug fixed (it roamed instead of driving to the
  yacht).
- Save key bumped to `verdebay-save-v4` so stale v1 saves cannot
  leak into screenshots.

## Layout

```
game/
  index.html            page + touch controls
  src/
    config.js           world, tuning, places, radio, stashes
    random.js           seeded RNG (mulberry32)
    city.js             generation, routing, collision
    missions.js         the 8 story missions
    world.js            simulation: player, cars, police, peds, heat
    input.js            keyboard + touch
    audio.js            WebAudio synth + 3 radio stations
    particles.js        exhaust, sparks, smoke, skid marks (new in v2)
    render.js           canvas, camera, HUD, minimap
    shots.js            staged screenshot scenes
    main.js             boot + game loop
serve.ts                local static server
main.ts                 dossier builder (make.fun entry point)
screenshots/           4 staged shots, 1280×720
```

## Verification

See `BUILD_NOTES.md` for the autopilot results per mission, the
screenshot sizes and the deterministic-build check.
