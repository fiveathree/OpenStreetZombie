// 中地圖場景：一個真實街區，你＋3 個隊友，撐夠 5 分鐘喪屍潮；中途救倖存者、用地點、放大招。
import { createFlowField } from '../flowfield.js';
import { createHorde } from '../horde.js';
import { ZOMBIES, MATCH_TIME, SURGES, POIS, waveAt, xpNeed, applyUpgrade } from '../stats.js';
const TAU = Math.PI * 2;
import { createSquad, hurt, updateDowned, autoAttack, chargeUlt, tickBuffs, bmul } from '../squad.js';
import { updateAlly } from '../ally-ai.js';
import { castUlt, updateZones, drawZones } from '../skills.js';
import { createPois, updatePois, drawPois } from '../poi.js';
import { createNight } from '../lighting.js';
import { rescue } from '../rescue.js';
import { drawZombies, drawSquad, drawEffects, drawFocus, drawLabels, applyCamera, worldTransform, toScreen, makeCam, zoomCam } from '../draw.js';

// cfg：{ team:[{role, lvl, injured}], night, hard, maxZombies, mapId }
export function createMidScene(map, cfg = {}) {
  const team = cfg.team || [{ role: 'player' }, { role: 'tank' }, { role: 'medic' }, { role: 'dps' }];
  const squad = createSquad(map.start.x, map.start.y, team);
  const player = squad[0];
  const effects = [], zones = [];
  const loot = { food: 0, meds: 0, parts: 0, ammo: 0 };
  const flow = createFlowField(map), leaderFlow = createFlowField(map);
  const pois = createPois(map.pois);
  const cam = makeCam(player.x, player.y);
  const holdPos = new Map();
  const night = cfg.night ? createNight() : null;
  const st = { t: 0, kills: 0, level: 1, xp: 0, pendingLevels: 0, over: null, command: 'follow', focus: null, toasts: [], squad, loot, shards: 0, rescued: 0, charShards: {} };
  let flowT = 0, flowTurn = false, spawnAcc = 0, surgeIdx = 0, follow = player, killsThisFrame = 0;
  let look = null, mmBase = null; // 撳小地圖睇第度；你一郁就返嚟
  const survivors = []; // 待救嘅倖存者
  const toast = m => st.toasts.push(m);
  const effect = e => effects.push(e);

  const horde = createHorde(map, {
    max: cfg.maxZombies || 220, effect, toast,
    onKill(z) {
      st.kills++; killsThisFrame++;
      loot.food += 0.04; loot.ammo += 0.03;
      st.xp += ZOMBIES[z.type].xp;
      while (st.xp >= xpNeed(st.level + st.pendingLevels)) { st.xp -= xpNeed(st.level + st.pendingLevels); st.pendingLevels++; }
    },
    onBlast(x, y, r, dmg) { for (const m of squad) if (Math.hypot(m.x - x, m.y - y) < r) hurt(m, dmg); },
  });
  const world = {
    map, squad, leader: player, leaderFlow, holdPos, command: 'follow', focus: null, zones, taunt: null, loot,
    zombiesNear: horde.near, nearestZombie: horde.nearest, hitZombie: horde.hit, effect, toast, los: map.los,
  };
  flow.update(squad);
  leaderFlow.update([player]);

  // ---- 出屍：喺畫面以外、沿路大約 28–80 米遠嘅街上 ----
  const offscreen = (x, y) => Math.abs(x - cam.x) > cam.hw + 2 || Math.abs(y - cam.y) > cam.hh + 2;
  function pickSpawn(min = 14, max = 40) {
    for (let k = 0; k < 60; k++) {
      const i = map.cells[(Math.random() * map.cells.length) | 0], d = flow.dist[i];
      if (d < min || d > max) continue;
      const c = map.cellCenter(i);
      if (offscreen(c.x, c.y)) return c;
    }
    return null;
  }

  function update(dt, mv) {
    if (st.over) return;
    st.t += dt;
    if (mv && (mv.x || mv.y)) look = null;
    if (st.t >= MATCH_TIME) { st.t = MATCH_TIME; st.over = 'win'; return; }
    killsThisFrame = 0;

    // 你
    if (player.state === 'ok' && (mv.x || mv.y)) {
      const sp = player.speed * bmul(player, 'speed');
      map.move(player, mv.x * sp * dt, mv.y * sp * dt);
      player.dir = Math.atan2(mv.y, mv.x);
      if (player.shotT <= 0) player.face = player.dir;
    }
    if (player.shotT > 0) player.face = player.aim;

    // 流場：兩張圖輪流更新，每張每 0.25 秒一次
    flowT -= dt;
    if (flowT <= 0) {
      flowT = 0.125;
      flowTurn = !flowTurn;
      if (flowTurn) { const up = squad.filter(m => m.state === 'ok'); flow.update(up.length ? up : [player]); }
      else leaderFlow.update([player]);
    }

    // 出屍
    const w = waveAt(st.t, Math.random, cfg.hard || 1);
    spawnAcc += w.rate * dt;
    while (spawnAcc >= 1) { spawnAcc--; const at = pickSpawn(); if (at) horde.spawn(waveAt(st.t).type, at, w.hpMul); }
    if (surgeIdx < SURGES.length && st.t >= SURGES[surgeIdx].t) {
      const s = SURGES[surgeIdx++], at = pickSpawn();
      if (at) {
        for (let i = 0; i < s.n; i++) horde.spawn(i % 5 === 4 ? 'runner' : 'walker', at, w.hpMul);
        if (s.boss) horde.spawn('boss', at, cfg.hard || 1);
        toast(s.boss ? '屍王嚟緊！' : '屍潮嚟緊！');
      }
    }
    // 救人任務：倖存者喺 50、130、210 秒出現
    for (const t of [50, 130, 210]) if (st.t - dt < t && st.t >= t) {
      const at = pickSpawn(16, 28);
      if (at) { survivors.push({ ...at, prog: 0, life: 70 }); toast('附近有倖存者求救！（地圖上嘅白點）'); }
    }
    for (const s of survivors) {
      s.life -= dt;
      const near = squad.some(m => m.state === 'ok' && Math.hypot(m.x - s.x, m.y - s.y) < 2.5);
      s.prog = near ? s.prog + dt / 2 : Math.max(0, s.prog - dt);
      if (s.prog >= 1) { s.done = true; loot.food += 8; loot.meds += 4; rescue(st, squad, s, toast); }
      else if (s.life <= 0) { s.done = true; toast('倖存者冇救到…'); }
    }
    for (let i = survivors.length - 1; i >= 0; i--) if (survivors[i].done) survivors.splice(i, 1);

    // 集火：揀你附近最硬嗰隻（尖叫屍優先）
    if (st.command === 'focus') {
      const f = st.focus;
      if (!f || f.dead || Math.hypot(f.x - player.x, f.y - player.y) > 20) {
        let best = null, bh = 0;
        horde.near(player.x, player.y, 16, z => { const v = z.hp + (z.type === 'screamer' ? 500 : 0); if (v > bh && map.los(player.x, player.y, z.x, z.y)) { bh = v; best = z; } });
        st.focus = best;
      }
    } else st.focus = null;
    world.command = st.command;
    world.focus = st.focus;

    // 隊伍
    for (const a of squad) if (a !== player) updateAlly(a, world, dt);
    for (const m of squad) { autoAttack(m, world, dt, st.focus); m.flash -= dt; tickBuffs(m, dt); }
    updateDowned(squad, dt);
    updateZones(world, dt);
    updatePois(pois, world, dt);

    // 喪屍
    horde.step(dt, { targets: squad, bite: (m, d) => hurt(m, d), flow, taunt: world.taunt });
    chargeUlt(squad, killsThisFrame, dt);

    for (const e of effects) e.t -= dt;
    let j = 0;
    for (const e of effects) if (e.t > 0) effects[j++] = e;
    effects.length = j;

    if (player.state === 'dead' || !squad.some(m => m.state === 'ok')) st.over = 'lose';
  }

  function command(c) {
    st.command = c;
    if (c === 'hold') for (const a of squad) holdPos.set(a, { x: a.x, y: a.y });
  }

  function pickUpgrade(u) {
    applyUpgrade(u, squad);
    st.pendingLevels--;
    st.level++;
  }

  // ---- 畫面 ----
  function render(ctx, W, H, dpr, dt = 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#121518'; ctx.fillRect(0, 0, W, H);
    const vis = applyCamera(ctx, cam, look || follow, W, H, dpr, dt);
    map.draw(ctx, cam.view);
    drawLabels(ctx, map.labels, cam, W, H, dpr, vis);
    worldTransform(ctx, cam, W, H, dpr);
    drawPois(ctx, pois, vis, st.t);
    if (st.command === 'hold') { // 守住嘅位置
      ctx.strokeStyle = '#b5592a'; ctx.lineWidth = 0.2;
      ctx.beginPath();
      for (const [, p] of holdPos) { ctx.moveTo(p.x - 0.5, p.y - 0.5); ctx.lineTo(p.x + 0.5, p.y + 0.5); ctx.moveTo(p.x + 0.5, p.y - 0.5); ctx.lineTo(p.x - 0.5, p.y + 0.5); }
      ctx.stroke();
    }
    drawZones(ctx, zones, st.t);
    drawEffects(ctx, effects, true);
    for (const s of survivors) { // 倖存者：白色、揮手
      ctx.fillStyle = '#d9d6cc'; ctx.beginPath(); ctx.arc(s.x, s.y, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9d6cc'; ctx.lineWidth = 0.18; ctx.beginPath(); ctx.moveTo(s.x + 0.4, s.y - 0.3); ctx.lineTo(s.x + 0.9, s.y - 0.9 + Math.sin(st.t * 8) * 0.3); ctx.stroke();
      ctx.strokeStyle = '#8fbf7a'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.arc(s.x, s.y, 1.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.prog); ctx.stroke();
    }
    drawZombies(ctx, horde.zombies, vis, st.t);
    drawFocus(ctx, st.focus, st.t);
    drawSquad(ctx, squad, player, vis);
    drawEffects(ctx, effects, false);

    if (night) { // 夜晚：隊員身邊有光，你前面有手電筒
      const lights = [];
      for (const m of squad) if (m.state !== 'dead') { const p = toScreen(cam, W, H, m.x, m.y); lights.push({ ...p, r: 6 * cam.z, cone: m === player ? { a: player.face, len: 20 * cam.z, half: 0.5 } : null }); }
      for (const zn of zones) { const p = toScreen(cam, W, H, zn.x, zn.y); lights.push({ ...p, r: (zn.r + 3) * cam.z }); }
      for (const e of effects) if (e.kind === 'blast') { const p = toScreen(cam, W, H, e.x, e.y); lights.push({ ...p, r: e.r * 1.6 * cam.z }); }
      for (const p of pois) if (p.type === 'fuel' || p.type === 'police' || p.type === 'pharmacy' || p.type === 'store') { const s = toScreen(cam, W, H, p.sx, p.sy); lights.push({ ...s, r: 3 * cam.z }); }
      night(ctx, W, H, dpr, lights);
    }
    // 倖存者喺畫面外：邊位有白色箭嘴
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of survivors) {
      const p = toScreen(cam, W, H, s.x, s.y);
      if (p.x > 0 && p.y > 0 && p.x < W && p.y < H) continue;
      const a = Math.atan2(p.y - H / 2, p.x - W / 2), ex = Math.max(24, Math.min(W - 24, W / 2 + Math.cos(a) * W)), ey = Math.max(90, Math.min(H - 150, H / 2 + Math.sin(a) * H));
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = '#d9d6cc'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // 標題畫面：鏡頭慢慢遊街
  function idle(t) {
    follow = { x: map.start.x + Math.sin(t * 0.05) * 30, y: map.start.y + Math.cos(t * 0.037) * 30 };
  }

  // ---- 小地圖：街道、地點、倖存者、屍、隊員（名牌）----
  function renderMinimap(ctx, S) {
    const k = S / map.size, f = S / 150;
    if (!mmBase || mmBase.width !== S) {
      mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = S;
      const g = mmBase.getContext('2d');
      g.fillStyle = '#1a1d19'; g.fillRect(0, 0, S, S);
      g.strokeStyle = '#3e403a'; g.lineCap = 'round';
      for (const r of map.roads) { g.lineWidth = Math.max(f, (r.w || 6) * k); g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k))); g.stroke(); }
    }
    ctx.drawImage(mmBase, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of pois) { const x = (p.sx ?? p.x) * k, y = (p.sy ?? p.y) * k, s = 5 * f; ctx.fillStyle = POIS[p.type].color; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    ctx.fillStyle = '#d94a3a';
    for (const z of horde.zombies) { const s = (z.type === 'boss' || z.type === 'king' ? 5 : 2) * f; ctx.fillRect(z.x * k - s / 2, z.y * k - s / 2, s, s); }
    for (const v of survivors) { ctx.fillStyle = Math.sin(st.t * 8) > 0 ? '#ffffff' : '#9a978c'; ctx.beginPath(); ctx.arc(v.x * k, v.y * k, 3 * f, 0, TAU); ctx.fill(); }
    for (const m of [...squad.filter(m => m !== player), player]) {
      if (m.state === 'dead') continue;
      const x = m.x * k, y = m.y * k, r = (m === player ? 6 : 5) * f;
      ctx.fillStyle = m.state === 'down' ? '#6b6560' : m === player ? '#f2c27a' : m.guest ? '#d9a060' : '#e8842c';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = f; ctx.strokeStyle = '#1c1410'; ctx.stroke();
      ctx.fillStyle = '#1c1410'; ctx.font = `900 ${7 * f}px "Noto Sans TC", sans-serif`;
      ctx.fillText(m === player ? '你' : m.glyph || [...m.name].find(c => c !== '阿' && c !== '小' && c !== ' ') || m.name[0], x, y + 0.5 * f);
    }
    ctx.strokeStyle = '#d9d6cc'; ctx.lineWidth = f;
    ctx.strokeRect((cam.x - cam.hw) * k, (cam.y - cam.hh) * k, cam.hw * 2 * k, cam.hh * 2 * k);
  }
  const lookAt = (fx, fy) => { const c = v => Math.max(0, Math.min(1, v)) * map.size; look = { x: c(fx), y: c(fy) }; cam.x = look.x; cam.y = look.y; };
  const lookBack = () => { look = null; cam.x = follow.x; cam.y = follow.y; };

  return {
    renderMinimap, lookAt, lookBack, isLooking: () => !!look, size: map.size,
    kind: 'mid', state: st, update, render, command, pickUpgrade, idle, squad,
    ult: () => castUlt(player, world),
    zoomBy: f => zoomCam(cam, f), setZoom: v => { cam.zoom = cam.zoomTarget = Math.max(0.45, Math.min(2, v || 1)); },
  };
}
