// 共用存檔：資源、英雄（本作 5 個 ＋ 屍城日誌角色）等級、傷勢、碎片、解鎖。存喺瀏覽器 localStorage（讀唔到就只喺今次有效）。
import { heroXpNeed, heroLevelCost, TREAT_COST } from './stats.js';
import { CORE_IDS, hero, RECRUIT_NEED } from './heroes.js';

const KEY = 'osz-save-v1';
const blank = () => ({ lvl: 1, xp: 0, injured: false, owned: false, shards: 0 });

function fresh() {
  const heroes = {};
  for (const id of CORE_IDS) heroes[id] = { ...blank(), owned: id === 'tank' || id === 'medic' || id === 'dps' };
  return {
    v: 1,
    res: { food: 20, meds: 10, parts: 10, ammo: 10 },
    shards: 0, // 通用碎片：招募任何人都可以補數
    heroes,
    team: ['tank', 'medic', 'dps'],
    cleared: { yancheng: false, qixian: false, big: false },
    runs: 0,
    bestStreet: 0,
  };
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) {
      const f = fresh();
      const heroes = { ...f.heroes };
      for (const [id, h] of Object.entries(s.heroes || {})) heroes[id] = { ...blank(), ...h };
      return { ...f, ...s, res: { ...f.res, ...s.res }, heroes, cleared: { ...f.cleared, ...s.cleared } };
    }
  } catch {}
  return fresh();
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function resetSave() { const s = fresh(); writeSave(s); return s; }

export const H = (s, id) => (s.heroes[id] ||= blank());
const canPay = (s, cost) => Object.entries(cost).every(([k, v]) => s.res[k] >= v);
const pay = (s, cost) => { for (const [k, v] of Object.entries(cost)) s.res[k] -= v; };
export const owned = s => Object.keys(s.heroes).filter(id => s.heroes[id].owned && hero(id));
export const recruitNeed = id => RECRUIT_NEED[hero(id)?.rarity] || 5;

export function canLevel(s, id) {
  const h = H(s, id);
  return h.owned && h.xp >= heroXpNeed(h.lvl) && canPay(s, heroLevelCost(h.lvl));
}
export function levelUp(s, id) {
  if (!canLevel(s, id)) return false;
  const h = H(s, id);
  pay(s, heroLevelCost(h.lvl));
  h.xp -= heroXpNeed(h.lvl);
  h.lvl++;
  writeSave(s);
  return true;
}
export function treat(s, id) {
  const h = H(s, id);
  if (!h.injured || !canPay(s, TREAT_COST)) return false;
  pay(s, TREAT_COST); h.injured = false; writeSave(s); return true;
}
// 招募：專屬碎片唔夠，用通用碎片補
export function canRecruit(s, id) { const h = H(s, id); return !h.owned && h.shards + s.shards >= recruitNeed(id); }
export function recruit(s, id) {
  if (!canRecruit(s, id)) return false;
  const h = H(s, id), need = recruitNeed(id), useOwn = Math.min(h.shards, need);
  h.shards -= useOwn; s.shards -= need - useOwn; h.owned = true;
  writeSave(s);
  return true;
}
export function unlockAll(s) {
  for (const id of CORE_IDS) H(s, id).owned = true;
  s.cleared.yancheng = s.cleared.qixian = true;
  for (const k in s.res) s.res[k] = Math.max(s.res[k], 300);
  s.shards = Math.max(s.shards, 30);
  writeSave(s);
}

// 一局完：result = { win, loot:{food,...}, shards, charShards:{id:n}, recruits:[id], xp, squad:[{heroId, state}], mapId, street }
export function applyResult(s, result) {
  const mul = result.win ? 1 : 0.5; // 輸咗只帶返一半
  const got = {};
  for (const [k, v] of Object.entries(result.loot || {})) { got[k] = Math.round(v * mul); s.res[k] = (s.res[k] || 0) + got[k]; }
  s.shards += result.shards || 0;
  for (const [id, n] of Object.entries(result.charShards || {})) H(s, id).shards += n;
  const joined = [];
  for (const id of result.recruits || []) { const h = H(s, id); if (!h.owned) { h.owned = true; joined.push(id); } } // 即時加入又捱到最後：正式入隊
  const used = new Set();
  for (const m of result.squad || []) {
    const id = m.heroId;
    if (!id || id === 'player' || !s.heroes[id]?.owned) continue;
    used.add(id);
    const h = s.heroes[id];
    h.xp += Math.round((result.xp || 0) * (m.state === 'dead' ? 0.5 : 1));
    h.injured = m.state === 'dead'; // 陣亡 = 受傷，下一場抖一場或者帶傷上陣
  }
  for (const [id, h] of Object.entries(s.heroes)) if (!used.has(id) && h.injured) h.injured = false; // 抖咗一場就好返
  if (result.win && result.mapId) s.cleared[result.mapId] = true;
  if (result.street) s.bestStreet = Math.max(s.bestStreet, result.street);
  s.runs++;
  writeSave(s);
  return { got, joined };
}
