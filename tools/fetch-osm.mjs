// 一次性：用 Overpass API 下載一個街區，轉成遊戲用 JSON（座標單位：米，原點喺左上角）。
// 用法：node tools/fetch-osm.mjs [lat] [lon] [半徑米] [輸出檔]
// 預設：高雄鹽埕區，大約 400 米範圍。
// OSM 喺台灣嘅建築輪廓唔齊，所以遊戲當「道路同空地以外」全部都係密集街屋（障礙物）。
import { writeFile } from 'node:fs/promises';

const [lat = 22.6244, lon = 120.2838, half = 200, out = 'data/yancheng.json'] =
  process.argv.slice(2).map((v, i) => (i < 3 ? Number(v) : v));
const R = 6378137, toRad = Math.PI / 180;
const dLat = half / R / toRad, dLon = half / (R * Math.cos(lat * toRad)) / toRad;
const pad = 1.25; // 多拎少少，等邊界上嘅路同建築唔會斷
const bbox = [lat - dLat * pad, lon - dLon * pad, lat + dLat * pad, lon + dLon * pad].map(n => n.toFixed(6)).join(',');

const query = `[out:json][timeout:60];
(
  way["highway"](${bbox});
  way["building"](${bbox});
  way["leisure"~"^(park|playground|pitch)$"](${bbox});
  way["amenity"="parking"](${bbox});
  way["landuse"~"^(grass|recreation_ground)$"](${bbox});
  way["place"="square"](${bbox});
  nwr["amenity"~"^(pharmacy|clinic|doctors|police|fuel)$"](${bbox});
  nwr["shop"~"^(convenience|chemist)$"](${bbox});
);
out geom;`;

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'OpenStreetZombie-preprocess/1.0' },
  body: 'data=' + encodeURIComponent(query),
});
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
const roads = [], buildings = [], open = [], pois = [];

for (const e of elements) {
  const t = e.tags || {};
  const poiType =
    t.amenity === 'pharmacy' || t.shop === 'chemist' || t.amenity === 'clinic' || t.amenity === 'doctors' ? 'pharmacy'
    : t.shop === 'convenience' ? 'store'
    : t.amenity === 'police' ? 'police'
    : t.amenity === 'fuel' ? 'fuel' : null;
  if (poiType) {
    let la, lo;
    if (e.type === 'node') ({ lat: la, lon: lo } = e);
    else if (e.center) ({ lat: la, lon: lo } = e.center);
    else if (e.geometry) { la = e.geometry.reduce((s, p) => s + p.lat, 0) / e.geometry.length; lo = e.geometry.reduce((s, p) => s + p.lon, 0) / e.geometry.length; }
    else if (e.bounds) { la = (e.bounds.minlat + e.bounds.maxlat) / 2; lo = (e.bounds.minlon + e.bounds.maxlon) / 2; }
    if (la != null) { const p = proj(la, lo); if (inside(p, -4)) pois.push({ type: poiType, name: t['name:zh'] || t.name || '', x: p[0], y: p[1] }); }
  }
  if (e.type !== 'way' || !e.geometry) continue;
  const pts = e.geometry.map(g => proj(g.lat, g.lon));
  if (!pts.some(p => inside(p, 30))) continue;
  if (t.highway && WIDTH[t.highway] && t.area !== 'yes') {
    roads.push({ w: t.highway === 'service' && t.service === 'alley' ? WIDTH.alley : WIDTH[t.highway], k: t.highway, name: t.name || '', pts });
  } else if (t.building && pts.length >= 4) {
    buildings.push(pts.slice(0, -1)); // 去掉重複嘅尾點
  } else if ((t.leisure || t.amenity === "parking" || t.landuse || t.place === "square") && pts.length >= 4) {
    open.push(pts.slice(0, -1)); // 公園、停車場：空地，行得
  }
}

const data = {
  source: 'OpenStreetMap', license: 'ODbL — © OpenStreetMap contributors',
  name: '高雄鹽埕區', center: [lat, lon], size, fetched: new Date().toISOString().slice(0, 10),
  roads, buildings, open, pois,
};
await writeFile(out, JSON.stringify(data));
console.log(`寫咗 ${out}：道路 ${roads.length}、建築 ${buildings.length}、空地 ${open.length}、地點 ${pois.length}`);
console.log(pois.map(p => `${p.type} ${p.name} (${p.x},${p.y})`).join('\n'));
