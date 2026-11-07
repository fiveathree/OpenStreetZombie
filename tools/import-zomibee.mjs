// 一次性：由屍城日誌（fiveathree/zomibee）抄角色入嚟，轉成 data/zomibee-cast.json。
// 用法：node tools/import-zomibee.mjs <zomibee 資料夾> [輸出檔]
// 每個角色按 7 項數值（力量、敏捷、感知、技術、醫術、廚藝、意志）揀一個戰鬥職業，再計血、傷害、速度倍數。
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [dir = '../zomibee-ref', out = 'data/zomibee-cast.json'] = process.argv.slice(2);
const src = (await Promise.all(['src/2_data.js', 'src/2b_more.js', 'src/6b_cast.js'].map(f => readFile(join(dir, f), 'utf8')))).join('\n');

// 抽出 `const NAME=` 後面嘅陣列或者物件字面值（數括號，略過字串）
function literal(name) {
  const i = src.indexOf(`const ${name}=`);
  if (i < 0) throw new Error('搵唔到 ' + name);
  let k = src.indexOf('=', i) + 1, depth = 0, start = -1, q = null;
  for (; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '[' || c === '{') { if (start < 0) start = k; depth++; }
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return Function('return ' + src.slice(start, k + 1))(); }
  }
  throw new Error('括號唔夾：' + name);
}

const rows = [...literal('CH_RAW'), ...literal('NEW_CH')];
const cast2 = literal('CAST2');
const CFA = literal('CFA');
const FA = literal('FA');
for (const r of cast2) { CFA[r[0]] = r[12]; rows.push(r.slice(0, 12)); }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;
const cast = rows.map(([id, name, rarity, origin, job, s, traits, perk, perkDesc, , bio, glyph]) => {
  const [str, agi, per, tec, med, cok, wil] = s;
  const fa = [...(CFA[id] || '')];
  const pet = fa.includes('寵');
  const score = {
    tank: str * 1.2 + wil * 0.8 + (/消防|保安|拳|力士|守/.test(job) ? 8 : 0),
    medic: med * 2 + (/醫|護|藥/.test(job) ? 6 : 0),
    dps: agi * 1.1 + str * 0.6 + per * 0.3 + (/軍|兵|刀|劍|武|將/.test(job) ? 4 : 0),
    control: tec * 1.6 + per * 0.3 + (/工程|化學|技|師|魔/.test(job) ? 4 : 0),
    support: per * 1.25 + agi * 0.3 + cok * 0.3 + (/狙|外送|速遞|廚/.test(job) ? 6 : 0),
  };
  let role = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
  if (pet) role = str >= agi ? 'tank' : 'dps'; // 貓狗唔識用槍，用咬
  const main = { tank: str, medic: med, dps: Math.max(agi, str), control: tec, support: per }[role];
  return {
    id: 'zb_' + id, src: id, name, rarity, origin, job, role, fa: fa.map(f => FA[f] || f), pet, glyph,
    stats: s, perk, perkDesc, bio,
    mul: { hp: r2(clamp(0.8 + (str + wil - 22) / 40, 0.7, 1.6)), dmg: r2(clamp(0.85 + (main - 12) / 20, 0.7, 1.6)), speed: r2(clamp(0.92 + (agi - 12) / 120, 0.85, 1.12)) },
  };
});

await writeFile(out, JSON.stringify({ source: '屍城日誌 fiveathree/zomibee', count: cast.length, cast }));
const by = {};
for (const c of cast) by[c.role] = (by[c.role] || 0) + 1;
console.log(`寫咗 ${out}：${cast.length} 個角色`, by);
