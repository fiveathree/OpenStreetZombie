// 共用隊伍：成員（連等級、傷勢、羈絆）、狀態加成、受傷、倒地互救、自動攻擊。三個地圖都用。
import { ROLES, BLEED_TIME, REVIVE_TIME, REVIVE_RANGE, levelMul, INJURY_HP, ULT_BOOST_LEVEL, activeBonds } from './stats.js';
import { hero, factionBonds } from './heroes.js';

// opts：{ heroId, lvl, injured, bonds:[名], factions:[{name}] }。heroId 決定名、倍數（屍城日誌角色有自己數值）
export function createMember(role, x, y, opts = {}) {
  const R = ROLES[role], lv = levelMul(opts.lvl || 1), bonds = opts.bonds || [];
  const H = opts.heroId ? hero(opts.heroId) : null, mul = H?.mul || { hp: 1, dmg: 1, speed: 1 };
  const fmul = 1 + 0.08 * (opts.factions?.length || 0); // 陣營加成
  const m = {
    ...R, role, x, y, r: 0.7, lvl: opts.lvl || 1, heroId: opts.heroId || role, guest: !!opts.guest,
    name: H?.name || R.name, job: H?.job || R.job, rarity: H?.rarity, fa: H?.fa || [], glyph: H?.glyph,
    dmg: R.dmg * lv * mul.dmg * fmul, hp: R.hp * lv * mul.hp * fmul, maxHp: R.hp * lv * mul.hp * fmul, speed: R.speed * mul.speed,
    reviveMul: R.reviveMul || 1, pierce: R.pierce || 0, injured: !!opts.injured,
    ultInfo: R.ult, ult: 0, ultRate: 1, ultBoost: (opts.lvl || 1) >= ULT_BOOST_LEVEL ? 1.5 : 1,
    state: 'ok', bleed: 0, revive: 0, fireT: Math.random() * R.cd, healT: 0, aim: 0, face: 0, dir: 0, flash: 0, shotT: 0,
    buffs: {},
  };
  if (bonds.includes('戰地醫護')) { if (role === 'medic') m.heal *= 1.25; if (role === 'dps') { m.maxHp *= 1.25; m.hp = m.maxHp; } }
  if (bonds.includes('救援隊')) m.speed *= 1.08;
  if (H?.pet) { m.attack = 'shove'; m.range = 2; m.knock = 1; m.dmg = 14 * lv * mul.dmg * fmul; m.cd = 0.5; } // 貓狗：咬
  if (m.injured) { m.maxHp *= INJURY_HP; m.hp = m.maxHp; }
  return m;
}

// team：[{ role, heroId, lvl, injured }]，第一個一定係你
export function createSquad(x, y, team = [{ role: 'player' }, { role: 'tank' }, { role: 'medic' }, { role: 'dps' }]) {
  const ids = team.filter(t => t.role !== 'player').map(t => t.heroId || t.role);
  const bonds = activeBonds(ids).map(b => b.name);
  const factions = factionBonds(ids);
  const squad = team.map(t => createMember(t.role, x, y, { ...t, bonds, factions }));
  squad.bonds = [...bonds, ...factions.map(f => f.name)];
  squad.factions = factions;
  return squad;
}

// ---- 加成（限時）----
export function buff(m, kind, mul, t) { m.buffs[kind] = { mul, t }; }
export const bmul = (m, kind) => (m.buffs[kind] && m.buffs[kind].t > 0 ? m.buffs[kind].mul : 1);
export function tickBuffs(m, dt) { for (const k in m.buffs) m.buffs[k].t -= dt; }

export function hurt(m, amt) {
  if (m.state !== 'ok' || m.invuln > 0) return;
  m.hp -= amt * (1 - m.armor) * bmul(m, 'guard');
  m.flash = 0.12;
  if (m.hp <= 0) { m.hp = 0; m.state = 'down'; m.bleed = BLEED_TIME; m.revive = 0; }
}

export function heal(m, amt) {
  if (m.state === 'ok') m.hp = Math.min(m.maxHp, m.hp + amt);
}

// 大招充電：每殺一隻、同埋隨時間慢慢充
export function chargeUlt(squad, kills, dt) {
  for (const m of squad) if (m.state === 'ok') m.ult = Math.min(1, m.ult + (kills / (m.ultInfo.charge * 5) + dt / 70) * m.ultRate);
}

// 倒地：附近有隊友企住就慢慢救返（有人救緊就唔會流血）；冇人救，時間到就死
export function updateDowned(squad, dt) {
  for (const m of squad) {
    if (m.state !== 'down') continue;
    let rate = 0;
    for (const h of squad) {
      if (h !== m && h.state === 'ok' && Math.hypot(h.x - m.x, h.y - m.y) < REVIVE_RANGE) rate += h.reviveMul / REVIVE_TIME;
    }
    if (rate) m.revive += rate * dt;
    else { m.revive = Math.max(0, m.revive - dt * 0.3); m.bleed -= dt; }
    if (m.revive >= 1) reviveMember(m, 0.4);
    else if (m.bleed <= 0) m.state = 'dead';
  }
}
export function reviveMember(m, frac) { m.state = 'ok'; m.hp = m.maxHp * frac; m.revive = 0; m.invuln = 1; }

// world 要提供：zombiesNear(x, y, r, fn)、los(x0, y0, x1, y1)、hitZombie(z, dmg, knock, fromX, fromY)、effect(e)
export function autoAttack(m, world, dt, focus) {
  m.fireT -= dt;
  m.shotT -= dt;
  if (m.invuln > 0) m.invuln -= dt;
  if (m.state !== 'ok' || m.fireT > 0) return;
  const dmg = m.dmg * bmul(m, 'dmg'), cd = m.cd / bmul(m, 'rate');

  if (m.attack === 'shove') { // 坦克：推開身邊所有喪屍
    const hit = [];
    world.zombiesNear(m.x, m.y, m.range + 2, z => { if (Math.hypot(z.x - m.x, z.y - m.y) < m.range + z.r) hit.push(z); });
    if (!hit.length) return;
    for (const z of hit) world.hitZombie(z, dmg, m.knock, m.x, m.y);
    m.fireT = cd;
    world.effect({ kind: 'shove', x: m.x, y: m.y, r: m.range, t: 0.18, life: 0.18 });
    return;
  }

  // 揀目標：集火目標優先；狙擊揀最硬；其他揀最近、睇得到嘅
  let tgt = null;
  if (focus && focus.hp > 0 && !focus.dead && Math.hypot(focus.x - m.x, focus.y - m.y) <= m.range && world.los(m.x, m.y, focus.x, focus.y)) tgt = focus;
  if (!tgt) {
    const cand = [];
    world.zombiesNear(m.x, m.y, m.range + 6, z => {
      if (z.invuln) return; // 打唔入嘅（大地圖未開放嘅巢穴）唔好浪費子彈
      const d2 = (z.x - m.x) ** 2 + (z.y - m.y) ** 2, rr = m.range + (z.r > 1.5 ? z.r : 0); // 大目標（屍巢、巢穴）計埋佢個身
      if (d2 <= rr * rr) cand.push([m.sniper ? -z.hp : d2, z]);
    });
    cand.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < cand.length && k < 6; k++) if (world.los(m.x, m.y, cand[k][1].x, cand[k][1].y)) { tgt = cand[k][1]; break; }
  }
  if (!tgt) return;

  m.fireT = cd;
  m.shotT = 0.25;
  m.aim = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  const ux = Math.cos(m.aim), uy = Math.sin(m.aim);

  if (m.attack === 'flame') { // 控場：扇形火焰，燒同減慢
    world.zombiesNear(m.x, m.y, m.range + 1, z => {
      const ax = z.x - m.x, ay = z.y - m.y, d = Math.hypot(ax, ay);
      if (d < m.range + z.r && (ax * ux + ay * uy) / (d || 1) > 0.8) { world.hitZombie(z, dmg, 0, m.x, m.y); z.slowT = 1; z.slow = m.slow; }
    });
    world.effect({ kind: 'flame', x: m.x, y: m.y, a: m.aim, r: m.range, t: 0.14, life: 0.14 });
    return;
  }

  const hits = [tgt];
  if (m.pierce > 0) { // 穿透：沿彈道再打後面幾隻
    const cand = [];
    world.zombiesNear(m.x + ux * m.range / 2, m.y + uy * m.range / 2, m.range / 2 + 1, z => {
      if (z === tgt) return;
      const ax = z.x - m.x, ay = z.y - m.y, along = ax * ux + ay * uy;
      if (along > 0 && along < m.range && Math.abs(ax * uy - ay * ux) < z.r + 0.3) cand.push([along, z]);
    });
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, z] of cand.slice(0, m.pierce)) if (world.los(m.x, m.y, z.x, z.y)) hits.push(z);
  }
  let far = 0, end = tgt;
  for (const z of hits) {
    const d = Math.hypot(z.x - m.x, z.y - m.y);
    if (d > far) { far = d; end = z; }
    world.hitZombie(z, dmg, 0, m.x, m.y);
  }
  world.effect({ kind: 'tracer', x0: m.x + ux * 0.9, y0: m.y + uy * 0.9, x1: end.x, y1: end.y, t: m.sniper ? 0.18 : 0.07, life: m.sniper ? 0.18 : 0.07, player: m.role === 'player', heavy: m.sniper });
}
