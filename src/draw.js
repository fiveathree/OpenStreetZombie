// 共用畫圖：喪屍、隊員、特效、街道名、集火準星。三個地圖都用（世界座標，單位米）。
const TAU = Math.PI * 2;
const Z_TYPES = ['walker', 'runner', 'fat', 'screamer', 'elite', 'boss', 'king'];
const Z_COLOR = { walker: '#7a3a30', runner: '#94402f', fat: '#6a5236', screamer: '#8a4a5a', elite: '#5a2a24', boss: '#521c19', king: '#3e1412' };
export const ROLE_MARK = { player: '你', tank: '坦', medic: '醫', dps: '輸', control: '控', support: '援' };

export function drawZombies(ctx, zombies, vis, t) {
  for (const type of Z_TYPES) {
    ctx.beginPath();
    let any = false;
    for (const z of zombies) if (z.type === type && vis(z.x, z.y)) { ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU); any = true; }
    if (!any) continue;
    ctx.fillStyle = Z_COLOR[type]; ctx.fill();
    ctx.lineWidth = 0.12; ctx.strokeStyle = '#1a0f0d'; ctx.stroke();
  }
  ctx.beginPath(); // 手：一長一短，歪歪斜斜
  for (const z of zombies) {
    if (!vis(z.x, z.y)) continue;
    const c = Math.cos(z.face), sn = Math.sin(z.face), w = Math.sin(t * 6 + z.wob) * 0.15;
    for (const side of [-1, 1]) {
      const sx = z.x - sn * z.r * 0.7 * side, sy = z.y + c * z.r * 0.7 * side, l = z.r * (1.25 + w * side + (side > 0 ? 0.15 : -0.1));
      ctx.moveTo(sx, sy); ctx.lineTo(sx + c * l - sn * 0.15 * side, sy + sn * l + c * 0.15 * side);
    }
  }
  ctx.lineWidth = 0.2; ctx.strokeStyle = '#4a2420'; ctx.stroke();
  ctx.beginPath(); // 頭（歪少少）
  for (const z of zombies) {
    if (!vis(z.x, z.y)) continue;
    const a = z.face + Math.sin(z.wob) * 0.4, hx = z.x + Math.cos(a) * z.r * 0.25, hy = z.y + Math.sin(a) * z.r * 0.25;
    ctx.moveTo(hx + z.r * 0.45, hy); ctx.arc(hx, hy, z.r * 0.45, 0, TAU);
  }
  ctx.fillStyle = '#3a1c18'; ctx.fill();
  ctx.beginPath(); // 減慢中：灰藍點
  for (const z of zombies) if (z.slowT > 0 && vis(z.x, z.y)) { ctx.moveTo(z.x + 0.25, z.y - z.r); ctx.arc(z.x, z.y - z.r, 0.25, 0, TAU); }
  ctx.fillStyle = '#6f8aa6'; ctx.fill();
  ctx.beginPath(); // 中槍閃
  for (const z of zombies) if (z.flash > 0 && vis(z.x, z.y)) { ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU); }
  ctx.fillStyle = 'rgba(217,201,176,.55)'; ctx.fill();
  for (const z of zombies) if ((z.type === 'boss' || z.type === 'king' || z.type === 'elite') && vis(z.x, z.y)) { // 大隻嘢有血條
    const w = z.r * 2.4;
    ctx.fillStyle = '#111'; ctx.fillRect(z.x - w / 2, z.y - z.r - 1, w, 0.4);
    ctx.fillStyle = '#b3302a'; ctx.fillRect(z.x - w / 2, z.y - z.r - 1, w * Math.max(0, z.hp / z.maxHp), 0.4);
  }
}

// 隊員（連倒地）。marks：畫唔畫字
export function drawSquad(ctx, squad, player, vis) {
  for (const m of squad) {
    if (m.state === 'ok' || !vis(m.x, m.y) || m.away) continue;
    ctx.fillStyle = m.state === 'dead' ? '#2f2c29' : '#6b6560';
    ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * 1.3, m.r * 0.8, 0.5, 0, TAU); ctx.fill();
    if (m.state === 'down') {
      ctx.lineWidth = 0.22;
      ctx.strokeStyle = '#b3302a';
      ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * m.bleed / 20); ctx.stroke();
      if (m.revive > 0) { ctx.strokeStyle = '#d9d6cc'; ctx.beginPath(); ctx.arc(m.x, m.y, 1.9, -Math.PI / 2, -Math.PI / 2 + TAU * m.revive); ctx.stroke(); }
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 0.85px "Noto Sans TC", sans-serif';
  for (const m of squad) {
    if (m.state !== 'ok' || !vis(m.x, m.y) || m.away) continue;
    const c = Math.cos(m.face), sn = Math.sin(m.face);
    if (m === player) { ctx.strokeStyle = 'rgba(232,132,44,.45)'; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.arc(m.x, m.y, 1.25, 0, TAU); ctx.stroke(); }
    if (m.ult >= 1) { ctx.strokeStyle = '#d9d6cc'; ctx.lineWidth = 0.1; ctx.setLineDash([0.3, 0.3]); ctx.beginPath(); ctx.arc(m.x, m.y, 1.0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.face);
    if (m.role === 'tank') { ctx.fillStyle = '#7d7f78'; ctx.fillRect(0.55, -0.85, 0.35, 1.7); }               // 盾
    else if (m.role === 'control') { ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-0.95, -0.35, 0.4, 0.7); ctx.fillStyle = '#151515'; ctx.fillRect(0.3, -0.12, 0.9, 0.24); } // 背住油罐、噴嘴
    else if (m.role === 'support') { ctx.fillStyle = '#151515'; ctx.fillRect(0.3, -0.08, 1.7, 0.16); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-0.95, -0.45, 0.45, 0.9); } // 長狙、外送箱
    else { ctx.fillStyle = '#151515'; ctx.fillRect(0.3, -0.11, m.role === 'dps' ? 1.2 : 0.8, 0.22); }
    ctx.restore();
    ctx.fillStyle = m.flash > 0 ? '#b3302a' : m === player ? '#e8842c' : '#c46a28';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    ctx.lineWidth = 0.13; ctx.strokeStyle = '#1c1410'; ctx.stroke();
    if (m.role === 'medic') { ctx.fillStyle = '#d9d6cc'; ctx.fillRect(m.x - 0.55, m.y - 0.12, 0.25, 0.24); } // 手臂十字
    ctx.fillStyle = '#1c1410';
    ctx.fillText(m.glyph || ROLE_MARK[m.role], m.x, m.y + 0.05);
    const ratio = m.hp / m.maxHp; // 血條
    ctx.fillStyle = '#111'; ctx.fillRect(m.x - 0.9, m.y - 1.45, 1.8, 0.28);
    ctx.fillStyle = ratio < 0.3 ? '#b3302a' : '#cfc8b4'; ctx.fillRect(m.x - 0.9, m.y - 1.45, 1.8 * ratio, 0.28);
    if (m.ult > 0) { ctx.fillStyle = '#6f8aa6'; ctx.fillRect(m.x - 0.9, m.y - 1.15, 1.8 * m.ult, 0.14); }
  }
}

export function drawEffects(ctx, effects, below) {
  for (const e of effects) {
    const a = e.t / e.life;
    if (below) {
      if (e.kind === 'blast') {
        ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#c4612a';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.2 - a * 0.4), 0, TAU); ctx.fill();
      }
      continue;
    }
    if (e.kind === 'tracer') {
      ctx.globalAlpha = a; ctx.strokeStyle = e.player ? '#f2c27a' : e.heavy ? '#e8e0c8' : '#c99a5c'; ctx.lineWidth = e.heavy ? 0.2 : 0.12;
      ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x1, e.y1); ctx.stroke();
    } else if (e.kind === 'shove') {
      ctx.globalAlpha = a; ctx.strokeStyle = '#cfc8b4'; ctx.lineWidth = 0.2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.1 - a * 0.3), 0, TAU); ctx.stroke();
    } else if (e.kind === 'heal') {
      ctx.globalAlpha = a; ctx.fillStyle = '#8fbf7a';
      const y = e.y - 1.6 - (1 - a) * 1.2;
      ctx.fillRect(e.x - 0.45, y - 0.12, 0.9, 0.24); ctx.fillRect(e.x - 0.12, y - 0.45, 0.24, 0.9);
    } else if (e.kind === 'flame') {
      ctx.globalAlpha = 0.45 * a; ctx.fillStyle = '#d98a3a';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, e.r, e.a - 0.55, e.a + 0.55); ctx.closePath(); ctx.fill();
    } else if (e.kind === 'shout') {
      ctx.globalAlpha = a; ctx.strokeStyle = e.red ? '#b3302a' : e.heal ? '#8fbf7a' : '#d9d6cc'; ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - a * 0.7), 0, TAU); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawFocus(ctx, f, t) {
  if (!f || f.dead) return;
  const r = f.r + 0.7, a = t * 2;
  ctx.strokeStyle = '#d94a3a'; ctx.lineWidth = 0.18;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; ctx.moveTo(f.x + Math.cos(b) * r, f.y + Math.sin(b) * r); ctx.lineTo(f.x + Math.cos(b) * (r + 0.6), f.y + Math.sin(b) * (r + 0.6)); }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
}

// 街道名：螢幕座標畫，字大細唔跟 zoom 變
export function drawLabels(ctx, labels, cam, W, H, dpr, vis) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of labels) {
    if (l.minor && cam.zoom < 0.9) continue;
    if (!vis(l.x, l.y, 10)) continue;
    ctx.save();
    ctx.translate(W / 2 + (l.x - cam.x) * cam.z, H / 2 + (l.y - cam.y) * cam.z);
    ctx.rotate(l.a);
    ctx.font = l.minor ? '500 11px "Noto Sans TC", sans-serif' : '900 13px "Noto Sans TC", sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(23,25,24,.9)';
    ctx.strokeText(l.name, 0, 0);
    ctx.fillStyle = l.minor ? '#7d8075' : '#a9a796';
    ctx.fillText(l.name, 0, 0);
    ctx.restore();
  }
}

// 鏡頭：跟 target 郁，計 zoom，設定世界座標；返回 vis(x, y, margin)
export function applyCamera(ctx, cam, target, W, H, dpr, dt, base = 30) {
  cam.x += (target.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (target.y - cam.y) * Math.min(1, dt * 6);
  cam.zoom += (cam.zoomTarget - cam.zoom) * Math.min(1, dt * 10);
  cam.z = Math.max(10, Math.min(30, Math.min(W, H) / base)) * cam.zoom;
  cam.hw = W / 2 / cam.z; cam.hh = H / 2 / cam.z;
  const s = dpr * cam.z;
  ctx.setTransform(s, 0, 0, s, dpr * W / 2 - cam.x * s, dpr * H / 2 - cam.y * s);
  cam.view = { x0: cam.x - cam.hw, y0: cam.y - cam.hh, x1: cam.x + cam.hw, y1: cam.y + cam.hh };
  return (x, y, m = 3) => Math.abs(x - cam.x) < cam.hw + m && Math.abs(y - cam.y) < cam.hh + m;
}
export const worldTransform = (ctx, cam, W, H, dpr) => { const s = dpr * cam.z; ctx.setTransform(s, 0, 0, s, dpr * W / 2 - cam.x * s, dpr * H / 2 - cam.y * s); };
export const toScreen = (cam, W, H, x, y) => ({ x: W / 2 + (x - cam.x) * cam.z, y: H / 2 + (y - cam.y) * cam.z });
export function makeCam(x, y) { return { x, y, z: 20, hw: 20, hh: 20, zoom: 1, zoomTarget: 1 }; }
export function zoomCam(cam, f, min = 0.45, max = 2) { cam.zoomTarget = Math.max(min, Math.min(max, cam.zoomTarget * f)); return cam.zoomTarget; }
