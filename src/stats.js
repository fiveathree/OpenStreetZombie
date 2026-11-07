// 共用戰鬥數值：職業、羈絆、大招、喪屍、升級卡、成長。三個地圖都用；改難度就改呢度。
export const MATCH_TIME = 300;   // 中地圖撐幾多秒過關
export const BLEED_TIME = 20;    // 倒地幾耐冇人救就死
export const REVIVE_TIME = 3;    // 救一個人要幾耐（醫療快一倍）
export const REVIVE_RANGE = 2.4; // 企幾近先救到

// 職業。job = 身份（羈絆用）；ult = 大招
export const ROLES = {
  player: { label: '你', name: '你', job: '倖存者', hp: 120, speed: 6.4, armor: 0, attack: 'gun', dmg: 12, cd: 0.3, range: 13, pierce: 0,
    ult: { name: '手榴彈', desc: '掟去最多喪屍嗰度，範圍爆炸', charge: 22 } },
  tank: { label: '坦克', name: '阿坤', job: '消防員', hp: 260, speed: 6, armor: 0.35, attack: 'shove', dmg: 15, cd: 0.7, range: 2.8, knock: 2.4,
    ult: { name: '嘲諷', desc: '附近喪屍全部轉打佢，6 秒內減傷一半', charge: 26 } },
  medic: { label: '醫療', name: '小芳', job: '護士', hp: 100, speed: 6.2, armor: 0, attack: 'gun', dmg: 8, cd: 0.5, range: 11, pierce: 0, heal: 14, healCd: 1.4, healRange: 9, reviveMul: 2,
    ult: { name: '急救站', desc: '全隊回四成血，即刻救起附近倒地隊友', charge: 30 } },
  dps: { label: '輸出', name: '阿傑', job: '退伍軍人', hp: 95, speed: 6.2, armor: 0, attack: 'gun', dmg: 9, cd: 0.16, range: 15, pierce: 1,
    ult: { name: '掃射', desc: '5 秒內射速三倍', charge: 24 } },
  control: { label: '控場', name: '陳老師', job: '化學老師', hp: 110, speed: 6, armor: 0.1, attack: 'flame', dmg: 5, cd: 0.12, range: 5.5, slow: 0.5,
    ult: { name: '汽油彈', desc: '掟一片火海，燒住同減慢喪屍', charge: 24 } },
  support: { label: '支援', name: '阿明', job: '外送員', hp: 90, speed: 6.6, armor: 0, attack: 'gun', dmg: 42, cd: 1.15, range: 22, pierce: 2, sniper: true,
    ult: { name: '物資空投', desc: '全隊傷害同移速 +30%，8 秒', charge: 28 } },
};
export const HEROES = ['tank', 'medic', 'dps', 'control', 'support']; // 可以帶出場嘅隊友

// 羈絆：兩個身份同場有加成
export const BONDS = [
  { a: 'tank', b: 'control', name: '火海加倍', desc: '消防員＋化學老師：汽油彈火勢同範圍加倍' },
  { a: 'medic', b: 'dps', name: '戰地醫護', desc: '護士＋退伍軍人：治療 +25%，輸出血量 +25%' },
  { a: 'tank', b: 'support', name: '救援隊', desc: '消防員＋外送員：全隊移速 +8%' },
  { a: 'control', b: 'support', name: '土製炸彈', desc: '化學老師＋外送員：你嘅手榴彈範圍 +40%' },
];
export const activeBonds = roles => BONDS.filter(b => roles.includes(b.a) && roles.includes(b.b));

export const ZOMBIES = {
  walker: { name: '普通屍', hp: 32, speed: 2.5, dps: 12, r: 0.6, xp: 1 },
  runner: { name: '跑屍', hp: 22, speed: 4.8, dps: 9, r: 0.55, xp: 2 },
  fat: { name: '肥屍', hp: 110, speed: 1.8, dps: 16, r: 0.95, xp: 4, blast: { r: 3.6, dmg: 28 } }, // 死後爆炸，炸埋隔籬啲屍
  screamer: { name: '尖叫屍', hp: 45, speed: 2.8, dps: 6, r: 0.65, xp: 4, scream: 7 },              // 見到你就嗌，叫多幾隻嚟
  boss: { name: '屍王', hp: 3000, speed: 2.3, dps: 35, r: 1.7, xp: 40 },
  elite: { name: '精英屍', hp: 320, speed: 3, dps: 20, r: 1.05, xp: 10 },                            // 大地圖野區
  king: { name: '喪屍王', hp: 7000, speed: 2.4, dps: 45, r: 2.1, xp: 80 },                            // 大地圖
  outpost: { name: '屍巢', hp: 4000, speed: 0, dps: 0, r: 4, xp: 30 },                                // 大地圖：每條路一個
  nest: { name: '喪屍巢穴', hp: 14000, speed: 0, dps: 0, r: 6, xp: 100 },                              // 大地圖：打爆就贏
};

// 大地圖（MOBA）數值
export const BIG = {
  base: { hp: 3200, dmg: 30, cd: 0.8, range: 18, cap: 3 },     // 主城
  tower: { hp: 1600, dmg: 30, cd: 0.7, range: 16, cap: 2 },    // 箭塔
  garrisonBonus: 1.3,                                          // 有隊友守，塔攻擊 ×1.3
  minion: { hp: 160, dmg: 10, cd: 0.8, range: 10, speed: 4.2 }, // 兵營出嘅兵
  soldier: { hp: 150, dmg: 10, cd: 0.7, range: 12 },           // 守備小隊（每隊 3 個）
  minionEvery: 30, waveEvery: 30, surgeEvery: 240,
  kingAt: 300, kingEvery: 240,
  laneSpeed: 1.5,                                              // 路上喪屍行快啲（大地圖好大）
  respawn: 12, recall: 3,
  startParts: 30, squadCost: 10, upgradeCost: 15,
  campEvery: 90, bossBuff: 90,
};

// t 秒時：每秒出幾多隻、血量倍數、出咩屍
export function waveAt(t, rand = Math.random, hard = 1) {
  const k = Math.min(1, t / MATCH_TIME);
  const runner = t < 50 ? 0 : Math.min(0.3, (t - 50) / 400);
  const fat = t < 110 ? 0 : Math.min(0.12, 0.04 + (t - 110) / 1500);
  const scream = t < 70 ? 0 : 0.03;
  const r = rand();
  return {
    rate: (1.5 + 8 * k ** 1.2) * hard,
    hpMul: (1 + 2.5 * k) * hard,
    type: r < fat ? 'fat' : r < fat + scream ? 'screamer' : r < fat + scream + runner ? 'runner' : 'walker',
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

// 地點效果（中地圖同大地圖共用）
export const POIS = {
  pharmacy: { label: '藥房', ch: '✚', color: '#4d774a', radius: 6, desc: '企入圈補血；藥用完要等' },
  store: { label: '便利店', ch: '店', color: '#9c5228', radius: 5, cd: 50, desc: '入去拎能量飲品：全隊射速 +30%，20 秒' },
  police: { label: '警局', ch: '警', color: '#45607a', radius: 6, cd: 70, desc: '入去拎武器：全隊傷害 +40%，30 秒' },
  fuel: { label: '油站', ch: '油', color: '#7a2e24', radius: 6, cd: 90, desc: '企入圈 2 秒點火，4 秒後大爆炸，記得走開' },
  hardware: { label: '五金行', ch: '五', color: '#6b6141', radius: 5, cd: 60, desc: '拎零件' },
  hospital: { label: '醫院', ch: '院', color: '#5a2a2a', radius: 0 },
  school: { label: '學校', ch: '校', color: '#4a5a3a', radius: 0 },
};
export const PHARMACY = { rate: 12, pool: 160, regen: 1.5 };
export const FUEL_BLAST = { fuse: 4, r: 16, dmg: 600, squadR: 8, squadDmg: 70 };

// 升級三選一。who：player／tank／medic／dps／control／support／all
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
  { who: 'control', title: '加壓噴嘴', desc: '火焰範圍 +30%', apply: m => { m.range *= 1.3; } },
  { who: 'control', title: '白磷', desc: '火焰傷害 +35%', apply: m => { m.dmg *= 1.35; } },
  { who: 'support', title: '穿甲狙擊', desc: '狙擊傷害 +40%', apply: m => { m.dmg *= 1.4; } },
  { who: 'support', title: '快拉栓', desc: '狙擊射速 +30%', apply: m => { m.cd /= 1.3; } },
  { who: 'all', title: '望遠瞄準', desc: '全隊槍嘅射程 +12%', apply: m => { if (m.attack === 'gun') m.range *= 1.12; } },
  { who: 'all', title: '罐頭', desc: '全隊血量上限 +15%，回一半血', apply: m => { m.maxHp *= 1.15; m.hp = Math.min(m.maxHp, m.hp + m.maxHp / 2); } },
  { who: 'all', title: '對講機', desc: '全隊大招充得快 30%', apply: m => { m.ultRate *= 1.3; } },
];

export function rollUpgrades(squad, n = 3, rand = Math.random) {
  const pool = UPGRADES.filter(u => u.who === 'all' || squad.some(m => m.role === u.who && m.state !== 'dead'));
  for (let i = pool.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

export function applyUpgrade(u, squad) {
  for (const m of squad) if (m.state !== 'dead' && (u.who === 'all' || m.role === u.who)) u.apply(m);
}

// ---- 長期成長（安全屋）----
export const heroXpNeed = lvl => 60 * lvl;                                   // 升下一級要幾多經驗
export const heroLevelCost = lvl => ({ food: 15 * lvl, meds: 8 * lvl });     // 升級要幾多資源
export const levelMul = lvl => 1 + 0.1 * (lvl - 1);                          // 每級 +10% 血同傷害
export const ULT_BOOST_LEVEL = 3;                                            // 呢級開始學識「大招強化」（效果 +50%）
export const INJURY_HP = 0.7;                                                // 帶傷上陣：血量上限 ×0.7
export const TREAT_COST = { meds: 12 };                                      // 即刻醫好傷
export const RECRUIT_SHARDS = 5;                                             // 招募一個隊友要幾多碎片
export const RES_NAMES = { food: '食物', meds: '藥品', parts: '零件', ammo: '彈藥' };
