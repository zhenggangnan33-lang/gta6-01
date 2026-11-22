// VERDE BAY map: road grid, blocks, buildings, landmarks and road routing.
// The map is generated from a seed so staged scenes are deterministic.
import { CFG } from './config.js';
import { mulberry32, range, rangeInt, pick, clamp } from './random.js';

// Blocks that are reserved for landmarks / open space (no random buildings).
const RESERVED = [
  { x: 480, y: 480, w: 320, h: 320 }, // garage forecourt block
  { x: 800, y: 480, w: 320, h: 320 }, // park block
  { x: 1120, y: 480, w: 320, h: 320 }, // bank block
  { x: 1440, y: 800, w: 320, h: 320 }, // hotel block
  { x: 800, y: 1120, w: 320, h: 320 }, // safehouse block
  { x: 480, y: 800, w: 320, h: 320 }, // jewelry block
  { x: 1760, y: 480, w: 320, h: 320 }, // dealership lot block
  { x: 1120, y: 1120, w: 320, h: 320 }, // mart block
  { x: 2080, y: 1440, w: 256, h: 320 }, // marina block
];

function blockFree(bx, by, bw, bh) {
  for (const r of RESERVED) {
    if (bx < r.x + r.w && bx + bw > r.x && by < r.y + r.h && by + bh > r.y) return false;
  }
  return true;
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const solids = []; // {x, y, w, h} solid for movement (buildings + water)
  const trees = [];
  const lots = []; // open parking lots {x, y, w, h}

  // Landmark buildings (solid).
  const lm = [
    { ...CFG.BANK, type: 'bank', color: '#8a7a4a' },
    { ...CFG.HOTEL, type: 'hotel', color: '#4a5a7a' },
    { ...CFG.SAFEHOUSE, type: 'house', color: '#6a5a7a' },
    { ...CFG.JEWELRY, type: 'jewelry', color: '#7a4a5a' },
    { ...CFG.MART, type: 'mart', color: '#5a7a5a' },
  ];
  for (const b of lm) {
    buildings.push({ x: b.x, y: b.y, w: b.w, h: b.h, type: b.type, color: b.color });
    solids.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  }
  // Garage workshop: a small solid building in the NW corner of the forecourt;
  // the rest of the forecourt stays open so a delivered car can drive in.
  const shop = { x: CFG.GARAGE.x, y: CFG.GARAGE.y, w: 86, h: 64, type: 'workshop', color: '#6a6a72' };
  buildings.push(shop);
  solids.push({ x: shop.x, y: shop.y, w: shop.w, h: shop.h });
  lots.push({ x: CFG.GARAGE.x, y: CFG.GARAGE.y, w: CFG.GARAGE.w, h: CFG.GARAGE.h, kind: 'garage' });
  lots.push({ x: CFG.DEALERSHIP.x, y: CFG.DEALERSHIP.y, w: CFG.DEALERSHIP.w, h: CFG.DEALERSHIP.h, kind: 'dealer' });

  // Park trees (decor only).
  for (let i = 0; i < 26; i++) {
    trees.push({
      x: range(rng, CFG.PARK.x + 14, CFG.PARK.x + CFG.PARK.w - 14),
      y: range(rng, CFG.PARK.y + 14, CFG.PARK.y + CFG.PARK.h - 14),
      r: range(rng, 7, 13),
    });
  }

  // Fill the remaining blocks with buildings: for each block between roads,
  // put 1-3 buildings with a margin, leaving a parking lot in some blocks.
  const xs = [0, 196, 516, 836, 1156, 1476, 1796, 2116];
  const ys = [0, 196, 516, 836, 1156, 1476];
  const xw = [124, 248, 248, 248, 248, 248, 248, 220];
  const yh = [124, 248, 248, 248, 248, 248, 288];
  for (let bi = 0; bi < xs.length; bi++) {
    for (let bj = 0; bj < ys.length; bj++) {
      const bx = xs[bi];
      const by = ys[bj];
      const bw = xw[bi];
      const bh = yh[bj];
      if (bx >= CFG.BEACH_X - 40) continue; // beach strip stays open
      if (!blockFree(bx, by, bw, bh)) continue;
      if (rng() < 0.22) {
        lots.push({ x: bx, y: by, w: bw, h: bh, kind: 'lot' });
        continue;
      }
      const n = rangeInt(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 70, Math.min(150, bw - 30));
        const h = range(rng, 60, Math.min(130, bh - 30));
        const x = range(rng, bx + 12, bx + bw - w - 12);
        const y = range(rng, by + 12, by + bh - h - 12);
        const b = { x, y, w, h, type: 'block', color: pick(rng, CFG.COLORS.buildingRoofs) };
        // Keep buildings far enough apart that a car can always pass
        // between them: a narrow gap is a trap a car gets wedged in and
        // can never reverse out of.
        if (buildings.some((o) => x < o.x + o.w + 48 && x + w + 48 > o.x && y < o.y + o.h + 48 && y + h + 48 > o.y)) continue;
        buildings.push(b);
        solids.push({ x, y, w, h });
      }
    }
  }

  // Water is solid (no swimming).
  solids.push({ x: CFG.WATER_X, y: 0, w: CFG.WORLD_W - CFG.WATER_X, h: CFG.WORLD_H });

  return {
    seed,
    buildings,
    solids,
    trees,
    lots,
    landmarks: {
      garage: CFG.GARAGE,
      bank: CFG.BANK,
      hotel: CFG.HOTEL,
      safehouse: CFG.SAFEHOUSE,
      jewelry: CFG.JEWELRY,
      dealership: CFG.DEALERSHIP,
      mart: CFG.MART,
      marina: CFG.MARINA,
      pier: CFG.PIER,
      park: CFG.PARK,
    },
  };
}

export function onRoad(x, y) {
  for (const rx of CFG.ROAD_X) if (Math.abs(x - rx) <= CFG.ROAD_HALF) return true;
  for (const ry of CFG.ROAD_Y) if (Math.abs(y - ry) <= CFG.ROAD_HALF) return true;
  return false;
}

// Circle (x, y, r) against every solid rect. True when blocked.
export function isSolid(city, x, y, r) {
  if (x < r || y < r || x > CFG.WORLD_W - r || y > CFG.WORLD_H - r) return true;
  for (const s of city.solids) {
    const cx = clamp(x, s.x, s.x + s.w);
    const cy = clamp(y, s.y, s.y + s.h);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Move a circle, sliding along walls: try full step, then x-only, then y-only.
export function moveCircle(city, e, dx, dy, r) {
  if (!isSolid(city, e.x + dx, e.y + dy, r)) {
    e.x += dx;
    e.y += dy;
    return true;
  }
  if (!isSolid(city, e.x + dx, e.y, r)) {
    e.x += dx;
    return true;
  }
  if (!isSolid(city, e.x, e.y + dy, r)) {
    e.y += dy;
    return true;
  }
  return false;
}

// If a circle is overlapping any solid, shove it out to the nearest free
// spot. Collision pushes ignore walls, so a police ram can shove a car
// into a building — or clean past the world edge, which is solid in
// isSolid but is not a rect in city.solids. Without this the car is
// wedged forever, because every moveCircle step from inside a solid
// stays inside it and is rejected.
export function pushOutOfSolids(city, e, r) {
  // The world edge is solid too: clamp back inside the map.
  e.x = clamp(e.x, r, CFG.WORLD_W - r);
  e.y = clamp(e.y, r, CFG.WORLD_H - r);
  for (let iter = 0; iter < 4; iter++) {
    let pushed = false;
    for (const s of city.solids) {
      const cx = clamp(e.x, s.x, s.x + s.w);
      const cy = clamp(e.y, s.y, s.y + s.h);
      const dx = e.x - cx;
      const dy = e.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = r - d;
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
        } else {
          // Center is inside the rect: leave along the shortest side.
          const l = e.x - s.x;
          const ri = s.x + s.w - e.x;
          const t = e.y - s.y;
          const b = s.y + s.h - e.y;
          const m = Math.min(l, ri, t, b);
          if (m === l) e.x = s.x - r;
          else if (m === ri) e.x = s.x + s.w + r;
          else if (m === t) e.y = s.y - r;
          else e.y = s.y + s.h + r;
        }
        pushed = true;
      }
    }
    if (!pushed) break;
  }
}

export function nearestRoadPoint(x, y) {
  let bestX = CFG.ROAD_X[0];
  let bestY = CFG.ROAD_Y[0];
  for (const rx of CFG.ROAD_X) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  for (const ry of CFG.ROAD_Y) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  // Snap to whichever road line is closer.
  if (Math.abs(x - bestX) <= Math.abs(y - bestY)) return { x: bestX, y };
  return { x, y: bestY };
}

// BFS over the intersection graph; returns waypoints from `from` to `to`.
export function route(city, from, to) {
  const xs = CFG.ROAD_X;
  const ys = CFG.ROAD_Y;
  const start = nearestIntersection(from.x, from.y);
  const goal = nearestIntersection(to.x, to.y);
  const key = (ix, iy) => ix + ',' + iy;
  const prev = new Map();
  const seen = new Set([key(start.ix, start.iy)]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift();
    if (n.ix === goal.ix && n.iy === goal.iy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = n.ix + dx;
      const ny = n.iy + dy;
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, n);
      queue.push({ ix: nx, iy: ny });
    }
  }
  const points = [{ x: to.x, y: to.y }];
  let cur = goal;
  const path = [];
  while (!(cur.ix === start.ix && cur.iy === start.iy)) {
    path.unshift({ x: xs[cur.ix], y: ys[cur.iy] });
    const p = prev.get(key(cur.ix, cur.iy));
    if (!p) break; // unreachable (should not happen on a full grid)
    cur = p;
  }
  path.unshift({ x: xs[start.ix], y: ys[start.iy] });
  // Drop the first waypoint if we are already on it, and the raw `from` point.
  const pts = [{ x: from.x, y: from.y }, ...path, ...points];
  // Simplify: remove consecutive duplicates / near-duplicates.
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1];
    if (Math.abs(pts[i].x - last.x) + Math.abs(pts[i].y - last.y) > 4) out.push(pts[i]);
  }
  return out;
}

function nearestIntersection(x, y) {
  let ix = 0;
  let iy = 0;
  for (let i = 0; i < CFG.ROAD_X.length; i++) {
    if (Math.abs(x - CFG.ROAD_X[i]) < Math.abs(x - CFG.ROAD_X[ix])) ix = i;
  }
  for (let i = 0; i < CFG.ROAD_Y.length; i++) {
    if (Math.abs(y - CFG.ROAD_Y[i]) < Math.abs(y - CFG.ROAD_Y[iy])) iy = i;
  }
  return { ix, iy };
}

export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, CFG.ROAD_X), y: range(rng, 80, CFG.WORLD_H - 80) };
  }
  return { x: range(rng, 80, CFG.BEACH_X - 80), y: pick(rng, CFG.ROAD_Y) };
}
