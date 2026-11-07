// 共用：地圖載入。讀預處理好嘅 OSM JSON → 導航格（行得／行唔得）＋ 畫地圖。小、中、大地圖都用。
// 座標單位係米。OSM 喺台灣嘅建築輪廓唔齊，所以「道路、空地同河以外」一律當密集街屋（障礙物、擋子彈）。
export const CELL = 2; // 預設導航格每格幾多米（大地圖用 4）
const CHUNK = 120;     // 畫圖分塊（米），只畫睇得到嗰幾塊

export async function loadMap(url, opts) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('地圖載入失敗：' + res.status);
  return buildMap(await res.json(), opts);
}

// 固定種子，等每次開嘅地圖（廢車、天台雜物）都一樣
function rng(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function trace(g, pts, close) {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}

// 沿每段路每隔 step 米叫一次 fn(road, x, y, 單位向量 ux, uy)
export function alongRoads(roads, step, fn) {
  for (const r of roads) for (let i = 1; i < r.pts.length; i++) {
    const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i], len = Math.hypot(bx - ax, by - ay);
    if (len < 1) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let d = step / 2; d < len; d += step) fn(r, ax + ux * d, ay + uy * d, ux, uy);
  }
}

const bboxOf = (pts, pad = 0) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
};

// opts：{ cell, detail }。detail = false 時少畫啲裝飾（大地圖）
export function buildMap(data, opts = {}) {
  const cell = opts.cell || CELL, detail = opts.detail !== false;
  const size = data.size, n = Math.ceil(size / cell), rand = rng(20261108);
  const roads = data.roads.map(r => ({ ...r, w: Math.max(r.w, 3) })); // 太窄嘅巷都要行得過
  const water = data.water || [], rivers = data.rivers || [];
  const RIVER_W = 42;

  // 廢車：擺喺闊路兩邊，會擋路（橋上唔擺）
  const cars = [];
  alongRoads(roads.filter(r => r.w >= 7 && !r.bridge), 9, (r, x, y, ux, uy) => {
    if (rand() > (detail ? 0.16 : 0.08)) return;
    const side = rand() < 0.5 ? -1 : 1, off = r.w / 2 - 1.4;
    cars.push({ x: x - uy * off * side, y: y + ux * off * side, a: Math.atan2(uy, ux) + (rand() - 0.5) * 0.6, c: rand() });
  });

  // 店舖：由招牌開一條 3 米行人路去最近嘅街，等人入得去
  const nearestRoadPoint = (x, y) => {
    let bx = x, by = y, bd = Infinity;
    for (const r of roads) for (let i = 1; i < r.pts.length; i++) {
      const [ax, ay] = r.pts[i - 1], [cx, cy] = r.pts[i], vx = cx - ax, vy = cy - ay, l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)), px = ax + vx * t, py = ay + vy * t, d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bd) { bd = d; bx = px; by = py; }
    }
    return { x: bx, y: by };
  };
  const doors = data.pois.map(p => { const d = nearestRoadPoint(p.x, p.y); return { x: p.x, y: p.y, dx: d.x, dy: d.y }; });

  // 用瀏覽器 canvas 光柵化：白色 = 行得。
  // 次序要緊：OSM 有啲建築輪廓蓋過路面（騎樓、天幕），所以先畫建築同河、後畫路（包括橋），路一定行得；最後先擺廢車。
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, n, n);
  g.scale(1 / cell, 1 / cell);
  g.lineCap = g.lineJoin = 'round';
  g.fillStyle = '#fff';
  for (const p of data.open) { g.beginPath(); trace(g, p, true); g.fill(); }
  g.fillStyle = g.strokeStyle = '#000';
  for (const b of data.buildings) { g.beginPath(); trace(g, b, true); g.fill(); }
  for (const w of water) { g.beginPath(); trace(g, w, true); g.fill(); }
  g.lineWidth = RIVER_W;
  for (const r of rivers) { g.beginPath(); trace(g, r.pts); g.stroke(); }
  g.strokeStyle = g.fillStyle = '#fff';
  for (const r of roads) { g.lineWidth = r.w + 0.5; g.beginPath(); trace(g, r.pts); g.stroke(); }
  g.lineWidth = 3.5;
  for (const d of doors) { g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.dx, d.dy); g.stroke(); g.beginPath(); g.arc(d.x, d.y, 2.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#000';
  for (const c of cars) { g.save(); g.translate(c.x, c.y); g.rotate(c.a); g.fillRect(-2.2, -1, 4.4, 2); g.restore(); }
  const px = g.getImageData(0, 0, n, n).data;
  const walk = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = (i - x) / n;
    walk[i] = px[i * 4] >= 100 && x > 0 && y > 0 && x < n - 1 && y < n - 1 ? 1 : 0; // 最外一圈當牆
  }

  const idx = (x, y) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cy * n + cx;
  };
  const cellCenter = i => ({ x: (i % n + 0.5) * cell, y: (Math.floor(i / n) + 0.5) * cell });

  // 只留最大嗰片連通嘅路網，其他死角當行唔得
  const comp = new Int32Array(n * n).fill(-1), q = new Int32Array(n * n);
  let best = -1, bestSize = 0, label = 0;
  for (let s = 0; s < n * n; s++) {
    if (!walk[s] || comp[s] >= 0) continue;
    let h = 0, t = 0;
    q[t++] = s; comp[s] = label;
    while (h < t) {
      const i = q[h++];
      for (const j of [i - n, i + n, i - 1, i + 1]) if (walk[j] && comp[j] < 0) { comp[j] = label; q[t++] = j; }
    }
    if (t > bestSize) { bestSize = t; best = label; }
    label++;
  }
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    if (walk[i] && comp[i] !== best) walk[i] = 0;
    if (walk[i]) cells.push(i);
  }

  const free = (x, y) => { const i = idx(x, y); return i >= 0 && walk[i] === 1; };
  // 視線：中間有冇街屋擋住
  const los = (x0, y0, x1, y1) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cell * 0.5));
    for (let k = 1; k < steps; k++) if (!free(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)) return false;
    return true;
  };
  // 郁動並貼牆滑行：X、Y 分開試
  const move = (e, dx, dy) => {
    const r = Math.min(e.r * 0.7, cell * 0.45);
    if (dx && free(e.x + dx + Math.sign(dx) * r, e.y)) e.x += dx;
    if (dy && free(e.x, e.y + dy + Math.sign(dy) * r)) e.y += dy;
  };
  const nearestFree = (x, y) => {
    const i0 = idx(x, y);
    if (i0 >= 0 && walk[i0]) return cellCenter(i0);
    let bi = -1, bd = Infinity;
    for (const i of cells) {
      const c = cellCenter(i), d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return cellCenter(bi);
  };

  const start = nearestFree(size / 2, size / 2);
  // 地點（藥房等）：招牌喺店原位，店前已經開咗路，生效位置就喺店度
  const pois = data.pois.map(p => ({ ...p, ...nearestFree(p.x, p.y), sx: p.x, sy: p.y }));

  // ---- 畫圖用嘅 Path2D：按 120 米分塊，每塊各自一套 ----
  const cn = Math.ceil(size / CHUNK) + 1;
  const chunks = new Map();
  const add = (kind, box, fn) => {
    const cx0 = Math.max(0, Math.floor(box[0] / CHUNK)), cy0 = Math.max(0, Math.floor(box[1] / CHUNK));
    const cx1 = Math.min(cn - 1, Math.floor(box[2] / CHUNK)), cy1 = Math.min(cn - 1, Math.floor(box[3] / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = cy * cn + cx;
      if (!chunks.has(k)) chunks.set(k, new Map());
      const c = chunks.get(k);
      if (!c.has(kind)) c.set(kind, new Path2D());
      fn(c.get(kind));
    }
  };
  const pt = (x, y, pad) => [x - pad, y - pad, x + pad, y + pad];

  // 騎樓街屋：沿路邊每 4 米一條分隔線，令街區睇落似一排排透天厝
  alongRoads(roads.filter(r => r.w >= 4 && !r.bridge), detail ? 4 : 7, (r, x, y, ux, uy) => {
    for (const s of [-1, 1]) {
      const e = r.w / 2 + 0.3, depth = 9 + rand() * 6;
      add('shop', pt(x, y, e + depth), p => { p.moveTo(x - uy * e * s, y + ux * e * s); p.lineTo(x - uy * (e + depth) * s, y + ux * (e + depth) * s); });
      if (rand() < 0.35) { // 天台水塔／鐵皮
        const d = e + 2 + rand() * (depth - 4), cx = x - uy * d * s, cy = y + ux * d * s;
        if (rand() < 0.5) add('roofLight', pt(cx, cy, 1), p => p.rect(cx - 0.7, cy - 0.7, 1.4, 1.4));
        else add('roofDark', pt(cx, cy, 1.5), p => p.rect(cx - 1.2, cy - 0.8, 2.4, 1.6));
      }
    }
  });
  // 倒地機車、垃圾：沿路邊擺，唔擋路
  alongRoads(roads.filter(r => r.w >= 5 && !r.bridge), 5, (r, x, y, ux, uy) => {
    const k = rand();
    if (k > (detail ? 0.22 : 0.08)) return;
    const s = rand() < 0.5 ? -1 : 1, o = r.w / 2 - 0.7, cx = x - uy * o * s, cy = y + ux * o * s, a = Math.atan2(uy, ux) + (rand() - 0.5) * 2;
    if (k < 0.12) add('scooter', pt(cx, cy, 1.2), p => { p.moveTo(cx - Math.cos(a) * 0.9, cy - Math.sin(a) * 0.9); p.lineTo(cx + Math.cos(a) * 0.9, cy + Math.sin(a) * 0.9); });
    else add('trash', pt(cx, cy, 1), p => p.rect(cx - 0.4, cy - 0.3, 0.8, 0.6));
    if (rand() < 0.15) { const bx = x + (rand() - 0.5) * r.w * 0.6, by = y + (rand() - 0.5) * r.w * 0.6; add('stain', pt(bx, by, 1.5), p => { p.moveTo(bx + 1, by); p.ellipse(bx, by, 1, 0.6, a, 0, Math.PI * 2); }); }
  });
  // 街道名：沿路每大約 80 米放一個，同名嘅唔好太近（巷 = 細字，拉遠時唔顯示）
  const labels = [];
  for (const r of roads) {
    if (!r.name) continue;
    let next = 20;
    alongRoads([r], 2, (_, x, y, ux, uy) => {
      if ((next -= 2) > 0) return;
      if (labels.some(l => l.name === r.name && Math.hypot(l.x - x, l.y - y) < 60)) return;
      let a = Math.atan2(uy, ux);
      if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI; // 字唔好倒轉
      labels.push({ name: r.name, x, y, a, minor: r.name.endsWith('巷') });
      next = 80;
    });
  }
  for (const p of data.open) add('open', bboxOf(p), path => trace(path, p, true));
  for (const b of data.buildings) add('bld', bboxOf(b), path => trace(path, b, true));
  for (const w of water) add('water', bboxOf(w), path => trace(path, w, true));
  for (const r of rivers) add('river', bboxOf(r.pts, RIVER_W), path => trace(path, r.pts));
  for (const d of doors) add('foot', bboxOf([[d.x, d.y], [d.dx, d.dy]], 2), p => { p.moveTo(d.x, d.y); p.lineTo(d.dx, d.dy); }); // 入店嘅路
  const widths = new Set();
  for (const r of roads) {
    const thin = r.k === 'footway' || r.k === 'path' || r.k === 'steps' || r.k === 'pedestrian';
    const box = bboxOf(r.pts, r.w + 2);
    if (thin) { add('foot', box, p => trace(p, r.pts)); continue; }
    if (r.bridge) { add('bridge', box, p => trace(p, r.pts)); continue; }
    widths.add(r.w);
    add('road' + r.w, box, p => trace(p, r.pts));
    if (r.w >= 10) add('lane', box, p => trace(p, r.pts));
  }
  if (detail) alongRoads(roads.filter(r => r.w >= 5 && !r.bridge), 6, (r, x, y, ux, uy) => {
    if (rand() > 0.3) return;
    const o = (rand() - 0.5) * (r.w - 2);
    let cx = x - uy * o, cy = y + ux * o;
    add('cracks', pt(cx, cy, 4), p => { p.moveTo(cx, cy); for (let k = 0; k < 3; k++) { cx += (rand() - 0.5) * 2.4; cy += (rand() - 0.5) * 2.4; p.lineTo(cx, cy); } });
  });
  const bridgeW = Math.max(10, ...roads.filter(r => r.bridge).map(r => r.w));
  const carColors = ['#5b3a2a', '#4a4f4c', '#6b5e45', '#3f4a52'];
  const roadWidths = [...widths].sort((a, b) => a - b);

  // view：{ x0, y0, x1, y1 }（米）
  function draw(g, view) {
    const vis = [];
    const cx0 = Math.max(0, Math.floor(view.x0 / CHUNK)), cy0 = Math.max(0, Math.floor(view.y0 / CHUNK));
    const cx1 = Math.min(cn - 1, Math.floor(view.x1 / CHUNK)), cy1 = Math.min(cn - 1, Math.floor(view.y1 / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const c = chunks.get(cy * cn + cx); if (c) vis.push(c); }
    const each = (kind, fn) => { for (const c of vis) { const p = c.get(kind); if (p) fn(p); } };

    g.fillStyle = '#121518';
    g.fillRect(view.x0 - 5, view.y0 - 5, view.x1 - view.x0 + 10, view.y1 - view.y0 + 10);
    g.fillStyle = '#23271f'; // 街屋天台
    g.fillRect(Math.max(0, view.x0), Math.max(0, view.y0), Math.min(size, view.x1) - Math.max(0, view.x0), Math.min(size, view.y1) - Math.max(0, view.y0));
    g.lineWidth = 0.25; g.strokeStyle = '#181b16'; each('shop', p => g.stroke(p));
    g.fillStyle = '#2e3229'; each('roofLight', p => g.fill(p));
    g.fillStyle = '#1b1e18'; each('roofDark', p => g.fill(p));
    g.fillStyle = '#30362c'; each('open', p => g.fill(p)); // 公園、停車場
    g.fillStyle = '#2b2f28'; each('bld', p => g.fill(p));
    g.lineWidth = 0.4; g.strokeStyle = '#171a15'; each('bld', p => g.stroke(p));
    g.lineCap = g.lineJoin = 'round';
    g.fillStyle = '#16202a'; each('water', p => g.fill(p)); // 河
    g.lineWidth = RIVER_W; g.strokeStyle = '#16202a'; each('river', p => g.stroke(p));
    for (const w of roadWidths) { g.lineWidth = w + 1; g.strokeStyle = '#171918'; each('road' + w, p => g.stroke(p)); }
    g.lineWidth = 3.2; g.strokeStyle = '#33352f'; each('foot', p => g.stroke(p));
    for (const w of roadWidths) { g.lineWidth = w; g.strokeStyle = '#3c3e3a'; each('road' + w, p => g.stroke(p)); }
    g.lineCap = 'butt';
    g.lineWidth = bridgeW + 2.4; g.strokeStyle = '#6b6a5e'; each('bridge', p => g.stroke(p)); // 橋欄
    g.lineWidth = bridgeW; g.strokeStyle = '#41433d'; each('bridge', p => g.stroke(p));
    g.lineCap = 'round';
    g.lineWidth = 0.18; g.strokeStyle = '#2c2e2a'; each('cracks', p => g.stroke(p));
    g.setLineDash([3, 4]); g.lineWidth = 0.22; g.strokeStyle = '#5f5b45'; each('lane', p => g.stroke(p)); g.setLineDash([]);
    g.fillStyle = '#3a2422'; each('stain', p => g.fill(p));
    g.fillStyle = '#2a2b27'; each('trash', p => g.fill(p));
    g.lineWidth = 0.6; g.strokeStyle = '#4d3b2c'; each('scooter', p => g.stroke(p));
    for (const c of cars) {
      if (c.x < view.x0 - 3 || c.x > view.x1 + 3 || c.y < view.y0 - 3 || c.y > view.y1 + 3) continue;
      g.save(); g.translate(c.x, c.y); g.rotate(c.a);
      g.fillStyle = carColors[(c.c * carColors.length) | 0];
      g.fillRect(-2.2, -1, 4.4, 2);
      g.fillStyle = '#1a1c1b'; g.fillRect(-0.9, -0.8, 1.9, 1.6);
      g.restore();
    }
  }

  return { name: data.name, size, n, cell, walk, cells, start, pois, labels, roads, rivers, idx, free, los, move, cellCenter, nearestFree, draw };
}
