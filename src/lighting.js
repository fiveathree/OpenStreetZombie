// 共用夜晚效果：成個畫面蓋一層藍黑，喺隊員身邊挖光圈、你前面挖手電筒光錐、火光照亮一小片。
// 黑層用四分一解像度畫，再放大貼上去：快好多（手機都順），放大時自然模糊，光圈邊位就柔咗（唔使用漸層）。
const SCALE = 0.25;

export function createNight() {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  // lights：[{ x, y, r, cone?: { a, len, half } }]，螢幕座標（CSS px）
  return function draw(ctx, W, H, dpr, lights, dark = 0.72) {
    const w = Math.max(1, Math.round(W * SCALE)), h = Math.max(1, Math.round(H * SCALE));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(6,9,18,${dark})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    for (const [alpha, k] of [[0.5, 1], [0.85, 0.6]]) {
      g.fillStyle = `rgba(0,0,0,${alpha})`;
      g.beginPath();
      for (const l of lights) {
        g.moveTo(l.x + l.r * k, l.y); g.arc(l.x, l.y, l.r * k, 0, Math.PI * 2);
        if (l.cone) {
          const { a, len, half } = l.cone, L = len * k;
          g.moveTo(l.x, l.y);
          g.arc(l.x, l.y, L, a - half * k, a + half * k);
          g.closePath();
        }
      }
      g.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, 0, 0, W * dpr, H * dpr);
  };
}
