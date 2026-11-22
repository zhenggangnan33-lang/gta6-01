// Canvas rendering for VERDE BAY: the city, the cars and people, the
// day/dusk/night lighting, the HUD with minimap, and every screen
// (title, pause, busted, wasted, win, garage shop). All art is drawn
// with canvas paths — no images, no external assets.

import { CFG } from './config.js';
import { MISSIONS } from './missions.js';

const C = CFG.colors;
const W = CFG.world.w, H = CFG.world.h;

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lightLevel(time) {
  // Returns {tint, alpha} for the fullscreen light overlay.
  if (time >= 7 && time < 16.5) return null; // full daylight
  if (time >= 16.5 && time < 19) return { color: '255,110,40', alpha: 0.13 + (time - 16.5) * 0.03 };
  if (time >= 19 || time < 5.5) return { color: '8,14,52', alpha: 0.42 };
  if (time >= 5.5 && time < 7) return { color: '255,150,80', alpha: 0.10 };
  return null;
}

export function drawWorld(ctx, w, vw, vh) {
  const p = w.player;
  // Camera follows the player, clamped to the world.
  const camX = Math.max(0, Math.min(W - vw, p.x - vw / 2));
  const camY = Math.max(0, Math.min(H - vh, p.y - vh / 2));
  ctx.save();
  ctx.translate(-camX, -camY);

  drawGround(ctx, w);
  drawRoads(ctx, w);
  drawCity(ctx, w);
  drawPickups(ctx, w);
  drawCars(ctx, w);
  drawPeds(ctx, w);
  drawPlayer(ctx, w);
  drawHeli(ctx, w);
  drawObjective(ctx, w);

  // Night / dusk light.
  const light = lightLevel(w.time);
  if (light) {
    ctx.fillStyle = `rgba(${light.color},${light.alpha})`;
    ctx.fillRect(camX, camY, vw, vh);
    if (light.color.startsWith('8,14')) {
      // Soft pool of light around the player at night.
      const g = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, 340);
      g.addColorStop(0, 'rgba(255,230,160,0.20)');
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 340, p.y - 340, 680, 680);
    }
  }
  ctx.restore();

  drawHud(ctx, w, vw, vh, camX, camY);
  if (w.state === 'title') drawTitle(ctx, w, vw, vh);
  else if (w.state === 'paused') drawPause(ctx, vw, vh);
  else if (w.state === 'busted') drawEnd(ctx, vw, vh, 'BUSTED', 'The Verde Bay PD hauled you in. Press Enter to get back out.');
  else if (w.state === 'wasted') drawEnd(ctx, vw, vh, 'WASTED', 'Dante went down. Press Enter to get back up.');
  else if (w.state === 'win') drawWin(ctx, w, vw, vh);
  if (w.shop.open) drawShop(ctx, w, vw, vh);
}

function drawGround(ctx, w) {
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, W, H);
  // Dry patches.
  ctx.fillStyle = C.grassDry;
  for (let i = 0; i < 24; i++) {
    const x = hash2(i, 7) * W, y = hash2(i, 13) * H;
    ctx.beginPath(); ctx.ellipse(x, y, 90 + hash2(i, 3) * 130, 50 + hash2(i, 5) * 70, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Beach along the south edge.
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, CFG.beachY, W, H - CFG.beachY);
  ctx.fillStyle = '#c9b078';
  for (let x = 0; x < W; x += 90) {
    ctx.beginPath(); ctx.ellipse(x + hash2(x, 1) * 40, CFG.beachY + 8, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Marina water (south-east corner).
  const m = CFG.marina;
  ctx.fillStyle = C.sea;
  ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
  ctx.strokeStyle = C.seaDeep;
  ctx.lineWidth = 3;
  for (let y = m.y0 + 30; y < m.y1; y += 46) {
    ctx.beginPath();
    for (let x = m.x0 + 12; x < m.x1 - 8; x += 26) {
      ctx.moveTo(x, y + Math.sin(x * 0.05 + y) * 4);
      ctx.lineTo(x + 14, y + Math.sin(x * 0.05 + y) * 4);
    }
    ctx.stroke();
  }
  // Docks + pier (wooden decks).
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(2300, 1620, 180, 16);
  ctx.fillRect(2380, 1700, 16, 130);
  ctx.fillRect(1980, 1852, 160, 18);
  // The yacht.
  const yx = CFG.places.yacht.at[0], yy = CFG.places.yacht.at[1];
  ctx.save();
  ctx.translate(yx, yy); ctx.rotate(-0.5);
  ctx.fillStyle = '#f2f2ee'; rr(ctx, -58, -16, 116, 32, 12); ctx.fill();
  ctx.fillStyle = '#2f6f8f'; rr(ctx, -30, -26, 52, 22, 8); ctx.fill();
  ctx.fillStyle = '#e8d44d'; ctx.fillRect(-58, -4, 116, 5);
  ctx.restore();
}

function drawRoads(ctx, w) {
  const { roadsX, roadsY, roadHalf } = CFG;
  ctx.fillStyle = C.asphalt;
  for (const x of roadsX) ctx.fillRect(x - roadHalf, 0, roadHalf * 2, CFG.beachY);
  for (const y of roadsY) ctx.fillRect(0, y - roadHalf, W, roadHalf * 2);
  // Sidewalk edging.
  ctx.fillStyle = C.sidewalk;
  for (const x of roadsX) {
    ctx.fillRect(x - roadHalf - 7, 0, 7, CFG.beachY);
    ctx.fillRect(x + roadHalf, 0, 7, CFG.beachY);
  }
  for (const y of roadsY) {
    ctx.fillRect(0, y - roadHalf - 7, W, 7);
    ctx.fillRect(0, y + roadHalf, W, 7);
  }
  // Centre dashes.
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const x of roadsX) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CFG.beachY); ctx.stroke();
  }
  for (const y of roadsY) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawCity(ctx, w) {
  const city = w.city;
  // Parks.
  for (const pk of city.parks) {
    ctx.fillStyle = pk.plaza ? C.plaza : C.park;
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    if (pk.plaza) {
      ctx.fillStyle = '#c9b18c';
      ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5d8a9a';
      ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 18, 0, Math.PI * 2); ctx.fill();
    }
    for (const [tx, ty, tr] of pk.trees) {
      ctx.fillStyle = '#2f5d2a';
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4c8a3d';
      ctx.beginPath(); ctx.arc(tx - 3, ty - 3, tr * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Parking lots.
  for (const lot of city.lots) {
    ctx.fillStyle = C.lot;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(232,212,77,0.7)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 24; x < lot.x + lot.w - 20; x += 46) {
      ctx.beginPath(); ctx.moveTo(x, lot.y + 8); ctx.lineTo(x, lot.y + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, lot.y + lot.h - 8); ctx.lineTo(x, lot.y + lot.h - 30); ctx.stroke();
    }
    if (lot.garage) {
      ctx.fillStyle = '#e8d44d';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VEGA MOTORS', lot.x + lot.w / 2, lot.y + 26);
      ctx.textAlign = 'left';
    }
  }
  // Buildings: wall, roof, windows.
  for (const b of city.buildings) {
    ctx.fillStyle = C.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (hash2(b.x + i * 31, b.y + j * 29) < 0.55) {
          ctx.fillRect(b.x + 10 + i * 32, b.y + 10 + j * 28, 14, 12);
        }
      }
    }
    if (b.stadium) {
      ctx.fillStyle = '#e8e8e8';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ESTADIO VERDE', b.x + b.w / 2, b.y + b.h / 2);
      ctx.textAlign = 'left';
    }
  }
}

function drawPickups(ctx, w) {
  const bags = w.missionData?.bags;
  if (!bags) return;
  for (const bag of bags) {
    if (bag.taken) continue;
    const bob = Math.sin(w.time * 6 + bag.x) * 3;
    ctx.fillStyle = '#1e6b34';
    ctx.beginPath(); ctx.arc(bag.x, bag.y + bob, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d44d';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', bag.x, bag.y + bob + 5);
    ctx.textAlign = 'left';
  }
}

function drawCarShape(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.model === 'truck' ? 62 : car.model === 'sports' ? 52 : 46;
  const wid = car.model === 'truck' ? 28 : 22;
  if (car.wrecked) ctx.globalAlpha = 0.75;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  rr(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 8); ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -len / 2, -wid / 2, len, wid, 8); ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.fillRect(len * 0.12, -wid / 2 + 3, 10, wid - 6);
  ctx.fillRect(-len * 0.32, -wid / 2 + 3, 8, wid - 6);
  if (car.model === 'truck') {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 3, 18, wid - 6);
  }
  if (car.police) {
    // Black-and-white doors + light bar.
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-6, -wid / 2 + 2, 14, wid - 4);
    const phase = Math.floor(t * 4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e5bff';
    ctx.fillRect(-2, -wid / 2 - 3, 8, 5);
    ctx.fillStyle = phase ? '#2e5bff' : '#ff2e2e';
    ctx.fillRect(-2, wid / 2 - 2, 8, 5);
  }
  if (car.sports) {
    ctx.fillStyle = '#ffd24d';
    ctx.fillRect(len / 2 - 10, -3, 8, 6); // spoiler hint
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(40,40,40,0.8)';
    ctx.beginPath(); ctx.arc(-len / 4, 0, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, w) {
  const t = w.time * 10 + performance.now() / 1000;
  for (const car of w.cars) drawCarShape(ctx, car, t);
  // Headlight cones at night (player car only, cheap).
  const light = lightLevel(w.time);
  if (light && w.player.car && !w.player.car.wrecked) {
    const car = w.player.car;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const g = ctx.createLinearGradient(20, 0, 260, 0);
    g.addColorStop(0, 'rgba(255,240,170,0.20)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(20, -8); ctx.lineTo(260, -70); ctx.lineTo(260, 70); ctx.lineTo(20, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawPeds(ctx, w) {
  for (const ped of w.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c9a0';
      ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, w) {
  const p = w.player;
  if (p.car) return; // drawn as the car
  const bob = Math.sin(p.walkPhase) * 2;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e7a4f'; // Dante's green jacket
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 7, 0, Math.PI * 2); ctx.fill();
  // Facing tick + punch arc.
  ctx.strokeStyle = '#2e7a4f';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 16, Math.sin(p.angle) * 16); ctx.stroke();
  if (p.punchT > 0) {
    ctx.strokeStyle = 'rgba(255,220,80,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 26, p.angle - 0.6, p.angle + 0.6); ctx.stroke();
  }
  ctx.restore();
}

function drawHeli(ctx, w) {
  const h = w.heli;
  if (!h.active) return;
  // Shadow on the ground, then the helicopter above the player.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(w.player.x, w.player.y, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
  // Spotlight.
  const g = ctx.createRadialGradient(w.player.x, w.player.y, 10, w.player.x, w.player.y, 130);
  g.addColorStop(0, 'rgba(255,250,200,0.20)');
  g.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(w.player.x, w.player.y, 130, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(4, 6, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke();
  ctx.restore();
}

function drawObjective(ctx, w) {
  const o = w.objective ? w.objective() : null;
  if (!o || w.state !== 'playing') return;
  const pulse = 1 + Math.sin(performance.now() / 280) * 0.12;
  ctx.save();
  ctx.strokeStyle = '#ffd24d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(o.x, o.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111';
  const labelW = ctx.measureText(o.label).width + 16;
  ctx.fillStyle = 'rgba(255,210,77,0.92)';
  rr(ctx, o.x - labelW / 2, o.y - 58, labelW, 22, 6); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillText(o.label, o.x, o.y - 42);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawHud(ctx, w, vw, vh, camX, camY) {
  const p = w.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: money + respect.
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  rr(ctx, 12, 12, 218, 64, 8); ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('$' + p.money.toLocaleString(), 24, 42);
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('RESPECT ' + p.respect, 24, 64);
  // Top-centre: wanted stars.
  const cx = vw / 2;
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  rr(ctx, cx - 120, 12, 240, 44, 8); ctx.fill();
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#cfd6de';
  ctx.fillText('WANTED', cx - 104, 40);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < w.stars ? '#ffd24d' : 'rgba(255,255,255,0.22)';
    const sx = cx - 28 + i * 26;
    ctx.font = '22px sans-serif';
    ctx.fillText('★', sx, 42);
  }
  // Bottom-left: health + speed.
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  rr(ctx, 12, vh - 62, 240, 50, 8); ctx.fill();
  ctx.fillStyle = '#3a3d44';
  rr(ctx, 24, vh - 48, 150, 12, 4); ctx.fill();
  ctx.fillStyle = p.health > 40 ? '#7ee787' : '#ff5f5f';
  rr(ctx, 24, vh - 48, 150 * Math.max(0, p.health / p.maxHealth), 12, 4); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  const speed = p.car ? Math.round(Math.abs(p.car.speed) * 0.36) : Math.round(p.speed * 0.36);
  ctx.fillText((p.car ? 'CAR ' : 'ON FOOT ') + speed + ' km/h', 24, vh - 22);
  if (p.car) {
    ctx.fillStyle = '#3a3d44';
    rr(ctx, 186, vh - 48, 54, 12, 4); ctx.fill();
    ctx.fillStyle = '#7fb5ff';
    rr(ctx, 186, vh - 48, 54 * Math.max(0, p.car.health / p.car.maxHealth), 12, 4); ctx.fill();
  }
  // Bottom-centre: current mission.
  const m = MISSIONS[w.missionIdx];
  if (m && w.state === 'playing') {
    const label = (w.missionIdx + 1) + '/8  ' + m.name + ' — ' + m.brief;
    ctx.font = 'bold 15px sans-serif';
    const mw = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(10,14,20,0.66)';
    rr(ctx, vw / 2 - mw / 2, vh - 40, mw, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.textAlign = 'center';
    ctx.fillText(label, vw / 2, vh - 19);
    ctx.textAlign = 'left';
  }
  // Flash messages under the stars.
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  w.messages.forEach((msg, i) => {
    ctx.globalAlpha = Math.min(1, msg.t);
    ctx.fillStyle = 'rgba(10,14,20,0.66)';
    const tw = ctx.measureText(msg.text).width + 24;
    rr(ctx, vw / 2 - tw / 2, 66 + i * 30, tw, 24, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(msg.text, vw / 2, 83 + i * 30);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  // Minimap (top-right).
  drawMinimap(ctx, w, vw);
  // Objective arrow at the screen edge.
  const o = w.objective ? w.objective() : null;
  if (o && w.state === 'playing') {
    const sx = o.x - camX, sy = o.y - camY;
    if (sx < 0 || sx > vw || sy < 0 || sy > vh) {
      const ax = Math.max(60, Math.min(vw - 60, sx));
      const ay = Math.max(60, Math.min(vh - 60, sy));
      const a = Math.atan2(sy - vh / 2, sx - vw / 2);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd24d';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(o.label, ax + 20, ay + 4);
    }
  }
  // Radio + time (bottom-right).
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  rr(ctx, vw - 212, vh - 62, 200, 50, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  const hh = Math.floor(w.time), mm = Math.floor((w.time - hh) * 60);
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ' + CFG.radio[w.station].name, vw - 200, vh - 40);
  ctx.fillStyle = '#9aa4b0';
  ctx.font = '13px sans-serif';
  ctx.fillText(w.muted ? 'muted (M)' : 'R: station · M: mute', vw - 200, vh - 22);
}

function drawMinimap(ctx, w, vw) {
  const mw = 210, mh = 158, mx = vw - mw - 12, my = 12;
  ctx.fillStyle = 'rgba(10,14,20,0.66)';
  rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
  const sx = mw / W, sy = mh / H;
  ctx.fillStyle = '#3f5a3a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2f6f8f';
  ctx.fillRect(mx + CFG.marina.x0 * sx, my + CFG.marina.y0 * sy, (CFG.marina.x1 - CFG.marina.x0) * sx, (CFG.marina.y1 - CFG.marina.y0) * sy);
  ctx.strokeStyle = '#c8c8ce';
  ctx.lineWidth = 1.5;
  for (const x of CFG.roadsX) { ctx.beginPath(); ctx.moveTo(mx + x * sx, my); ctx.lineTo(mx + x * sx, my + mh); ctx.stroke(); }
  for (const y of CFG.roadsY) { ctx.beginPath(); ctx.moveTo(mx, my + y * sy); ctx.lineTo(mx + mw, my + y * sy); ctx.stroke(); }
  const o = w.objective ? w.objective() : null;
  if (o) {
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(mx + o.x * sx, my + o.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of w.police) {
    if (c.wrecked) continue;
    ctx.fillStyle = '#ff5f5f';
    ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#7ee787';
  ctx.beginPath(); ctx.arc(mx + w.player.x * sx, my + w.player.y * sy, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(mx + w.player.x * sx, my + w.player.y * sy, 4.5, 0, Math.PI * 2); ctx.stroke();
}

function panel(ctx, vw, vh, wdt, hgt) {
  ctx.fillStyle = 'rgba(8,10,16,0.78)';
  rr(ctx, vw / 2 - wdt / 2, vh / 2 - hgt / 2, wdt, hgt, 12); ctx.fill();
  ctx.strokeStyle = '#ffd24d';
  ctx.lineWidth = 2;
  rr(ctx, vw / 2 - wdt / 2, vh / 2 - hgt / 2, wdt, hgt, 12); ctx.stroke();
}

function drawTitle(ctx, w, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, vw, vh, 640, 520);
  const cx = vw / 2, top = vh / 2 - 240;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('VERDE BAY', cx, top + 70);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in a sun-soaked coastal city', cx, top + 108);
  ctx.fillStyle = '#cfd6de';
  ctx.font = '15px sans-serif';
  ctx.fillText(CFG.hero + ', wheelman for ' + CFG.boss + '.', cx, top + 140);
  ctx.fillText('Steal cars. Outrun the Verde Bay PD. Run eight missions.', cx, top + 164);
  ctx.fillText('Become King of Verde Bay.', cx, top + 188);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('CONTROLS', cx - 260, top + 224);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '14px sans-serif';
  CFG.controls.forEach((row, i) => {
    ctx.fillText(row[0], cx - 260, top + 250 + i * 22);
    ctx.fillText(row[1], cx - 120, top + 250 + i * 22);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 20px sans-serif';
  const blink = Math.floor(performance.now() / 600) % 2 === 0;
  if (blink) ctx.fillText('Press Enter to start', cx, top + 500);
  ctx.textAlign = 'left';
}

function drawPause(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#cfd6de';
  ctx.fillText('Press P to keep playing', vw / 2, vh / 2 + 30);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, vw, vh, big, small) {
  ctx.fillStyle = 'rgba(8,10,16,0.62)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = big === 'BUSTED' ? '#7fb5ff' : '#ff5f5f';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(big, vw / 2, vh / 2 - 8);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(small, vw / 2, vh / 2 + 32);
  ctx.textAlign = 'left';
}

function drawWin(ctx, w, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.7)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, vw, vh, 560, 320);
  const cx = vw / 2, top = vh / 2 - 140;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText('KING OF VERDE BAY', cx, top + 60);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('All eight missions done. The city is yours, ' + CFG.hero + '.', cx, top + 100);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('$' + w.player.money.toLocaleString() + '   ·   Respect ' + w.player.respect, cx, top + 146);
  ctx.fillStyle = '#cfd6de';
  ctx.font = '16px sans-serif';
  ctx.fillText('Cars stolen: ' + w.stats.stolen + '   ·   Missions: ' + w.stats.missions, cx, top + 182);
  ctx.fillText('Press Enter to keep playing', cx, top + 226);
  ctx.textAlign = 'left';
}

function drawShop(ctx, w, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, vw, vh, 520, 300);
  const cx = vw / 2, top = vh / 2 - 130;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('VEGA MOTORS — GARAGE SHOP', cx, top + 40);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  const items = [
    ['1', 'Armor plating', '$' + CFG.tuning.shop.armor, w.upgrades.armor],
    ['2', 'Turbo engine', '$' + CFG.tuning.shop.turbo, w.upgrades.turbo],
    ['3', 'Racing tires', '$' + CFG.tuning.shop.tires, w.upgrades.tires],
  ];
  items.forEach((it, i) => {
    const y = top + 84 + i * 40;
    ctx.fillStyle = it[3] ? '#7ee787' : '#fff';
    ctx.fillText('[' + it[0] + ']  ' + it[1] + '  —  ' + it[2] + (it[3] ? '  (installed)' : ''), cx, y);
  });
  ctx.fillStyle = '#cfd6de';
  ctx.font = '15px sans-serif';
  ctx.fillText('Cash: $' + w.player.money.toLocaleString() + '    ·    Press G to leave', cx, top + 230);
  ctx.textAlign = 'left';
}
