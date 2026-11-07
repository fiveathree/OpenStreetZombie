// 操作：電腦 WASD／方向鍵、滑鼠轆 zoom；手機（或者滑鼠）喺畫面任何位置撳住拖就係虛擬搖桿，兩隻手指捏就 zoom
const STICK_R = 48;

export function createInput(canvas, stickEl, onZoom = () => {}) {
  const keys = new Set();
  const pts = new Map(); // 撳緊嘅手指
  let stick = null, pinch = 0;
  addEventListener('keydown', e => keys.add(e.code));
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); pts.clear(); stick = null; pinch = 0; stickEl.hidden = true; });

  const knob = stickEl.firstElementChild;
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const stopStick = () => { stick = null; stickEl.hidden = true; };

  canvas.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pts.size === 2) { stopStick(); pinch = spread(); return; } // 第二隻手指：轉做捏
    if (pts.size > 1 || stick) return;
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
    stickEl.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    knob.style.transform = '';
    stickEl.hidden = false;
  });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { const d = spread(); if (d > 0) { onZoom(d / pinch); pinch = d; } return; }
    if (!stick || e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    stick.dx = dx; stick.dy = dy;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const end = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (stick && e.pointerId === stick.id) stopStick();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); onZoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  return {
    keys,
    vector() {
      let x = (keys.has('KeyD') || keys.has('ArrowRight')) - (keys.has('KeyA') || keys.has('ArrowLeft'));
      let y = (keys.has('KeyS') || keys.has('ArrowDown')) - (keys.has('KeyW') || keys.has('ArrowUp'));
      if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
      if (stick) {
        const d = Math.hypot(stick.dx, stick.dy);
        if (d > 6) return { x: stick.dx / STICK_R, y: stick.dy / STICK_R };
      }
      return { x: 0, y: 0 };
    },
  };
}
