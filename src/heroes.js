// 英雄名冊：本作 5 個隊友 ＋ 屍城日誌（fiveathree/zomibee）抄入嚟嘅 131 個角色（data/zomibee-cast.json）。
// 每個英雄都有一個戰鬥職業（tank／medic／dps／control／support），再加自己嘅血、傷害、速度倍數同陣營。

export const CORE = {
  tank: { id: 'tank', role: 'tank', name: '阿坤', job: '消防員', fa: ['軍警消防'], rarity: 'SR', core: true, mul: { hp: 1, dmg: 1, speed: 1 } },
  medic: { id: 'medic', role: 'medic', name: '小芳', job: '護士', fa: ['醫者仁心'], rarity: 'SR', core: true, mul: { hp: 1, dmg: 1, speed: 1 } },
  dps: { id: 'dps', role: 'dps', name: '阿傑', job: '退伍軍人', fa: ['軍警消防'], rarity: 'SR', core: true, mul: { hp: 1, dmg: 1, speed: 1 } },
  control: { id: 'control', role: 'control', name: '陳老師', job: '化學老師', fa: ['寶島'], rarity: 'SR', core: true, mul: { hp: 1, dmg: 1, speed: 1 } },
  support: { id: 'support', role: 'support', name: '阿明', job: '外送員', fa: ['寶島'], rarity: 'SR', core: true, mul: { hp: 1, dmg: 1, speed: 1 } },
};
export const CORE_IDS = Object.keys(CORE);

const CAST = {};
export async function loadCast(url = 'data/zomibee-cast.json') {
  try {
    const d = await (await fetch(url)).json();
    for (const c of d.cast) CAST[c.id] = c;
  } catch {} // 讀唔到就淨係得本作 5 個人
}
export const hero = id => CORE[id] || CAST[id];
export const castList = () => Object.values(CAST);

// 招募要幾多粒專屬碎片（唔夠可以用通用碎片補）
export const RECRUIT_NEED = { C: 2, R: 3, SR: 4, SSR: 6, UR: 10 };
const RARITY_W = { C: 40, R: 30, SR: 18, SSR: 9, UR: 3 };
export const JOIN_CHANCE = { C: 0.5, R: 0.45, SR: 0.4, SSR: 0.3, UR: 0.2 }; // 救到之後即刻加入幫手嘅機會

// 隨機一個被困倖存者（按稀有度抽），skip：唔要嘅 id
export function rollSurvivor(skip = new Set(), rand = Math.random) {
  const list = castList().filter(c => !skip.has(c.id));
  if (!list.length) return null;
  let total = 0;
  for (const c of list) total += RARITY_W[c.rarity] || 10;
  let r = rand() * total;
  for (const c of list) { r -= RARITY_W[c.rarity] || 10; if (r <= 0) return c; }
  return list[list.length - 1];
}

// 同陣營兩人或以上：全隊傷害、血量各 +8%（每個陣營計一次，最多 +16%）
export function factionBonds(ids) {
  const count = {};
  for (const id of ids) for (const f of hero(id)?.fa || []) count[f] = (count[f] || 0) + 1;
  return Object.entries(count).filter(([, n]) => n >= 2).map(([f, n]) => ({ name: f, n })).slice(0, 2);
}
