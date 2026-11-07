// 空間網格：快速搵「附近有邊啲喪屍」（同截蛇大亂鬥一樣嘅做法）
export function createSpatial(size, cell = 4) {
  const n = Math.ceil(size / cell) + 2;
  const buckets = Array.from({ length: n * n }, () => []);
  const used = [];
  const c = v => Math.min(n - 1, Math.max(0, Math.floor(v / cell) + 1));
  return {
    clear() { for (const b of used) b.length = 0; used.length = 0; },
    insert(o) { const b = buckets[c(o.y) * n + c(o.x)]; if (!b.length) used.push(b); b.push(o); },
    query(x, y, r, fn) {
      const x1 = c(x + r), y1 = c(y + r);
      for (let cy = c(y - r); cy <= y1; cy++) for (let cx = c(x - r); cx <= x1; cx++) {
        const b = buckets[cy * n + cx];
        for (let i = 0; i < b.length; i++) fn(b[i]);
      }
    },
  };
}
