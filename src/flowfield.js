// 共用流場圖：由目標點向外 BFS，成群喪屍（或者隊友）跟住「離目標越嚟越近」嘅鄰格行，
// 唔使每隻自己計路。地圖最外一圈格一定行唔得（map.js 保證），所以唔使檢查出界。
import { CELL } from './map.js';

export function createFlowField(map) {
  const { n, walk } = map;
  const dist = new Int32Array(n * n), q = new Int32Array(n * n);
  // 8 個方向：偏移、同埋斜行時要檢查嘅兩個直格（唔准斜切牆角）
  const OFF = [1, -1, n, -n, n + 1, -n + 1, n - 1, -n - 1];
  const SX = [0, 0, 0, 0, 1, 1, -1, -1], SY = [0, 0, n, -n, n, -n, n, -n];

  function update(targets) {
    dist.fill(-1);
    let h = 0, t = 0;
    for (const p of targets) {
      const i = map.idx(p.x, p.y);
      if (i >= 0 && walk[i] && dist[i] < 0) { dist[i] = 0; q[t++] = i; }
    }
    while (h < t) {
      const i = q[h++], d = dist[i] + 1;
      for (let k = 0; k < 8; k++) {
        const j = i + OFF[k];
        if (!walk[j] || dist[j] >= 0) continue;
        if (k >= 4 && !(walk[i + SX[k]] && walk[i + SY[k]])) continue;
        dist[j] = d; q[t++] = j;
      }
    }
  }

  // 返回單位向量，或者 null（呢格去唔到目標）
  function dir(px, py) {
    const i = map.idx(px, py);
    if (i < 0 || dist[i] < 0) return null;
    let best = dist[i], bj = -1;
    for (let k = 0; k < 8; k++) {
      const j = i + OFF[k], d = dist[j];
      if (d >= 0 && d < best && (k < 4 || (walk[i + SX[k]] && walk[i + SY[k]]))) { best = d; bj = j; }
    }
    if (bj < 0) return null;
    const vx = (bj % n + 0.5) * CELL - px, vy = (Math.floor(bj / n) + 0.5) * CELL - py, l = Math.hypot(vx, vy) || 1;
    return { x: vx / l, y: vy / l };
  }

  return { dist, update, dir };
}
