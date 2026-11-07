// 共用地點效果：藥房補血、便利店能量飲品、警局武器、五金行零件、油站引爆。中地圖同大地圖都用。
// world 要提供：squad、zombiesNear、hitZombie、effect、toast、loot（{food, meds, parts, ammo}）
import { POIS, PHARMACY, FUEL_BLAST } from './stats.js';
import { heal, hurt, buff } from './squad.js';

export function createPois(list) {
  return list.filter(p => POIS[p.type]).map(p => ({ ...p, pool: PHARMACY.pool, cd: 0, arm: 0, fuse: 0, active: false }));
}

const near = (p, squad, r) => squad.filter(m => m.state === 'ok' && Math.hypot(m.x - p.x, m.y - p.y) < r);

export function updatePois(pois, world, dt) {
  const { squad, loot } = world;
  for (const p of pois) {
    const def = POIS[p.type];
    if (!def.radius) continue;
    p.cd = Math.max(0, p.cd - dt);
    p.active = false;
    const inside = near(p, squad, def.radius);
    switch (p.type) {
      case 'pharmacy':
        p.pool = Math.min(PHARMACY.pool, p.pool + PHARMACY.regen * dt);
        for (const m of inside) {
          if (m.hp >= m.maxHp || p.pool <= 0) continue;
          const amt = Math.min(PHARMACY.rate * dt, p.pool, m.maxHp - m.hp);
          heal(m, amt); p.pool -= amt; p.active = true;
          loot.meds += amt / 40;
        }
        break;
      case 'store':
        if (inside.length && !p.cd) {
          for (const m of squad) if (m.state === 'ok') buff(m, 'rate', 1.3, 20);
          loot.food += 6; loot.ammo += 3; p.cd = def.cd;
          world.toast('便利店：能量飲品！射速 +30%');
        }
        break;
      case 'police':
        if (inside.length && !p.cd) {
          for (const m of squad) if (m.state === 'ok') buff(m, 'dmg', 1.4, 30);
          loot.ammo += 8; p.cd = def.cd;
          world.toast('警局：拎到武器！傷害 +40%');
        }
        break;
      case 'hardware':
        if (inside.length && !p.cd) { loot.parts += 8; p.cd = def.cd; world.toast('五金行：拎到零件'); }
        break;
      case 'fuel':
        if (p.fuse > 0) {
          p.fuse -= dt;
          if (p.fuse <= 0) explode(p, world);
        } else if (!p.cd) {
          if (inside.length) { p.arm += dt; p.active = true; if (p.arm >= 2) { p.fuse = FUEL_BLAST.fuse; p.arm = 0; world.toast('油站點着咗！快啲走開！'); } }
          else p.arm = 0;
        }
        break;
    }
  }
}

function explode(p, world) {
  p.cd = POIS.fuel.cd;
  world.effect({ kind: 'blast', x: p.x, y: p.y, r: FUEL_BLAST.r, t: 0.8, life: 0.8 });
  const hit = [];
  world.zombiesNear(p.x, p.y, FUEL_BLAST.r, z => { if (Math.hypot(z.x - p.x, z.y - p.y) < FUEL_BLAST.r) hit.push(z); });
  for (const z of hit) world.hitZombie(z, FUEL_BLAST.dmg, 3, p.x, p.y);
  for (const m of world.squad) if (Math.hypot(m.x - p.x, m.y - p.y) < FUEL_BLAST.squadR) hurt(m, FUEL_BLAST.squadDmg);
  world.toast(`油站爆炸！炸死 ${hit.length} 隻`);
}

// 世界座標：範圍圈；招牌另外喺 drawPoiSigns 畫
export function drawPois(ctx, pois, vis, time) {
  ctx.setLineDash([0.8, 0.8]);
  ctx.lineWidth = 0.18;
  for (const p of pois) {
    const def = POIS[p.type];
    if (!def.radius || !vis(p.x, p.y, def.radius + 2)) continue;
    let c = '#5c8a54';
    if (p.type === 'pharmacy') c = p.pool > 5 ? (p.active ? '#8fbf7a' : '#5c8a54') : '#3a4a38';
    else if (p.type === 'fuel') c = p.fuse > 0 ? (Math.sin(time * 20) > 0 ? '#d94a3a' : '#f1e9dc') : p.cd ? '#3d302c' : '#b5592a';
    else c = p.cd ? '#3a3d38' : def.color === '#45607a' ? '#6f8aa6' : '#c07a45';
    ctx.strokeStyle = c;
    ctx.beginPath(); ctx.arc(p.x, p.y, def.radius, 0, Math.PI * 2); ctx.stroke();
    if (p.type === 'fuel' && (p.arm > 0 || p.fuse > 0)) {
      ctx.setLineDash([]);
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = '#d94a3a';
      const f = p.fuse > 0 ? p.fuse / FUEL_BLAST.fuse : p.arm / 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, def.radius + 0.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
      ctx.setLineDash([0.8, 0.8]); ctx.lineWidth = 0.18;
    }
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 1.5px "Noto Sans TC", sans-serif';
  for (const p of pois) {
    if (!vis(p.sx, p.sy, 4)) continue;
    const def = POIS[p.type];
    ctx.fillStyle = '#111'; ctx.fillRect(p.sx - 1.25, p.sy - 1.15, 2.6, 2.6);
    ctx.fillStyle = p.cd && p.type !== 'pharmacy' ? '#3a3d38' : def.color; ctx.fillRect(p.sx - 1.3, p.sy - 1.3, 2.6, 2.6);
    ctx.fillStyle = '#d9d6cc'; ctx.fillText(def.ch, p.sx, p.sy + 0.1);
  }
}
