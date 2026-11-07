// 共用隊友 AI：每格重複五步 —— 跟住你 → 揀目標 → 放技能 → 救人 → 執行指令。
// 三個地圖用同一個 AI，只係參數同可用指令唔同。
import { heal, bmul } from './squad.js';
import { castUlt, wantsUlt } from './skills.js';

export const AI = {
  rescueRange: 30, // 幾遠內嘅倒地隊友會去救
  kiteRange: 2.2,  // 非坦克：喪屍貼到咁近就退後
  guardRange: 6,   // 坦克：喪屍行到你幾近就衝出去擋
  catchUp: 1.3,    // 離目標太遠時加速
};

// 每個職業喺「跟我」同「散開」時企邊：[角度（相對你面向）, 距離]
const SLOTS = {
  follow: { tank: [0, 2.6], medic: [Math.PI, 3], dps: [-2.2, 3], control: [0.9, 3], support: [2.4, 4] },
  spread: { tank: [0, 7], medic: [2.4, 8], dps: [-2.4, 8], control: [1.2, 7], support: [-1.2, 9] },
};

// w：{ leader, squad, command, holdPos, map, leaderFlow, nearestZombie(x, y, r), effect(e), ...skills 要嘅嘢 }
// command：follow／spread／hold／focus／goto（goto 用 a.goal = {x, y}，大地圖派人用）
export function updateAlly(a, w, dt) {
  if (a.state !== 'ok') return;
  const L = w.leader, map = w.map;

  // 1. 跟住你：按指令計站位
  let gx, gy, flow = w.leaderFlow;
  if (w.command === 'hold') ({ x: gx, y: gy } = w.holdPos.get(a) || a);
  else if (w.command === 'goto' && a.goal) { gx = a.goal.x; gy = a.goal.y; flow = a.goalFlow || null; }
  else {
    const [ang, dist] = SLOTS[w.command === 'spread' ? 'spread' : 'follow'][a.role] || [Math.PI, 3];
    // 站位撞牆（窄街）就改企前面或者後面，排成一條線
    let best = 0;
    for (const t of [ang, Math.abs(ang) > 1.6 ? Math.PI : 0, Math.abs(ang) > 1.6 ? 0 : Math.PI]) {
      const c = Math.cos(L.dir + t), s = Math.sin(L.dir + t);
      let r = 0;
      while (r < dist && map.free(L.x + c * (r + 0.5), L.y + s * (r + 0.5))) r += 0.5;
      if (r > best + 0.5) { best = r; gx = L.x + c * r; gy = L.y + s * r; }
      if (r >= Math.min(dist, 2.5)) break;
    }
    if (!best) { gx = L.x; gy = L.y; }
  }

  // 2. 揀目標：坦克見到喪屍貼近你，就衝去擋
  if (a.role === 'tank' && w.command !== 'hold' && w.command !== 'goto' && L.state === 'ok') {
    const z = w.nearestZombie(L.x, L.y, AI.guardRange);
    if (z) { gx = z.x; gy = z.y; }
  }

  // 3. 放技能：醫療補最殘嗰個；夠電就放大招
  if (a.heal) {
    a.healT -= dt;
    if (a.healT <= 0) {
      let low = null, ratio = 0.95;
      for (const m of w.squad) {
        if (m.state === 'ok' && Math.hypot(m.x - a.x, m.y - a.y) < a.healRange && m.hp / m.maxHp < ratio) { ratio = m.hp / m.maxHp; low = m; }
      }
      if (low) { heal(low, a.heal); a.healT = a.healCd; w.effect({ kind: 'heal', x: low.x, y: low.y, t: 0.6, life: 0.6 }); }
    }
  }
  if (wantsUlt(a, w, L)) castUlt(a, w);

  // 4. 救人：最近嗰個隊友（或者醫療）去救倒地嘅人，蓋過其他指令
  for (const m of w.squad) {
    if (m.state !== 'down' || Math.hypot(m.x - a.x, m.y - a.y) > AI.rescueRange) continue;
    let nearest = null, nd = Infinity;
    for (const h of w.squad) {
      if (h === m || h.state !== 'ok' || h === L) continue;
      const d = Math.hypot(h.x - m.x, h.y - m.y);
      if (d < nd) { nd = d; nearest = h; }
    }
    if (nearest === a || a.role === 'medic') { gx = m.x; gy = m.y; flow = w.leaderFlow; break; }
  }

  // 5. 執行指令（集火由 autoAttack 處理）＋ 行過去
  let vx = 0, vy = 0;
  const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
  if (d > 0.5) {
    if (d < 40 && map.los(a.x, a.y, gx, gy)) { vx = dx / d; vy = dy / d; }
    else { const f = flow && flow.dir(a.x, a.y); if (f) { vx = f.x; vy = f.y; } else { vx = dx / d; vy = dy / d; } }
  }
  if (a.role !== 'tank') { // 喪屍貼身就退
    const z = w.nearestZombie(a.x, a.y, AI.kiteRange);
    if (z) { const zx = a.x - z.x, zy = a.y - z.y, zl = Math.hypot(zx, zy) || 1; vx += zx / zl * 0.8; vy += zy / zl * 0.8; }
  }
  for (const m of w.squad) { // 隊員之間唔好疊埋一齊
    if (m === a || m.state === 'dead') continue;
    const ox = a.x - m.x, oy = a.y - m.y, od = Math.hypot(ox, oy);
    if (od < 1.5) { const k = (1.5 - od) / 1.5; vx += (od ? ox / od : Math.cos(a.role.length)) * k; vy += (od ? oy / od : Math.sin(a.role.length)) * k; }
  }
  const vl = Math.hypot(vx, vy);
  if (vl > 0.01) {
    const s = a.speed * bmul(a, 'speed') * (d > 6 ? AI.catchUp : Math.min(1, d / 1.5 + 0.4)) / Math.max(1, vl);
    map.move(a, vx * s * dt, vy * s * dt);
    if (a.shotT <= 0) a.face = Math.atan2(vy, vx);
  }
  if (a.shotT > 0) a.face = a.aim;
}
