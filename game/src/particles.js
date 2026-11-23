// Particles for VERDE BAY v2: exhaust puffs, crash sparks, damage
// smoke and skid marks. One fixed-size pool, no allocations in the
// hot loop. Skid marks are persistent decals drawn under the cars.

const MAX = 420;

export function createParticles() {
  const pool = [];
  for (let i = 0; i < MAX; i++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', grow: 0, fade: true });
  }
  const skids = []; // {x, y, angle} — capped, oldest dropped
  let cursor = 0;

  function spawn(x, y, vx, vy, life, size, color, grow) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.color = color; p.grow = grow || 0;
  }

  const api = {
    count() { let n = 0; for (const p of pool) if (p.alive) n++; return n; },
    skidCount() { return skids.length; },

    // A short burst of sparks/debris.
    burst(x, y, n, color, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.3 + Math.random() * 0.7) * (speed || 120);
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.4, 2 + Math.random() * 2.5, color, 0);
      }
    },

    // One grey exhaust puff from the tailpipe.
    puff(x, y, n) {
      for (let i = 0; i < (n || 1); i++) {
        spawn(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22,
          0.5 + Math.random() * 0.3, 4 + Math.random() * 3, 'rgba(160,160,170,0.5)', 9);
      }
    },

    // Damage smoke, rising and expanding.
    smoke(x, y, n) {
      for (let i = 0; i < (n || 1); i++) {
        spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 12, -22 - Math.random() * 18,
          0.9 + Math.random() * 0.5, 6 + Math.random() * 4, 'rgba(90,90,95,0.55)', 12);
      }
    },

    // A skid mark decal at the rear axle.
    skid(x, y, angle) {
      if (skids.length > 0) {
        const last = skids[skids.length - 1];
        if ((last.x - x) ** 2 + (last.y - y) ** 2 < 100) return; // too close to the last one
      }
      skids.push({ x, y, angle });
      if (skids.length > 400) skids.shift();
    },

    update(dt) {
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96; p.vy *= 0.96;
        if (p.grow) p.size += p.grow * dt;
      }
    },

    draw(ctx) {
      // Skid marks first, under everything else.
      ctx.fillStyle = 'rgba(20,20,25,0.45)';
      for (const s of skids) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.fillRect(-7, -2.5, 14, 5);
        ctx.restore();
      }
      for (const p of pool) {
        if (!p.alive) continue;
        const a = p.fade ? p.life / p.max : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
  return api;
}
