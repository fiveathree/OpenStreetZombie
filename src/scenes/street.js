// 小地圖場景：一條真實街道就係一條跑道。小隊沿街向前衝，左右拖揀行邊邊；
// 真實路口有門（射得嘅加人門、乘人、減人、武器），喪屍由真實橫街同騎樓湧出嚟；路上有油桶、物資箱、被困倖存者；街尾有屍王。
import { ROLES, levelMul } from '../stats.js';

const TAU = Math.PI * 2;
const LANE = 16;          // 跑道闊（米）
const SPEED = 7.5;        // 向前衝速度（米／秒）
const MAX_LEN = 760;      // 最長跑幾遠
const CAP_MAX = 50;       // 每隊最多幾多兵

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

// cfg：{ captains:[{ role, heroId, name, lvl }], day, rescue() }
export function createStreetScene(map, cfg = {}) {
  const street = pickStreet(map, cfg.day || 0);
  const L = Math.min(MAX_LEN, street.len);
  const juncs = junctions(map, street).filter(j => j.s > 40 && j.s < L - 70);
  const signs = signsAlong(map, street).filter(s => s.s < L);
  const effects = [];
  const st = {
    t: 0, s: 0, x: 0, kills: 0, over: null, toasts: [], loot: { food: 0, meds: 0, parts: 0, ammo: 0 }, shards: 0, charShards: {},
    target: -1, ult: 0, ultReady: false, street: street.name, len: L, cross: '', freed: 0,
  };
  const toast = m => st.toasts.push(m);
  const R = (a, b) => a + Math.random() * (b - a);

  const capList = (cfg.captains || [{ role: 'tank' }, { role: 'dps' }, { role: 'medic' }]).slice(0, 3);
  const caps = capList.map((c, i) => ({
    role: c.role, heroId: c.heroId, name: c.name || ROLES[c.role].name, troop: TROOPS[c.role], lvl: c.lvl || 1,
    off: (i - (capList.length - 1) / 2) * 5, n: 8, tier: 1, hp: 100 * levelMul(c.lvl || 1), maxHp: 100 * levelMul(c.lvl || 1), alive: true, fireT: 0, regenT: 0, start: 8,
  }));
  st.caps = caps;

  // ---- 門：每個路口前面一對，路口之間都有；「＋」「−」門可以射，數字會升 ----
  const KINDS = [['+', 3], ['+', 5], ['×', 2], ['−', 4], ['−', 8], ['槍', 1], ['+', 2], ['×', 3]];
  const pickKind = () => { const k = KINDS[(Math.random() * KINDS.length) | 0]; return { op: k[0], v: k[1], dmg: 0 }; };
  const gates = [];
  const addGate = s => { const a = pickKind(); let b = pickKind(); if (a.op === '−' && b.op === '−') b = { op: '+', v: 2, dmg: 0 }; gates.push({ s, left: a, right: b, used: false }); };
  for (const j of juncs) addGate(j.s - 14);
  for (let s = 55; s < L - 90; s += 55) if (!gates.some(g => Math.abs(g.s - s) < 25)) addGate(s);

  // ---- 路上嘢：廢車、路障、油桶、物資箱、被困倖存者（全部可以射）----
  const items = [];
  const clear = s => !gates.some(g => Math.abs(g.s - s) < 10) && !juncs.some(j => Math.abs(j.s - s) < 8);
  for (let s = 45; s < L - 80; s += R(9, 16)) {
    if (!clear(s)) continue;
    const k = Math.random(), u = R(-LANE / 2 + 2, LANE / 2 - 2);
    if (k < 0.25) items.push({ kind: 'car', s, u, w: R(2, 3), h: 4.2, hp: 90 });
    else if (k < 0.35) items.push({ kind: 'block', s, u, w: 3, h: 1.2, hp: 60 });
    else if (k < 0.6) items.push({ kind: 'barrel', s, u, w: 1.2, h: 1.2, hp: 30 });
    else if (k < 0.78) items.push({ kind: 'crate', s, u, w: 1.8, h: 1.8, hp: 90 + s / 5 });
    else if (k < 0.9) items.push({ kind: 'cage', s, u, w: 2.2, h: 2.2, hp: 70 + s / 8 });
  }
  for (const it of items) it.max = it.hp;
  const zombies = [];
  const spawnZ = (s, u, type = 'walker', hp = 30, side = 0) => {
    const big = type === 'boss' || type === 'brute';
    zombies.push({ s, u, hp, maxHp: hp, type, r: type === 'boss' ? 1.8 : type === 'brute' ? 1.2 : 0.6, speed: big ? 2 : type === 'runner' ? 4.5 : 2.2, flash: 0, wob: Math.random() * TAU, side });
  };
  const troops = () => caps.reduce((a, c) => a + (c.alive ? c.n : 0), 0);
  const zHp = s => (26 + s / 9) * (1 + troops() / 90); // 兵越多，屍越硬
  let bossSpawned = false, boss = null, finished = false, nextRow = 30, nextAmbush = 9, nextBrute = 160;
  const jDone = new Set();
  const later = []; // 連環爆：下一格先爆

  const groupPos = c => ({ s: st.s, u: st.x + c.off });
  const groupR = c => 0.8 + Math.sqrt(c.n) * 0.42;
  const pickCap = () => { const c = caps[st.target]; return c && c.alive ? c : caps.filter(k => k.alive).sort((a, b) => a.n - b.n)[0]; };

  function applyGate(g, side) {
    const k = side < 0 ? g.left : g.right, c = pickCap();
    if (!c) return;
    if (k.op === '+') c.n = Math.min(CAP_MAX, c.n + k.v);
    else if (k.op === '×') c.n = Math.min(CAP_MAX, c.n + Math.min(30, c.n * (k.v - 1)));
    else if (k.op === '−') c.n = Math.max(0, c.n - k.v);
    else if (k.op === '槍') { c.tier++; st.loot.parts += 3; }
    effects.push({ kind: 'pop', s: g.s, u: side * LANE / 4, t: 0.5, life: 0.5, good: k.op !== '−' });
    toast(`${c.name}隊 ${k.op === '槍' ? '換新武器！' : k.op + k.v}`);
  }
  function blast(s, u, r, dmg) {
    effects.push({ kind: 'blast', s, u, r, t: 0.5, life: 0.5 });
    for (const z of zombies) if (Math.hypot(z.s - s, z.u - u) < r + z.r) { z.hp -= dmg; z.flash = 0.15; }
    for (const it of items) if (it.hp > 0 && it.kind === 'barrel' && Math.hypot(it.s - s, it.u - u) < r) { it.hp = 0; later.push(() => breakItem(it)); }
  }
  function breakItem(it) {
    if (it.broken) return;
    it.broken = true; it.hp = 0;
    if (it.kind === 'barrel') { blast(it.s, it.u, 6, 220); toast('油桶爆炸！'); }
    else if (it.kind === 'crate') {
      const c = pickCap(); if (!c) return;
      const r = Math.random();
      if (r < 0.4) { c.n = Math.min(CAP_MAX, c.n + 6); toast(`物資箱：${c.name}隊 +6`); }
      else if (r < 0.7) { c.tier++; toast(`物資箱：${c.name}隊武器升級！`); }
      else { st.ult = 1; toast('物資箱：大招充滿！'); }
      st.loot.ammo += 2; st.loot.parts += 2;
    } else if (it.kind === 'cage') {
      const c = pickCap(); if (c) c.n = Math.min(CAP_MAX, c.n + 4);
      st.freed++;
      const who = st.freed % 3 === 0 && cfg.rescue ? cfg.rescue() : null;
      if (who) { st.charShards[who.id] = (st.charShards[who.id] || 0) + 1; toast(`籠入面係 ${who.name}（${who.rarity}）！專屬碎片 +1`); }
      else toast(`救出被困嘅人：${c ? c.name + '隊' : ''} +4`);
    } else st.loot.parts += 1;
  }

  function update(dt, mv) {
    if (st.over) return;
    st.t += dt;
    for (const f of later.splice(0)) f();
    const alive = caps.filter(c => c.alive);
    const stopAt = L - 55;
    if (!(bossSpawned && boss && boss.hp > 0 && st.s >= stopAt)) st.s = Math.min(L, st.s + SPEED * dt);
    st.x = Math.max(-LANE / 2 + 5, Math.min(LANE / 2 - 5, st.x + mv.x * 12 * dt));

    // ---- 出屍：前面一排排湧過嚟、騎樓伏擊、大隻佬、路口屍潮 ----
    if (st.s + 70 > nextRow && nextRow < L - 70) {
      const n = Math.round(3 + nextRow / 70 + troops() / 18);
      for (let i = 0; i < n; i++) spawnZ(nextRow + R(0, 6), R(-LANE / 2 + 1, LANE / 2 - 1), Math.random() < 0.2 ? 'runner' : 'walker', zHp(nextRow));
      nextRow += R(10, 16);
    }
    if (st.t > nextAmbush && st.s < L - 90) {
      nextAmbush = st.t + R(6, 10);
      const side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 5; i++) spawnZ(st.s + R(18, 30), side * (LANE / 2 + R(3, 8)), 'runner', zHp(st.s) * 0.8, side);
      toast(side < 0 ? '左邊騎樓有屍衝出嚟！' : '右邊騎樓有屍衝出嚟！');
    }
    if (st.s + 60 > nextBrute && nextBrute < L - 120) { spawnZ(nextBrute, R(-4, 4), 'brute', 500 + nextBrute * 1.5); toast('前面有大隻佬！'); nextBrute += 160; }
    for (const j of juncs) {
      if (!jDone.has(j) && st.s > j.s - 70) {
        jDone.add(j);
        const n = 8 + Math.floor(st.s / 40) + (j.w >= 10 ? 8 : 0);
        for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; spawnZ(j.s + R(-j.w / 2, j.w / 2), side * (LANE / 2 + 2 + R(0, 10)), Math.random() < 0.25 ? 'runner' : 'walker', zHp(j.s), side); }
        if (j.name) toast(`${j.name}路口屍潮！`);
      }
      if (j.w >= 10 && Math.abs(st.s - j.s) < 25 && !j.ultUsed && st.ult < 1) { st.ult = 1; st.ultJ = j; toast(`大路口：${j.name || '十字路口'}！大招充滿`); }
      if (Math.abs(st.s - j.s) < 20) st.cross = j.name;
    }
    if (!bossSpawned && st.s > L - 110) { bossSpawned = true; spawnZ(L - 20, 0, 'boss', 2400 + st.s * 2); boss = zombies[zombies.length - 1]; toast('街尾有屍王！'); }

    // ---- 小兵開火：前面嘅屍優先，冇就射門、射路上嘢 ----
    for (const c of alive) {
      const T = c.troop, dmgMul = (1 + 0.5 * (c.tier - 1)) * levelMul(c.lvl);
      c.fireT -= dt;
      if (T.regen && (c.regenT += dt) > T.regen) { c.regenT = 0; if (c.n < c.start * 3) c.n++; }
      if (c.fireT > 0) continue;
      const p = groupPos(c), shooters = Math.max(1, c.n), dmg = T.dmg * shooters * dmgMul;
      let tgt = null, best = Infinity;
      for (const z of zombies) {
        const ds = z.s - p.s, du = Math.abs(z.u - p.u);
        if (ds < -2 || ds > T.range || du > (T.aoe ? 5 : 9)) continue;
        const v = T.sniper ? -z.hp : ds + du;
        if (v < best) { best = v; tgt = z; }
      }
      if (tgt) {
        c.fireT = T.cd;
        if (T.aoe) {
          for (const z of zombies) if (z.s - p.s > -1 && z.s - p.s < T.range && Math.abs(z.u - p.u) < 5) { z.hp -= dmg; z.flash = 0.08; }
          effects.push({ kind: 'flame', s: p.s, u: p.u, r: T.range, t: 0.3, life: 0.3 });
        } else {
          tgt.hp -= dmg; tgt.flash = 0.08;
          for (let k = 0; k < Math.min(4, shooters); k++) effects.push({ kind: 'tracer', s0: p.s + 0.5, u0: p.u + (k - 1.5) * 0.6, s1: tgt.s, u1: tgt.u, t: 0.07, life: 0.07, heavy: T.sniper });
        }
        continue;
      }
      let thing = null, tb = Infinity; // 同一條直線上最近嘅嘢或者門
      for (const it of items) if (it.hp > 0 && it.s - p.s > 0 && it.s - p.s < T.range && Math.abs(it.u - p.u) < it.w / 2 + 2 && it.s - p.s < tb) { tb = it.s - p.s; thing = it; }
      for (const g of gates) {
        if (g.used || g.s - p.s <= 2 || g.s - p.s > T.range || g.s - p.s > tb) continue;
        const k = p.u < 0 ? g.left : g.right;
        if (k.op === '+' || k.op === '−') { tb = g.s - p.s; thing = { gate: g, k }; }
      }
      if (!thing) continue;
      c.fireT = T.cd;
      const ts = thing.gate ? thing.gate.s : thing.s, tu = thing.gate ? (p.u < 0 ? -LANE / 4 : LANE / 4) : thing.u;
      effects.push({ kind: 'tracer', s0: p.s + 0.5, u0: p.u, s1: ts, u1: tu, t: 0.07, life: 0.07 });
      if (thing.gate) { // 射門：每 25 點傷害 +1（−門會慢慢變 +）
        const k = thing.k;
        k.dmg += dmg;
        const need = () => 25 * (1 + (k.op === '+' ? k.v : 0) / 4); // 越高越難射
        while (k.dmg >= need() && !(k.op === '+' && k.v >= 15)) { k.dmg -= need(); if (k.op === '−') { k.v--; if (k.v <= 0) { k.op = '+'; k.v = 1; } } else k.v++; }
      } else { thing.hp -= dmg; if (thing.hp <= 0) breakItem(thing); }
    }

    // ---- 喪屍行埋嚟；撞到小隊就食咗小兵 ----
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
        if (z.type === 'boss' || z.type === 'brute') { // 大隻：慢慢食
          z.biteT = (z.biteT || 0) - dt;
          if (z.biteT <= 0) { z.biteT = 0.7; const k = z.type === 'boss' ? 2 : 1; if (tgt.n > 0) tgt.n = Math.max(0, tgt.n - k); else tgt.hp -= 30; }
          continue;
        }
        z.hp = 0; z.bit = true;
        if (tgt.n > 0) tgt.n -= tgt.troop.shield ? (Math.random() < 0.5 ? 1 : 0) : 1;
        else tgt.hp -= 25;
      }
    }
    for (const g of gates) if (!g.used && st.s >= g.s) { g.used = true; applyGate(g, st.x < 0 ? -1 : 1); }
    for (const it of items) { // 撞路上嘢
      if (it.hp <= 0 || Math.abs(it.s - st.s) > it.h / 2 + 1) continue;
      for (const c of alive) if (Math.abs(groupPos(c).u - it.u) < it.w / 2 + groupR(c) * 0.6) {
        if (it.kind === 'barrel' || it.kind === 'crate' || it.kind === 'cage') breakItem(it);
        else { it.hp = 0; c.n = Math.max(0, c.n - 3); toast(`${c.name}隊撞到${it.kind === 'car' ? '廢車' : '路障'}！−3`); }
        break;
      }
    }
    for (const c of caps) if (c.alive && c.hp <= 0) { c.alive = false; toast(`${c.name}倒下！`); }
    let j = 0, kills = 0;
    for (const z of zombies) { if (z.hp > 0 && z.s > st.s - 20) zombies[j++] = z; else if (z.hp <= 0 && !z.bit) kills++; }
    zombies.length = j;
    st.kills += kills; st.loot.food += kills * 0.05; st.loot.ammo += kills * 0.04;
    st.ult = Math.min(1, st.ult + kills / 160);
    st.ultReady = st.ult >= 1;
    for (const e of effects) e.t -= dt;
    j = 0;
    for (const e of effects) if (e.t > 0) effects[j++] = e;
    effects.length = j;

    if (!caps.some(c => c.alive)) { st.over = 'lose'; return; }
    if (st.s >= L && (!boss || boss.hp <= 0) && !finished) {
      finished = true;
      st.shards += caps.every(c => c.alive) ? 2 : 1;
      const who = cfg.rescue ? cfg.rescue() : null;
      if (who) { st.charShards[who.id] = (st.charShards[who.id] || 0) + 1; toast(`街尾救到 ${who.name}（${who.rarity}）！`); }
      st.loot.food += 15; st.loot.meds += 5; st.loot.ammo += 10; st.loot.parts += 5;
      st.over = 'win';
    }
  }

  // 大招：三隊一齊放，清走前面一大片（殺屍充電，大路口即刻充滿）
  function ult() {
    if (st.ult < 1) return false;
    st.ult = 0; st.ultReady = false; if (st.ultJ) st.ultJ.ultUsed = true;
    for (const z of zombies) if (z.s - st.s > -5 && z.s - st.s < 32) { z.hp -= z.type === 'boss' ? 600 : z.type === 'brute' ? 400 : 999; z.flash = 0.2; }
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
    for (let s = Math.floor(s0 / 4) * 4; s < s1; s += 4) { // 騎樓街屋
      for (const side of [-1, 1]) {
        const k = Math.abs(Math.sin(s * 12.9898 + side * 78.233)) * 1000 % 1;
        ctx.fillStyle = k < 0.3 ? '#2b2f28' : k < 0.6 ? '#272b24' : '#2f332b';
        const x0 = side < 0 ? 0 : ux(LANE / 2 + 1.5), x1 = side < 0 ? ux(-LANE / 2 - 1.5) : W;
        ctx.fillRect(x0, sy(s + 4), x1 - x0, 4 * z - 1);
        ctx.fillStyle = '#1b1e18';
        ctx.fillRect(side < 0 ? ux(-LANE / 2 - 1.5) - 0.5 * z : ux(LANE / 2 + 1.5), sy(s + 4), 0.5 * z, 0.6 * z);
        if (k > 0.85) { ctx.fillStyle = '#4d3b2c'; ctx.fillRect(side < 0 ? ux(-LANE / 2 - 1.2) : ux(LANE / 2 + 0.3), sy(s + 2), 0.9 * z, 0.35 * z); } // 倒地機車
      }
    }
    ctx.fillStyle = '#33352f';
    ctx.fillRect(ux(-LANE / 2 - 1.5), 0, 1.5 * z, H); ctx.fillRect(ux(LANE / 2), 0, 1.5 * z, H);
    ctx.fillStyle = '#3c3e3a'; ctx.fillRect(ux(-LANE / 2), 0, LANE * z, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const j of juncs) { // 橫街（真實街名）
      if (j.s < s0 - 20 || j.s > s1 + 20) continue;
      const w = Math.max(6, j.w);
      ctx.fillStyle = '#3c3e3a'; ctx.fillRect(0, sy(j.s + w / 2), W, w * z);
      ctx.font = `900 ${Math.max(11, z * 1.2)}px "Noto Sans TC", sans-serif`;
      ctx.fillStyle = '#a9a796';
      if (j.name) { ctx.fillText(j.name, ux(-LANE / 2 - 5), sy(j.s)); ctx.fillText(j.name, ux(LANE / 2 + 5), sy(j.s)); }
    }
    ctx.setLineDash([3 * z, 4 * z]); ctx.strokeStyle = '#5f5b45'; ctx.lineWidth = 0.22 * z;
    ctx.beginPath(); ctx.moveTo(ux(0), 0); ctx.lineTo(ux(0), H); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `700 ${Math.max(10, z * 1)}px "Noto Sans TC", sans-serif`;
    for (const g of signs) { // 真實店名招牌
      if (g.s < s0 || g.s > s1) continue;
      const x = ux(g.side * (LANE / 2 + 4.5));
      ctx.fillStyle = g.type === 'pharmacy' ? '#4d774a' : g.type === 'police' ? '#45607a' : '#9c5228';
      const tw = ctx.measureText(g.name).width + 8;
      ctx.fillRect(x - tw / 2, sy(g.s) - 9, tw, 18);
      ctx.fillStyle = '#d9d6cc'; ctx.fillText(g.name, x, sy(g.s));
    }
    for (const g of gates) { // 門
      if (g.used || g.s < s0 || g.s > s1) continue;
      for (const [side, k] of [[-1, g.left], [1, g.right]]) {
        ctx.fillStyle = k.op === '−' ? 'rgba(179,48,42,.75)' : 'rgba(93,107,79,.85)';
        const x0 = side < 0 ? ux(-LANE / 2) : ux(0), w = LANE / 2 * z;
        ctx.fillRect(x0 + 2, sy(g.s) - 1.2 * z, w - 4, 2.4 * z);
        if (k.dmg > 0) { ctx.fillStyle = 'rgba(241,233,220,.4)'; ctx.fillRect(x0 + 2, sy(g.s) + 0.9 * z, (w - 4) * Math.min(1, k.dmg / (25 * (1 + (k.op === '+' ? k.v : 0) / 4))), 0.3 * z); }
        ctx.fillStyle = '#f1e9dc'; ctx.font = `900 ${Math.max(16, z * 1.8)}px "IBM Plex Mono", monospace`;
        ctx.fillText(k.op === '槍' ? '武器↑' : k.op + k.v, x0 + w / 2, sy(g.s));
      }
    }
    for (const it of items) { // 路上嘢
      if (it.hp <= 0 || it.s < s0 || it.s > s1) continue;
      const x = ux(it.u - it.w / 2), y = sy(it.s + it.h / 2), w = it.w * z, h = it.h * z;
      if (it.kind === 'car') { ctx.fillStyle = '#5b3a2a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#1a1c1b'; ctx.fillRect(x + 0.3 * z, sy(it.s + 1), w - 0.6 * z, 2 * z); }
      else if (it.kind === 'block') { ctx.fillStyle = '#6b6a5e'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#b5592a'; for (let k = 0; k < 3; k++) ctx.fillRect(x + k * w / 3, y, w / 6, h); }
      else if (it.kind === 'barrel') { ctx.fillStyle = '#8a3a24'; ctx.beginPath(); ctx.arc(ux(it.u), sy(it.s), 0.6 * z, 0, TAU); ctx.fill(); ctx.fillStyle = '#d9a060'; ctx.font = `900 ${Math.max(9, z * 0.7)}px "Noto Sans TC", sans-serif`; ctx.fillText('油', ux(it.u), sy(it.s)); }
      else if (it.kind === 'crate') { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#4a3a20'; ctx.lineWidth = 0.15 * z; ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.stroke(); }
      else if (it.kind === 'cage') {
        ctx.fillStyle = '#d9d6cc'; ctx.beginPath(); ctx.arc(ux(it.u), sy(it.s), 0.45 * z, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6b6a5e'; ctx.lineWidth = 0.15 * z; ctx.strokeRect(x, y, w, h);
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * w / 4, y); ctx.lineTo(x + k * w / 4, y + h); ctx.stroke(); }
      }
      if ((it.kind === 'crate' || it.kind === 'cage' || it.kind === 'barrel') && it.hp < it.max) { ctx.fillStyle = '#111'; ctx.fillRect(x, y - 0.5 * z, w, 0.25 * z); ctx.fillStyle = '#cfc8b4'; ctx.fillRect(x, y - 0.5 * z, w * it.hp / it.max, 0.25 * z); }
    }
    for (const zz of zombies) { // 喪屍
      const x = ux(zz.u), y = sy(zz.s), r = zz.r * z;
      ctx.fillStyle = zz.flash > 0 ? '#d9c9b0' : zz.type === 'boss' ? '#521c19' : zz.type === 'brute' ? '#6a5236' : zz.type === 'runner' ? '#94402f' : '#7a3a30';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a2420'; ctx.lineWidth = 0.2 * z;
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x - r * 0.8, y + r * 1.3 + Math.sin(st.t * 6 + zz.wob) * 2); ctx.moveTo(x + r * 0.7, y); ctx.lineTo(x + r * 0.8, y + r * 1.2); ctx.stroke();
      if (zz.type === 'boss' || zz.type === 'brute') { const bw = zz.r * 3.3 * z; ctx.fillStyle = '#111'; ctx.fillRect(x - bw / 2, y - r - z, bw, 0.5 * z); ctx.fillStyle = '#b3302a'; ctx.fillRect(x - bw / 2, y - r - z, bw * Math.max(0, zz.hp / zz.maxHp), 0.5 * z); }
    }
    caps.forEach((c, i) => { // 小隊
      if (!c.alive) return;
      const p = groupPos(c), cx = ux(p.u), cy = sy(p.s);
      ctx.fillStyle = '#b8652a';
      for (let k = 0; k < Math.min(c.n, 80); k++) { const a = k * 2.4, rr = 0.9 + Math.sqrt(k) * 0.42; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr * z, cy + Math.abs(Math.sin(a)) * rr * z, 0.38 * z, 0, TAU); ctx.fill(); }
      ctx.fillStyle = st.target === i ? '#f2c27a' : '#e8842c';
      ctx.beginPath(); ctx.arc(cx, cy, 0.8 * z, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1c1410'; ctx.lineWidth = 0.15 * z; ctx.stroke();
      ctx.font = `900 ${Math.max(10, z * 0.9)}px "Noto Sans TC", sans-serif`;
      ctx.fillStyle = '#1c1410'; ctx.fillText([...c.name].find(ch => ch !== '阿' && ch !== '小' && ch !== ' ') || c.name[0], cx, cy);
      ctx.fillStyle = '#f1e9dc'; ctx.font = `900 ${Math.max(13, z * 1.2)}px "IBM Plex Mono", monospace`; ctx.fillText(String(c.n), cx, cy - 1.8 * z);
    });
    for (const e of effects) {
      const a = e.t / e.life;
      ctx.globalAlpha = a;
      if (e.kind === 'tracer') { ctx.strokeStyle = e.heavy ? '#e8e0c8' : '#f2c27a'; ctx.lineWidth = (e.heavy ? 0.22 : 0.12) * z; ctx.beginPath(); ctx.moveTo(ux(e.u0), sy(e.s0)); ctx.lineTo(ux(e.u1), sy(e.s1)); ctx.stroke(); }
      else if (e.kind === 'flame') { ctx.fillStyle = 'rgba(217,138,58,.5)'; ctx.beginPath(); ctx.moveTo(ux(e.u), sy(e.s)); ctx.lineTo(ux(e.u - 4), sy(e.s + e.r)); ctx.lineTo(ux(e.u + 4), sy(e.s + e.r)); ctx.closePath(); ctx.fill(); }
      else if (e.kind === 'blast') { ctx.fillStyle = '#c4612a'; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(ux(e.u), sy(e.s), e.r * z * (1.2 - a * 0.4), 0, TAU); ctx.fill(); }
      else if (e.kind === 'pop') { ctx.strokeStyle = e.good ? '#8fbf7a' : '#d94a3a'; ctx.lineWidth = 0.3 * z; ctx.beginPath(); ctx.arc(ux(e.u), sy(e.s), (1 - a) * 6 * z, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }

  const setTarget = i => { st.target = st.target === i ? -1 : i; };
  return { kind: 'street', state: st, update, render, ult, setTarget, caps };
}
