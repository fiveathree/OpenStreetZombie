// 共用：地圖載入。讀預處理好嘅 OSM JSON → 導航格（行得／行唔得）＋ 畫地圖。小、中、大地圖都用。
// 座標單位係米。OSM 喺台灣嘅建築輪廓唔齊，所以「道路同空地以外」一律當密集街屋（障礙物、擋子彈）。
export const CELL = 2; // 導航格每格幾多米

export async function loadMap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('地圖載入失敗：' + res.status);
  return buildMap(await res.json());
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

// 沿每段路每隔 step 米叫一次 fn(x, y, 單位向量 ux, uy)
function alongRoads(roads, step, fn) {
  for (const r of roads) for (let i = 1; i < r.pts.length; i++) {
    const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i], len = Math.hypot(bx - ax, by - ay);
    if (len < 1) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let d = step / 2; d < len; d += step) fn(r, ax + ux * d, ay + uy * d, ux, uy);
  }
}

export function buildMap(data) {
  const size = data.size, n = Math.ceil(size / CELL), rand = rng(20261108);
  const roads = data.roads.map(r => ({ ...r, w: Math.max(r.w, 3) })); // 太窄嘅巷都要行得過

  // 廢車：擺喺闊路兩邊，會擋路
  const cars = [];
  alongRoads(roads.filter(r => r.w >= 7), 9, (r, x, y, ux, uy) => {
    if (rand() > 0.16) return;
    const side = rand() < 0.5 ? -1 : 1, off = r.w / 2 - 1.4;
    cars.push({ x: x - uy * off * side, y: y + ux * off * side, a: Math.atan2(uy, ux) + (rand() - 0.5) * 0.6, c: rand() });
  });

  // 用瀏覽器 canvas 光柵化：白色 = 行得
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, n, n);
  g.scale(1 / CELL, 1 / CELL);
  g.strokeStyle = g.fillStyle = '#fff';
  g.lineCap = g.lineJoin = 'round';
  for (const r of roads) { g.lineWidth = r.w; g.beginPath(); trace(g, r.pts); g.stroke(); }
  for (const p of data.open) { g.beginPath(); trace(g, p, true); g.fill(); }
  g.fillStyle = '#000';
  for (const b of data.buildings) { g.beginPath(); trace(g, b, true); g.fill(); }
  for (const c of cars) { g.save(); g.translate(c.x, c.y); g.rotate(c.a); g.fillRect(-2.2, -1, 4.4, 2); g.restore(); }
  const px = g.getImageData(0, 0, n, n).data;
  const walk = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = (i - x) / n;
    walk[i] = px[i * 4] > 127 && x > 0 && y > 0 && x < n - 1 && y < n - 1 ? 1 : 0; // 最外一圈當牆
  }

  const idx = (x, y) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cy * n + cx;
  };
  const cellCenter = i => ({ x: (i % n + 0.5) * CELL, y: (Math.floor(i / n) + 0.5) * CELL });

  // 只留最大嗰片連通嘅路網，其他死角當行唔得
  const comp = new Int32Array(n * n).fill(-1), q = new Int32Array(n * n);
  let best = -1, bestSize = 0, label = 0;
  for (let s = 0; s < n * n; s++) {
    if (!walk[s] || comp[s] >= 0) continue;
    let h = 0, t = 0;
    q[t++] = s; comp[s] = label;
    while (h < t) {
      const i = q[h++], x = i % n;
      for (const j of [i - n, i + n, x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < n * n && walk[j] && comp[j] < 0) { comp[j] = label; q[t++] = j; }
      }
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
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (CELL * 0.5));
    for (let k = 1; k < steps; k++) if (!free(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)) return false;
    return true;
  };
  // 郁動並貼牆滑行：X、Y 分開試
  const move = (e, dx, dy) => {
    const r = e.r * 0.7;
    if (dx && free(e.x + dx + Math.sign(dx) * r, e.y)) e.x += dx;
    if (dy && free(e.x, e.y + dy + Math.sign(dy) * r)) e.y += dy;
  };
  const nearestFree = (x, y) => {
    let bi = -1, bd = Infinity;
    for (const i of cells) {
      const c = cellCenter(i), d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return cellCenter(bi);
  };

  const start = nearestFree(size / 2, size / 2);
  // 地點（藥房等）嘅招牌留喺原位，生效位置移去最近嘅街上
  const pois = data.pois.map(p => ({ ...p, ...nearestFree(p.x, p.y), sx: p.x, sy: p.y }));

  // ---- 畫圖用嘅 Path2D（一次過整好，每格重用）----
  const P = () => new Path2D();
  const shop = P(), roofLight = P(), roofDark = P(), open = P(), bld = P(), cracks = P(), lane = P(), foot = P();
  const roadByW = new Map();
  // 騎樓街屋：沿路邊每 4 米一條分隔線，令街區睇落似一排排透天厝
  alongRoads(roads.filter(r => r.w >= 4), 4, (r, x, y, ux, uy) => {
    for (const s of [-1, 1]) {
      const e = r.w / 2 + 0.3, depth = 9 + rand() * 6;
      shop.moveTo(x - uy * e * s, y + ux * e * s);
      shop.lineTo(x - uy * (e + depth) * s, y + ux * (e + depth) * s);
      if (rand() < 0.35) { // 天台水塔／鐵皮
        const d = e + 2 + rand() * (depth - 4), cx = x - uy * d * s, cy = y + ux * d * s;
        if (rand() < 0.5) roofLight.rect(cx - 0.7, cy - 0.7, 1.4, 1.4);
        else roofDark.rect(cx - 1.2, cy - 0.8, 2.4, 1.6);
      }
    }
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
  for (const p of data.open) trace(open, p, true);
  for (const b of data.buildings) trace(bld, b, true);
  for (const r of roads) {
    const thin = r.k === 'footway' || r.k === 'path' || r.k === 'steps' || r.k === 'pedestrian';
    if (thin) { trace(foot, r.pts); continue; }
    if (!roadByW.has(r.w)) roadByW.set(r.w, P());
    trace(roadByW.get(r.w), r.pts);
    if (r.w >= 10) trace(lane, r.pts);
  }
  alongRoads(roads.filter(r => r.w >= 5), 6, (r, x, y, ux, uy) => {
    if (rand() > 0.3) return;
    const o = (rand() - 0.5) * (r.w - 2);
    let cx = x - uy * o, cy = y + ux * o;
    cracks.moveTo(cx, cy);
    for (let k = 0; k < 3; k++) { cx += (rand() - 0.5) * 2.4; cy += (rand() - 0.5) * 2.4; cracks.lineTo(cx, cy); }
  });
  const carColors = ['#5b3a2a', '#4a4f4c', '#6b5e45', '#3f4a52'];

  function draw(g) {
    g.fillStyle = '#121518';
    g.fillRect(-60, -60, size + 120, size + 120);
    g.fillStyle = '#23271f'; // 街屋天台
    g.fillRect(0, 0, size, size);
    g.lineWidth = 0.25; g.strokeStyle = '#181b16'; g.stroke(shop);
    g.fillStyle = '#2e3229'; g.fill(roofLight);
    g.fillStyle = '#1b1e18'; g.fill(roofDark);
    g.fillStyle = '#30362c'; g.fill(open); // 公園、停車場
    g.fillStyle = '#2b2f28'; g.fill(bld);
    g.lineWidth = 0.4; g.strokeStyle = '#171a15'; g.stroke(bld);
    g.lineCap = g.lineJoin = 'round';
    for (const [w, p] of roadByW) { g.lineWidth = w + 1; g.strokeStyle = '#171918'; g.stroke(p); }
    g.lineWidth = 3.2; g.strokeStyle = '#33352f'; g.stroke(foot);
    for (const [w, p] of roadByW) { g.lineWidth = w; g.strokeStyle = '#3c3e3a'; g.stroke(p); }
    g.lineWidth = 0.18; g.strokeStyle = '#2c2e2a'; g.stroke(cracks);
    g.setLineDash([3, 4]); g.lineWidth = 0.22; g.strokeStyle = '#5f5b45'; g.stroke(lane); g.setLineDash([]);
    for (const c of cars) {
      g.save(); g.translate(c.x, c.y); g.rotate(c.a);
      g.fillStyle = carColors[(c.c * carColors.length) | 0];
      g.fillRect(-2.2, -1, 4.4, 2);
      g.fillStyle = '#1a1c1b'; g.fillRect(-0.9, -0.8, 1.9, 1.6);
      g.restore();
    }
  }

  return { name: data.name, size, n, walk, cells, start, pois, labels, idx, free, los, move, cellCenter, draw };
}
