// Canvas rendering for VERDE BAY v2: camera, world, HUD and minimap.
// v2 adds: view culling (off-camera buildings, parks and lots are
// skipped), neon landmark signs at dusk/night, beach umbrellas and
// palms, particle rendering, a police count on the HUD, and stash
// markers on the minimap. Cars, pedestrians and the helicopter are
// drawn with simple shapes plus a shadow, so the game reads at speed.

import { CFG, MISSION_REWARDS } from './config.js';

const C = CFG.colors;
const T = CFG.tuning;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const r = {
    cam: { x: 0, y: 0, zoom: 1 },
    flashT: 0,
  };

  // Daylight tint by time of day: warm noon, orange dusk, dark night.
  function lightFor(time) {
    if (time >= 7 && time < 17.5) return { sky: C.skyDay, amb: 0 };
    if (time >= 17.5 && time < 19.5) {
      const k = (time - 17.5) / 2;
      return { sky: C.skyDusk, amb: k * 0.32, dusk: true };
    }
    if (time >= 19.5 || time < 5) return { sky: C.skyNight, amb: 0.52, night: true };
    const k = (time - 5) / 2;
    return { sky: C.skyDusk, amb: 0.32 * (1 - k), dusk: true };
  }

  r.draw = (w, dt) => {
    const W = canvas.width, H = canvas.height;
    const p = w.player;
    const light = lightFor(w.time);
    const night = !!light.night, dusk = !!light.dusk;

    // Camera follows the player, clamped to the world.
    const zoom = Math.min(W / 900, H / 560);
    r.cam.zoom = zoom;
    r.cam.x = Math.max(0, Math.min(CFG.world.w - W / zoom, p.x - W / zoom / 2));
    r.cam.y = Math.max(0, Math.min(CFG.world.h - H / zoom, p.y - H / zoom / 2));
    const vx0 = r.cam.x - 60, vy0 = r.cam.y - 60, vx1 = r.cam.x + W / zoom + 60, vy1 = r.cam.y + H / zoom + 60;
    const visible = (x, y, m) => x + m > vx0 && x - m < vx1 && y + m > vy0 && y - m < vy1;

    ctx.fillStyle = light.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-r.cam.x, -r.cam.y);

    // Ground: grass, then sand, then water.
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, 0, CFG.world.w, CFG.beachY);
    ctx.fillStyle = C.sand;
    ctx.fillRect(0, CFG.beachY, CFG.world.w, CFG.world.h - CFG.beachY);
    const m = CFG.marina;
    ctx.fillStyle = C.sea;
    ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
    // Marina docks.
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(m.x0 + 60, m.y0 + 40, 240, 10);
    ctx.fillRect(m.x0 + 60, m.y0 + 130, 240, 10);

    // Beach umbrellas and palm trees.
    for (const bp of w.city.beachProps) {
      if (!visible(bp.x, bp.y, 30)) continue;
      if (bp.umbrella) {
        ctx.fillStyle = bp.hue;
        ctx.beginPath(); ctx.arc(bp.x, bp.y, 13, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(bp.x, bp.y + 16); ctx.stroke();
      } else {
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bp.x, bp.y + 14); ctx.lineTo(bp.x, bp.y - 8); ctx.stroke();
        ctx.fillStyle = '#3f8f4f';
        for (let f = 0; f < 5; f++) {
          const a = (f / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(bp.x + Math.cos(a) * 9, bp.y - 8 + Math.sin(a) * 5, 9, 3.5, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Parks and lots (culled).
    for (const park of w.city.parks) {
      if (!visible(park.x + park.w / 2, park.y + park.h / 2, Math.max(park.w, park.h) / 2)) continue;
      ctx.fillStyle = park.plaza ? '#5a8f5f' : C.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#3f7a45';
      for (const [tx, ty, tr] of park.trees) {
        ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
      }
      if (park.plaza) {
        ctx.fillStyle = '#c8b890';
        ctx.beginPath(); ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 16, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const lot of w.city.lots) {
      if (!visible(lot.x + lot.w / 2, lot.y + lot.h / 2, Math.max(lot.w, lot.h) / 2)) continue;
      ctx.fillStyle = '#55555c';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 22; x < lot.x + lot.w - 10; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, lot.y + 8); ctx.lineTo(x, lot.y + 34); ctx.stroke();
      }
    }

    // Roads.
    ctx.fillStyle = C.asphalt;
    for (const rx of CFG.roadsX) ctx.fillRect(rx - CFG.roadHalf, 0, CFG.roadHalf * 2, CFG.beachY);
    for (const ry of CFG.roadsY) ctx.fillRect(0, ry - CFG.roadHalf, CFG.world.w, CFG.roadHalf * 2);
    // Centre dashes.
    ctx.strokeStyle = 'rgba(240,220,120,0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    for (const rx of CFG.roadsX) {
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, CFG.beachY); ctx.stroke();
    }
    for (const ry of CFG.roadsY) {
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(CFG.world.w, ry); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Buildings (culled) with a roof and a shadow edge.
    for (const b of w.city.buildings) {
      if (!visible(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) / 2)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      if (b.tall === 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      }
      if (b.stadium) {
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 16, b.h / 2 - 14, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Landmark labels and neon signs.
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const drawnLabels = [];
    for (const key of Object.keys(CFG.places)) {
      const pl = CFG.places[key];
      if (!visible(pl.at[0], pl.at[1], 120)) continue;
      // At dusk/night the neon sign IS the label: skip the pill so the
      // two never print on top of each other.
      const labelY = pl.at[1] - pl.r - 12;
      if ((dusk || night) && CFG.neon.some((n) => Math.abs(n.x - pl.at[0]) < 90 && Math.abs(n.y - labelY) < 46)) continue;
      // Skip a label that would print on top of one already drawn
      // (the Docks / Yacht La Rosa pair sits 60 px apart).
      if (drawnLabels.some(([x, y]) => Math.abs(x - pl.at[0]) < 110 && Math.abs(y - labelY) < 26)) continue;
      drawnLabels.push([pl.at[0], labelY]);
      ctx.fillStyle = 'rgba(20,20,26,0.65)';
      const tw = ctx.measureText(pl.name).width;
      ctx.fillRect(pl.at[0] - tw / 2 - 6, pl.at[1] - pl.r - 26, tw + 12, 20);
      ctx.fillStyle = '#f2ead8';
      ctx.fillText(pl.name, pl.at[0], pl.at[1] - pl.r - 12);
    }
    // Neon signs glow at dusk and night.
    if (dusk || night) {
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.font = 'bold 22px system-ui, sans-serif';
      for (const n of CFG.neon) {
        if (!visible(n.x, n.y, 80)) continue;
        ctx.shadowColor = n.color;
        ctx.fillStyle = n.color;
        ctx.fillText(n.text, n.x, n.y);
      }
      ctx.restore();
    }

    // Mission markers: cash bags and the yacht.
    const md = w.missionData;
    if (md.bags) {
      for (const bag of md.bags) {
        if (bag.taken) continue;
        ctx.fillStyle = '#2fae4e';
        ctx.beginPath(); ctx.arc(bag.x, bag.y, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('$', bag.x, bag.y + 5);
      }
    }
    if (w.missionIdx === 7 && w.missionPhase === 1) {
      const y = CFG.places.yacht.at;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(y[0], y[1] - 18); ctx.lineTo(y[0] + 10, y[1]); ctx.lineTo(y[0], y[1] + 18); ctx.lineTo(y[0] - 10, y[1]); ctx.closePath(); ctx.fill();
    }

    // Hidden stashes (small green glint, only when close — they are hidden).
    for (const s of w.stashes) {
      if (s.taken) continue;
      if (dist(p.x, p.y, s.x, s.y) > 260) continue;
      ctx.fillStyle = 'rgba(126,231,135,0.9)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#123';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('$', s.x, s.y + 3);
    }

    // Skid marks and particles, under the cars.
    w.particles.draw(ctx);

    // Cars.
    for (const car of w.cars) {
      if (car.wrecked) continue;
      if (!visible(car.x, car.y, 60)) continue;
      drawCar(ctx, car, night);
    }
    // Wrecked cars as burnt husks.
    for (const car of w.cars) {
      if (!car.wrecked) continue;
      if (!visible(car.x, car.y, 60)) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#2c2c30';
      ctx.fillRect(-20, -11, 40, 22);
      ctx.fillStyle = '#151517';
      ctx.fillRect(-12, -8, 18, 16);
      ctx.restore();
    }

    // Pedestrians.
    for (const ped of w.peds) {
      if (!visible(ped.x, ped.y, 30)) continue;
      ctx.save();
      ctx.translate(ped.x, ped.y);
      if (ped.down > 0) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = ped.color;
        ctx.fillRect(-8, -5, 16, 10);
      } else {
        const bob = Math.sin(w.stats.playSeconds * 9 + ped.x) * 1.5;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(0, 5, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ped.color;
        ctx.beginPath(); ctx.arc(0, -2 + bob * 0.3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-4, 2, 8, 10);
        ctx.fillStyle = '#222';
        ctx.fillRect(-4, 10, 3, 5); ctx.fillRect(1, 10, 3, 5);
      }
      ctx.restore();
    }

    // Player on foot.
    if (!p.car) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const bob = p.speed > 0 ? Math.sin(p.walkPhase) * 2 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 6, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(p.angle);
      ctx.fillStyle = '#e8b64c';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = '#f2c98a';
      ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
      if (p.punchT > 0) {
        ctx.fillStyle = '#f2c98a';
        ctx.beginPath(); ctx.arc(16, 0, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // Helicopter with a searchlight cone.
    if (w.heli.active) {
      ctx.save();
      ctx.translate(w.heli.x, w.heli.y);
      ctx.fillStyle = 'rgba(255,244,180,0.10)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(p.x - w.heli.x - 40, p.y - w.heli.y - 40);
      ctx.lineTo(p.x - w.heli.x + 40, p.y - w.heli.y + 40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 6, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2c3440';
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2c3440'; ctx.lineWidth = 3;
      const ra = w.heli.angle;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra) * -22, Math.sin(ra) * -22);
      ctx.lineTo(Math.cos(ra) * 22, Math.sin(ra) * 22);
      ctx.moveTo(Math.cos(ra + Math.PI / 2) * -22, Math.sin(ra + Math.PI / 2) * -22);
      ctx.lineTo(Math.cos(ra + Math.PI / 2) * 22, Math.sin(ra + Math.PI / 2) * 22);
      ctx.stroke();
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Objective arrow at the screen edge.
    const obj = w.objective();
    if (obj && w.state === 'playing') {
      const dx = obj.x - p.x, dy = obj.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 130) {
        const a = Math.atan2(dy, dx);
        const ex = p.x + Math.cos(a) * 110, ey = p.y + Math.sin(a) * 110;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd24d';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd24d';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(obj.label + '  ' + Math.round(d) + 'm', ex, ey - 18);
      }
    }

    // Dusk/night darkness overlay.
    if (light.amb > 0) {
      ctx.fillStyle = 'rgba(8,10,28,' + light.amb + ')';
      ctx.fillRect(r.cam.x, r.cam.y, W / zoom, H / zoom);
    }

    ctx.restore();

    // ---- HUD (screen space) ----
    drawHUD(ctx, w, W, H, light);
  };

  function drawCar(ctx, car, night) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 20, 11, car.angle, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(car.angle);
    const len = car.model === 'truck' ? 52 : car.model === 'van' ? 46 : 40;
    const wid = car.model === 'truck' ? 26 : 22;
    ctx.fillStyle = car.color;
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-len / 2 + 4, -wid / 2, 8, wid);
    // Cabin.
    ctx.fillStyle = '#1d2733';
    if (car.model === 'truck') {
      ctx.fillRect(-len / 2 + 6, -wid / 2 + 3, 14, wid - 6);
      ctx.fillStyle = '#c8ccd2';
      ctx.fillRect(len / 2 - 16, -wid / 2 + 2, 12, wid - 4);
    } else {
      ctx.fillRect(-6, -wid / 2 + 3, 14, wid - 6);
    }
    // Headlights at night.
    if (night && Math.abs(car.speed) > 20) {
      ctx.fillStyle = 'rgba(255,244,180,0.75)';
      ctx.beginPath(); ctx.arc(len / 2 + 3, -wid / 2 + 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(len / 2 + 3, wid / 2 - 4, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police light bar.
    if (car.police) {
      const t = performance.now() / 300;
      ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff3b30' : '#2e6bff';
      ctx.fillRect(-4, -wid / 2 - 2, 8, 4);
      ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#2e6bff' : '#ff3b30';
      ctx.fillRect(-4, wid / 2 - 2, 8, 4);
    }
    // Convoy truck markings.
    if (car.convoy) {
      ctx.fillStyle = '#e8c832';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ARMORED', 0, 3);
    }
    // Health bar for a damaged player car.
    if (car.health < car.maxHealth * 0.6) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-18, -wid / 2 - 8, 36, 4);
      ctx.fillStyle = car.health < car.maxHealth * 0.3 ? '#ff3b30' : '#ffd24d';
      ctx.fillRect(-18, -wid / 2 - 8, 36 * (car.health / car.maxHealth), 4);
    }
    ctx.restore();
  }

  function drawHUD(ctx, w, W, H, light) {
    const p = w.player;
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px system-ui, sans-serif';

    // Top-left: cash, respect, stashes.
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.fillRect(10, 10, 240, 66);
    ctx.fillStyle = '#7ee787';
    ctx.fillText('$' + p.money.toLocaleString(), 20, 32);
    ctx.fillStyle = '#ffd24d';
    ctx.fillText('Respect ' + p.respect, 20, 54);
    ctx.fillStyle = '#8fd3ff';
    ctx.fillText('Stashes ' + w.stats.stashes + '/' + w.stashes.length, 140, 54);

    // Wanted stars + police count, top-right.
    const cops = w.police.filter((c) => !c.wrecked).length;
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.fillRect(W - 210, 10, 200, 40);
    ctx.fillStyle = '#ffd24d';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < w.stars ? '★' : '☆';
    ctx.fillText(stars, W - 200, 36);
    ctx.fillStyle = '#ff8a80';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(cops > 0 ? cops + ' units' : '', W - 110, 36);
    ctx.font = 'bold 16px system-ui, sans-serif';

    // Health bar, bottom-left.
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.fillRect(10, H - 56, 200, 46);
    ctx.fillStyle = '#fff';
    ctx.fillText('Health', 18, H - 36);
    ctx.fillStyle = '#333';
    ctx.fillRect(90, H - 48, 110, 12);
    ctx.fillStyle = p.health > 40 ? '#7ee787' : '#ff3b30';
    ctx.fillRect(90, H - 48, 110 * (p.health / p.maxHealth), 12);
    if (p.car) {
      ctx.fillStyle = '#fff';
      ctx.fillText('Car', 18, H - 18);
      ctx.fillStyle = '#333';
      ctx.fillRect(90, H - 30, 110, 12);
      ctx.fillStyle = p.car.health > p.car.maxHealth * 0.4 ? '#7ee787' : '#ff3b30';
      ctx.fillRect(90, H - 30, 110 * (p.car.health / p.car.maxHealth), 12);
    }

    // Mission panel, bottom-centre.
    ctx.fillStyle = 'rgba(10,12,18,0.65)';
    const mw = 420;
    ctx.fillRect(W / 2 - mw / 2, H - 58, mw, 48);
    ctx.fillStyle = '#ffd24d';
    ctx.textAlign = 'center';
    ctx.fillText('Mission ' + (w.missionIdx + 1) + '/8 — ' + w.missionName(), W / 2, H - 38);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(w.missionBrief(), W / 2, H - 20);
    ctx.font = 'bold 16px system-ui, sans-serif';

    // Clock + radio, top-centre.
    const hh = Math.floor(w.time) % 24;
    const mm = Math.floor((w.time % 1) * 60);
    const clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.fillRect(W / 2 - 110, 10, 220, 28);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(clock + '  ·  ' + CFG.radio[w.station].name, W / 2, 29);

    // Messages.
    ctx.textAlign = 'left';
    ctx.font = '14px system-ui, sans-serif';
    w.messages.forEach((msg, i) => {
      ctx.globalAlpha = Math.min(1, msg.t);
      ctx.fillStyle = 'rgba(10,12,18,0.75)';
      const tw = ctx.measureText(msg.text).width;
      ctx.fillRect(10, 90 + i * 26, tw + 16, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg.text, 18, 106 + i * 26);
      ctx.globalAlpha = 1;
    });

    // Minimap, bottom-right.
    const ms = 150;
    const mx = W - ms - 10, my = H - ms - 10;
    const sc = ms / CFG.world.w;
    ctx.fillStyle = 'rgba(10,12,18,0.75)';
    ctx.fillRect(mx - 4, my - 4, ms + 8, ms + 8);
    ctx.fillStyle = '#1d2b1d';
    ctx.fillRect(mx, my, ms, ms);
    ctx.fillStyle = '#3a3a40';
    for (const rx of CFG.roadsX) ctx.fillRect(mx + rx * sc - 1, my, 2, ms);
    for (const ry of CFG.roadsY) ctx.fillRect(mx, my + ry * sc, ms, 2);
    ctx.fillStyle = '#2f6fb5';
    ctx.fillRect(mx + CFG.marina.x0 * sc, my + CFG.marina.y0 * sc, (CFG.marina.x1 - CFG.marina.x0) * sc, (CFG.marina.y1 - CFG.marina.y0) * sc);
    ctx.fillStyle = '#ffd24d';
    const obj = w.objective();
    if (obj) {
      ctx.beginPath(); ctx.arc(mx + obj.x * sc, my + obj.y * sc, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#7ee787';
    for (const s of w.stashes) {
      if (!s.taken) ctx.fillRect(mx + s.x * sc - 1.5, my + s.y * sc - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ff3b30';
    for (const cop of w.police) {
      if (!cop.wrecked) {
        ctx.beginPath(); ctx.arc(mx + cop.x * sc, my + cop.y * sc, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (w.heli.active) {
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.arc(mx + w.heli.x * sc, my + w.heli.y * sc, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(mx + p.x * sc, my + p.y * sc, 3.5, 0, Math.PI * 2); ctx.fill();

    // Controls hint, bottom-left above the health bar (kept clear of
    // the minimap at bottom-right; the title screen already prints
    // its own controls, so it is hidden there).
    if (w.state !== 'title') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('WASD drive · E enter/exit · F punch · G garage · R radio · M mute · P pause', 14, H - ms - 22);
    }

    // State overlays.
    if (w.state === 'title') drawTitle(ctx, w, W, H);
    if (w.state === 'paused') drawCenter(ctx, W, H, 'PAUSED', 'Press P to resume. Missions, money and respect are saved.');
    if (w.state === 'busted') drawCenter(ctx, W, H, 'BUSTED!', 'The Verde Bay PD hauled you in. Press ENTER to get out — it will cost you ' + (T.bustPenalty * 100) + '% of your cash.');
    if (w.state === 'wasted') drawCenter(ctx, W, H, 'WASTED', 'Rico is down. Press ENTER to get back up at La Rosa House.');
    if (w.state === 'win') drawCenter(ctx, W, H, 'KING OF VERDE BAY', 'All 8 missions done. $' + p.money.toLocaleString() + ' banked, ' + p.respect + ' respect, ' + w.stats.stashes + '/10 stashes. Press ENTER to keep playing.');
    if (w.shop.open) drawShop(ctx, w, W, H);
  }

  function drawCenter(ctx, W, H, title, sub) {
    ctx.fillStyle = 'rgba(5,6,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 26);
  }

  function drawTitle(ctx, w, W, H) {
    ctx.fillStyle = 'rgba(5,6,12,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('VERDE BAY', W / 2, H / 2 - 90);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('A tiny open-world crime story', W / 2, H / 2 - 56);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Dante Vega. Wheelman for La Rosa. Eight missions. One city that never sleeps.', W / 2, H / 2 - 26);
    if (w.saveInfo) {
      ctx.fillStyle = '#8fd3ff';
      ctx.fillText('Save found — $' + w.saveInfo.money.toLocaleString() + ', ' + w.saveInfo.respect + ' respect, mission ' + (w.saveInfo.missionIdx + 1) + '/8, ' + w.saveInfo.stashes + '/10 stashes.', W / 2, H / 2 + 4);
    }
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press ENTER to start', W / 2, H / 2 + 44);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD drive and walk · E enter / exit car · F punch · G garage shop · R radio · M mute · P pause', W / 2, H / 2 + 74);
    ctx.fillText('Steal cars, lose the cops, finish all eight missions — and grab the 10 hidden stashes.', W / 2, H / 2 + 96);
  }

  function drawShop(ctx, w, W, H) {
    ctx.fillStyle = 'rgba(5,6,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('VEGA MOTORS — GARAGE SHOP', W / 2, H / 2 - 90);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    const rows = [
      ['1', 'Armor plating', '$' + T.shop.armor, w.upgrades.armor],
      ['2', 'Turbocharger', '$' + T.shop.turbo, w.upgrades.turbo],
      ['3', 'Racing tires', '$' + T.shop.tires, w.upgrades.tires],
    ];
    rows.forEach(([key, name, price, owned], i) => {
      const y = H / 2 - 50 + i * 34;
      ctx.fillStyle = owned ? '#7ee787' : '#fff';
      ctx.fillText('[' + key + ']  ' + name + '  —  ' + price + (owned ? '  (installed)' : ''), W / 2, y);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Cash: $' + w.player.money.toLocaleString() + '   ·   Press G or Esc to leave', W / 2, H / 2 + 70);
  }

  return r;
}

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
