// City generation, road routing and collision for VERDE BAY.
// The town is a road grid (see config.js): blocks between roads hold
// buildings, parks or parking lots, laid out by a seeded generator. Cars
// drive on the right-hand side of the road; routing is a BFS over the
// intersection graph. All collision is circle-vs-rectangle, resolved
// axis by axis, plus a push-out that rescues anything a ram shoved into
// a wall.

import { CFG } from './config.js';
import { makeRng } from './random.js';

const { roadsX, roadsY, roadHalf, lane } = CFG;
const W = CFG.world.w, H = CFG.world.h;

function rectsOverlap(ax, ay, ar, bx, by, bw, bh) {
  return ax < bx + bw && ax + ar > bx && ay < by + bh && ay + ar > by;
}

export function genCity(seed) {
  const rng = makeRng(seed ^ 0x5f3759df);
  const solids = []; // {x, y, w, h} building rectangles
  const buildings = []; // solids + roof colour + height hint
  const parks = []; // {x, y, w, h, trees: [[x,y,r], ...]}
  const lots = []; // open parking lots {x, y, w, h}
  const roofs = [CFG.colors.buildingRoof, CFG.colors.buildingRoof2, CFG.colors.buildingRoof3];

  // Which block (ix, iy) contains a point.
  const blockOf = (x, y) => {
    let ix = -1, iy = -1;
    for (let i = 0; i < roadsX.length - 1; i++) if (x > roadsX[i] && x < roadsX[i + 1]) ix = i;
    for (let j = 0; j < roadsY.length - 1; j++) if (y > roadsY[j] && y < roadsY[j + 1]) iy = j;
    return [ix, iy];
  };

  // Reserved blocks: garage forecourt, plaza, stadium, marina/beach.
  const reserved = new Map();
  reserved.set('3,3', 'garage'); // Vega Motors forecourt (open lot)
  reserved.set('3,1', 'plaza'); // Palma Plaza (park)
  reserved.set('6,2', 'stadium'); // Estadio Verde
  reserved.set('0,2', 'dealer'); // Cometa Motors lot (open, sports car lives here)
  reserved.set('6,5', 'marina');
  reserved.set('5,6', 'beach');
  reserved.set('6,6', 'beach');

  // The marina water is solid ground to no one: cars and people stay out
  // of it, except where the roads cross it (x=2400 and y=1800 stay open).
  const m = CFG.marina;
  const roadX0 = 2400 - roadHalf - 6, roadX1 = 2400 + roadHalf + 6;
  const roadY0 = 1800 - roadHalf - 6, roadY1 = 1800 + roadHalf + 6;
  solids.push(
    { x: m.x0, y: m.y0, w: roadX0 - m.x0, h: roadY0 - m.y0 },
    { x: roadX1, y: m.y0, w: m.x1 - roadX1, h: roadY0 - m.y0 },
    { x: m.x0, y: roadY1, w: roadX0 - m.x0, h: m.y1 - roadY1 },
    { x: roadX1, y: roadY1, w: m.x1 - roadX1, h: m.y1 - roadY1 },
  );

  for (let ix = 0; ix < roadsX.length - 1; ix++) {
    for (let iy = 0; iy < roadsY.length - 1; iy++) {
      const bx0 = roadsX[ix] + roadHalf + 14;
      const by0 = roadsY[iy] + roadHalf + 14;
      const bx1 = roadsX[ix + 1] - roadHalf - 14;
      const by1 = roadsY[iy + 1] - roadHalf - 14;
      const bw = bx1 - bx0, bh = by1 - by0;
      const key = ix + ',' + iy;
      const kind = reserved.get(key);
      if (kind === 'garage') {
        lots.push({ x: bx0, y: by0, w: bw, h: bh, garage: true });
        // Small workshop in the north-west corner of the forecourt.
        const ws = { x: bx0 + 8, y: by0 + 8, w: 150, h: 90 };
        solids.push(ws);
        buildings.push({ ...ws, roof: '#6a5a7a', tall: 1 });
        continue;
      }
      if (kind === 'dealer') {
        // Cometa Motors: an open sales lot, no buildings in the way.
        lots.push({ x: bx0, y: by0, w: bw, h: bh, dealer: true });
        continue;
      }
      if (kind === 'plaza') {
        const trees = [];
        for (let t = 0; t < 12; t++) trees.push([bx0 + 24 + rng.range(0, bw - 48), by0 + 24 + rng.range(0, bh - 48), rng.range(9, 15)]);
        parks.push({ x: bx0, y: by0, w: bw, h: bh, plaza: true, trees });
        continue;
      }
      if (kind === 'stadium') {
        const st = { x: bx0 + 10, y: by0 + 10, w: bw - 20, h: bh - 20 };
        solids.push(st);
        buildings.push({ ...st, roof: '#3f6d8f', tall: 2, stadium: true });
        continue;
      }
      if (kind === 'marina' || kind === 'beach') continue; // water / sand: nothing built
      const roll = rng.next();
      if (roll < 0.22) {
        // Park with trees.
        const trees = [];
        const n = rng.int(6, 11);
        for (let t = 0; t < n; t++) trees.push([bx0 + 20 + rng.range(0, bw - 40), by0 + 20 + rng.range(0, bh - 40), rng.range(8, 14)]);
        parks.push({ x: bx0, y: by0, w: bw, h: bh, trees });
      } else if (roll < 0.38) {
        // Open parking lot (parked cars spawn here).
        lots.push({ x: bx0, y: by0, w: bw, h: bh });
      } else {
        // 1–3 buildings, kept 48 px apart and clear of the block edge.
        const n = rng.int(1, 3);
        const placed = [];
        for (let b = 0; b < n; b++) {
          const wdt = rng.range(70, Math.min(150, bw - 60));
          const hgt = rng.range(60, Math.min(130, bh - 60));
          let x = 0, y = 0, ok = false;
          for (let tries = 0; tries < 12 && !ok; tries++) {
            x = bx0 + rng.range(0, bw - wdt);
            y = by0 + rng.range(0, bh - hgt);
            ok = placed.every((p) => !rectsOverlap(x - 48, y - 48, wdt + 96, hgt + 96, p.x, p.y, p.w, p.h));
          }
          if (!ok) continue;
          const r = { x, y, w: wdt, h: hgt };
          placed.push(r);
          solids.push(r);
          buildings.push({ ...r, roof: rng.pick(roofs), tall: rng.int(0, 2) });
        }
      }
    }
  }

  // Intersection graph.
  const nodes = [];
  const nodeIndex = new Map();
  for (let i = 0; i < roadsX.length; i++) {
    for (let j = 0; j < roadsY.length; j++) {
      nodeIndex.set(i + ',' + j, nodes.length);
      nodes.push({ x: roadsX[i], y: roadsY[j], i, j });
    }
  }
  const adj = nodes.map(() => []);
  const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  for (let i = 0; i < roadsX.length; i++) {
    for (let j = 0; j < roadsY.length; j++) {
      const n = nodeIndex.get(i + ',' + j);
      if (i + 1 < roadsX.length) link(n, nodeIndex.get((i + 1) + ',' + j));
      if (j + 1 < roadsY.length) link(n, nodeIndex.get(i + ',' + (j + 1)));
    }
  }

  const nearestNode = (x, y) => {
    let best = 0, bd = Infinity;
    for (let n = 0; n < nodes.length; n++) {
      const d = (nodes[n].x - x) ** 2 + (nodes[n].y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  // BFS route between the nodes nearest two points. Returns waypoints
  // (node positions, start and end included).
  const route = (fx, fy, tx, ty) => {
    const start = nearestNode(fx, fy), goal = nearestNode(tx, ty);
    if (start === goal) return [{ x: tx, y: ty }];
    const prev = new Array(nodes.length).fill(-1);
    const queue = [start];
    prev[start] = start;
    while (queue.length) {
      const n = queue.shift();
      if (n === goal) break;
      for (const m of adj[n]) if (prev[m] === -1) { prev[m] = n; queue.push(m); }
    }
    if (prev[goal] === -1) return [{ x: tx, y: ty }];
    const path = [];
    let n = goal;
    while (n !== start) { path.unshift(nodes[n]); n = prev[n]; }
    path.unshift(nodes[start]);
    path.push({ x: tx, y: ty });
    return path;
  };

  // Project a point onto the nearest road centreline.
  const nearestRoadPoint = (x, y) => {
    let best = null, bd = Infinity;
    for (const rx of roadsX) {
      const d = Math.abs(x - rx);
      if (d < bd) { bd = d; best = { x: rx, y: Math.max(roadHalf, Math.min(H - roadHalf, y)) }; }
    }
    for (const ry of roadsY) {
      const d = Math.abs(y - ry);
      if (d < bd) { bd = d; best = { x: Math.max(roadHalf, Math.min(W - roadHalf, x)), y: ry }; }
    }
    return best;
  };

  const onRoad = (x, y) => {
    if (y > CFG.beachY) return false;
    for (const rx of roadsX) if (Math.abs(x - rx) <= roadHalf + 6) return true;
    for (const ry of roadsY) if (Math.abs(y - ry) <= roadHalf + 6) return true;
    return false;
  };

  const randomRoadPoint = (rng2) => {
    if (rng2.chance(0.5)) {
      return { x: rng2.pick(roadsX), y: rng2.range(80, H - 120) };
    }
    return { x: rng2.range(80, W - 120), y: rng2.pick(roadsY) };
  };

  // Circle vs buildings, axis-separated. Returns the resolved position
  // and which axis hit a wall.
  const moveCircle = (x, y, r, dx, dy) => {
    let hitX = false, hitY = false;
    let nx = x + dx;
    for (const s of solids) {
      if (nx + r > s.x && nx - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) {
        nx = dx > 0 ? s.x - r : s.x + s.w + r;
        hitX = true;
      }
    }
    let ny = y + dy;
    for (const s of solids) {
      if (nx + r > s.x && nx - r < s.x + s.w && ny + r > s.y && ny - r < s.y + s.h) {
        ny = dy > 0 ? s.y - r : s.y + s.h + r;
        hitY = true;
      }
    }
    return { x: nx, y: ny, hitX, hitY };
  };

  // Push a circle out of any solid it overlaps (rescue after a ram),
  // then clamp it inside the world.
  const pushOut = (x, y, r) => {
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const s of solids) {
        const cx = Math.max(s.x, Math.min(x, s.x + s.w));
        const cy = Math.max(s.y, Math.min(y, s.y + s.h));
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 0.01) {
            const d = Math.sqrt(d2);
            x = cx + (dx / d) * r; y = cy + (dy / d) * r;
          } else {
            // Centre inside the rect: push out along the short axis.
            const pl = x - (s.x - r), pr = (s.x + s.w + r) - x;
            const pt = y - (s.y - r), pb = (s.y + s.h + r) - y;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) x = s.x - r; else if (m === pr) x = s.x + s.w + r;
            else if (m === pt) y = s.y - r; else y = s.y + s.h + r;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    return { x: Math.max(r, Math.min(W - r, x)), y: Math.max(r, Math.min(H - r, y)) };
  };

  const insideSolid = (x, y, r) => solids.some((s) => x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h);

  return {
    seed, solids, buildings, parks, lots, nodes, adj,
    blockOf, route, nearestNode, nearestRoadPoint, onRoad,
    randomRoadPoint, moveCircle, pushOut, insideSolid, lane,
  };
}
