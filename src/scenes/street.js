// 小地圖場景：一條真實街道就係一條跑道。小隊沿街向前衝，左右拖揀行邊邊；
// 真實路口有門（加人、乘人、減人、武器），喪屍由真實橫街湧出嚟，街尾有屍王同倖存者。
import { ROLES, levelMul } from '../stats.js';

const TAU = Math.PI * 2;
const LANE = 16;          // 跑道闊（米）
const SPEED = 7.5;        // 向前衝速度（米／秒）
const MAX_LEN = 760;      // 最長跑幾遠

// 隊長職業 → 小兵武器
export const TROOPS = {
  tank: { name: '盾兵', dmg: 6, cd: 0.5, range: 22, shield: true },
  medic: { name: '救護兵', dmg: 4, cd: 0.5, range: 22, regen: 4 },
  dps: { name: '機槍兵', dmg: 5, cd: 0.18, range: 26 },
  control: { name: '火焰兵', dmg: 3, cd: 0.3, range: 10, aoe: true },
  support: { name: '狙擊兵', dmg: 26, cd: 1.2, range: 42, sniper: true },
};

// 揀街：同名嘅路駁埋一條，揀最長嗰幾條；day 決定今日跑邊條
export function pickStreet(map, day = 0) {
  const byName = new Map();
  for (const r of map.roads) if (r.name && !r.bridge && r.w >= 7 && !r.name.endsWith('巷')) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r.pts.map(p => [p[0], p[1]]));
  }
  const chains = [];
  for (const [name, parts] of byName) {
    const left = parts.slice();
    while (left.length) {
      let chain = left.shift();
      for (let grew = true; grew;) {
        grew = false;
        for (let i = 0; i < left.length; i++) {
          const p = left[i], a = chain[0], b = chain[chain.length - 1];
          const d = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
          if (d(b, p[0]) < 4) chain = chain.concat(p.slice(1));
          else if (d(b, p[p.length - 1]) < 4) chain = chain.concat(p.slice().reverse().slice(1));
          else if (d(a, p[p.length - 1]) < 4) chain = p.concat(chain.slice(1));
          else if (d(a, p[0]) < 4) chain = p.slice().reverse().concat(chain.slice(1));
          else continue;
          left.splice(i, 1); grew = true; break;
        }
      }
      let len = 0;
      for (let i = 1; i < chain.length; i++) len += Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]);
      chains.push({ name, pts: chain, len });
    }
  }
  chains.sort((a, b) => b.len - a.len);
  const top = chains.filter(c => c.len > 350).slice(0, 4);
  return top[day % top.length] || chains[0];
}

function segX(a, b, c, d) { // 兩段線交點，返回 t（沿 ab）或 -1
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= -0.05 && u <= 1.05 ? t : -1;
}

// 搵路口：其他路同呢條街相交嘅位置（沿街距離 s）
function junctions(map, street) {
  const out = [];
  let acc = 0;
  for (let i = 1; i < street.pts.length; i++) {
    const a = street.pts[i - 1], b = street.pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const r of map.roads) {
      if (r.name === street.name) continue;
      for (let k = 1; k < r.pts.length; k++) {
        const t = segX(a, b, r.pts[k - 1], r.pts[k]);
        if (t >= 0) out.push({ s: acc + t * len, name: r.name || '', w: r.w });
      }
    }
    acc += len;
  }
  out.sort((p, q) => p.s - q.s);
  const merged = [];
  for (const j of out) {
    const last = merged[merged.length - 1];
    if (last && j.s - last.s < 14) { if (j.w > last.w) { last.w = j.w; last.name = j.name || last.name; } continue; }
    merged.push({ ...j });
  }
  return merged;
}

// 沿街附近嘅真實店舖，變成路邊招牌
function signsAlong(map, street) {
  const out = [];
  let acc = 0;
  for (let i = 1; i < street.pts.length; i++) {
    const a = street.pts[i - 1], b = street.pts[i], vx = b[0] - a[0], vy = b[1] - a[1], len = Math.hypot(vx, vy);
    for (const p of map.pois) {
      const t = ((p.sx - a[0]) * vx + (p.sy - a[1]) * vy) / (len * len);
      if (t < 0 || t > 1) continue;
      const side = (vx * (p.sy - a[1]) - vy * (p.sx - a[0])) / len;
      if (Math.abs(side) < 30 && p.name) out.push({ s: acc + t * len, side: Math.sign(side) || 1, name: p.name, type: p.type });
    }
    acc += len;
  }
  return out;
}

// cfg：{ captains:[{role, lvl}], day }
export function createStreetScene(map, cfg = {}) {
  const street = pickStreet(map, cfg.day || 0);
  const L = Math.min(MAX_LEN, street.len);
  const juncs = junctions(map, street).filter(j => j.s > 40 && j.s < L - 70);
  const signs = signsAlong(map, street).filter(s => s.s < L);
  const effects = [];
  const st = { t: 0, s: 0, x: 0, kills: 0, over: null, toasts: [], loot: { food: 0, meds: 0, parts: 0, ammo: 0 }, shards: 0, target: -1, ultReady: false, street: street.name, len: L, cross: '' };
  const toast = m => st.toasts.push(m);

  const capRoles = (cfg.captains || [{ role: 'tank' }, { role: 'dps' }, { role: 'medic' }]).slice(0, 3);
  const caps = capRoles.map((c, i) => ({
    role: c.role, name: ROLES[c.role].name, troop: TROOPS[c.role], lvl: c.lvl || 1,
    off: (i - (capRoles.length - 1) / 2) * 5, n: 6, tier: 1, hp: 100 * levelMul(c.lvl || 1), maxHp: 100 * levelMul(c.lvl || 1), alive: true, fireT: 0, regenT: 0, start: 6,
  }));
  st.caps = caps;

  // 門：每個路口前面一對，一邊一隻
  const KINDS = [['+', 5], ['+', 8], ['×', 2], ['−', 3], ['−', 5], ['槍', 1], ['+', 3]];
  const gates = [];
  for (const j of juncs) {
    const pick = () => KINDS[(Math.random() * KINDS.length) | 0];
    let a = pick(), b = pick();
    if (a[0] === '−' && b[0] === '−') b = ['+', 4];
    gates.push({ s: j.s - 14, left: a, right: b, used: false });
  }
  // 障礙：廢車、路障
  const obstacles = [];
  for (let s = 70; s < L - 80; s += 26 + Math.random() * 30) {
    if (juncs.some(j => Math.abs(j.s - s) < 20)) continue;
    obstacles.push({ s, u: (Math.random() - 0.5) * (LANE - 4), w: 2 + Math.random() * 1.5, h: 4.2, hp: 60, kind: Math.random() < 0.7 ? 'car' : 'block' });
  }
  const zombies = [];
  const spawnZ = (s, u, type = 'walker', hp = 30) => zombies.push({ s, u, hp, maxHp: hp, type, r: type === 'boss' ? 1.8 : 0.6, speed: type === 'boss' ? 2 : type === 'runner' ? 4.5 : 2.2, flash: 0, wob: Math.random() * TAU, side: 0 });
  // 街上本身有啲散屍
  for (let s = 50; s < L - 60; s += 9) if (Math.random() < 0.5) spawnZ(s, (Math.random() - 0.5) * (LANE - 2), 'walker', 26 + s / 20);
  let bossSpawned = false, boss = null, finished = false;
  const jDone = new Set();

  const groupPos = c => ({ s: st.s, u: st.x + c.off });
  const groupR = c => 0.8 + Math.sqrt(c.n) * 0.42;

  function applyGate(g, side) {
    const [op, v] = side < 0 ? g.left : g.right;
    let c = caps[st.target];
    if (!c || !c.alive) c = caps.filter(k => k.alive).sort((a, b) => a.n - b.n)[0];
    if (!c) return;
    if (op === '+') c.n += v;
    else if (op === '×') c.n = Math.min(60, c.n * v);
    else if (op === '−') c.n = Math.max(0, c.n - v);
    else if (op === '槍') { c.tier++; st.loot.parts += 3; }
    toast(`${c.name}隊 ${op === '槍' ? '換新武器！' : op + v}`);
  }

  function update(dt, mv) {
    if (st.over) return;
    st.t += dt;
    const alive = caps.filter(c => c.alive);
    // 前進（屍王未死就停喺街尾）
    const stopAt = L - 55;
    if (!(bossSpawned && boss && boss.hp > 0 && st.s >= stopAt)) st.s = Math.min(L, st.s + SPEED * dt);
    st.x = Math.max(-LANE / 2 + 5, Math.min(LANE / 2 - 5, st.x + mv.x * 12 * dt));

    // 門
    for (const g of gates) if (!g.used && st.s >= g.s) { g.used = true; applyGate(g, st.x < 0 ? -1 : 1); }
    // 路口：橫街湧屍；大路口可以放大招
    for (const j of juncs) {
      if (!jDone.has(j) && st.s > j.s - 70) {
        jDone.add(j);
        const n = 8 + Math.floor(st.s / 40) + (j.w >= 10 ? 8 : 0), hp = 30 + st.s / 10;
        for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; spawnZ(j.s + (Math.random() - 0.5) * j.w, side * (LANE / 2 + 2 + Math.random() * 10), Math.random() < 0.25 ? 'runner' : 'walker', hp); zombies[zombies.length - 1].side = side; }
      }
      if (j.w >= 10 && Math.abs(st.s - j.s) < 25) { if (!st.ultReady && !j.ultUsed) { st.ultReady = true; st.ultJ = j; toast(`大路口：${j.name || '十字路口'}！撳「大招」`); } }
      else if (st.ultJ === j) st.ultReady = false;
      if (Math.abs(st.s - j.s) < 20) st.cross = j.name;
    }
    if (!bossSpawned && st.s > L - 110) { bossSpawned = true; spawnZ(L - 20, 0, 'boss', 2400 + st.s * 2); boss = zombies[zombies.length - 1]; toast('街尾有屍王！'); }

    // 小兵開火
    for (const c of alive) {
      const T = c.troop, dmgMul = (1 + 0.5 * (c.tier - 1)) * levelMul(c.lvl);
      c.fireT -= dt;
      if (T.regen && (c.regenT += dt) > T.regen) { c.regenT = 0; if (c.n < c.start * 3) c.n++; }
      if (c.fireT > 0 || c.n <= 0 && c.hp <= 0) continue;
      const p = groupPos(c), shooters = Math.max(1, c.n);
      let tgt = null, best = Infinity;
      for (const z of zombies) {
        const ds = z.s - p.s, du = Math.abs(z.u - p.u);
        if (ds < -2 || ds > T.range || du > (T.aoe ? 5 : 9)) continue;
        const v = T.sniper ? -z.hp : ds + du;
        if (v < best) { best = v; tgt = z; }
      }
      if (!tgt) { // 冇屍就打障礙
        for (const o of obstacles) if (o.hp > 0 && o.s - p.s > 0 && o.s - p.s < T.range && Math.abs(o.u - p.u) < 4) { o.hp -= T.dmg * shooters * dmgMul * 0.5; c.fireT = T.cd; effects.push({ kind: 'tracer', s0: p.s, u0: p.u, s1: o.s, u1: o.u, t: 0.08, life: 0.08 }); if (o.hp <= 0) { st.loot.parts += 1; } break; }
        continue;
      }
      c.fireT = T.cd;
      if (T.aoe) {
        for (const z of zombies) if (z.s - p.s > -1 && z.s - p.s < T.range && Math.abs(z.u - p.u) < 5) { z.hp -= T.dmg * shooters * dmgMul; z.flash = 0.08; }
        effects.push({ kind: 'flame', s: p.s, u: p.u, r: T.range, t: 0.3, life: 0.3 });
      } else {
        tgt.hp -= T.dmg * shooters * dmgMul; tgt.flash = 0.08;
        for (let k = 0; k < Math.min(4, shooters); k++) effects.push({ kind: 'tracer', s0: p.s + 0.5, u0: p.u + (k - 1.5) * 0.6, s1: tgt.s, u1: tgt.u, t: 0.07, life: 0.07, heavy: T.sniper });
      }
    }
    // 喪屍行埋嚟；撞到小隊就食咗小兵
    for (const z of zombies) {
      z.flash -= dt;
      if (z.hp <= 0) continue;
      let tgt = null, bd = Infinity;
      for (const c of alive) { const p = groupPos(c), d = Math.hypot(z.s - p.s, z.u - p.u); if (d < bd) { bd = d; tgt = c; } }
      if (!tgt) continue;
      const p = groupPos(tgt);
      if (bd < 40 || z.side) {
        const ds = p.s - z.s, du = p.u - z.u, d = Math.hypot(ds, du) || 1;
        z.s += ds / d * z.speed * dt; z.u += du / d * z.speed * dt;
        if (Math.abs(z.u) < LANE / 2) z.side = 0;
      }
      if (bd < groupR(tgt) + z.r) {
        if (z.type === 'boss') { // 屍王：每秒食幾個
          z.biteT = (z.biteT || 0) - dt;
          if (z.biteT <= 0) { z.biteT = 0.7; if (tgt.n > 0) tgt.n = Math.max(0, tgt.n - 2); else tgt.hp -= 30; }
          continue;
        }
        z.hp = 0;
        if (tgt.n > 0) tgt.n -= tgt.troop.shield ? (Math.random() < 0.5 ? 1 : 0) : 1;
        else tgt.hp -= 25;
      }
    }
    // 撞障礙
    for (const o of obstacles) {
      if (o.hp <= 0 || Math.abs(o.s - st.s) > o.h / 2 + 1) continue;
      for (const c of alive) if (Math.abs(groupPos(c).u - o.u) < o.w / 2 + groupR(c) * 0.6) { o.hp = 0; c.n = Math.max(0, c.n - 3); toast(`${c.name}隊撞到${o.kind === 'car' ? '廢車' : '路障'}！−3`); break; }
    }
    for (const c of caps) if (c.alive && c.hp <= 0) { c.alive = false; toast(`${c.name}倒下！`); }
    let j = 0;
    for (const z of zombies) { if (z.hp > 0 && z.s > st.s - 20) zombies[j++] = z; else if (z.hp <= 0 && z.s > st.s - 20) { st.kills++; st.loot.food += 0.06; st.loot.ammo += 0.05; } }
    zombies.length = j;
    for (const e of effects) e.t -= dt;
    j = 0;
    for (const e of effects) if (e.t > 0) effects[j++] = e;
    effects.length = j;

    if (!caps.some(c => c.alive)) { st.over = 'lose'; return; }
    if (st.s >= L && (!boss || boss.hp <= 0) && !finished) {
      finished = true;
      const allAlive = caps.every(c => c.alive);
      st.shards = allAlive ? 2 : 1;
      st.loot.food += 15; st.loot.meds += 5; st.loot.ammo += 10; st.loot.parts += 5;
      toast(`救到街尾嘅倖存者！招募碎片 +${st.shards}`);
      st.over = 'win';
    }
  }

  // 大路口大招：三個隊長一齊放，清走前面一大片
  function ult() {
    if (!st.ultReady) return false;
    st.ultReady = false; st.ultJ.ultUsed = true;
    for (const z of zombies) if (z.s - st.s > -5 && z.s - st.s < 30) { z.hp -= z.type === 'boss' ? 600 : 999; z.flash = 0.2; }
    effects.push({ kind: 'blast', s: st.s + 14, u: 0, r: 16, t: 0.6, life: 0.6 });
    toast('三隊一齊放大招！');
    return true;
  }

  // ---- 畫面：跑道向上（s 越大越上），小隊喺下面三分一 ----
  function render(ctx, W, H, dpr) {
    const z = Math.min(W / (LANE + 8), H / 30);
    const sy = s => H * 0.74 - (s - st.s) * z, ux = u => W / 2 + u * z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#23271f'; ctx.fillRect(0, 0, W, H);
    const s0 = st.s - H * 0.3 / z, s1 = st.s + H * 0.8 / z;
    // 騎樓街屋：兩邊每 4 米一間
    for (let s = Math.floor(s0 / 4) * 4; s < s1; s += 4) {
      for (const side of [-1, 1]) {
        const k = Math.abs(Math.sin(s * 12.9898 + side * 78.233)) * 1000 % 1;
        ctx.fillStyle = k < 0.3 ? '#2b2f28' : k < 0.6 ? '#272b24' : '#2f332b';
        const x0 = side < 0 ? 0 : ux(LANE / 2 + 1.5), x1 = side < 0 ? ux(-LANE / 2 - 1.5) : W;
        ctx.fillRect(x0, sy(s + 4), x1 - x0, 4 * z - 1);
        ctx.fillStyle = '#1b1e18'; // 騎樓柱
        ctx.fillRect(side < 0 ? ux(-LANE / 2 - 1.5) - 0.5 * z : ux(LANE / 2 + 1.5), sy(s + 4), 0.5 * z, 0.6 * z);
      }
    }
    ctx.fillStyle = '#33352f'; // 騎樓下行人路
    ctx.fillRect(ux(-LANE / 2 - 1.5), 0, 1.5 * z, H); ctx.fillRect(ux(LANE / 2), 0, 1.5 * z, H);
    ctx.fillStyle = '#3c3e3a'; ctx.fillRect(ux(-LANE / 2), 0, LANE * z, H);
    // 橫街
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const j of juncs) {
      if (j.s < s0 - 20 || j.s > s1 + 20) continue;
      const w = Math.max(6, j.w);
      ctx.fillStyle = '#3c3e3a'; ctx.fillRect(0, sy(j.s + w / 2), W, w * z);
      ctx.font = `900 ${Math.max(11, z * 1.4)}px "Noto Sans TC", sans-serif`;
      ctx.fillStyle = '#a9a796';
      if (j.name) { ctx.fillText(j.name, ux(-LANE / 2 - 6), sy(j.s)); ctx.fillText(j.name, ux(LANE / 2 + 6), sy(j.s)); }
    }
    ctx.setLineDash([3 * z, 4 * z]); ctx.strokeStyle = '#5f5b45'; ctx.lineWidth = 0.22 * z;
    ctx.beginPath(); ctx.moveTo(ux(0), 0); ctx.lineTo(ux(0), H); ctx.stroke(); ctx.setLineDash([]);
    // 店舖招牌（真實 OSM 店名）
    ctx.font = `700 ${Math.max(10, z * 1.1)}px "Noto Sans TC", sans-serif`;
    for (const g of signs) {
      if (g.s < s0 || g.s > s1) continue;
      const x = ux(g.side * (LANE / 2 + 5));
      ctx.fillStyle = g.type === 'pharmacy' ? '#4d774a' : g.type === 'police' ? '#45607a' : '#9c5228';
      const tw = ctx.measureText(g.name).width + 8;
      ctx.fillRect(x - tw / 2, sy(g.s) - 9, tw, 18);
      ctx.fillStyle = '#d9d6cc'; ctx.fillText(g.name, x, sy(g.s));
    }
    // 門
    for (const g of gates) {
      if (g.used || g.s < s0 || g.s > s1) continue;
      for (const [side, k] of [[-1, g.left], [1, g.right]]) {
        const good = k[0] !== '−';
        ctx.fillStyle = good ? 'rgba(93,107,79,.85)' : 'rgba(179,48,42,.75)';
        const x0 = side < 0 ? ux(-LANE / 2) : ux(0), w = LANE / 2 * z;
        ctx.fillRect(x0 + 2, sy(g.s) - 1.2 * z, w - 4, 2.4 * z);
        ctx.fillStyle = '#f1e9dc'; ctx.font = `900 ${Math.max(16, z * 2)}px "IBM Plex Mono", monospace`;
        ctx.fillText(k[0] === '槍' ? '武器↑' : k[0] + k[1], x0 + w / 2, sy(g.s));
      }
    }
    // 障礙
    for (const o of obstacles) {
      if (o.hp <= 0 || o.s < s0 || o.s > s1) continue;
      ctx.fillStyle = o.kind === 'car' ? '#5b3a2a' : '#6b6a5e';
      ctx.fillRect(ux(o.u - o.w / 2), sy(o.s + o.h / 2), o.w * z, o.h * z);
      if (o.kind === 'car') { ctx.fillStyle = '#1a1c1b'; ctx.fillRect(ux(o.u - o.w / 2 + 0.3), sy(o.s + 1), (o.w - 0.6) * z, 2 * z); }
    }
    // 喪屍
    for (const zz of zombies) {
      const x = ux(zz.u), y = sy(zz.s), r = zz.r * z;
      ctx.fillStyle = zz.flash > 0 ? '#d9c9b0' : zz.type === 'boss' ? '#521c19' : zz.type === 'runner' ? '#94402f' : '#7a3a30';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a2420'; ctx.lineWidth = 0.2 * z;
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x - r * 0.8, y + r * 1.3 + Math.sin(st.t * 6 + zz.wob) * 2); ctx.moveTo(x + r * 0.7, y); ctx.lineTo(x + r * 0.8, y + r * 1.2); ctx.stroke();
      if (zz.type === 'boss') { ctx.fillStyle = '#111'; ctx.fillRect(x - 3 * z, y - r - z, 6 * z, 0.5 * z); ctx.fillStyle = '#b3302a'; ctx.fillRect(x - 3 * z, y - r - z, 6 * z * Math.max(0, zz.hp / zz.maxHp), 0.5 * z); }
    }
    // 小隊
    ctx.font = `900 ${Math.max(10, z * 0.9)}px "Noto Sans TC", sans-serif`;
    caps.forEach((c, i) => {
      if (!c.alive) return;
      const p = groupPos(c), cx = ux(p.u), cy = sy(p.s);
      ctx.fillStyle = '#b8652a';
      for (let k = 0; k < Math.min(c.n, 60); k++) { const a = k * 2.4, rr = 0.9 + Math.sqrt(k) * 0.42; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr * z, cy + Math.abs(Math.sin(a)) * rr * z, 0.38 * z, 0, TAU); ctx.fill(); }
      ctx.fillStyle = st.target === i ? '#f2c27a' : '#e8842c';
      ctx.beginPath(); ctx.arc(cx, cy, 0.8 * z, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1c1410'; ctx.lineWidth = 0.15 * z; ctx.stroke();
      ctx.fillStyle = '#1c1410'; ctx.fillText(c.name[0] === '阿' || c.name[0] === '小' ? c.name[1] : c.name[0], cx, cy);
      ctx.fillStyle = '#d9d6cc'; ctx.fillText(String(c.n), cx, cy - 1.6 * z);
    });
    for (const e of effects) {
      const a = e.t / e.life;
      ctx.globalAlpha = a;
      if (e.kind === 'tracer') { ctx.strokeStyle = e.heavy ? '#e8e0c8' : '#f2c27a'; ctx.lineWidth = (e.heavy ? 0.22 : 0.12) * z; ctx.beginPath(); ctx.moveTo(ux(e.u0), sy(e.s0)); ctx.lineTo(ux(e.u1), sy(e.s1)); ctx.stroke(); }
      else if (e.kind === 'flame') { ctx.fillStyle = 'rgba(217,138,58,.5)'; ctx.beginPath(); ctx.moveTo(ux(e.u), sy(e.s)); ctx.lineTo(ux(e.u - 4), sy(e.s + e.r)); ctx.lineTo(ux(e.u + 4), sy(e.s + e.r)); ctx.closePath(); ctx.fill(); }
      else if (e.kind === 'blast') { ctx.fillStyle = '#c4612a'; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(ux(e.u), sy(e.s), e.r * z * (1.2 - a * 0.4), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  const setTarget = i => { st.target = st.target === i ? -1 : i; };
  return { kind: 'street', state: st, update, render, ult, setTarget, caps };
}
