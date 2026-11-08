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
  // 香港街名中英對照（「亞皆老街 Argyle Street」）：有中文就淨係留中文
  const zh = n => (/[一-鿿]/.test(n) ? n.replace(/\s*[A-Za-z][A-Za-z0-9 .,'&()-]*$/, '').trim() : n);
  const roads = data.roads.map(r => ({ ...r, name: zh(r.name || ''), w: Math.max(r.w, 3) })); // 太窄嘅巷都要行得過
  const water = data.water || [], rivers = data.rivers || [];
  // 地點：大城市一條街十間藥房，太多就冇挑戰。每種最多幾間、互相隔開；冇藥房就喺中間附近加個救護站
  const CAP = { pharmacy: 6, store: 6, police: 2, fuel: 2, hardware: 2 };
  const srcPois = [...data.pois];
  if (detail && !srcPois.some(p => p.type === 'pharmacy')) srcPois.push({ type: 'pharmacy', name: '救護站', x: size / 2 + 25, y: size / 2 + 10 });
  const kept = [];
  for (const p of srcPois) {
    const same = kept.filter(k => k.type === p.type);
    if (detail && (same.length >= (CAP[p.type] ?? 99) || same.some(k => Math.hypot(k.x - p.x, k.y - p.y) < 45))) continue;
    kept.push(p);
  }
  data = { ...data, pois: kept };
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
  const lotStep = detail ? 4 : 7;
  alongRoads(roads.filter(r => r.w >= 4 && !r.bridge), lotStep, (r, x, y, ux, uy) => {
    for (const s of [-1, 1]) {
      const e = r.w / 2 + (r.w >= 7 ? 1.9 : 0.3), depth = 9 + rand() * 6, h = lotStep / 2;
      // 屋頂：一格一色（混凝土、鐵皮、鏽、帆布），前面有一條深色簷篷影
      const fx = x - uy * e * s, fy = y + ux * e * s, bx = x - uy * (e + depth) * s, by = y + ux * (e + depth) * s;
      add('roof' + ((rand() * 6) | 0), pt(x, y, e + depth + h), p => { p.moveTo(fx - ux * h, fy - uy * h); p.lineTo(fx + ux * h, fy + uy * h); p.lineTo(bx + ux * h, by + uy * h); p.lineTo(bx - ux * h, by - uy * h); p.closePath(); });
      add('eave', pt(x, y, e + 2), p => { p.moveTo(fx - ux * h, fy - uy * h); p.lineTo(fx + ux * h, fy + uy * h); });
      add('shop', pt(x, y, e + depth), p => { p.moveTo(fx - ux * h, fy - uy * h); p.lineTo(bx - ux * h, by - uy * h); });
      if (detail && rand() < 0.4) { const d = e + 1.5 + rand() * (depth - 3), cx = x - uy * d * s + ux * (rand() - 0.5) * 2, cy = y + ux * d * s + uy * (rand() - 0.5) * 2; add('ac', pt(cx, cy, 1), p => p.rect(cx - 0.45, cy - 0.35, 0.9, 0.7)); }
      if (rand() < 0.2) { const d = e + 2 + rand() * (depth - 4), cx = x - uy * d * s, cy = y + ux * d * s, rr = 0.8 + rand() * 1.5; add('rust', pt(cx, cy, rr), p => { p.moveTo(cx + rr, cy); p.ellipse(cx, cy, rr, rr * 0.6, rand() * 3, 0, Math.PI * 2); }); }
      if (rand() < 0.35) { // 天台水塔／鐵皮
        const d = e + 2 + rand() * (depth - 4), cx = x - uy * d * s, cy = y + ux * d * s;
        if (rand() < 0.5) add('roofLight', pt(cx, cy, 1), p => { p.moveTo(cx + 0.75, cy); p.arc(cx, cy, 0.75, 0, Math.PI * 2); }); // 水塔
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
  // 街區入面（離街遠過街屋嗰排）：一格格屋頂，方向跟最近條街
  {
    const B = 40, bucket = new Map(), bk = (i, j) => i * 10000 + j;
    for (const r of roads) if (r.w >= 4 && !r.bridge) for (let i = 1; i < r.pts.length; i++) {
      const [x0, y0] = r.pts[i - 1], [x1, y1] = r.pts[i];
      for (let bi = Math.floor(Math.min(x0, x1) / B); bi <= Math.floor(Math.max(x0, x1) / B); bi++)
        for (let bj = Math.floor(Math.min(y0, y1) / B); bj <= Math.floor(Math.max(y0, y1) / B); bj++) {
          const k = bk(bi, bj); if (!bucket.has(k)) bucket.set(k, []); bucket.get(k).push([x0, y0, x1, y1, r.w]);
        }
    }
    const step = detail ? 7 : 12;
    for (let y = step / 2; y < size; y += step) for (let x = step / 2; x < size; x += step) {
      const jx = x + (rand() - 0.5) * 2, jy = y + (rand() - 0.5) * 2;
      if (free(jx, jy)) continue;
      let bd = Infinity, ang = 0, bw = 0;
      const bi = Math.floor(jx / B), bj = Math.floor(jy / B);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const [x0, y0, x1, y1, w] of bucket.get(bk(bi + di, bj + dj)) || []) {
        const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((jx - x0) * vx + (jy - y0) * vy) / l2));
        const d = Math.hypot(x0 + vx * t - jx, y0 + vy * t - jy);
        if (d < bd) { bd = d; ang = Math.atan2(vy, vx); bw = w; }
      }
      if (bd < bw / 2 + 15) continue; // 街屋嗰排已經有屋頂
      const c = Math.cos(ang), sn = Math.sin(ang), hw = step * 0.5 + rand() * 1.2, hh = step * 0.38 + rand() * 1.5;
      add('roof' + ((rand() * 6) | 0), pt(jx, jy, step), q => { q.moveTo(jx + c * hw - sn * hh, jy + sn * hw + c * hh); q.lineTo(jx - c * hw - sn * hh, jy - sn * hw + c * hh); q.lineTo(jx - c * hw + sn * hh, jy - sn * hw - c * hh); q.lineTo(jx + c * hw + sn * hh, jy + sn * hw - c * hh); q.closePath(); });
      add('shop', pt(jx, jy, step), q => { q.moveTo(jx + c * hw - sn * hh, jy + sn * hw + c * hh); q.lineTo(jx - c * hw - sn * hh, jy - sn * hw + c * hh); });
      if (detail && rand() < 0.3) { const ox = jx + (rand() - 0.5) * hw, oy = jy + (rand() - 0.5) * hh; if (rand() < 0.5) add('roofLight', pt(ox, oy, 1), q => { q.moveTo(ox + 0.75, oy); q.arc(ox, oy, 0.75, 0, Math.PI * 2); }); else add('ac', pt(ox, oy, 1), q => q.rect(ox - 0.45, oy - 0.35, 0.9, 0.7)); }
    }
  }
  // 行道樹：闊路兩邊行人路，每 12 米左右一棵（淨係畫，唔擋路）
  const tree = (cx, cy, r) => {
    add('treeShadow', pt(cx + 0.6, cy + 0.6, r + 1), p => { p.moveTo(cx + 0.6 + r, cy + 0.6); p.arc(cx + 0.6, cy + 0.6, r, 0, Math.PI * 2); });
    add('tree', pt(cx, cy, r), p => { p.moveTo(cx + r, cy); p.arc(cx, cy, r, 0, Math.PI * 2); });
    add('treeHi', pt(cx, cy, r), p => { const hr = r * 0.45, hx = cx - r * 0.3, hy = cy - r * 0.3; p.moveTo(hx + hr, hy); p.arc(hx, hy, hr, 0, Math.PI * 2); });
  };
  alongRoads(roads.filter(r => r.w >= 10 && !r.bridge), 6, (r, x, y, ux, uy) => {
    if (rand() > 0.45) return;
    const s = rand() < 0.5 ? -1 : 1, o = r.w / 2 + 1;
    tree(x - uy * o * s, y + ux * o * s, 1.4 + rand() * 0.9);
  });
  const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const poly of data.open) { // 公園、空地：散落幾棵樹
    const [x0, y0, x1, y1] = bboxOf(poly), area = (x1 - x0) * (y1 - y0);
    for (let k = 0, n = Math.min(40, area / (detail ? 90 : 300)); k < n; k++) { const x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0); if (inPoly(poly, x, y)) tree(x, y, 1.6 + rand() * 1.4); }
  }
  // 斑馬線：路口（兩條路相交）前面
  const ends = new Map();
  const keyOf = (x, y) => Math.round(x / 3) + ',' + Math.round(y / 3);
  for (const r of roads) for (const q of r.pts) { const k = keyOf(q[0], q[1]); ends.set(k, (ends.get(k) || 0) + 1); }
  if (detail) for (const r of roads) {
    if (r.w < 7 || r.bridge || r.pts.length < 2) continue;
    for (const [a, b] of [[r.pts[0], r.pts[1]], [r.pts[r.pts.length - 1], r.pts[r.pts.length - 2]]]) {
      if ((ends.get(keyOf(a[0], a[1])) || 0) < 2) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 12) continue;
      const ux = dx / l, uy = dy / l, d = 7, cx = a[0] + ux * d, cy = a[1] + uy * d;
      add('zebra', pt(cx, cy, r.w), p => { for (let o = -r.w / 2 + 0.6; o < r.w / 2 - 0.4; o += 1.1) { const sx = cx - uy * o, sy = cy + ux * o; p.moveTo(sx - ux * 1.3 - uy * 0.25, sy - uy * 1.3 + ux * 0.25); p.lineTo(sx + ux * 1.3 - uy * 0.25, sy + uy * 1.3 + ux * 0.25); p.lineTo(sx + ux * 1.3 + uy * 0.25, sy + uy * 1.3 - ux * 0.25); p.lineTo(sx - ux * 1.3 + uy * 0.25, sy - uy * 1.3 - ux * 0.25); p.closePath(); } });
    }
  }
  alongRoads(roads.filter(r => r.w >= 6 && !r.bridge), detail ? 9 : 18, (r, x, y, ux, uy) => { // 路面補丁
    if (rand() > 0.35) return;
    const o = (rand() - 0.5) * (r.w - 3), cx = x - uy * o, cy = y + ux * o, w = 1.5 + rand() * 3, hgt = 1 + rand() * 1.5, a = Math.atan2(uy, ux);
    add(rand() < 0.6 ? 'patchDark' : 'patchLight', pt(cx, cy, w), p => { p.moveTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); p.ellipse(cx, cy, w, hgt, a, 0, Math.PI * 2); });
  });
  for (const r of rivers) alongRoads([{ ...r, w: RIVER_W }], 14, (_, x, y, ux, uy) => { // 河面水紋
    for (let k = 0; k < 2; k++) { const o = (rand() - 0.5) * RIVER_W * 0.8, cx = x - uy * o, cy = y + ux * o, l = 2 + rand() * 4; add('ripple', pt(cx, cy, l), p => { p.moveTo(cx - ux * l, cy - uy * l); p.lineTo(cx + ux * l, cy + uy * l); }); }
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
  for (const b of data.buildings) { const k = 'bld' + ((rand() * 4) | 0); add(k, bboxOf(b), path => trace(path, b, true)); add('bldAll', bboxOf(b), path => trace(path, b, true)); }
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
  const carColors = ['#5b3a2a', '#4a4f4c', '#6b5e45', '#3f4a52', '#5a5a52'];
  // 天台色：混凝土、深灰、鏽鐵皮、舊帆布、淺灰、啡
  const ROOFS = ['#35372f', '#2e302a', '#43382e', '#2f3a38', '#3d3e38', '#3a332b'];
  const BLDS = ['#33352f', '#3a3a33', '#2e3130', '#3b352e'];
  const roadWidths = [...widths].sort((a, b) => a - b);

  // view：{ x0, y0, x1, y1 }（米）
  function draw(g, view) {
    const vis = [];
    const cx0 = Math.max(0, Math.floor(view.x0 / CHUNK)), cy0 = Math.max(0, Math.floor(view.y0 / CHUNK));
    const cx1 = Math.min(cn - 1, Math.floor(view.x1 / CHUNK)), cy1 = Math.min(cn - 1, Math.floor(view.y1 / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const c = chunks.get(cy * cn + cx); if (c) vis.push(c); }
    const far = view.x1 - view.x0 > 170; // 拉到好遠：細節睇唔到，唔畫（慳手機）
    const SMALL = new Set(['ac', 'rust', 'patchDark', 'patchLight', 'zebra', 'cracks', 'ripple', 'treeHi', 'stain', 'trash', 'scooter', 'eave']);
    const each = (kind, fn) => { if (far && SMALL.has(kind)) return; for (const c of vis) { const p = c.get(kind); if (p) fn(p); } };

    g.fillStyle = '#121518';
    g.fillRect(view.x0 - 5, view.y0 - 5, view.x1 - view.x0 + 10, view.y1 - view.y0 + 10);
    g.fillStyle = '#262923'; // 後巷、天井
    g.fillRect(Math.max(0, view.x0), Math.max(0, view.y0), Math.min(size, view.x1) - Math.max(0, view.x0), Math.min(size, view.y1) - Math.max(0, view.y0));
    ROOFS.forEach((c, i) => { g.fillStyle = c; each('roof' + i, p => g.fill(p)); }); // 街屋天台
    g.fillStyle = '#5a4030'; each('rust', p => g.fill(p));
    g.lineWidth = 0.22; g.strokeStyle = '#1a1c17'; each('shop', p => g.stroke(p));
    g.lineWidth = 1.1; g.strokeStyle = '#1c1e19'; each('eave', p => g.stroke(p));
    g.fillStyle = '#4a4c46'; each('roofLight', p => g.fill(p)); // 水塔
    g.fillStyle = '#1f221d'; each('roofDark', p => g.fill(p));
    g.fillStyle = '#5e605a'; each('ac', p => g.fill(p));
    g.fillStyle = '#323b2c'; each('open', p => g.fill(p)); // 公園、空地
    g.save(); g.translate(0.8, 0.8); g.fillStyle = 'rgba(0,0,0,.35)'; each('bldAll', p => g.fill(p)); g.restore(); // 建築影
    BLDS.forEach((c, i) => { g.fillStyle = c; each('bld' + i, p => g.fill(p)); });
    g.lineWidth = 0.35; g.strokeStyle = '#4a4a42'; each('bldAll', p => g.stroke(p)); // 天台石壆
    g.lineCap = g.lineJoin = 'round';
    g.lineWidth = RIVER_W + 3; g.strokeStyle = '#3a3a32'; each('river', p => g.stroke(p)); // 河堤
    g.fillStyle = '#18232c'; each('water', p => g.fill(p)); // 河
    g.lineWidth = RIVER_W; g.strokeStyle = '#18232c'; each('river', p => g.stroke(p));
    g.lineWidth = 0.3; g.strokeStyle = '#2a3a46'; each('ripple', p => g.stroke(p));
    for (const w of roadWidths) { g.lineWidth = w + (w >= 7 ? 4.4 : 1); g.strokeStyle = '#191b19'; each('road' + w, p => g.stroke(p)); }
    for (const w of roadWidths) if (w >= 7) { g.lineWidth = w + 3.8; g.strokeStyle = '#4b4b44'; each('road' + w, p => g.stroke(p)); } // 行人路
    g.lineWidth = 3.2; g.strokeStyle = '#46463f'; each('foot', p => g.stroke(p));
    for (const w of roadWidths) { g.lineWidth = w + 0.5; g.strokeStyle = '#2a2b28'; each('road' + w, p => g.stroke(p)); } // 石壆
    for (const w of roadWidths) { g.lineWidth = w; g.strokeStyle = '#3a3c38'; each('road' + w, p => g.stroke(p)); }
    g.fillStyle = '#333531'; each('patchDark', p => g.fill(p));
    g.fillStyle = '#42443f'; each('patchLight', p => g.fill(p));
    g.fillStyle = '#6a6960'; each('zebra', p => g.fill(p));
    g.lineCap = 'butt';
    g.lineWidth = bridgeW + 2.4; g.strokeStyle = '#6b6a5e'; each('bridge', p => g.stroke(p)); // 橋欄
    g.lineWidth = bridgeW; g.strokeStyle = '#41433d'; each('bridge', p => g.stroke(p));
    g.lineCap = 'round';
    g.lineWidth = 0.18; g.strokeStyle = '#2c2e2a'; each('cracks', p => g.stroke(p));
    g.setLineDash([3, 4]); g.lineWidth = 0.22; g.strokeStyle = '#5f5b45'; each('lane', p => g.stroke(p)); g.setLineDash([]);
    g.fillStyle = '#3a2422'; each('stain', p => g.fill(p));
    g.fillStyle = '#2a2b27'; each('trash', p => g.fill(p));
    g.lineWidth = 0.6; g.strokeStyle = '#4d3b2c'; each('scooter', p => g.stroke(p));
    for (const c of cars) { // 廢車：有車頂、擋風玻璃、車燈；有啲燒剩個殼
      if (c.x < view.x0 - 3 || c.x > view.x1 + 3 || c.y < view.y0 - 3 || c.y > view.y1 + 3) continue;
      const burnt = c.c > 0.82, col = burnt ? '#2a2420' : carColors[(c.c * carColors.length) | 0];
      g.save(); g.translate(c.x, c.y); g.rotate(c.a);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-2.1, -0.85, 4.6, 2.05);
      g.fillStyle = col; g.beginPath(); g.roundRect(-2.3, -1.05, 4.6, 2.1, 0.45); g.fill();
      g.lineWidth = 0.08; g.strokeStyle = '#141412'; g.stroke();
      g.fillStyle = burnt ? '#1a1614' : '#22272a'; g.fillRect(0.55, -0.8, 0.75, 1.6); g.fillRect(-1.6, -0.75, 0.55, 1.5); // 前後玻璃
      g.fillStyle = burnt ? '#3a2a22' : col; g.fillRect(-1.05, -0.82, 1.6, 1.64); // 車頂
      if (burnt) { g.fillStyle = '#5a3a26'; g.fillRect(-0.6, -0.5, 0.8, 0.5); g.fillRect(1.4, 0.2, 0.5, 0.5); }
      else { g.fillStyle = '#8a8466'; g.fillRect(2.15, -0.85, 0.12, 0.35); g.fillRect(2.15, 0.5, 0.12, 0.35); }
      g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,.3)'; each('treeShadow', p => g.fill(p)); // 樹
    g.fillStyle = '#2d3a27'; each('tree', p => g.fill(p));
    g.lineWidth = 0.15; g.strokeStyle = '#1a2216'; each('tree', p => g.stroke(p));
    g.fillStyle = '#3a4a31'; each('treeHi', p => g.fill(p));
  }

  // 地標（景點、車站、廟、塔）：大字、唔轉角度、拉遠都顯示
  // 太近嘅（同一間廟兩個寫法、車站幾個入口）淨係留第一個
  const landmarks = (data.landmarks || []).filter((l, i, all) => all.findIndex(o => Math.hypot(o.x - l.x, o.y - l.y) < 30) === i);
  for (const l of landmarks) labels.push({ name: l.name, x: l.x, y: l.y, a: 0, landmark: true });
  return { name: data.name, center: data.center, size, n, cell, walk, cells, start, pois, labels, landmarks, roads, rivers, idx, free, los, move, cellCenter, nearestFree, draw };
}
