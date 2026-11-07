// 中地圖場景：一個真實街區，你＋3 個隊友，撐夠 5 分鐘喪屍潮。
import { createFlowField } from '../flowfield.js';
import { createSpatial } from '../spatial.js';
import { ZOMBIES, MATCH_TIME, SURGES, PHARMACY, waveAt, xpNeed, applyUpgrade } from '../stats.js';
import { createSquad, hurt, heal, updateDowned, autoAttack } from '../squad.js';
import { updateAlly } from '../ally-ai.js';

const TAU = Math.PI * 2;
const Z_TYPES = ['walker', 'runner', 'fat', 'boss'];
const Z_COLOR = { walker: '#7a3a30', runner: '#94402f', fat: '#6a5236', boss: '#521c19' };
const POI_STYLE = { pharmacy: ['#4d774a', '✚'], store: ['#9c5228', '店'], police: ['#45607a', '警'], fuel: ['#7a2e24', '油'] };
const ROLE_MARK = { player: '你', tank: '坦', medic: '醫', dps: '輸' };

export function createMidScene(map, { maxZombies = 220 } = {}) {
  const squad = createSquad(map.start.x, map.start.y);
  const player = squad[0];
  const zombies = [], effects = [];
  const flow = createFlowField(map), leaderFlow = createFlowField(map);
  const spatial = createSpatial(map.size, 4);
  const pharmacies = map.pois.filter(p => p.type === 'pharmacy').map(p => ({ ...p, pool: PHARMACY.pool, active: false }));
  const cam = { x: player.x, y: player.y, z: 20, hw: 20, hh: 20, zoom: 1, zoomTarget: 1 };
  const ZOOM_MIN = 0.45, ZOOM_MAX = 2;
  const holdPos = new Map();
  const st = { t: 0, kills: 0, level: 1, xp: 0, pendingLevels: 0, over: null, command: 'follow', focus: null, toast: null, squad };
  let flowT = 0, flowTurn = false, spawnAcc = 0, surgeIdx = 0, follow = player;
  flow.update(squad);
  leaderFlow.update([player]);

  const zombiesNear = (x, y, r, fn) => spatial.query(x, y, r, z => { if (!z.dead) fn(z); });
  const effect = e => effects.push(e);
  function nearestZombie(x, y, r) {
    let best = null, bd = r * r;
    zombiesNear(x, y, r, z => { const d = (z.x - x) ** 2 + (z.y - y) ** 2; if (d < bd) { bd = d; best = z; } });
    return best;
  }

  function gainXp(v) {
    st.xp += v;
    while (st.xp >= xpNeed(st.level + st.pendingLevels)) { st.xp -= xpNeed(st.level + st.pendingLevels); st.pendingLevels++; }
  }

  function hitZombie(z, dmg, knock, fx, fy) {
    if (z.dead) return;
    z.hp -= dmg;
    z.flash = 0.08;
    if (knock) {
      const dx = z.x - fx, dy = z.y - fy, d = Math.hypot(dx, dy) || 1, k = knock * 6 / (z.type === 'boss' ? 5 : z.type === 'fat' ? 2 : 1);
      z.kx += dx / d * k; z.ky += dy / d * k;
    }
    if (z.hp > 0) return;
    z.dead = true;
    st.kills++;
    gainXp(ZOMBIES[z.type].xp);
    const blast = ZOMBIES[z.type].blast;
    if (blast) { // 肥屍爆炸：傷隊員，亦炸埋隔籬啲屍
      effect({ kind: 'blast', x: z.x, y: z.y, r: blast.r, t: 0.35, life: 0.35 });
      for (const m of squad) if (Math.hypot(m.x - z.x, m.y - z.y) < blast.r) hurt(m, blast.dmg);
      const near = [];
      zombiesNear(z.x, z.y, blast.r, o => { if (Math.hypot(o.x - z.x, o.y - z.y) < blast.r) near.push(o); });
      for (const o of near) hitZombie(o, 40, 1.5, z.x, z.y);
    }
  }

  const world = { map, squad, leader: player, leaderFlow, holdPos, command: 'follow', focus: null, zombiesNear, nearestZombie, hitZombie, effect, los: map.los };

  // ---- 出屍：喺畫面以外、沿路大約 36–90 米遠嘅街上 ----
  const offscreen = (x, y) => Math.abs(x - cam.x) > cam.hw + 2 || Math.abs(y - cam.y) > cam.hh + 2;
  function pickSpawn() {
    for (let k = 0; k < 60; k++) {
      const i = map.cells[(Math.random() * map.cells.length) | 0], d = flow.dist[i];
      if (d < 14 || d > 40) continue;
      const c = map.cellCenter(i);
      if (offscreen(c.x, c.y)) return c;
    }
    return null;
  }
  function spawn(type, at, hpMul) {
    if (zombies.length >= maxZombies && type !== 'boss') return;
    const Z = ZOMBIES[type];
    let x = at.x + (Math.random() - 0.5) * 1.6, y = at.y + (Math.random() - 0.5) * 1.6;
    if (!map.free(x, y)) ({ x, y } = at);
    const hp = Z.hp * hpMul;
    zombies.push({ type, x, y, r: Z.r, hp, maxHp: hp, speed: Z.speed * (0.85 + Math.random() * 0.3), dps: Z.dps, kx: 0, ky: 0, face: Math.random() * TAU, flash: 0, dead: false, wob: Math.random() * TAU });
  }

  function update(dt, mv) {
    if (st.over) return;
    st.t += dt;
    if (st.t >= MATCH_TIME) { st.t = MATCH_TIME; st.over = 'win'; return; }

    // 你
    if (player.state === 'ok' && (mv.x || mv.y)) {
      map.move(player, mv.x * player.speed * dt, mv.y * player.speed * dt);
      player.dir = Math.atan2(mv.y, mv.x);
      if (player.shotT <= 0) player.face = player.dir;
    }
    if (player.shotT > 0) player.face = player.aim;

    // 流場：兩張圖輪流更新，每張每 0.25 秒一次，唔好擠埋同一格
    flowT -= dt;
    if (flowT <= 0) {
      flowT = 0.125;
      flowTurn = !flowTurn;
      if (flowTurn) { const up = squad.filter(m => m.state === 'ok'); flow.update(up.length ? up : [player]); }
      else leaderFlow.update([player]);
    }

    // 出屍
    const w = waveAt(st.t);
    spawnAcc += w.rate * dt;
    while (spawnAcc >= 1) { spawnAcc--; const at = pickSpawn(); if (at) spawn(waveAt(st.t).type, at, w.hpMul); }
    if (surgeIdx < SURGES.length && st.t >= SURGES[surgeIdx].t) {
      const s = SURGES[surgeIdx++], at = pickSpawn();
      if (at) {
        for (let i = 0; i < s.n; i++) spawn(i % 5 === 4 ? 'runner' : 'walker', at, w.hpMul);
        if (s.boss) spawn('boss', at, 1);
        st.toast = s.boss ? '屍王嚟緊！' : '屍潮嚟緊！';
      }
    }

    spatial.clear();
    for (const z of zombies) spatial.insert(z);

    // 集火：揀你附近最硬嗰隻
    if (st.command === 'focus') {
      const f = st.focus;
      if (!f || f.dead || Math.hypot(f.x - player.x, f.y - player.y) > 20) {
        let best = null, bh = 0;
        zombiesNear(player.x, player.y, 16, z => { if (z.hp > bh && map.los(player.x, player.y, z.x, z.y)) { bh = z.hp; best = z; } });
        st.focus = best;
      }
    } else st.focus = null;
    world.command = st.command;
    world.focus = st.focus;

    // 隊伍
    for (const a of squad) if (a !== player) updateAlly(a, world, dt);
    for (const m of squad) { autoAttack(m, world, dt, st.focus); m.flash -= dt; }
    updateDowned(squad, dt);

    // 藥房補血
    for (const p of pharmacies) {
      p.pool = Math.min(PHARMACY.pool, p.pool + PHARMACY.regen * dt);
      p.active = false;
      for (const m of squad) {
        if (m.state !== 'ok' || m.hp >= m.maxHp || p.pool <= 0 || Math.hypot(m.x - p.x, m.y - p.y) > PHARMACY.radius) continue;
        const amt = Math.min(PHARMACY.rate * dt, p.pool, m.maxHp - m.hp);
        heal(m, amt); p.pool -= amt; p.active = true;
      }
    }

    // 喪屍
    const decay = Math.exp(-8 * dt);
    for (const z of zombies) {
      if (z.dead) continue;
      z.flash -= dt;
      let tgt = null, bd = Infinity;
      for (const m of squad) if (m.state === 'ok') { const d = (m.x - z.x) ** 2 + (m.y - z.y) ** 2; if (d < bd) { bd = d; tgt = m; } }
      let vx = 0, vy = 0;
      if (tgt && bd < 196 && map.los(z.x, z.y, tgt.x, tgt.y)) { const d = Math.sqrt(bd) || 1; vx = (tgt.x - z.x) / d; vy = (tgt.y - z.y) / d; }
      else { const f = flow.dir(z.x, z.y); if (f) { vx = f.x; vy = f.y; } }
      let px = 0, py = 0; // 互相推開
      spatial.query(z.x, z.y, z.r + 1.8, o => {
        if (o === z || o.dead) return;
        const dx = z.x - o.x, dy = z.y - o.y, rr = z.r + o.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; px += dx * k; py += dy * k; }
      });
      for (const m of squad) { // 咬人；同埋擠住隊員
        if (m.state !== 'ok') continue;
        const dx = z.x - m.x, dy = z.y - m.y, rr = z.r + m.r, d = Math.hypot(dx, dy);
        if (d < rr + 0.15) {
          hurt(m, z.dps * dt);
          if (d > 1e-3 && d < rr) {
            const o = rr - d, push = z.type === 'boss' ? 0.6 : 0.15;
            px += dx / d * o; py += dy / d * o;
            map.move(m, -dx / d * o * push, -dy / d * o * push);
          }
        }
      }
      if (vx || vy) z.face = Math.atan2(vy, vx);
      map.move(z, vx * z.speed * dt + px * 0.5 + z.kx * dt, vy * z.speed * dt + py * 0.5 + z.ky * dt);
      z.kx *= decay; z.ky *= decay;
    }
    let j = 0;
    for (const z of zombies) if (!z.dead) zombies[j++] = z;
    zombies.length = j;

    for (const e of effects) e.t -= dt;
    j = 0;
    for (const e of effects) if (e.t > 0) effects[j++] = e;
    effects.length = j;

    if (player.state === 'dead' || !squad.some(m => m.state === 'ok')) st.over = 'lose';
  }

  function command(c) {
    st.command = c;
    if (c === 'hold') for (const a of squad) holdPos.set(a, { x: a.x, y: a.y });
  }

  // zoom：factor > 1 拉近；返回新倍數
  function zoomBy(factor) {
    cam.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoomTarget * factor));
    return cam.zoomTarget;
  }
  function setZoom(v) { cam.zoom = cam.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v || 1)); }

  function pickUpgrade(u) {
    applyUpgrade(u, squad);
    st.pendingLevels--;
    st.level++;
  }

  // ---- 畫面 ----
  function render(ctx, W, H, dpr, dt = 0) {
    cam.x += (follow.x - cam.x) * Math.min(1, dt * 6);
    cam.y += (follow.y - cam.y) * Math.min(1, dt * 6);
    cam.zoom += (cam.zoomTarget - cam.zoom) * Math.min(1, dt * 10);
    cam.z = Math.max(10, Math.min(30, Math.min(W, H) / 30)) * cam.zoom;
    cam.hw = W / 2 / cam.z; cam.hh = H / 2 / cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#121518';
    ctx.fillRect(0, 0, W, H);
    const s = dpr * cam.z;
    ctx.setTransform(s, 0, 0, s, dpr * W / 2 - cam.x * s, dpr * H / 2 - cam.y * s);
    map.draw(ctx);
    const vis = (x, y, m = 3) => Math.abs(x - cam.x) < cam.hw + m && Math.abs(y - cam.y) < cam.hh + m;

    // 街道名（螢幕座標畫，字大細唔跟 zoom 變）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const l of map.labels) {
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
    ctx.setTransform(s, 0, 0, s, dpr * W / 2 - cam.x * s, dpr * H / 2 - cam.y * s);

    // 藥房範圍
    ctx.setLineDash([0.8, 0.8]);
    ctx.lineWidth = 0.18;
    for (const p of pharmacies) {
      if (!vis(p.x, p.y, 8)) continue;
      ctx.strokeStyle = p.pool > 5 ? (p.active ? '#8fbf7a' : '#5c8a54') : '#3a4a38';
      ctx.beginPath(); ctx.arc(p.x, p.y, PHARMACY.radius, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    // 招牌
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 1.5px "Noto Sans TC", sans-serif';
    for (const p of map.pois) {
      if (!vis(p.sx, p.sy, 4)) continue;
      const [bg, ch] = POI_STYLE[p.type];
      ctx.fillStyle = '#111';
      ctx.fillRect(p.sx - 1.25, p.sy - 1.15, 2.6, 2.6);
      ctx.fillStyle = bg;
      ctx.fillRect(p.sx - 1.3, p.sy - 1.3, 2.6, 2.6);
      ctx.fillStyle = '#d9d6cc';
      ctx.fillText(ch, p.sx, p.sy + 0.1);
    }
    // 守住嘅位置
    if (st.command === 'hold') {
      ctx.strokeStyle = '#b5592a'; ctx.lineWidth = 0.2;
      ctx.beginPath();
      for (const [, p] of holdPos) { ctx.moveTo(p.x - 0.5, p.y - 0.5); ctx.lineTo(p.x + 0.5, p.y + 0.5); ctx.moveTo(p.x + 0.5, p.y - 0.5); ctx.lineTo(p.x - 0.5, p.y + 0.5); }
      ctx.stroke();
    }
    // 爆炸
    for (const e of effects) if (e.kind === 'blast') {
      ctx.globalAlpha = e.t / e.life * 0.7;
      ctx.fillStyle = '#c4612a';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.2 - e.t / e.life * 0.4), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 倒地／陣亡隊員
    for (const m of squad) {
      if (m.state === 'ok' || !vis(m.x, m.y)) continue;
      ctx.fillStyle = m.state === 'dead' ? '#2f2c29' : '#6b6560';
      ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * 1.3, m.r * 0.8, 0.5, 0, TAU); ctx.fill();
      if (m.state === 'down') {
        ctx.lineWidth = 0.22;
        ctx.strokeStyle = '#b3302a';
        ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * m.bleed / 20); ctx.stroke();
        if (m.revive > 0) { ctx.strokeStyle = '#d9d6cc'; ctx.beginPath(); ctx.arc(m.x, m.y, 1.9, -Math.PI / 2, -Math.PI / 2 + TAU * m.revive); ctx.stroke(); }
      }
    }

    // 喪屍（同類一齊畫，快啲）
    const tt = st.t;
    for (const type of Z_TYPES) {
      ctx.beginPath();
      let any = false;
      for (const z of zombies) if (z.type === type && vis(z.x, z.y)) { ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU); any = true; }
      if (!any) continue;
      ctx.fillStyle = Z_COLOR[type]; ctx.fill();
      ctx.lineWidth = 0.12; ctx.strokeStyle = '#1a0f0d'; ctx.stroke();
    }
    ctx.beginPath(); // 手
    for (const z of zombies) {
      if (!vis(z.x, z.y)) continue;
      const c = Math.cos(z.face), sn = Math.sin(z.face), w = Math.sin(tt * 6 + z.wob) * 0.15;
      for (const side of [-1, 1]) {
        const sx = z.x - sn * z.r * 0.7 * side, sy = z.y + c * z.r * 0.7 * side, l = z.r * (1.25 + w * side);
        ctx.moveTo(sx, sy); ctx.lineTo(sx + c * l, sy + sn * l);
      }
    }
    ctx.lineWidth = 0.2; ctx.strokeStyle = '#4a2420'; ctx.stroke();
    ctx.beginPath(); // 頭
    for (const z of zombies) {
      if (!vis(z.x, z.y)) continue;
      const hx = z.x + Math.cos(z.face) * z.r * 0.25, hy = z.y + Math.sin(z.face) * z.r * 0.25;
      ctx.moveTo(hx + z.r * 0.45, hy); ctx.arc(hx, hy, z.r * 0.45, 0, TAU);
    }
    ctx.fillStyle = '#3a1c18'; ctx.fill();
    ctx.beginPath(); // 中槍閃
    for (const z of zombies) if (z.flash > 0 && vis(z.x, z.y)) { ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU); }
    ctx.fillStyle = 'rgba(217,201,176,.55)'; ctx.fill();
    // 屍王血條
    for (const z of zombies) if (z.type === 'boss' && vis(z.x, z.y)) {
      ctx.fillStyle = '#111'; ctx.fillRect(z.x - 2, z.y - z.r - 1, 4, 0.4);
      ctx.fillStyle = '#b3302a'; ctx.fillRect(z.x - 2, z.y - z.r - 1, 4 * z.hp / z.maxHp, 0.4);
    }

    // 集火目標
    if (st.focus && !st.focus.dead) {
      const f = st.focus, r = f.r + 0.7, a = tt * 2;
      ctx.strokeStyle = '#d94a3a'; ctx.lineWidth = 0.18;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; ctx.moveTo(f.x + Math.cos(b) * r, f.y + Math.sin(b) * r); ctx.lineTo(f.x + Math.cos(b) * (r + 0.6), f.y + Math.sin(b) * (r + 0.6)); }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
    }

    // 隊員
    ctx.font = '900 0.85px "Noto Sans TC", sans-serif';
    for (const m of squad) {
      if (m.state !== 'ok') continue;
      const c = Math.cos(m.face), sn = Math.sin(m.face);
      if (m === player) { ctx.strokeStyle = 'rgba(232,132,44,.45)'; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.arc(m.x, m.y, 1.25, 0, TAU); ctx.stroke(); }
      if (m.role === 'tank') { // 盾
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.face);
        ctx.fillStyle = '#7d7f78'; ctx.fillRect(0.55, -0.85, 0.35, 1.7);
        ctx.restore();
      } else { // 槍
        const l = m.role === 'dps' ? 1.5 : 1.1;
        ctx.strokeStyle = '#151515'; ctx.lineWidth = 0.22;
        ctx.beginPath(); ctx.moveTo(m.x + c * 0.3, m.y + sn * 0.3); ctx.lineTo(m.x + c * l, m.y + sn * l); ctx.stroke();
      }
      ctx.fillStyle = m.flash > 0 ? '#b3302a' : m === player ? '#e8842c' : '#c46a28';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.13; ctx.strokeStyle = '#1c1410'; ctx.stroke();
      ctx.fillStyle = '#1c1410';
      ctx.fillText(ROLE_MARK[m.role], m.x, m.y + 0.05);
      const ratio = m.hp / m.maxHp; // 血條
      ctx.fillStyle = '#111'; ctx.fillRect(m.x - 0.9, m.y - 1.45, 1.8, 0.28);
      ctx.fillStyle = ratio < 0.3 ? '#b3302a' : '#cfc8b4'; ctx.fillRect(m.x - 0.9, m.y - 1.45, 1.8 * ratio, 0.28);
    }

    // 彈道、推擊、補血
    for (const e of effects) {
      const a = e.t / e.life;
      if (e.kind === 'tracer') {
        ctx.globalAlpha = a; ctx.strokeStyle = e.player ? '#f2c27a' : '#c99a5c'; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x1, e.y1); ctx.stroke();
      } else if (e.kind === 'shove') {
        ctx.globalAlpha = a; ctx.strokeStyle = '#cfc8b4'; ctx.lineWidth = 0.2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.1 - a * 0.3), 0, TAU); ctx.stroke();
      } else if (e.kind === 'heal') {
        ctx.globalAlpha = a; ctx.fillStyle = '#8fbf7a';
        const y = e.y - 1.6 - (1 - a) * 1.2;
        ctx.fillRect(e.x - 0.45, y - 0.12, 0.9, 0.24); ctx.fillRect(e.x - 0.12, y - 0.45, 0.24, 0.9);
      }
    }
    ctx.globalAlpha = 1;
  }

  // 標題畫面：鏡頭慢慢遊街
  function idle(t) {
    follow = { x: map.start.x + Math.sin(t * 0.05) * 30, y: map.start.y + Math.cos(t * 0.037) * 30 };
  }

  return { state: st, update, render, command, pickUpgrade, idle, squad, zoomBy, setZoom };
}
