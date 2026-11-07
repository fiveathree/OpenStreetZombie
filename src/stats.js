// 共用戰鬥數值：職業、喪屍、升級卡。改難度就改呢度。
export const MATCH_TIME = 300;   // 撐幾多秒過關
export const BLEED_TIME = 20;    // 倒地幾耐冇人救就死
export const REVIVE_TIME = 3;    // 救一個人要幾耐（醫療快一倍）
export const REVIVE_RANGE = 2.4; // 企幾近先救到

export const ROLES = {
  player: { label: '你', name: '你', hp: 120, speed: 6.4, armor: 0, attack: 'gun', dmg: 12, cd: 0.3, range: 13, pierce: 0 },
  tank: { label: '坦克', name: '阿坤', hp: 260, speed: 6, armor: 0.35, attack: 'shove', dmg: 15, cd: 0.7, range: 2.8, knock: 2.4 },
  medic: { label: '醫療', name: '小芳', hp: 100, speed: 6.2, armor: 0, attack: 'gun', dmg: 8, cd: 0.5, range: 11, pierce: 0, heal: 14, healCd: 1.4, healRange: 9, reviveMul: 2 },
  dps: { label: '輸出', name: '阿傑', hp: 95, speed: 6.2, armor: 0, attack: 'gun', dmg: 9, cd: 0.16, range: 15, pierce: 1 },
};

export const ZOMBIES = {
  walker: { hp: 32, speed: 2.5, dps: 12, r: 0.6, xp: 1 },
  runner: { hp: 22, speed: 4.8, dps: 9, r: 0.55, xp: 2 },
  fat: { hp: 110, speed: 1.8, dps: 16, r: 0.95, xp: 4, blast: { r: 3.6, dmg: 28 } }, // 死後爆炸，炸埋隔籬啲屍
  boss: { hp: 3000, speed: 2.3, dps: 35, r: 1.7, xp: 40 },
};

// t 秒時：每秒出幾多隻、血量倍數、出咩屍
export function waveAt(t, rand = Math.random) {
  const k = Math.min(1, t / MATCH_TIME);
  const runner = t < 50 ? 0 : Math.min(0.3, (t - 50) / 400);
  const fat = t < 110 ? 0 : Math.min(0.12, 0.04 + (t - 110) / 1500);
  const r = rand();
  return {
    rate: 1.5 + 8 * k ** 1.2,
    hpMul: 1 + 2.5 * k,
    type: r < fat ? 'fat' : r < fat + runner ? 'runner' : 'walker',
  };
}

// 屍潮：喺某條街一次過湧一大班
export const SURGES = [
  { t: 100, n: 28 },
  { t: 180, n: 40 },
  { t: 240, n: 30, boss: true },
  { t: 275, n: 60 },
];

export const xpNeed = level => 10 + 10 * (level - 1);

export const PHARMACY = { radius: 6, rate: 12, pool: 160, regen: 1.5 }; // 每秒補幾多血；藥用完要等

// 升級三選一。who：player／tank／medic／dps／all
export const UPGRADES = [
  { who: 'player', title: '改裝槍管', desc: '你嘅傷害 +30%', apply: m => { m.dmg *= 1.3; } },
  { who: 'player', title: '快手', desc: '你嘅射速 +25%', apply: m => { m.cd /= 1.25; } },
  { who: 'player', title: '跑鞋', desc: '你嘅移速 +10%', apply: m => { m.speed *= 1.1; } },
  { who: 'player', title: '穿甲彈', desc: '你嘅子彈多穿 1 隻喪屍', apply: m => { m.pierce += 1; } },
  { who: 'tank', title: '鐵皮盾', desc: '坦克血量上限 +40%，即刻回滿', apply: m => { m.maxHp *= 1.4; m.hp = m.maxHp; } },
  { who: 'tank', title: '大力推', desc: '坦克推擊範圍同傷害 +30%', apply: m => { m.range *= 1.3; m.dmg *= 1.3; } },
  { who: 'medic', title: '急救包', desc: '醫療每次治療量 +40%', apply: m => { m.heal *= 1.4; } },
  { who: 'medic', title: '腎上腺素', desc: '醫療救人再快一倍，治療範圍 +30%', apply: m => { m.reviveMul *= 2; m.healRange *= 1.3; } },
  { who: 'dps', title: '擴容彈匣', desc: '輸出射速 +25%', apply: m => { m.cd /= 1.25; } },
  { who: 'dps', title: '高爆彈', desc: '輸出傷害 +30%', apply: m => { m.dmg *= 1.3; } },
  { who: 'all', title: '望遠瞄準', desc: '全隊槍嘅射程 +12%', apply: m => { if (m.attack === 'gun') m.range *= 1.12; } },
  { who: 'all', title: '罐頭', desc: '全隊血量上限 +15%，回一半血', apply: m => { m.maxHp *= 1.15; m.hp = Math.min(m.maxHp, m.hp + m.maxHp / 2); } },
];

export function rollUpgrades(squad, n = 3, rand = Math.random) {
  const pool = UPGRADES.filter(u => u.who === 'all' || squad.some(m => m.role === u.who && m.state !== 'dead'));
  for (let i = pool.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

export function applyUpgrade(u, squad) {
  for (const m of squad) if (m.state !== 'dead' && (u.who === 'all' || m.role === u.who)) u.apply(m);
}
