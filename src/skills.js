// 共用技能：大招、火區、組合技（火海）。三個地圖都用。
// world 要提供：squad、zombiesNear、hitZombie、effect、toast(msg)、zones（陣列）、taunt（物件或 null）
import { heal, buff, reviveMember } from './squad.js';

// 搵附近喪屍最密嗰點
function densest(world, x, y, range) {
  const list = [];
  world.zombiesNear(x, y, range, z => list.push(z));
  let best = null, bn = 0;
  for (const z of list) {
    let n = 0;
    for (const o of list) if ((o.x - z.x) ** 2 + (o.y - z.y) ** 2 < 16) n++;
    if (n > bn) { bn = n; best = z; }
  }
  return best ? { x: best.x, y: best.y, n: bn, total: list.length } : null;
}
const countNear = (world, x, y, r) => { let n = 0; world.zombiesNear(x, y, r, z => { if ((z.x - x) ** 2 + (z.y - y) ** 2 < r * r) n++; }); return n; };

function blast(world, x, y, r, dmg, from) {
  world.effect({ kind: 'blast', x, y, r, t: 0.4, life: 0.4 });
  const hit = [];
  world.zombiesNear(x, y, r, z => { if (Math.hypot(z.x - x, z.y - y) < r + z.r) hit.push(z); });
  for (const z of hit) world.hitZombie(z, dmg, 1.2, x, y, from);
}

// 喺火區入面爆炸 = 組合技「火海」
function comboFire(world, x, y) {
  for (const zn of world.zones) {
    if (zn.kind === 'fire' && Math.hypot(zn.x - x, zn.y - y) < zn.r + 2 && !zn.combo) {
      zn.combo = true; zn.r *= 1.5; zn.dps *= 1.6; zn.t += 4; zn.life += 4;
      world.toast('組合技：火海！');
      return true;
    }
  }
  return false;
}

// 放大招；target（可選）= 指定位置。返回有冇放到
export function castUlt(m, world, target) {
  if (m.state !== 'ok' || m.ult < 1) return false;
  const k = m.ultBoost, bonds = world.squad.bonds || [];
  switch (m.role) {
    case 'player': {
      const p = target || densest(world, m.x, m.y, 14);
      if (!p) return false;
      const r = 4.2 * (bonds.includes('土製炸彈') ? 1.4 : 1);
      blast(world, p.x, p.y, r, m.dmg * 10 * k, m);
      comboFire(world, p.x, p.y);
      break;
    }
    case 'tank':
      world.taunt = { m, t: 6 * k };
      buff(m, 'guard', 0.5, 6 * k);
      world.effect({ kind: 'shout', x: m.x, y: m.y, r: 12, t: 0.6, life: 0.6 });
      break;
    case 'medic':
      for (const o of world.squad) {
        if (o.state === 'ok') heal(o, o.maxHp * 0.4 * k);
        else if (o.state === 'down' && Math.hypot(o.x - m.x, o.y - m.y) < 9) reviveMember(o, 0.5);
      }
      world.effect({ kind: 'shout', x: m.x, y: m.y, r: 9, t: 0.6, life: 0.6, heal: true });
      break;
    case 'dps':
      buff(m, 'rate', 3, 5 * k);
      break;
    case 'control': {
      const p = target || densest(world, m.x, m.y, 12) || m;
      const fire2 = bonds.includes('火海加倍');
      world.zones.push({ kind: 'fire', x: p.x, y: p.y, r: 5 * (fire2 ? 1.3 : 1), dps: 30 * k * (fire2 ? 2 : 1), t: 7, life: 7, from: m });
      world.effect({ kind: 'blast', x: p.x, y: p.y, r: 3, t: 0.3, life: 0.3 });
      break;
    }
    case 'support':
      for (const o of world.squad) if (o.state === 'ok') { buff(o, 'dmg', 1.3, 8 * k); buff(o, 'speed', 1.3, 8 * k); }
      world.effect({ kind: 'shout', x: m.x, y: m.y, r: 10, t: 0.6, life: 0.6 });
      break;
  }
  m.ult = 0;
  world.toast(`${m.name}：${m.ultInfo.name}！`);
  return true;
}

// 隊友 AI 幾時自己放大招
export function wantsUlt(m, world, leader) {
  if (m.ult < 1 || m.state !== 'ok') return false;
  switch (m.role) {
    case 'tank': return countNear(world, leader.x, leader.y, 8) >= 5;
    case 'medic': return world.squad.some(o => (o.state === 'down' && Math.hypot(o.x - m.x, o.y - m.y) < 9) || (o.state === 'ok' && o.hp / o.maxHp < 0.4));
    case 'dps': return countNear(world, m.x, m.y, m.range) >= 6;
    case 'control': return countNear(world, m.x, m.y, 10) >= 6;
    case 'support': return countNear(world, m.x, m.y, 15) >= 10;
  }
  return false;
}

export function updateZones(world, dt) {
  for (const zn of world.zones) {
    zn.t -= dt;
    const hit = [];
    world.zombiesNear(zn.x, zn.y, zn.r, z => { if (Math.hypot(z.x - zn.x, z.y - zn.y) < zn.r) hit.push(z); });
    for (const z of hit) { world.hitZombie(z, zn.dps * dt, 0, zn.x, zn.y, zn.from); z.slowT = 0.5; z.slow = 0.45; }
  }
  let j = 0;
  for (const zn of world.zones) if (zn.t > 0) world.zones[j++] = zn;
  world.zones.length = j;
  if (world.taunt && (world.taunt.t -= dt) <= 0) world.taunt = null;
}

// 世界座標下畫火區（實色，唔用漸層）
export function drawZones(ctx, zones, time) {
  for (const zn of zones) {
    const a = Math.min(1, zn.t / 1.5);
    ctx.globalAlpha = 0.28 * a;
    ctx.fillStyle = zn.combo ? '#c4451f' : '#b5592a';
    ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6 * a;
    ctx.fillStyle = '#d98a3a';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const ang = i * 0.7 + time * 1.3, rr = zn.r * (0.25 + ((i * 37) % 10) / 14), fx = zn.x + Math.cos(ang) * rr, fy = zn.y + Math.sin(ang) * rr, s = 0.5 + Math.sin(time * 9 + i) * 0.2;
      ctx.moveTo(fx + s, fy); ctx.arc(fx, fy, s, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
