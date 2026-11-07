// 共用喪屍群：出屍、中槍、死亡（肥屍爆炸）、尖叫屍叫人、行路、咬人。中地圖同大地圖都用。
import { ZOMBIES } from './stats.js';
import { createSpatial } from './spatial.js';

const TAU = Math.PI * 2;

// opts：{ max, onKill(z), effect(e), toast(msg) }
export function createHorde(map, opts = {}) {
  const zombies = [];
  const spatial = createSpatial(map.size, 4);
  const max = opts.max || 220;

  const near = (x, y, r, fn) => spatial.query(x, y, r, z => { if (!z.dead) fn(z); });
  function nearest(x, y, r) {
    let best = null, bd = r * r;
    near(x, y, r, z => { const d = (z.x - x) ** 2 + (z.y - y) ** 2; if (d < bd) { bd = d; best = z; } });
    return best;
  }

  function spawn(type, at, hpMul = 1, extra) {
    if (zombies.length >= max && type !== 'boss' && type !== 'king') return null;
    const Z = ZOMBIES[type];
    let x = at.x + (Math.random() - 0.5) * 1.6, y = at.y + (Math.random() - 0.5) * 1.6;
    if (!map.free(x, y)) ({ x, y } = at);
    const hp = Z.hp * hpMul;
    const z = { type, x, y, r: Z.r, hp, maxHp: hp, speed: Z.speed * (0.85 + Math.random() * 0.3), dps: Z.dps, kx: 0, ky: 0, face: Math.random() * TAU, flash: 0, dead: false, wob: Math.random() * TAU, slowT: 0, slow: 1, ...extra };
    zombies.push(z);
    return z;
  }

  function hit(z, dmg, knock, fx, fy, from) {
    if (z.dead || z.invuln) return;
    z.hp -= z.static ? dmg * 0.3 : dmg; // 建築（屍巢、巢穴）有甲
    z.flash = 0.08;
    if (knock && !z.static) {
      const dx = z.x - fx, dy = z.y - fy, d = Math.hypot(dx, dy) || 1, k = knock * 6 / (z.r > 1.5 ? 5 : z.r > 0.9 ? 2 : 1);
      z.kx += dx / d * k; z.ky += dy / d * k;
    }
    if (z.hp > 0) return;
    z.dead = true;
    opts.onKill?.(z, from);
    const blast = ZOMBIES[z.type].blast;
    if (blast) { // 肥屍爆炸：傷隊員（由場景處理），亦炸埋隔籬啲屍
      opts.effect?.({ kind: 'blast', x: z.x, y: z.y, r: blast.r, t: 0.35, life: 0.35 });
      opts.onBlast?.(z.x, z.y, blast.r, blast.dmg);
      const list = [];
      near(z.x, z.y, blast.r, o => { if (Math.hypot(o.x - z.x, o.y - z.y) < blast.r) list.push(o); });
      for (const o of list) hit(o, 40, 1.5, z.x, z.y);
    }
  }

  // targets：[{ x, y, r, alive }]；bite(t, dmg)；steer(z) 返回 {x, y} 或 null；taunt：{ m } 或 null
  function step(dt, { targets, bite, flow, steer, taunt, chase = 14 }) {
    spatial.clear();
    for (const z of zombies) spatial.insert(z);
    const decay = Math.exp(-8 * dt);
    for (const z of zombies) {
      if (z.dead) continue;
      z.flash -= dt;
      if (z.static) continue; // 大地圖嘅屍巢、巢穴：唔郁
      z.slowT -= dt;
      let tgt = null, bd = Infinity;
      if (taunt && taunt.m.state === 'ok' && (taunt.m.x - z.x) ** 2 + (taunt.m.y - z.y) ** 2 < 144) { tgt = taunt.m; bd = (tgt.x - z.x) ** 2 + (tgt.y - z.y) ** 2; }
      else for (const t of targets) if (t.alive !== false && t.state !== 'down' && t.state !== 'dead') { const d = (t.x - z.x) ** 2 + (t.y - z.y) ** 2; if (d < bd) { bd = d; tgt = t; } }
      // 尖叫屍：見到人就嗌，叫多幾隻
      const Z = ZOMBIES[z.type];
      if (Z.scream && !z.screamed && tgt && bd < 196 && map.los(z.x, z.y, tgt.x, tgt.y)) {
        z.screamed = true;
        opts.effect?.({ kind: 'shout', x: z.x, y: z.y, r: 14, t: 0.8, life: 0.8, red: true });
        opts.toast?.('尖叫屍叫咗更多屍嚟！');
        for (let i = 0; i < Z.scream; i++) {
          const a = Math.random() * TAU, d = 6 + Math.random() * 6, p = { x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d };
          spawn(i % 3 ? 'walker' : 'runner', map.free(p.x, p.y) ? p : z, z.maxHp / ZOMBIES.screamer.hp, z.lane != null ? { lane: z.lane, wp: z.wp } : undefined);
        }
      }
      let vx = 0, vy = 0;
      if (tgt && bd < chase * chase && map.los(z.x, z.y, tgt.x, tgt.y)) { const d = Math.sqrt(bd) || 1; vx = (tgt.x - z.x) / d; vy = (tgt.y - z.y) / d; }
      else {
        const f = (steer && steer(z)) || (flow && flow.dir(z.x, z.y));
        if (f) { vx = f.x; vy = f.y; }
      }
      let px = 0, py = 0; // 互相推開
      spatial.query(z.x, z.y, z.r + 2.2, o => {
        if (o === z || o.dead) return;
        const dx = z.x - o.x, dy = z.y - o.y, rr = z.r + o.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; px += dx * k; py += dy * k; }
      });
      if (tgt) { // 咬最近嗰個；同埋擠住佢
        const t = tgt;
        const dx = z.x - t.x, dy = z.y - t.y, rr = z.r + (t.r || 0.7), d = Math.hypot(dx, dy);
        if (d < rr + 0.15) {
          bite(t, z.dps * dt, z);
          if (d > 1e-3 && d < rr) {
            const o = rr - d;
            px += dx / d * o; py += dy / d * o;
            if (t.state) { const push = z.r > 1.5 ? 0.6 : 0.15; map.move(t, -dx / d * o * push, -dy / d * o * push); }
          }
        }
      }
      if (vx || vy) z.face = Math.atan2(vy, vx);
      const sp = z.speed * (z.slowT > 0 ? z.slow : 1) * dt;
      map.move(z, vx * sp + px * 0.5 + z.kx * dt, vy * sp + py * 0.5 + z.ky * dt);
      z.kx *= decay; z.ky *= decay;
    }
    let j = 0;
    for (const z of zombies) if (!z.dead) zombies[j++] = z;
    zombies.length = j;
  }

  return { zombies, spawn, hit, near, nearest, step, spatial };
}
