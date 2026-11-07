// 操作：電腦 WASD／方向鍵；手機（或者滑鼠）喺畫面任何位置撳住拖，就係虛擬搖桿
const STICK_R = 48;

export function createInput(canvas, stickEl) {
  const keys = new Set();
  let stick = null;
  addEventListener('keydown', e => keys.add(e.code));
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); stick = null; stickEl.hidden = true; });

  const knob = stickEl.firstElementChild;
  canvas.addEventListener('pointerdown', e => {
    if (stick) return;
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
    canvas.setPointerCapture(e.pointerId);
    stickEl.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    knob.style.transform = '';
    stickEl.hidden = false;
  });
  canvas.addEventListener('pointermove', e => {
    if (!stick || e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    stick.dx = dx; stick.dy = dy;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const end = e => { if (stick && e.pointerId === stick.id) { stick = null; stickEl.hidden = true; } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

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
