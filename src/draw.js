// 共用畫圖：喪屍、隊員、特效、街道名、集火準星。三個地圖都用（世界座標，單位米）。
const TAU = Math.PI * 2;
import { zombieSprite, humanSprite, frameOf, blit, Z_VARIANTS } from './sprites.js';
export const ROLE_MARK = { player: '你', tank: '坦', medic: '醫', dps: '輸', control: '控', support: '援' };

// 喪屍：每隻一張俯視圖（有幾套衫、三格行路），轉向貼上去
export function drawZombies(ctx, zombies, vis, t) {
  const base = ctx.getTransform();
  for (const z of zombies) {
    if (!vis(z.x, z.y)) continue;
    if (z.v == null) z.v = (Math.random() * Z_VARIANTS) | 0;
    const big = z.type === 'boss' || z.type === 'king' || z.type === 'elite' || z.type === 'fat';
    const f = frameOf(t * (z.slowT > 0 ? 0.5 : 1), z.wob, z.type === 'runner' ? 10 : big ? 3.5 : 5);
    blit(ctx, base, zombieSprite(z.type, z.v, f), z.x, z.y, z.r, z.face);
  }
  ctx.setTransform(base);
  ctx.beginPath(); // 減慢中：灰藍點
  for (const z of zombies) if (z.slowT > 0 && vis(z.x, z.y)) { ctx.moveTo(z.x + 0.25, z.y - z.r); ctx.arc(z.x, z.y - z.r, 0.25, 0, TAU); }
  ctx.fillStyle = '#6f8aa6'; ctx.fill();
  ctx.beginPath(); // 中槍閃
  for (const z of zombies) if (z.flash > 0 && vis(z.x, z.y)) { ctx.moveTo(z.x + z.r * 0.8, z.y); ctx.arc(z.x, z.y, z.r * 0.8, 0, TAU); }
  ctx.fillStyle = 'rgba(217,201,176,.45)'; ctx.fill();
  for (const z of zombies) if ((z.type === 'boss' || z.type === 'king' || z.type === 'elite') && vis(z.x, z.y)) { // 大隻嘢有血條
    const w = z.r * 2.4;
    ctx.fillStyle = '#111'; ctx.fillRect(z.x - w / 2, z.y - z.r - 1, w, 0.4);
    ctx.fillStyle = '#b3302a'; ctx.fillRect(z.x - w / 2, z.y - z.r - 1, w * Math.max(0, z.hp / z.maxHp), 0.4);
  }
}

// 隊員：腳下橙色圈（一眼分到自己人）、俯視人物（按職業：消防衣、護士服、軍裝、實驗袍、外送員）、頭頂名牌同血條
export function drawSquad(ctx, squad, player, vis) {
  const base = ctx.getTransform(), now = performance.now() / 1000;
  for (const m of squad) {
    if (m.state === 'ok' || !vis(m.x, m.y) || m.away) continue;
    if (m.state === 'dead') { ctx.fillStyle = '#2f2c29'; ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * 1.3, m.r * 0.8, 0.5, 0, TAU); ctx.fill(); continue; }
    ctx.globalAlpha = 0.6; // 倒地：瞓低
    blit(ctx, base, humanSprite(m.role, 0), m.x, m.y, m.r, m.face + Math.PI / 2);
    ctx.setTransform(base); ctx.globalAlpha = 1;
    ctx.lineWidth = 0.22; ctx.strokeStyle = '#b3302a';
    ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * m.bleed / 20); ctx.stroke();
    if (m.revive > 0) { ctx.strokeStyle = '#d9d6cc'; ctx.beginPath(); ctx.arc(m.x, m.y, 1.9, -Math.PI / 2, -Math.PI / 2 + TAU * m.revive); ctx.stroke(); }
  }
  for (const m of squad) { // 腳下圈
    if (m.state !== 'ok' || !vis(m.x, m.y) || m.away) continue;
    ctx.strokeStyle = m === player ? 'rgba(242,194,122,.85)' : 'rgba(232,132,44,.6)'; ctx.lineWidth = m === player ? 0.16 : 0.12;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.35, 0, TAU); ctx.stroke();
    if (m.ult >= 1) { ctx.strokeStyle = '#d9d6cc'; ctx.lineWidth = 0.1; ctx.setLineDash([0.3, 0.3]); ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const m of squad) { // 人
    if (m.state !== 'ok' || !vis(m.x, m.y) || m.away) continue;
    const moved = Math.hypot(m.x - (m._lx ?? m.x), m.y - (m._ly ?? m.y)) > 0.002;
    m._lx = m.x; m._ly = m.y;
    if (moved) m._walk = (m._walk || 0) + 1;
    const f = moved ? frameOf(now, m.r * 7, 7) : 0;
    blit(ctx, base, humanSprite(m.role, f), m.x, m.y, m.r, m.face);
  }
  ctx.setTransform(base);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 0.7px "Noto Sans TC", sans-serif';
  for (const m of squad) {
    if (m.state !== 'ok' || !vis(m.x, m.y) || m.away) continue;
    if (m.flash > 0) { ctx.fillStyle = 'rgba(179,48,42,.45)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); }
    // 名牌：細方塊寫一個字
    const ty = m.y - 1.95;
    ctx.fillStyle = m === player ? '#e8842c' : m.guest ? '#d9a060' : '#c46a28';
    ctx.fillRect(m.x - 0.45, ty - 0.38, 0.9, 0.76);
    ctx.fillStyle = '#1c1410'; ctx.fillText(m.glyph || ROLE_MARK[m.role], m.x, ty + 0.03);
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
    if (l.landmark) { // 地標：菱形記號＋名
      ctx.fillStyle = '#e8b45a'; ctx.strokeStyle = 'rgba(23,25,24,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = '900 14px "Noto Sans TC", sans-serif'; ctx.lineWidth = 3.5;
      ctx.strokeText(l.name, 0, -16); ctx.fillText(l.name, 0, -16);
      ctx.restore(); continue;
    }
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
