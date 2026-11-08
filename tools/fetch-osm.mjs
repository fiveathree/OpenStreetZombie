// 一次性：用 Overpass API 下載一個範圍，轉成遊戲用 JSON（座標單位：米，原點喺左上角）。
// 用法：node tools/fetch-osm.mjs <lat> <lon> <半徑米> <輸出檔> <名> [--big]
//   中地圖（鹽埕）：node tools/fetch-osm.mjs 22.6244 120.2838 200 data/yancheng.json 高雄鹽埕區
//   中地圖（七賢）：node tools/fetch-osm.mjs 22.6289 120.2840 220 data/qixian.json 鹽埕七賢路
//   大地圖＋小地圖：node tools/fetch-osm.mjs 22.6262 120.2858 760 data/big.json 鹽埕・愛河 --big
// --big：唔要行人路、後巷同建築輪廓（檔案細啲），但要埋河、橋、醫院、學校。
// OSM 喺台灣嘅建築輪廓唔齊，所以遊戲當「道路、空地同河以外」全部都係密集街屋（障礙物）。
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { mergeLandmarks } from './landmarks.mjs';

const args = process.argv.slice(2);
const big = args.includes('--big');
const [latS = '22.6244', lonS = '120.2838', halfS = '200', out = 'data/yancheng.json', name = '高雄鹽埕區'] = args.filter(a => a !== '--big');
const lat = Number(latS), lon = Number(lonS), half = Number(halfS);
const R = 6378137, toRad = Math.PI / 180;
const dLat = half / R / toRad, dLon = half / (R * Math.cos(lat * toRad)) / toRad;
const pad = 1.25; // 多拎少少，等邊界上嘅路同建築唔會斷
const bbox = [lat - dLat * pad, lon - dLon * pad, lat + dLat * pad, lon + dLon * pad].map(n => n.toFixed(6)).join(',');

const query = `[out:json][timeout:90];
(
  way["highway"](${bbox});
  ${big ? '' : `way["building"](${bbox});`}
  way["leisure"~"^(park|playground|pitch)$"](${bbox});
  way["amenity"="parking"](${bbox});
  way["landuse"~"^(grass|recreation_ground)$"](${bbox});
  way["place"="square"](${bbox});
  way["waterway"="river"](${bbox});
  way["natural"="water"](${bbox});
  nwr["amenity"~"^(pharmacy|clinic|doctors|police|fuel|hospital|school)$"](${bbox});
  nwr["shop"~"^(convenience|chemist|hardware|supermarket)$"](${bbox});
  nwr["tourism"~"^(attraction|museum|viewpoint|gallery)$"]["name"](${bbox});
  nwr["historic"]["name"](${bbox});
  nwr["railway"="station"]["name"](${bbox});
  nwr["amenity"~"^(marketplace|place_of_worship|theatre|townhall)$"]["name"](${bbox});
  nwr["man_made"="tower"]["name"](${bbox});
);
out geom;`;

// Overpass 繁忙時會 429／502／504：等一陣再試（15、30、60…秒）
let res;
for (let i = 0, wait = 15; ; i++, wait *= 2) {
  res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'OpenStreetZombie-preprocess/1.0' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (res.ok || i >= 5 || ![429, 502, 503, 504].includes(res.status)) break;
  console.log('Overpass ' + res.status + '，' + wait + ' 秒後再試');
  await new Promise(r => setTimeout(r, wait * 1000));
}
if (!res.ok) throw new Error('Overpass ' + res.status + ' ' + (await res.text()).slice(0, 300));
const { elements } = await res.json();

const size = half * 2;
// 米，原點 = 範圍左上角；y 向下
const proj = (la, lo) => [
  Math.round(((lo - lon) * toRad * R * Math.cos(lat * toRad) + half) * 10) / 10,
  Math.round((half - (la - lat) * toRad * R) * 10) / 10,
];
const inside = ([x, y], m = 0) => x >= -m && y >= -m && x <= size + m && y <= size + m;

const WIDTH = { primary: 14, secondary: 12, tertiary: 10, trunk: 16, residential: 7, unclassified: 7, living_street: 5, service: 4, pedestrian: 5, footway: 2.5, path: 2.5, steps: 2.5, alley: 3.5 };
const MINOR = new Set(['footway', 'path', 'steps', 'service']);
const roads = [], buildings = [], open = [], water = [], rivers = [], pois = [], landmarks = [];
// 地標：景點、古蹟、車站、市場、廟、塔（淨係標名，唔係玩法地點）
const LM = t => t.tourism && /^(attraction|museum|viewpoint|gallery)$/.test(t.tourism) ? 3 : t.historic ? 3 : t.man_made === 'tower' ? 4 : t.railway === 'station' ? 2 : /^(marketplace|place_of_worship|theatre|townhall)$/.test(t.amenity || '') ? 1 : 0;
const zhName = t => (t['name:zh-Hant'] || t['name:zh-HK'] || t['name:zh-TW'] || t['name:zh'] || t['name:ja'] || t.name || '').trim();
const centerOf = e => e.type === 'node' ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : e.bounds ? [(e.bounds.minlat + e.bounds.maxlat) / 2, (e.bounds.minlon + e.bounds.maxlon) / 2] : e.geometry ? [e.geometry.reduce((s, p) => s + p.lat, 0) / e.geometry.length, e.geometry.reduce((s, p) => s + p.lon, 0) / e.geometry.length] : null;

for (const e of elements) {
  const t = e.tags || {};
  const poiType =
    t.amenity === 'pharmacy' || t.shop === 'chemist' || t.amenity === 'clinic' || t.amenity === 'doctors' ? 'pharmacy'
    : t.shop === 'convenience' || t.shop === 'supermarket' ? 'store'
    : t.shop === 'hardware' ? 'hardware'
    : t.amenity === 'police' ? 'police'
    : t.amenity === 'fuel' ? 'fuel'
    : t.amenity === 'hospital' ? 'hospital'
    : t.amenity === 'school' ? 'school' : null;
  if (poiType) {
    let la, lo;
    if (e.type === 'node') ({ lat: la, lon: lo } = e);
    else if (e.center) ({ lat: la, lon: lo } = e.center);
    else if (e.geometry) { la = e.geometry.reduce((s, p) => s + p.lat, 0) / e.geometry.length; lo = e.geometry.reduce((s, p) => s + p.lon, 0) / e.geometry.length; }
    else if (e.bounds) { la = (e.bounds.minlat + e.bounds.maxlat) / 2; lo = (e.bounds.minlon + e.bounds.maxlon) / 2; }
    if (la != null) { const p = proj(la, lo); if (inside(p, -4)) pois.push({ type: poiType, name: t['name:zh'] || t.name || '', x: p[0], y: p[1] }); }
  }
  const lmRank = LM(t), lmName = zhName(t);
  if (lmRank && lmName && !poiType) { const c = centerOf(e); if (c) { const p = proj(c[0], c[1]); if (inside(p, -10)) landmarks.push({ name: lmName, x: p[0], y: p[1], rank: lmRank }); } }
  if (e.type !== 'way' || !e.geometry) continue;
  const pts = e.geometry.map(g => proj(g.lat, g.lon));
  if (!pts.some(p => inside(p, 30))) continue;
  if (t.highway && WIDTH[t.highway] && t.area !== 'yes') {
    if (big && (MINOR.has(t.highway))) continue;
    const r = { w: t.highway === 'service' && t.service === 'alley' ? WIDTH.alley : WIDTH[t.highway], k: t.highway, name: t.name || '', pts };
    if (t.bridge === 'yes') r.bridge = 1;
    roads.push(r);
  } else if (t.waterway === 'river') {
    rivers.push({ name: t.name || '', pts });
  } else if (t.natural === 'water' && pts.length >= 4) {
    water.push(pts.slice(0, -1));
  } else if (t.building && pts.length >= 4) {
    buildings.push(pts.slice(0, -1)); // 去掉重複嘅尾點
  } else if ((t.leisure || t.amenity === 'parking' || t.landuse || t.place === 'square') && pts.length >= 4) {
    open.push(pts.slice(0, -1)); // 公園、停車場：空地，行得
  }
}

const data = {
  source: 'OpenStreetMap', license: 'ODbL — © OpenStreetMap contributors',
  name, center: [lat, lon], size, fetched: new Date().toISOString().slice(0, 10),
  roads, buildings, open, water, rivers, pois,
  // 同名嘅（例如車站幾個出口）留一個；重要嘅排先，最多 14 個
  landmarks: landmarks.sort((a, b) => b.rank - a.rank).filter((l, i, a) => a.findIndex(o => o.name === l.name) === i).slice(0, 14).map(({ name, x, y }) => ({ name, x, y })),
};
mergeLandmarks(data, basename(out, '.json'));
await writeFile(out, JSON.stringify(data));
console.log(`寫咗 ${out}：道路 ${roads.length}、建築 ${buildings.length}、空地 ${open.length}、水 ${water.length}、河 ${rivers.length}、地點 ${pois.length}、地標 ${data.landmarks.length}`);
console.log('地標：' + data.landmarks.map(l => l.name).join('、'));
console.log(pois.map(p => `${p.type} ${p.name} (${p.x},${p.y})`).join('\n'));
