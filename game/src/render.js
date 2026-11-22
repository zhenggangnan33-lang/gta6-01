// VERDE BAY rendering: canvas world, lighting, HUD, minimap, screens.
// Screen-space layout keeps the HUD clear of itself: WANTED top-left,
// minimap top-right, objective bottom-left, money/health bottom-right.
import { CFG } from './config.js';
import { currentObjective, missionName } from './world.js';

export function cameraFor(w, viewW, viewH) {
  const x = Math.max(0, Math.min(CFG.WORLD_W - viewW, w.player.x - viewW / 2));
  const y = Math.max(0, Math.min(CFG.WORLD_H - viewH, w.player.y - viewH / 2));
  return { x, y };
}

function lighting(w) {
  // time 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = night.
  const t = w.time;
  if (t < 0.2 || (t >= 0.3 && t < 0.45)) return { color: null, alpha: 0 };
  if (t >= 0.45 && t < 0.6) return { color: '255,140,40', alpha: 0.16 }; // dusk
  if (t >= 0.6 && t < 0.9) return { color: '10,20,60', alpha: 0.34 }; // night
  return { color: '255,170,90', alpha: 0.1 }; // dawn
}

function drawCarShape(ctx, x, y, angle, color, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-24, -10, 48, 24);
  ctx.fillStyle = color;
  roundRect(ctx, -22, -11, 44, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(2, -8, 10, 16); // windshield
  ctx.fillRect(-14, -8, 8, 16); // rear window
  if (kind === 'police') {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-6, -11, 12, 22); // white doors
    ctx.fillStyle = '#20242a';
    ctx.fillRect(-6, -11, 12, 4);
    ctx.fillRect(-6, 7, 12, 4);
  }
  if (kind === 'sport') {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-20, -11, 4, 22);
  }
  if (kind === 'van') {
    ctx.fillStyle = '#555b62';
    ctx.fillRect(-22, -11, 14, 22);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, w, viewW, viewH) {
  const cam = cameraFor(w, viewW, viewH);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Ground.
  ctx.fillStyle = CFG.COLORS.grass;
  ctx.fillRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
  // Beach and water (east edge).
  ctx.fillStyle = CFG.COLORS.beach;
  ctx.fillRect(CFG.BEACH_X, 0, CFG.WORLD_W - CFG.BEACH_X, CFG.WORLD_H);
  ctx.fillStyle = CFG.COLORS.water;
  ctx.fillRect(CFG.WATER_X, 0, CFG.WORLD_W - CFG.WATER_X, CFG.WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const waveOff = (w.stats.playTime * 12) % 24;
  for (let y = -24; y < CFG.WORLD_H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(CFG.WATER_X + 6, y + waveOff);
    ctx.lineTo(CFG.WATER_X + 26, y + waveOff);
    ctx.stroke();
  }
  // Marina water basin.
  ctx.fillStyle = '#1a5f8a';
  ctx.fillRect(CFG.MARINA.x, CFG.MARINA.y, CFG.MARINA.w, CFG.MARINA.h);

  // Roads: sidewalk border, then asphalt, then centre dashes.
  ctx.fillStyle = CFG.COLORS.sidewalk;
  for (const rx of CFG.ROAD_X) ctx.fillRect(rx - CFG.ROAD_HALF - 8, 0, (CFG.ROAD_HALF + 8) * 2, CFG.WORLD_H);
  for (const ry of CFG.ROAD_Y) ctx.fillRect(0, ry - CFG.ROAD_HALF - 8, CFG.WORLD_W, (CFG.ROAD_HALF + 8) * 2);
  ctx.fillStyle = CFG.COLORS.road;
  for (const rx of CFG.ROAD_X) ctx.fillRect(rx - CFG.ROAD_HALF, 0, CFG.ROAD_HALF * 2, CFG.WORLD_H);
  for (const ry of CFG.ROAD_Y) ctx.fillRect(0, ry - CFG.ROAD_HALF, CFG.WORLD_W, CFG.ROAD_HALF * 2);
  ctx.strokeStyle = CFG.COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const rx of CFG.ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, CFG.WORLD_H);
    ctx.stroke();
  }
  for (const ry of CFG.ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(CFG.WORLD_W, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Parking lots / garage forecourt.
  for (const lot of w.city.lots) {
    ctx.fillStyle = lot.kind === 'garage' ? '#4a4a44' : '#555550';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 34; x < lot.x + lot.w - 20; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, lot.y + 8);
      ctx.lineTo(x, lot.y + 34);
      ctx.stroke();
    }
    if (lot.kind === 'garage') {
      ctx.fillStyle = '#c9a227';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('SOLANO GARAGE', lot.x + 60, lot.y + lot.h - 16);
    }
  }
  // Park.
  const pk = CFG.PARK;
  ctx.fillStyle = '#2f6b2c';
  ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  for (const t of w.city.trees) {
    ctx.fillStyle = CFG.COLORS.parkTree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pier.
  const pier = CFG.PIER;
  ctx.fillStyle = CFG.COLORS.pier;
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  for (let x = pier.x + 12; x < pier.x + pier.w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, pier.y);
    ctx.lineTo(x, pier.y + pier.h);
    ctx.stroke();
  }

  // Buildings with shadows and windows.
  for (const b of w.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = 'rgba(255,240,180,0.75)';
    for (let wx = b.x + 14; wx < b.x + b.w - 12; wx += 26) {
      for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 26) {
        ctx.fillRect(wx, wy, 10, 12);
      }
    }
  }
  // Yacht at the marina.
  ctx.fillStyle = '#f0f0f0';
  roundRect(ctx, CFG.MARINA.yachtX - 46, CFG.MARINA.yachtY - 14, 92, 28, 10);
  ctx.fill();
  ctx.fillStyle = '#b03a2e';
  ctx.fillRect(CFG.MARINA.yachtX - 20, CFG.MARINA.yachtY - 22, 40, 10);

  // Mission drops.
  if (w.missionIdx === 3) {
    for (const d of w.missionState.drops || []) {
      if (d.got) continue;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('$', d.x - 4, d.y + 5);
    }
  }
  // Objective marker (pulsing ring).
  const obj = currentObjective(w);
  if (w.state === 'play' && obj) {
    const pulse = 10 + Math.sin(w.stats.playTime * 4) * 4;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, CFG.MARKER_R * 0.55 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pedestrians.
  for (const ped of w.peds) {
    if (ped.down > 0) {
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cars (civilian + van).
  for (const c of w.cars) {
    if (c.wrecked) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = '#1c1c1c';
      roundRect(ctx, -22, -11, 44, 22, 6);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, c.x, c.y, c.angle, c.color, c.kind);
    if (c.health < 90) {
      ctx.fillStyle = 'rgba(100,100,100,0.6)';
      ctx.beginPath();
      ctx.arc(c.x - 10, c.y - 10, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Police.
  for (const c of w.police) {
    if (c.wrecked) continue;
    drawCarShape(ctx, c.x, c.y, c.angle, c.color, 'police');
    const blink = Math.floor(w.stats.playTime * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e7bff';
    ctx.beginPath();
    ctx.arc(c.x - Math.cos(c.angle) * 4, c.y - Math.sin(c.angle) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roadblock cones.
  for (const rb of w.roadblocks) {
    ctx.fillStyle = '#ff6a00';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(rb.x + i * 30, rb.y + 24, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Helicopter + shadow.
  if (w.heli.active) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(w.heli.x + 26, w.heli.y + 30, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2f36';
    ctx.beginPath();
    ctx.ellipse(w.heli.x, w.heli.y, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    const rot = w.stats.playTime * 14;
    ctx.beginPath();
    ctx.moveTo(w.heli.x - Math.cos(rot) * 34, w.heli.y - Math.sin(rot) * 34);
    ctx.lineTo(w.heli.x + Math.cos(rot) * 34, w.heli.y + Math.sin(rot) * 34);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,200,0.12)';
    ctx.beginPath();
    ctx.arc(w.heli.x, w.heli.y + 60, 60, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const p = w.player;
  if (!p.car) {
    ctx.fillStyle = '#e8b13c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, CFG.PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, '#e8b13c', p.car.kind === 'police' ? 'police' : p.car.kind);
  }
  // Health bar above the player on foot.
  if (!p.car && p.health < CFG.PLAYER_HEALTH) {
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - 16, p.y - 24, 32, 5);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(p.x - 16, p.y - 24, 32 * (p.health / CFG.PLAYER_HEALTH), 5);
  }
  // Particles.
  for (const pt of w.particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Lighting overlay.
  const light = lighting(w);
  if (light.color) {
    ctx.fillStyle = `rgba(${light.color},${light.alpha})`;
    ctx.fillRect(cam.x, cam.y, viewW, viewH);
  }
  // Headlight cone at night when driving.
  if (light.alpha > 0.3 && p.car) {
    const hx = p.car.x + Math.cos(p.car.angle) * 120;
    const hy = p.car.y + Math.sin(p.car.angle) * 120;
    const grad = ctx.createRadialGradient(hx, hy, 10, hx, hy, 150);
    grad.addColorStop(0, 'rgba(255,250,200,0.20)');
    grad.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, 150, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return cam;
}

function drawMinimap(ctx, w, viewW) {
  const mw = 200;
  const mh = 150;
  const x0 = viewW - mw - 14;
  const y0 = 14;
  const sx = mw / CFG.WORLD_W;
  const sy = mh / CFG.WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, mw, mh);
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  for (const rx of CFG.ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + mh);
    ctx.stroke();
  }
  for (const ry of CFG.ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + mw, y0 + ry * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#1d6f9e';
  ctx.fillRect(x0 + CFG.WATER_X * sx, y0, (CFG.WORLD_W - CFG.WATER_X) * sx, mh);
  const obj = currentObjective(w);
  if (obj && w.state === 'play') {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x0 + obj.x * sx, y0 + obj.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of w.police) {
    if (c.wrecked) continue;
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + w.player.x * sx, y0 + w.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHUD(ctx, w, viewW, viewH) {
  const p = w.player;
  ctx.textBaseline = 'top';
  // WANTED + stars, top-left.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(14, 14, 190, 44);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('WANTED', 24, 22);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < w.stars ? '#ffd700' : 'rgba(255,255,255,0.25)';
    const sx = 104 + i * 17;
    ctx.beginPath();
    ctx.moveTo(sx, 24);
    ctx.lineTo(sx + 4, 32);
    ctx.lineTo(sx + 12, 32);
    ctx.lineTo(sx + 6, 37);
    ctx.lineTo(sx + 9, 45);
    ctx.lineTo(sx, 40);
    ctx.lineTo(sx - 9, 45);
    ctx.lineTo(sx - 6, 37);
    ctx.lineTo(sx - 12, 32);
    ctx.lineTo(sx - 4, 32);
    ctx.closePath();
    ctx.fill();
  }
  drawMinimap(ctx, w, viewW);
  // Objective panel, bottom-left.
  const obj = currentObjective(w);
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(14, viewH - 76, 420, 62);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${w.missionIdx + 1}/8  ${missionName(w)}`, 24, viewH - 68);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(obj ? obj.label : '', 24, viewH - 46);
  // Money / respect / health, bottom-right.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(viewW - 214, viewH - 76, 200, 62);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`$${p.money}`, viewW - 204, viewH - 68);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Respect ${p.respect}`, viewW - 204, viewH - 44);
  if (p.car) {
    ctx.fillStyle = '#e8b13c';
    ctx.fillText(`Car ${Math.max(0, Math.round(p.car.health))}  ${Math.round(Math.abs(p.car.speed) * 0.24)} mph`, viewW - 204, viewH - 26);
  } else {
    ctx.fillStyle = '#e8b13c';
    ctx.fillText(`Health ${Math.max(0, Math.round(p.health))}`, viewW - 204, viewH - 26);
  }
  // Banner.
  if (w.banner && w.bannerT > 0) {
    ctx.font = 'bold 19px sans-serif';
    const tw = ctx.measureText(w.banner).width;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect((viewW - tw) / 2 - 14, 66, tw + 28, 34);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(w.banner, (viewW - tw) / 2, 74);
  }
  // Off-screen objective arrow.
  if (w.state === 'play' && obj) {
    const cam = cameraFor(w, viewW, viewH);
    const sx = obj.x - cam.x;
    const sy = obj.y - cam.y;
    if (sx < 0 || sx > viewW || sy < 0 || sy > viewH) {
      const cx = viewW / 2;
      const cy = viewH / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ax = cx + Math.cos(ang) * (viewW / 2 - 70);
      const ay = cy + Math.sin(ang) * (viewH / 2 - 70);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // Garage shop overlay.
  if (w.shopOpen) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#11161c';
    ctx.fillRect(viewW / 2 - 220, viewH / 2 - 130, 440, 260);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewW / 2 - 220, viewH / 2 - 130, 440, 260);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('SOLANO GARAGE', viewW / 2 - 100, viewH / 2 - 112);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    CFG.SHOP.forEach((item, i) => {
      const owned = w.upgrades[item.id];
      const y = viewH / 2 - 70 + i * 44;
      ctx.fillStyle = owned ? '#2ecc71' : '#fff';
      ctx.fillText(`[${item.key}] ${item.name} — $${item.price}${owned ? '  OWNED' : ''}`, viewW / 2 - 190, y);
    });
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Your money: $${p.money}    (G to close)`, viewW / 2 - 190, viewH / 2 + 76);
  }
}

export function drawScreen(ctx, w, viewW, viewH, kind, lines) {
  ctx.fillStyle = 'rgba(6,10,16,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(kind, viewW / 2, viewH / 2 - 120);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, viewW / 2, viewH / 2 - 40 + i * 34);
  });
  ctx.textAlign = 'left';
}
