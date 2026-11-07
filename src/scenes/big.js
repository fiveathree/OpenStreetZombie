// 大地圖場景（MOBA，PvE）：主城喺鹽埕，喪屍巢穴喺愛河東岸，三條路經愛河上三條真實嘅橋（七賢橋、中正橋、高雄橋）。
// 一邊出去打野，一邊要派隊友或者守備小隊守住主城同箭塔。打爆巢穴就贏，主城失守就輸。
import { createFlowField } from '../flowfield.js';
import { createHorde } from '../horde.js';
import { ZOMBIES, BIG } from '../stats.js';
import { createSquad, hurt, updateDowned, autoAttack, chargeUlt, tickBuffs, bmul, reviveMember } from '../squad.js';
import { updateAlly } from '../ally-ai.js';
import { castUlt, updateZones, drawZones } from '../skills.js';
import { createPois, updatePois, drawPois } from '../poi.js';
import { createNight } from '../lighting.js';
import { rescue } from '../rescue.js';
import { drawZombies, drawSquad, drawEffects, drawLabels, applyCamera, worldTransform, toScreen, makeCam, zoomCam } from '../draw.js';

const TAU = Math.PI * 2;
// 人手揀嘅位置（米，原點係範圍左上角；範圍中心 22.6262, 120.2858）
const SPOTS = {
  base: { x: 480, y: 1080, name: '主城（鹽埕）' },
  nest: { x: 1250, y: 760, name: '喪屍巢穴（愛河東岸）' },
  lanes: [
    { key: 'top', name: '上路', bridge: { x: 791, y: 343 }, bridgeName: '七賢橋' },
    { key: 'mid', name: '中路', bridge: { x: 1012, y: 690 }, bridgeName: '中正橋' },
    { key: 'bot', name: '下路', bridge: { x: 1205, y: 1375 }, bridgeName: '高雄橋' },
  ],
};

export function createBigScene(map, cfg = {}) {
  const team = cfg.team || [{ role: 'player' }, { role: 'tank' }, { role: 'medic' }, { role: 'dps' }, { role: 'control' }];
  const base = map.nearestFree(SPOTS.base.x, SPOTS.base.y);
  const nestP = map.nearestFree(SPOTS.nest.x, SPOTS.nest.y);
  const squad = createSquad(base.x, base.y, team);
  const player = squad[0];
  const effects = [], zones = [];
  const loot = { food: 0, meds: 0, parts: 0, ammo: 0 };
  const pois = createPois(map.pois);
  const cam = makeCam(player.x, player.y);
  const night = createNight();
  const st = { t: 0, kills: 0, over: null, toasts: [], squad, loot, shards: 0, parts: BIG.startParts, level: 1, xp: 0, pendingLevels: 0, respawn: 0, recall: 0, help: new Set(), buffT: 0, isNight: false, charShards: {} };
  const toast = m => st.toasts.push(m);
  const effect = e => effects.push(e);
  let killsThisFrame = 0;
  let look = null; // 撳小地圖睇第度：鏡頭停喺嗰點，你一郁就返嚟

  // ---- 三條路：主城 → 橋 → 巢穴，用流場搵真實道路 ----
  const flow = createFlowField(map);
  const lanes = SPOTS.lanes.map(l => {
    const br = map.nearestFree(l.bridge.x, l.bridge.y);
    flow.update([br]);
    const a = flow.trace(base, 1);
    flow.update([nestP]);
    const b = flow.trace(br, 1);
    return { ...l, br, pts: a.concat(b), split: a.length };
  });
  const at = (lane, f, from = 0, to = lane.pts.length) => lane.pts[Math.min(to - 1, Math.floor(from + (to - from) * f))];

  // ---- 建築 ----
  const structs = [];
  const mkStruct = (id, name, p, kind, laneIdx) => structs.push({ id, name, x: p.x, y: p.y, r: kind === 'base' ? 5 : 2.5, kind, lane: laneIdx, hp: BIG[kind].hp, maxHp: BIG[kind].hp, fireT: 0, mul: 1, soldiers: [], alive: true, hurtT: 0 });
  mkStruct('base', '主城', base, 'base', -1);
  lanes.forEach((l, i) => {
    mkStruct(l.key + '1', l.name + '外塔', at(l, 0.75, 0, l.split), 'tower', i);
    mkStruct(l.key + '2', l.name + '內塔', at(l, 0.35, 0, l.split), 'tower', i);
  });
  const structFlows = new Map();
  for (const s of structs) { const f = createFlowField(map); f.update([s]); structFlows.set(s.id, f); }
  const nestFlow = createFlowField(map); nestFlow.update([nestP]); // 小兵睇唔到下一點時跟呢張圖行

  // ---- 喪屍方 ----
  const horde = createHorde(map, {
    max: cfg.maxZombies || 260, effect, toast,
    onKill(z) {
      killsThisFrame++; st.kills++;
      loot.food += 0.03; loot.ammo += 0.03; st.parts += 0.15;
      if (z.type === 'outpost') { toast(`${lanes[z.lane].name}屍巢打爆咗！巢穴而家打得入`); nest.invuln = false; st.parts += 20; }
      if (z.type === 'nest') st.over = 'win';
      if (z.camp) z.camp.alive--;
      if (z.type === 'king') { toast('喪屍王倒下！'); loot.meds += 10; }
      if (z.jboss) { st.buffT = BIG.bossBuff; toast('打低野區 Boss！兵營出嘅兵變強 90 秒'); jboss.dead = true; jboss.respawn = 180; }
    },
    onBlast(x, y, r, dmg) { for (const m of squad) if (Math.hypot(m.x - x, m.y - y) < r) hurt(m, dmg); },
  });
  const nest = horde.spawn('nest', nestP, 1, { static: true, invuln: true, lane: -1 });
  lanes.forEach((l, i) => horde.spawn('outpost', at(l, 0.5, l.split), 1, { static: true, lane: i }));

  // ---- 野區：營地（精英屍／物資／被困倖存者）＋ 野區 Boss ----
  const camps = [];
  // 營地要離開三條路最少 30 米（唔好擋住小兵）
  const laneDist = (x, y) => { let d = Infinity; for (const l of lanes) for (let i = 0; i < l.pts.length; i += 2) d = Math.min(d, (l.pts[i].x - x) ** 2 + (l.pts[i].y - y) ** 2); return Math.sqrt(d); };
  const offLane = (x, y) => {
    let best = null, bs = -1;
    for (let k = 0; k < 400; k++) {
      const a = Math.random() * TAU, r = Math.random() * 90, p = { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
      if (!map.free(p.x, p.y)) continue;
      const d = laneDist(p.x, p.y);
      const score = Math.min(d, 60) - r * 0.2;
      if (d >= 30 && score > bs) { bs = score; best = p; }
    }
    return best;
  };
  for (const [a, b] of [[0, 1], [1, 2]]) for (const f of [0.4, 0.75]) {
    const p = at(lanes[a], f, 0, lanes[a].split), q = at(lanes[b], f, 0, lanes[b].split);
    const c = offLane((p.x + q.x) / 2, (p.y + q.y) / 2);
    if (c) camps.push({ x: c.x, y: c.y, kind: ['elite', 'supply', 'survivor'][camps.length % 3], alive: 0, respawn: 5, prog: 0 });
  }
  const jbP = offLane((lanes[1].br.x + lanes[2].br.x) / 2 - 80, (lanes[1].br.y + lanes[2].br.y) / 2) || map.nearestFree(900, 1000);
  const jboss = { x: jbP.x, y: jbP.y, respawn: 30, dead: true, z: null };
  const bossFlow = createFlowField(map); bossFlow.update([jboss]);
  function spawnCamp(c) {
    c.prog = 0;
    const n = c.kind === 'elite' ? 2 : 3;
    for (let i = 0; i < n; i++) { const z = horde.spawn(c.kind === 'elite' ? 'elite' : 'walker', c, 1 + st.t / 600, { camp: c, lane: -1 }); if (z) c.alive++; }
    c.ready = true;
  }

  // ---- 我方小兵、守備兵 ----
  const minions = [];
  const spawnMinion = (laneIdx, kind = 'minion', at2 = base, struct = null) => {
    const M = BIG[kind], buffed = kind === 'minion' && st.buffT > 0 ? 1.6 : 1;
    minions.push({ kind, lane: laneIdx, wp: 0, x: at2.x + (Math.random() - 0.5) * 3, y: at2.y + (Math.random() - 0.5) * 3, r: 0.6, hp: M.hp * buffed, maxHp: M.hp * buffed, dmg: M.dmg * buffed, cd: M.cd, range: M.range, fireT: 0, alive: true, struct, face: 0 });
  };

  // ---- 隊友派遣 ----
  for (const a of squad) if (a !== player) a.mode = { kind: 'follow' };
  const leaderFlow = createFlowField(map);
  leaderFlow.update([player]);
  const holdPos = new Map();
  const world = {
    map, squad, leader: player, leaderFlow, holdPos, command: 'follow', focus: null, zones, taunt: null, loot,
    zombiesNear: horde.near, nearestZombie: (x, y, r) => { const z = horde.nearest(x, y, r); return z && !z.static ? z : null; },
    hitZombie: horde.hit, effect, toast, los: map.los,
  };

  function laneFront(a, laneIdx) { // 沿路向巢穴推，見到敵人就停
    const l = lanes[laneIdx];
    let bi = 0, bd = Infinity;
    for (let i = 0; i < l.pts.length; i += 2) { const d = (l.pts[i].x - a.x) ** 2 + (l.pts[i].y - a.y) ** 2; if (d < bd) { bd = d; bi = i; } }
    if (bd > 30 * 30) return { goal: l.pts[bi], flow: structFlows.get('base') && null };
    let enemy = null;
    horde.near(a.x, a.y, 13, o => { if (!o.invuln) enemy = o; });
    return { goal: enemy ? a : l.pts[Math.min(l.pts.length - 1, bi + 4)], flow: null };
  }

  function update(dt, mv) {
    if (st.over) return;
    st.t += dt;
    killsThisFrame = 0;
    st.isNight = Math.floor(st.t / 240) % 2 === 1; // 每 4 分鐘日夜交替
    if (st.buffT > 0) st.buffT -= dt;

    // 你：死咗就等復活；回城
    if (player.state === 'dead') {
      if (!st.respawn) st.respawn = BIG.respawn;
      st.respawn -= dt;
      if (st.respawn <= 0) { st.respawn = 0; player.x = base.x; player.y = base.y; reviveMember(player, 1); look = null; toast('你喺主城復活'); }
    }
    if (mv.x || mv.y) look = null;
    if (player.state === 'ok' && (mv.x || mv.y)) {
      const sp = player.speed * bmul(player, 'speed');
      map.move(player, mv.x * sp * dt, mv.y * sp * dt);
      player.dir = Math.atan2(mv.y, mv.x);
      if (player.shotT <= 0) player.face = player.dir;
      if (st.recall) { st.recall = 0; toast('回城取消'); }
    }
    if (player.shotT > 0) player.face = player.aim;
    if (st.recall) { st.recall -= dt; if (st.recall <= 0) { st.recall = 0; player.x = base.x; player.y = base.y; for (const a of squad) if (a.mode?.kind === 'follow' && a.state === 'ok') { a.x = base.x; a.y = base.y; } } }

    // 隊友：死咗就喺主城復活
    for (const a of squad) if (a !== player && a.state === 'dead') {
      a.respawnT = (a.respawnT ?? BIG.respawn) - dt;
      if (a.respawnT <= 0) { a.respawnT = null; a.x = base.x; a.y = base.y; reviveMember(a, 1); a.deaths = (a.deaths || 0) + 1; }
    }

    if ((st.flowT = (st.flowT || 0) - dt) <= 0) { st.flowT = 0.3; leaderFlow.update([player]); }

    // ---- 出兵、出屍 ----
    if (Math.floor(st.t / BIG.minionEvery) !== Math.floor((st.t - dt) / BIG.minionEvery)) for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) if (minions.filter(u => u.lane === i).length < 16) spawnMinion(i); // 每路最多 16 個兵，手機唔會卡
    const tier = 1 + st.t / 420;
    if (st.t > 8 && Math.floor(st.t / BIG.waveEvery) !== Math.floor((st.t - dt) / BIG.waveEvery)) {
      lanes.forEach((l, i) => {
        const outpostAlive = horde.zombies.some(z => z.type === 'outpost' && z.lane === i);
        const n = Math.round((6 + Math.floor(st.t / 90) * 2) * (outpostAlive ? 1 : 0.6));
        const from = at(l, outpostAlive ? 0.45 : 0.1, l.split);
        for (let k = 0; k < n; k++) horde.spawn(k % 4 === 3 ? 'runner' : k % 9 === 8 ? 'fat' : k % 11 === 10 ? 'screamer' : 'walker', from, tier, { lane: i, wp: l.pts.indexOf(from) });
      });
    }
    if (Math.floor(st.t / BIG.surgeEvery) !== Math.floor((st.t - dt) / BIG.surgeEvery) && st.t > 1) {
      const i = (Math.random() * 3) | 0, l = lanes[i];
      for (let k = 0; k < 30; k++) horde.spawn(k % 3 ? 'walker' : 'runner', at(l, 0.3, l.split), tier, { lane: i, wp: l.pts.indexOf(at(l, 0.3, l.split)) });
      toast(`大屍潮湧去${l.name}！`);
    }
    if (st.t >= BIG.kingAt && Math.floor((st.t - BIG.kingAt) / BIG.kingEvery) !== Math.floor((st.t - dt - BIG.kingAt) / BIG.kingEvery)) {
      // 喪屍王揀守得最弱嗰路
      const score = lanes.map((l, i) => structs.filter(s => s.lane === i && s.alive).reduce((a, s) => a + s.hp + s.soldiers.length * 150, 0) + squad.filter(m => m.mode?.kind === 'garrison' && structs.find(s => s.id === m.mode.id)?.lane === i).length * 600);
      const i = score.indexOf(Math.min(...score)), l = lanes[i];
      horde.spawn('king', at(l, 0.2, l.split), tier, { lane: i, wp: l.pts.indexOf(at(l, 0.2, l.split)) });
      toast(`喪屍王攻緊${l.name}！`);
    }
    // 巢穴：冇人打就慢慢回血；被打就叫守衛出嚟
    if (!nest.dead) {
      if (nest.hp < nest.lastHp - 1) { nest.hitT = 6; if ((nest.guardT = (nest.guardT || 0) - dt) <= 0) { nest.guardT = 8; for (let k = 0; k < 8; k++) horde.spawn(k % 3 ? 'walker' : 'runner', nest, tier, { lane: -1 }); if (Math.random() < 0.3) horde.spawn('elite', nest, tier, { lane: -1 }); } }
      else if ((nest.hitT = (nest.hitT || 0) - dt) <= 0) nest.hp = Math.min(nest.maxHp, nest.hp + 25 * dt);
      nest.lastHp = nest.hp;
    }
    for (const c of camps) { if (!c.ready && (c.respawn -= dt) <= 0) spawnCamp(c); if (c.ready && c.alive <= 0 && c.kind !== 'survivor' && c.kind !== 'supply') { c.ready = false; c.respawn = BIG.campEvery; } }
    if (jboss.dead && (jboss.respawn -= dt) <= 0) { jboss.dead = false; jboss.z = horde.spawn('boss', jboss, 1 + st.t / 400, { jboss: true, camp: { x: jboss.x, y: jboss.y, alive: 1 }, lane: -1 }); toast('野區 Boss 出咗'); }

    // 物資、倖存者營地：打清守衛之後企埋去
    for (const c of camps) {
      if (!c.ready || (c.kind !== 'supply' && c.kind !== 'survivor') || c.alive > 0) continue;
      const near = squad.some(m => m.state === 'ok' && Math.hypot(m.x - c.x, m.y - c.y) < 3);
      c.prog = near ? c.prog + dt / 2 : Math.max(0, c.prog - dt);
      if (c.prog >= 1) {
        c.ready = false; c.respawn = BIG.campEvery;
        if (c.kind === 'supply') { st.parts += 15; loot.food += 10; toast('拎到物資：零件 +15'); }
        else {
          loot.food += 5;
          const joined = rescue(st, squad, c, toast); // 屍城日誌角色：有機會即刻跟你
          if (joined) joined.mode = { kind: 'follow' };
          else { const s = structs.find(k => k.alive && k.soldiers.length < 6) || structs[0]; for (let k = 0; k < 2; k++) spawnMinion(-1, 'soldier', s, s); s.soldiers.push(...minions.slice(-2)); toast(`其他被困嘅人變咗${s.name}守備兵`); }
        }
      }
    }

    // ---- 隊友 ----
    for (const a of squad) {
      if (a === player || a.state !== 'ok') continue;
      const m = a.mode;
      if (m.kind === 'follow') { world.command = 'follow'; }
      else {
        world.command = 'goto';
        if (m.kind === 'garrison') { const s = structs.find(k => k.id === m.id); if (!s || !s.alive) { a.mode = { kind: 'follow' }; continue; } const ang = (m.slot || 0) * 2.1; a.goal = { x: s.x + Math.cos(ang) * 4, y: s.y + Math.sin(ang) * 4 }; a.goalFlow = structFlows.get(s.id); }
        else if (m.kind === 'lane') { const f = laneFront(a, m.lane); a.goal = f.goal; a.goalFlow = null; }
        else if (m.kind === 'boss') { a.goal = jboss; a.goalFlow = bossFlow; }
        else if (m.kind === 'base') { a.goal = base; a.goalFlow = structFlows.get('base'); }
      }
      updateAlly(a, world, dt);
    }
    for (const m of squad) { autoAttack(m, world, dt, null); m.flash -= dt; tickBuffs(m, dt); }
    updateDowned(squad, dt);
    updateZones(world, dt);
    updatePois(pois, world, dt);

    // ---- 建築、小兵開火 ----
    const shoot = (u, dmg, range, color) => {
      let z = null, bd = range * range;
      horde.near(u.x, u.y, range + 6, o => { const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2, rr = range + (o.r > 1.5 ? o.r : 0); if (!o.invuln && d < rr * rr && d < bd) { bd = d; z = o; } });
      if (!z) return false;
      horde.hit(z, dmg, 0, u.x, u.y);
      effect({ kind: 'tracer', x0: u.x, y0: u.y, x1: z.x, y1: z.y, t: 0.08, life: 0.08, heavy: color });
      return true;
    };
    for (const s of structs) {
      if (!s.alive) continue;
      s.hurtT -= dt;
      const S = BIG[s.kind], guarded = squad.some(m => m.mode?.kind === 'garrison' && m.mode.id === s.id && m.state === 'ok' && Math.hypot(m.x - s.x, m.y - s.y) < 12);
      for (const m of squad) if (m.mode?.kind === 'garrison' && m.mode.id === s.id && m.state === 'ok' && Math.hypot(m.x - s.x, m.y - s.y) < 12) m.buffs.dmg = { mul: BIG.garrisonBonus, t: 0.2 }; // 守塔嘅人有攻擊加成
      if ((s.fireT -= dt) <= 0 && shoot(s, S.dmg * s.mul * (guarded ? BIG.garrisonBonus : 1), S.range, true)) s.fireT = S.cd;
      if (s.hp < s.maxHp * 0.4 && s.hurtT > 0) { if (!st.help.has(s.id)) { st.help.add(s.id); toast(`${s.name}求救！血得返 ${Math.round(s.hp / s.maxHp * 100)}%`); } }
      else st.help.delete(s.id);
      if (s.hp <= 0) { s.alive = false; st.help.delete(s.id); toast(`${s.name}失守！`); if (s.kind === 'base') st.over = 'lose'; }
    }
    for (const u of minions) {
      if (!u.alive) continue;
      if ((u.fireT -= dt) <= 0 && shoot(u, u.dmg, u.range, false)) { u.fireT = u.cd; continue; }
      if (u.kind === 'soldier') { // 守備兵：企喺建築附近
        if (u.struct && Math.hypot(u.x - u.struct.x, u.y - u.struct.y) > 8) { const d = Math.hypot(u.struct.x - u.x, u.struct.y - u.y); map.move(u, (u.struct.x - u.x) / d * 3 * dt, (u.struct.y - u.y) / d * 3 * dt); }
        continue;
      }
      if (horde.nearest(u.x, u.y, u.range)) continue;
      const l = lanes[u.lane], p = l.pts[Math.min(l.pts.length - 1, u.wp)];
      let dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy);
      if (d < 4) { u.wp++; continue; }
      if (!map.los(u.x, u.y, p.x, p.y)) { const f = nestFlow.dir(u.x, u.y); if (f) { dx = f.x; dy = f.y; d = 1; } }
      map.move(u, dx / d * BIG.minion.speed * dt, dy / d * BIG.minion.speed * dt); u.face = Math.atan2(dy, dx);
    }

    // ---- 喪屍行路 ----
    const targets = [...squad.filter(m => m.state === 'ok'), ...minions.filter(u => u.alive), ...structs.filter(s => s.alive)];
    horde.step(dt, {
      targets, taunt: world.taunt, chase: 14,
      bite(t, dmg) {
        if (t.state) hurt(t, dmg);
        else if (t.kind === 'base' || t.kind === 'tower') { t.hp -= dmg; t.hurtT = 2; }
        else { t.hp -= dmg; if (t.hp <= 0) t.alive = false; }
      },
      steer(z) {
        if (z.camp) { const d = Math.hypot(z.camp.x - z.x, z.camp.y - z.y); return d > 3 ? { x: (z.camp.x - z.x) / d, y: (z.camp.y - z.y) / d } : { x: 0, y: 0 }; }
        if (z.lane == null || z.lane < 0) return null;
        const l = lanes[z.lane];
        if (z.wp == null || z.wp < 0) z.wp = l.pts.length - 1;
        const p = l.pts[Math.max(0, z.wp)], dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy);
        if (d < 4 && z.wp > 0) z.wp--;
        if ((z.wp === 0 && d < 4) || !map.los(z.x, z.y, p.x, p.y)) { const f = structFlows.get('base').dir(z.x, z.y); if (f) return { x: f.x * BIG.laneSpeed, y: f.y * BIG.laneSpeed }; }
        return { x: dx / (d || 1) * BIG.laneSpeed, y: dy / (d || 1) * BIG.laneSpeed };
      },
    });
    // 野區喪屍唔好走太遠
    for (const z of horde.zombies) if (z.camp && Math.hypot(z.x - z.camp.x, z.y - z.camp.y) > 25) { z.x += (z.camp.x - z.x) * 0.05; z.y += (z.camp.y - z.y) * 0.05; }
    let j = 0;
    for (const u of minions) if (u.alive) minions[j++] = u;
    minions.length = j;
    for (const s of structs) s.soldiers = s.soldiers.filter(u => u.alive);
    chargeUlt(squad, killsThisFrame * 0.5, dt);

    for (const e of effects) e.t -= dt;
    j = 0;
    for (const e of effects) if (e.t > 0) effects[j++] = e;
    effects.length = j;
  }

  // ---- 派遣 API（畀 main.js 用）----
  const garrisonOf = id => squad.filter(m => m.mode?.kind === 'garrison' && m.mode.id === id);
  function info(id) {
    const s = structs.find(k => k.id === id);
    return {
      ...s, cap: BIG[s.kind].cap, guards: garrisonOf(id).map(m => m.role), soldierN: s.soldiers.length, parts: Math.floor(st.parts),
      allies: squad.filter(m => m !== player).map(m => ({ role: m.role, name: m.name, label: m.label, state: m.state, mode: m.mode, here: m.mode?.kind === 'garrison' && m.mode.id === id })),
    };
  }
  function assign(id, role) {
    const a = squad.find(m => m.role === role), s = structs.find(k => k.id === id);
    if (!a || !s?.alive) return false;
    const g = garrisonOf(id);
    if (g.length >= BIG[s.kind].cap) { toast(`${s.name}已經守滿`); return false; }
    a.mode = { kind: 'garrison', id, slot: g.length };
    toast(`${a.name}去守${s.name}`);
    return true;
  }
  function recallAlly(role) { const a = squad.find(m => m.role === role); if (a) { a.mode = { kind: 'follow' }; toast(`${a.name}返嚟跟你`); } }
  function buildSquad(id) {
    const s = structs.find(k => k.id === id);
    if (!s?.alive || st.parts < BIG.squadCost || s.soldiers.length >= 6) return false;
    st.parts -= BIG.squadCost;
    for (let k = 0; k < 3; k++) { spawnMinion(-1, 'soldier', s, s); s.soldiers.push(minions[minions.length - 1]); }
    toast(`${s.name}多咗一隊守備兵`);
    return true;
  }
  function upgrade(id) {
    const s = structs.find(k => k.id === id);
    if (!s?.alive || st.parts < BIG.upgradeCost) return false;
    st.parts -= BIG.upgradeCost; s.mul *= 1.3; s.maxHp *= 1.3; s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.3);
    toast(`${s.name}升級咗`);
    return true;
  }
  // 指揮：推上／中／下路、守主城、集合、打 Boss（只影響冇派去守點嘅隊友）
  function command(c) {
    const free = squad.filter(m => m !== player && m.mode?.kind !== 'garrison');
    const map2 = { top: { kind: 'lane', lane: 0 }, mid: { kind: 'lane', lane: 1 }, bot: { kind: 'lane', lane: 2 }, base: { kind: 'base' }, follow: { kind: 'follow' }, boss: { kind: 'boss' } };
    for (const a of free) a.mode = { ...map2[c] };
    st.command = c;
  }
  function recall() { if (player.state === 'ok' && !st.recall) { st.recall = BIG.recall; toast('回城中…唔好郁'); } }
  // 撳畫面：有冇撳中建築
  function tap(sx, sy, W, H) {
    const x = cam.x + (sx - W / 2) / cam.z, y = cam.y + (sy - H / 2) / cam.z;
    let best = null, bd = 64;
    for (const s of structs) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (s.alive && d < bd) { bd = d; best = s.id; } }
    return best;
  }
  // 小地圖：鏡頭即刻飛去嗰點（fx、fy 係 0–1）
  function lookAt(fx, fy) {
    const c = v => Math.max(0, Math.min(1, v)) * map.size;
    look = { x: c(fx), y: c(fy) };
    cam.x = look.x; cam.y = look.y;
  }
  function lookBack() { look = null; cam.x = player.x; cam.y = player.y; }
  function tapMinimap(fx, fy) {
    const x = fx * map.size, y = fy * map.size;
    let best = null, bd = 60 * 60;
    for (const s of structs) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (s.alive && d < bd) { bd = d; best = s.id; } }
    return best;
  }

  // ---- 畫面 ----
  function render(ctx, W, H, dpr, dt = 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#121518'; ctx.fillRect(0, 0, W, H);
    const vis = applyCamera(ctx, cam, look || player, W, H, dpr, dt);
    map.draw(ctx, cam.view);
    drawLabels(ctx, map.labels, cam, W, H, dpr, vis);
    worldTransform(ctx, cam, W, H, dpr);
    // 三條路：淡淡哋標住
    ctx.lineCap = ctx.lineJoin = 'round';
    lanes.forEach(l => { ctx.strokeStyle = 'rgba(181,89,42,.18)'; ctx.lineWidth = 3; ctx.beginPath(); l.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); });
    drawPois(ctx, pois, vis, st.t);
    drawZones(ctx, zones, st.t);
    drawEffects(ctx, effects, true);
    // 營地
    for (const c of camps) if (c.ready && vis(c.x, c.y, 5)) {
      ctx.strokeStyle = c.kind === 'elite' ? '#b3302a' : c.kind === 'supply' ? '#c07a45' : '#d9d6cc'; ctx.lineWidth = 0.3; ctx.setLineDash([1, 1]);
      ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (c.kind === 'supply') { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(c.x - 1, c.y - 1, 2, 2); }
      if (c.kind === 'survivor') { ctx.fillStyle = '#d9d6cc'; ctx.beginPath(); ctx.arc(c.x, c.y, 0.6, 0, TAU); ctx.fill(); }
      if (c.prog > 0) { ctx.strokeStyle = '#8fbf7a'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(c.x, c.y, 2, -Math.PI / 2, -Math.PI / 2 + TAU * c.prog); ctx.stroke(); }
    }
    // 我方建築
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of structs) {
      if (!vis(s.x, s.y, 8)) continue;
      const sz = s.kind === 'base' ? 5 : 2.5;
      ctx.fillStyle = s.alive ? '#4f5a48' : '#2a2b27'; ctx.fillRect(s.x - sz, s.y - sz, sz * 2, sz * 2);
      ctx.strokeStyle = st.help.has(s.id) && Math.sin(st.t * 10) > 0 ? '#d94a3a' : '#e8842c'; ctx.lineWidth = 0.4; ctx.strokeRect(s.x - sz, s.y - sz, sz * 2, sz * 2);
      if (s.alive) { ctx.fillStyle = '#111'; ctx.fillRect(s.x - sz, s.y - sz - 1.2, sz * 2, 0.5); ctx.fillStyle = '#cfc8b4'; ctx.fillRect(s.x - sz, s.y - sz - 1.2, sz * 2 * s.hp / s.maxHp, 0.5); }
      ctx.fillStyle = '#d9d6cc'; ctx.font = '900 1.2px "Noto Sans TC", sans-serif'; ctx.fillText(s.name, s.x, s.y + sz + 1.2);
      ctx.strokeStyle = 'rgba(232,132,44,.2)'; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.arc(s.x, s.y, BIG[s.kind].range, 0, TAU); ctx.stroke();
    }
    // 敵方：屍巢、巢穴
    for (const z of horde.zombies) if (z.static && vis(z.x, z.y, 8)) {
      ctx.fillStyle = z.invuln ? '#2e1a17' : '#4a1c18'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b3302a'; ctx.lineWidth = 0.4; ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(z.x - z.r, z.y - z.r - 1.4, z.r * 2, 0.6); ctx.fillStyle = '#b3302a'; ctx.fillRect(z.x - z.r, z.y - z.r - 1.4, z.r * 2 * z.hp / z.maxHp, 0.6);
      ctx.fillStyle = '#d9d6cc'; ctx.font = '900 1.3px "Noto Sans TC", sans-serif'; ctx.fillText(ZOMBIES[z.type].name + (z.invuln ? '（先打屍巢）' : ''), z.x, z.y + z.r + 1.4);
    }
    // 小兵、守備兵
    ctx.beginPath();
    for (const u of minions) if (vis(u.x, u.y)) { ctx.moveTo(u.x + 0.55, u.y); ctx.arc(u.x, u.y, 0.55, 0, TAU); }
    ctx.fillStyle = st.buffT > 0 ? '#d9a060' : '#a8865a'; ctx.fill();
    drawZombies(ctx, horde.zombies.filter(z => !z.static), vis, st.t);
    drawSquad(ctx, squad, player, vis);
    drawEffects(ctx, effects, false);
    if (st.isNight) {
      const lights = [];
      for (const m of squad) if (m.state !== 'dead') { const p = toScreen(cam, W, H, m.x, m.y); lights.push({ ...p, r: 6 * cam.z, cone: m === player ? { a: player.face, len: 20 * cam.z, half: 0.5 } : null }); }
      for (const s of structs) if (s.alive) { const p = toScreen(cam, W, H, s.x, s.y); lights.push({ ...p, r: 10 * cam.z }); }
      for (const zn of zones) { const p = toScreen(cam, W, H, zn.x, zn.y); lights.push({ ...p, r: (zn.r + 3) * cam.z }); }
      night(ctx, W, H, dpr, lights, 0.62);
    }
  }

  // 小地圖：靜態底圖畫一次，之後每格加點
  let mmBase = null;
  function renderMinimap(ctx, S) {
    if (!mmBase || mmBase.width !== S) {
      mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = S;
      const g = mmBase.getContext('2d'), k = S / map.size;
      g.fillStyle = '#1a1d19'; g.fillRect(0, 0, S, S);
      g.strokeStyle = '#3a3c37'; g.lineWidth = 1; g.lineCap = 'round';
      for (const r of map.roads) { g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k))); g.stroke(); }
      g.strokeStyle = '#1f3442'; g.lineWidth = 42 * k;
      for (const r of map.rivers) { g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k))); g.stroke(); }
      g.strokeStyle = 'rgba(181,89,42,.7)'; g.lineWidth = 2;
      for (const l of lanes) { g.beginPath(); l.pts.forEach((p, i) => (i ? g.lineTo(p.x * k, p.y * k) : g.moveTo(p.x * k, p.y * k))); g.stroke(); }
    }
    const k = S / map.size;
    ctx.drawImage(mmBase, 0, 0);
    ctx.fillStyle = '#d94a3a';
    for (const z of horde.zombies) if (!z.static) ctx.fillRect(z.x * k - 1, z.y * k - 1, z.type === 'king' || z.type === 'boss' ? 4 : 2, z.type === 'king' || z.type === 'boss' ? 4 : 2);
    ctx.fillStyle = '#a8865a';
    for (const u of minions) ctx.fillRect(u.x * k - 1, u.y * k - 1, 2, 2);
    for (const z of horde.zombies) if (z.static) { ctx.fillStyle = z.invuln ? '#6a2a24' : '#d94a3a'; ctx.fillRect(z.x * k - 3, z.y * k - 3, 6, 6); }
    for (const s of structs) { ctx.fillStyle = !s.alive ? '#333' : st.help.has(s.id) && Math.sin(st.t * 10) > 0 ? '#d94a3a' : '#e8842c'; ctx.fillRect(s.x * k - 3, s.y * k - 3, 6, 6); }
    for (const c of camps) if (c.ready) { ctx.fillStyle = c.kind === 'supply' ? '#c07a45' : c.kind === 'survivor' ? '#d9d6cc' : '#7a3a30'; ctx.beginPath(); ctx.arc(c.x * k, c.y * k, 2.5, 0, TAU); ctx.fill(); }
    if (!jboss.dead) { ctx.fillStyle = '#b3302a'; ctx.beginPath(); ctx.arc(jboss.x * k, jboss.y * k, 4, 0, TAU); ctx.fill(); }
    for (const m of squad) if (m.state !== 'dead') { ctx.fillStyle = m === player ? '#f2c27a' : '#e8842c'; ctx.beginPath(); ctx.arc(m.x * k, m.y * k, m === player ? 3.5 : 2.5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#d9d6cc'; ctx.lineWidth = 1;
    ctx.strokeRect((cam.x - cam.hw) * k, (cam.y - cam.hh) * k, cam.hw * 2 * k, cam.hh * 2 * k);
  }

  return {
    kind: 'big', state: st, update, render, renderMinimap, squad, structs, lanes,
    command, recall, tap, tapMinimap, lookAt, lookBack, isLooking: () => !!look, info, assign, recallAlly, buildSquad, upgrade,
    ult: () => castUlt(player, world),
    pickUpgrade() {}, idle() {},
    zoomBy: f => zoomCam(cam, f, 0.3, 2), setZoom: v => { cam.zoom = cam.zoomTarget = Math.max(0.3, Math.min(2, v || 1)); },
    nestHp: () => nest.hp / nest.maxHp,
    outposts: () => horde.zombies.filter(z => z.type === 'outpost').length,
    nestOpen: () => !nest.invuln,
    counts: () => ({ zombies: horde.zombies.length, minions: minions.filter(u => u.kind === 'minion').length, soldiers: minions.filter(u => u.kind === 'soldier').length }),
  };
}
