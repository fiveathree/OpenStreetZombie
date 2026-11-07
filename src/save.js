// 共用存檔：資源、隊友等級、傷勢、解鎖。存喺瀏覽器 localStorage（讀唔到就只喺今次有效）。
import { HEROES, heroXpNeed, heroLevelCost, TREAT_COST, RECRUIT_SHARDS } from './stats.js';

const KEY = 'osz-save-v1';

function fresh() {
  const heroes = {};
  for (const r of HEROES) heroes[r] = { lvl: 1, xp: 0, injured: false, owned: r === 'tank' || r === 'medic' || r === 'dps' };
  return {
    v: 1,
    res: { food: 20, meds: 10, parts: 10, ammo: 10 },
    shards: 0,
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
    if (s && s.v === 1) { const f = fresh(); return { ...f, ...s, res: { ...f.res, ...s.res }, heroes: { ...f.heroes, ...s.heroes }, cleared: { ...f.cleared, ...s.cleared } }; }
  } catch {}
  return fresh();
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function resetSave() { const s = fresh(); writeSave(s); return s; }

const canPay = (s, cost) => Object.entries(cost).every(([k, v]) => s.res[k] >= v);
const pay = (s, cost) => { for (const [k, v] of Object.entries(cost)) s.res[k] -= v; };

export function canLevel(s, role) {
  const h = s.heroes[role];
  return h.owned && h.xp >= heroXpNeed(h.lvl) && canPay(s, heroLevelCost(h.lvl));
}
export function levelUp(s, role) {
  if (!canLevel(s, role)) return false;
  const h = s.heroes[role];
  pay(s, heroLevelCost(h.lvl));
  h.xp -= heroXpNeed(h.lvl);
  h.lvl++;
  writeSave(s);
  return true;
}
export function treat(s, role) {
  const h = s.heroes[role];
  if (!h.injured || !canPay(s, TREAT_COST)) return false;
  pay(s, TREAT_COST); h.injured = false; writeSave(s); return true;
}
export function recruit(s, role) {
  const h = s.heroes[role];
  if (h.owned || s.shards < RECRUIT_SHARDS) return false;
  s.shards -= RECRUIT_SHARDS; h.owned = true; writeSave(s); return true;
}
export function unlockAll(s) {
  for (const r of HEROES) s.heroes[r].owned = true;
  s.cleared.yancheng = s.cleared.qixian = true;
  for (const k in s.res) s.res[k] = Math.max(s.res[k], 300);
  writeSave(s);
}

// 一局完：result = { mode, win, loot:{food,...}, shards, xp, squad:[{role, state}], mapId, street }
export function applyResult(s, result) {
  const mul = result.win ? 1 : 0.5; // 輸咗只帶返一半
  const got = {};
  for (const [k, v] of Object.entries(result.loot || {})) { got[k] = Math.round(v * mul); s.res[k] = (s.res[k] || 0) + got[k]; }
  s.shards += result.shards || 0;
  const used = new Set();
  for (const m of result.squad || []) {
    if (m.role === 'player' || !s.heroes[m.role]) continue;
    used.add(m.role);
    const h = s.heroes[m.role];
    h.xp += Math.round((result.xp || 0) * (m.state === 'dead' ? 0.5 : 1));
    h.injured = m.state === 'dead'; // 陣亡 = 受傷，下一場抖一場或者帶傷上陣
  }
  for (const r of HEROES) if (!used.has(r) && s.heroes[r].injured) s.heroes[r].injured = false; // 抖咗一場就好返
  if (result.win && result.mapId) s.cleared[result.mapId] = true;
  if (result.street) s.bestStreet = Math.max(s.bestStreet, result.street);
  s.runs++;
  writeSave(s);
  return got;
}
