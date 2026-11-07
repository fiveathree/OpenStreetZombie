// 共用隊伍：成員、受傷、倒地互救、自動攻擊。三個地圖都用。
import { ROLES, BLEED_TIME, REVIVE_TIME, REVIVE_RANGE } from './stats.js';

export function createMember(role, x, y) {
  const R = ROLES[role];
  return {
    ...R, role, x, y, r: 0.7, maxHp: R.hp, reviveMul: R.reviveMul || 1, pierce: R.pierce || 0,
    state: 'ok', bleed: 0, revive: 0, fireT: Math.random() * R.cd, healT: 0, aim: 0, face: 0, dir: 0, flash: 0, shotT: 0,
  };
}

export function createSquad(x, y, roles = ['player', 'tank', 'medic', 'dps']) {
  return roles.map(r => createMember(r, x, y));
}

export function hurt(m, amt) {
  if (m.state !== 'ok') return;
  m.hp -= amt * (1 - m.armor);
  m.flash = 0.12;
  if (m.hp <= 0) { m.hp = 0; m.state = 'down'; m.bleed = BLEED_TIME; m.revive = 0; }
}

export function heal(m, amt) {
  if (m.state === 'ok') m.hp = Math.min(m.maxHp, m.hp + amt);
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
    if (m.revive >= 1) { m.state = 'ok'; m.hp = m.maxHp * 0.4; m.revive = 0; }
    else if (m.bleed <= 0) m.state = 'dead';
  }
}

// world 要提供：zombiesNear(x, y, r, fn)、los(x0, y0, x1, y1)、hitZombie(z, dmg, knock, fromX, fromY)、effect(e)
export function autoAttack(m, world, dt, focus) {
  m.fireT -= dt;
  m.shotT -= dt;
  if (m.state !== 'ok' || m.fireT > 0) return;

  if (m.attack === 'shove') { // 坦克：推開身邊所有喪屍
    const hit = [];
    world.zombiesNear(m.x, m.y, m.range + 2, z => { if (Math.hypot(z.x - m.x, z.y - m.y) < m.range + z.r) hit.push(z); });
    if (!hit.length) return;
    for (const z of hit) world.hitZombie(z, m.dmg, m.knock, m.x, m.y);
    m.fireT = m.cd;
    world.effect({ kind: 'shove', x: m.x, y: m.y, r: m.range, t: 0.18, life: 0.18 });
    return;
  }

  // 槍：集火目標優先，否則揀最近、睇得到嘅
  let tgt = null;
  if (focus && focus.hp > 0 && Math.hypot(focus.x - m.x, focus.y - m.y) <= m.range && world.los(m.x, m.y, focus.x, focus.y)) tgt = focus;
  if (!tgt) {
    const cand = [];
    world.zombiesNear(m.x, m.y, m.range, z => {
      const d2 = (z.x - m.x) ** 2 + (z.y - m.y) ** 2;
      if (d2 <= m.range * m.range) cand.push([d2, z]);
    });
    cand.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < cand.length && k < 6; k++) if (world.los(m.x, m.y, cand[k][1].x, cand[k][1].y)) { tgt = cand[k][1]; break; }
  }
  if (!tgt) return;

  m.fireT = m.cd;
  m.shotT = 0.25;
  m.aim = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  const ux = Math.cos(m.aim), uy = Math.sin(m.aim);
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
    world.hitZombie(z, m.dmg, 0, m.x, m.y);
  }
  world.effect({ kind: 'tracer', x0: m.x + ux * 0.9, y0: m.y + uy * 0.9, x1: end.x, y1: end.y, t: 0.07, life: 0.07, player: m.role === 'player' });
}
