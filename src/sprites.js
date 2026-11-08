// 俯視角人物同喪屍：開波時預先畫落細 canvas，之後每隻用 drawImage 轉向貼上去（快，手機都頂得順）。
// 每張圖以「半徑 1」設計、面向 +x；畫嘅時候按真實半徑放大縮細。冇漸層、冇螢光，用平塗＋深色描邊。
const TAU = Math.PI * 2;
const PX = 56;           // 每個單位（半徑）幾多 px
const E = 1.7;           // 圖半闊（單位）：手同武器會伸出身體外
const FRAMES = 3;        // 行路：左腳、企、右腳

const INK = '#17130f';
const SHADOW = 'rgba(0,0,0,.28)';

function canvas(ext = E, px = PX) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(ext * 2 * px);
  const g = c.getContext('2d');
  g.setTransform(px, 0, 0, px, ext * px, ext * px);
  g.lineJoin = g.lineCap = 'round';
  return [c, g];
}
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); };
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
function fillStroke(g, fill, w = 0.07) { g.fillStyle = fill; g.fill(); g.lineWidth = w; g.strokeStyle = INK; g.stroke(); }
function limb(g, x0, y0, x1, y1, w, color) {
  g.lineWidth = w + 0.1; g.strokeStyle = INK; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.lineWidth = w; g.strokeStyle = color; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
// 雙腳：f = -1 / 0 / 1（邊隻腳喺前）
function feet(g, f, color, stride = 0.3, spread = 0.32) {
  ell(g, 0.05 + stride * f, -spread, 0.3, 0.15); fillStroke(g, color, 0.06);
  ell(g, 0.05 - stride * f, spread, 0.3, 0.15); fillStroke(g, color, 0.06);
}

// ---------------- 喪屍 ----------------
const Z_SKIN = ['#7d876c', '#8a8b74', '#6f7a66', '#868070'];
const Z_CLOTH = {
  walker: ['#4a5560', '#5b4a3a', '#62625a', '#77705f'],
  runner: ['#3e4a3e', '#5a3a36', '#46505a', '#6a5a3e'],
  fat: ['#6a6052', '#4e4a56', '#5e5040', '#6e6a5e'],
  screamer: ['#6a5a60', '#585058', '#706660', '#4e4650'],
};
const BLOOD = '#561c17', BLOOD2 = '#3c120f';

function zombieBody(g, kind, v, f) {
  const skin = Z_SKIN[v % Z_SKIN.length];
  const cloth = (Z_CLOTH[kind] || Z_CLOTH.walker)[v % 4];
  const sway = f * 0.08;
  ell(g, 0, 0, 0.62, 0.95); g.fillStyle = SHADOW; g.fill();
  if (kind === 'runner') {
    feet(g, f, '#26221e', 0.42, 0.28);
    // 跑：手向後擺
    limb(g, -0.05, -0.62, -0.55 - f * 0.25, -0.7, 0.24, cloth); circ(g, -0.58 - f * 0.25, -0.72, 0.13); fillStroke(g, skin, 0.05);
    limb(g, -0.05, 0.62, -0.55 + f * 0.25, 0.7, 0.24, cloth); circ(g, -0.58 + f * 0.25, 0.72, 0.13); fillStroke(g, skin, 0.05);
    ell(g, 0, 0, 0.42, 0.72); fillStroke(g, cloth);
    ell(g, 0.1, 0.25, 0.14, 0.22); g.fillStyle = BLOOD; g.fill();
    circ(g, 0.22, -0.04, 0.34); fillStroke(g, skin);
    ell(g, 0.08, -0.02, 0.26, 0.3); g.fillStyle = '#2a241f'; g.fill(); // 頭髮
    return;
  }
  feet(g, f * 0.6, '#2b2520', 0.22, kind === 'fat' ? 0.45 : 0.32);
  // 手：向前伸，一長一短，歪歪哋
  const reach = kind === 'fat' ? 0.95 : 1.15;
  limb(g, 0.1, -0.6, reach + sway, -0.42 + sway * 0.5, 0.24, cloth); circ(g, reach + 0.04 + sway, -0.42 + sway * 0.5, 0.14); fillStroke(g, skin, 0.05);
  limb(g, 0.1, 0.6, reach - 0.18 - sway, 0.5, 0.24, skin); circ(g, reach - 0.14 - sway, 0.5, 0.14); fillStroke(g, skin, 0.05);
  if (kind === 'fat') {
    ell(g, 0, 0, 0.8, 0.98); fillStroke(g, cloth);
    ell(g, 0.28, 0.05, 0.42, 0.55); fillStroke(g, '#8f8a74', 0.05); // 肚腩爆出嚟
    ell(g, 0.35, 0.15, 0.16, 0.2); g.fillStyle = '#5e6a45'; g.fill();
    ell(g, 0.2, -0.3, 0.12, 0.1); g.fillStyle = BLOOD; g.fill();
    circ(g, 0.2, -0.05, 0.36); fillStroke(g, skin);
    ell(g, 0.05, -0.05, 0.25, 0.28); g.fillStyle = '#3a332c'; g.fill();
    return;
  }
  ell(g, 0, 0, 0.48, 0.82); fillStroke(g, cloth);
  // 爛衫、血
  g.fillStyle = '#1f1a16'; g.beginPath(); g.moveTo(-0.3, 0.55); g.lineTo(-0.05, 0.4); g.lineTo(-0.18, 0.75); g.fill();
  ell(g, 0.05 + (v % 2) * 0.15, -0.35 + (v % 3) * 0.2, 0.18, 0.13); g.fillStyle = BLOOD; g.fill();
  ell(g, -0.15, 0.2, 0.1, 0.08); g.fillStyle = BLOOD2; g.fill();
  if (kind === 'screamer') {
    // 長頭髮散開、口擘大
    g.strokeStyle = '#1e1a18'; g.lineWidth = 0.08;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(0.1, k * 0.06); g.lineTo(-0.45 - Math.abs(k) * 0.03, k * 0.16); g.stroke(); }
    circ(g, 0.2, 0.03, 0.33); fillStroke(g, '#a9ab9c');
    ell(g, 0.05, 0.03, 0.22, 0.3); g.fillStyle = '#1e1a18'; g.fill();
    ell(g, 0.42, 0.03, 0.1, 0.13); g.fillStyle = '#2a0e0c'; g.fill();
    return;
  }
  const hx = 0.2 + 0.05 * Math.sin(v), hy = 0.08 * ((v % 3) - 1); // 頭歪少少
  circ(g, hx, hy, 0.34); fillStroke(g, skin);
  if (v % 4 !== 3) { ell(g, hx - 0.12, hy, 0.22, 0.28); g.fillStyle = v % 2 ? '#2a241f' : '#4a3a2a'; g.fill(); }
  ell(g, hx + 0.12, hy - 0.12, 0.08, 0.06); g.fillStyle = BLOOD2; g.fill();
}

// 大隻嘢：精英、屍王、喪屍王（只得一個樣）
function brute(g, kind, f) {
  const skin = kind === 'elite' ? '#6a5a50' : kind === 'boss' ? '#5e4a44' : '#3e2a26';
  ell(g, 0, 0, 0.8, 1.05); g.fillStyle = SHADOW; g.fill();
  feet(g, f * 0.5, '#211b17', 0.2, 0.42);
  limb(g, 0.05, -0.72, 0.95, -0.62 + f * 0.06, 0.38, skin); circ(g, 1.0, -0.6 + f * 0.06, 0.22); fillStroke(g, skin, 0.05);
  limb(g, 0.05, 0.72, 0.9, 0.66 - f * 0.06, 0.38, skin); circ(g, 0.95, 0.66 - f * 0.06, 0.22); fillStroke(g, skin, 0.05);
  ell(g, 0, 0, 0.62, 0.95); fillStroke(g, skin, 0.08);
  if (kind === 'elite') { // 爛防暴背心
    g.beginPath(); g.rect(-0.4, -0.6, 0.7, 1.2); fillStroke(g, '#2e3236', 0.06);
    g.fillStyle = '#4a4e52'; g.fillRect(-0.3, -0.5, 0.15, 1.0);
  } else { // 爛肉、紅筋
    ell(g, -0.1, -0.35, 0.3, 0.22, 0.4); g.fillStyle = '#6e2a24'; g.fill();
    ell(g, 0.15, 0.4, 0.26, 0.18, -0.3); g.fillStyle = '#6e2a24'; g.fill();
    g.strokeStyle = '#3a1210'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.3, -0.35); g.lineTo(0.1, -0.3); g.moveTo(0, 0.4); g.lineTo(0.3, 0.45); g.stroke();
  }
  // 骨刺
  g.fillStyle = '#cfc5b0'; g.strokeStyle = INK; g.lineWidth = 0.04;
  const spikes = kind === 'king' ? [[-0.2, -0.8], [-0.35, -0.5], [-0.4, 0], [-0.35, 0.5], [-0.2, 0.8]] : [[-0.15, -0.78], [-0.15, 0.78]];
  for (const [x, y] of spikes) { g.beginPath(); g.moveTo(x + 0.12, y - 0.08 * Math.sign(y || 1)); g.lineTo(x - 0.35, y * 1.25); g.lineTo(x - 0.05, y + 0.1 * Math.sign(y || 1)); g.closePath(); g.fill(); g.stroke(); }
  circ(g, 0.32, 0, 0.32); fillStroke(g, skin);
  if (kind === 'king') { // 骨冠
    g.fillStyle = '#cfc5b0';
    for (let k = 0; k < 7; k++) { const a = Math.PI * 0.6 + k * Math.PI * 0.8 / 6; g.beginPath(); g.moveTo(0.32 + Math.cos(a - 0.2) * 0.3, Math.sin(a - 0.2) * 0.3); g.lineTo(0.32 + Math.cos(a) * 0.55, Math.sin(a) * 0.55); g.lineTo(0.32 + Math.cos(a + 0.2) * 0.3, Math.sin(a + 0.2) * 0.3); g.fill(); }
  }
  ell(g, 0.5, -0.1, 0.05, 0.05); g.fillStyle = '#c9b46a'; g.fill(); ell(g, 0.5, 0.1, 0.05, 0.05); g.fill(); // 眼
}

// ---------------- 人 ----------------
// 每個職業：衫、褲、頭（頭髮／頭盔）、背囊、武器
const LOOK = {
  player: { cloth: '#4a4f48', trim: '#e8842c', head: 'hair', hair: '#2a2420', pack: '#5a4a36', gun: 'pistol' },
  tank: { cloth: '#8a7350', trim: '#c9c06a', head: 'helmet', helm: '#a8893e', pack: '#55524a', gun: 'shield' },        // 消防衣、反光帶、頭盔
  medic: { cloth: '#7d93a0', trim: '#d9d6cc', head: 'cap', hair: '#2a2420', capC: '#d9d6cc', pack: '#d9d6cc', cross: true, gun: 'pistol' }, // 護士
  dps: { cloth: '#56603e', trim: '#3e4630', head: 'helmet', helm: '#4e5838', pack: '#4a4a36', gun: 'rifle' },           // 退伍軍人
  control: { cloth: '#bdb7a6', trim: '#7a7466', head: 'mask', hair: '#4a4a4a', pack: '#7a3a24', tank: true, gun: 'flamer' }, // 實驗袍、油罐、防毒面具
  support: { cloth: '#a8622e', trim: '#3a3a36', head: 'helmet', helm: '#2e2e2c', pack: '#c08a3a', box: true, gun: 'sniper' }, // 外送員、頭盔、外送箱
};
const SKIN = '#c09a7c';

function weapon(g, kind) {
  g.strokeStyle = INK; g.lineWidth = 0.05;
  if (kind === 'pistol') { g.fillStyle = '#1e1e1c'; g.fillRect(0.55, -0.07, 0.45, 0.14); g.strokeRect(0.55, -0.07, 0.45, 0.14); }
  else if (kind === 'rifle') { g.fillStyle = '#1e1e1c'; g.fillRect(0.2, -0.08, 1.15, 0.16); g.strokeRect(0.2, -0.08, 1.15, 0.16); g.fillStyle = '#3a3a34'; g.fillRect(0.55, 0.06, 0.16, 0.18); }
  else if (kind === 'sniper') { g.fillStyle = '#26241f'; g.fillRect(0.1, -0.06, 1.5, 0.12); g.strokeRect(0.1, -0.06, 1.5, 0.12); g.fillStyle = '#1a1a18'; g.fillRect(0.5, -0.13, 0.3, 0.26); }
  else if (kind === 'flamer') { g.fillStyle = '#3a3a34'; g.fillRect(0.3, -0.1, 0.9, 0.2); g.strokeRect(0.3, -0.1, 0.9, 0.2); g.fillStyle = '#8a3a24'; g.fillRect(1.15, -0.06, 0.12, 0.12); }
  else if (kind === 'shield') { g.beginPath(); g.ellipse(0.72, 0, 0.16, 0.85, 0, 0, TAU); fillStroke(g, '#6e706a'); g.fillStyle = '#c9c06a'; g.fillRect(0.66, -0.55, 0.12, 0.2); g.fillRect(0.66, 0.35, 0.12, 0.2); }
}

function human(g, role, f) {
  const L = LOOK[role] || LOOK.player;
  ell(g, 0, 0, 0.6, 0.9); g.fillStyle = SHADOW; g.fill();
  feet(g, f, '#24201c', 0.42, 0.28);
  // 背囊／油罐／外送箱
  if (L.tank) { ell(g, -0.6, -0.22, 0.2, 0.2); fillStroke(g, L.pack); ell(g, -0.6, 0.22, 0.2, 0.2); fillStroke(g, L.pack); }
  else if (L.box) { g.beginPath(); g.rect(-0.95, -0.45, 0.5, 0.9); fillStroke(g, L.pack); g.fillStyle = '#7a5a2a'; g.fillRect(-0.92, -0.05, 0.44, 0.1); }
  else { g.beginPath(); g.rect(-0.7, -0.4, 0.32, 0.8); fillStroke(g, L.pack); if (L.cross) { g.fillStyle = '#9a2e26'; g.fillRect(-0.6, -0.06, 0.12, 0.12); g.fillRect(-0.64, -0.02, 0.2, 0.04); } }
  // 手：揸住武器
  const twoHand = L.gun === 'rifle' || L.gun === 'sniper' || L.gun === 'flamer';
  weapon(g, L.gun);
  if (L.gun === 'shield') {
    limb(g, 0.05, -0.6, 0.62, -0.35, 0.25, L.cloth); limb(g, 0.05, 0.6, 0.45, 0.6, 0.25, L.cloth);
    circ(g, 0.62, -0.35, 0.12); fillStroke(g, SKIN, 0.04); circ(g, 0.47, 0.62, 0.12); fillStroke(g, SKIN, 0.04);
  } else {
    limb(g, 0.05, -0.6, twoHand ? 0.65 : 0.55, -0.06, 0.25, L.cloth);
    limb(g, 0.05, 0.6, twoHand ? 0.35 : 0.55, 0.06, 0.25, L.cloth);
    circ(g, twoHand ? 0.65 : 0.55, -0.06, 0.12); fillStroke(g, SKIN, 0.04);
    circ(g, twoHand ? 0.35 : 0.55, 0.06, 0.12); fillStroke(g, SKIN, 0.04);
  }
  // 身
  ell(g, -0.02, 0, 0.45, 0.78); fillStroke(g, L.cloth);
  if (role === 'tank') { g.fillStyle = L.trim; g.fillRect(-0.3, -0.68, 0.1, 1.36); g.fillRect(0.12, -0.6, 0.08, 1.2); } // 反光帶
  else if (role === 'player') { g.fillStyle = L.trim; g.fillRect(-0.32, -0.7, 0.08, 0.35); }                                // 橙色臂章
  else if (role === 'control') { g.strokeStyle = L.trim; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.1, -0.7); g.lineTo(0.3, 0); g.lineTo(0.1, 0.7); g.stroke(); }
  else if (role === 'medic') { g.fillStyle = '#9a2e26'; g.fillRect(-0.05, -0.74, 0.16, 0.16); }
  else { g.fillStyle = L.trim; g.fillRect(-0.25, -0.6, 0.5, 0.12); }
  // 頭
  if (L.head === 'helmet') { circ(g, 0.06, 0, 0.38); fillStroke(g, L.helm); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0.18, -0.3, 0.12, 0.6); }
  else if (L.head === 'mask') { circ(g, 0.06, 0, 0.34); fillStroke(g, L.hair); ell(g, 0.32, 0, 0.12, 0.2); fillStroke(g, '#2e2e2c', 0.04); }
  else if (L.head === 'cap') { circ(g, 0.06, 0, 0.34); fillStroke(g, SKIN); ell(g, -0.04, 0, 0.26, 0.3); g.fillStyle = L.hair; g.fill(); ell(g, -0.1, 0, 0.16, 0.24); g.fillStyle = L.capC; g.fill(); }
  else { circ(g, 0.06, 0, 0.34); fillStroke(g, SKIN); ell(g, -0.04, 0, 0.27, 0.31); g.fillStyle = L.hair; g.fill(); }
}

// 民兵（大地圖小兵、守備兵、街道衝鋒小兵）：細啲、簡單啲
function militia(g, f, cloth) {
  ell(g, 0, 0, 0.6, 0.88); g.fillStyle = SHADOW; g.fill();
  feet(g, f, '#24201c', 0.42, 0.28);
  weapon(g, 'rifle');
  limb(g, 0.05, -0.6, 0.65, -0.06, 0.25, cloth); limb(g, 0.05, 0.6, 0.35, 0.06, 0.25, cloth);
  ell(g, -0.02, 0, 0.45, 0.76); fillStroke(g, cloth);
  circ(g, 0.06, 0, 0.36); fillStroke(g, '#5a5a4e');
}

// ---------------- 快取 ----------------
const cache = new Map();
function get(key, draw, ext = E, px = PX) {
  let c = cache.get(key);
  if (!c) { const [cv, g] = canvas(ext, px); draw(g); c = { img: cv, ext }; cache.set(key, c); }
  return c;
}
const frameOf = (t, phase, speed = 6) => { const k = Math.floor(t * speed + phase) % 4; return k === 0 ? -1 : k === 2 ? 1 : 0; };

export const Z_VARIANTS = 4;
export function zombieSprite(type, v, f) {
  if (type === 'elite' || type === 'boss' || type === 'king') return get(`b:${type}:${f}`, g => brute(g, type, f), E, 96);
  const kind = type === 'brute' ? 'fat' : type;
  return get(`z:${kind}:${v % Z_VARIANTS}:${f}`, g => zombieBody(g, kind, v, f));
}
export function humanSprite(role, f) { return get(`h:${role}:${f}`, g => human(g, role, f)); }
export function militiaSprite(f, cloth = '#6e6a52') { return get(`m:${cloth}:${f}`, g => militia(g, f, cloth)); }
export { frameOf };

// 喺世界座標（已經 worldTransform）畫一張轉咗向嘅圖。base = ctx.getTransform()（每 frame 攞一次）
export function blit(ctx, base, spr, x, y, r, face) {
  const c = Math.cos(face), s = Math.sin(face), a = base.a;
  ctx.setTransform(a * c, a * s, -a * s, a * c, base.e + a * x, base.f + a * y);
  const w = spr.ext * r;
  ctx.drawImage(spr.img, -w, -w, w * 2, w * 2);
}

// ---------------- 建築（大地圖）----------------
// 箭塔：沙包圍住一個木棚；主城：混凝土圍牆、屋頂、沙包角、天線。half = 半闊（米）
function towerArt(g, alive) {
  const sand = alive ? '#8a7f62' : '#4a463c';
  for (let k = 0; k < 14; k++) { // 沙包圈
    const a = k / 14 * TAU;
    g.save(); g.translate(Math.cos(a) * 0.82, Math.sin(a) * 0.82); g.rotate(a + Math.PI / 2);
    g.beginPath(); g.roundRect(-0.2, -0.1, 0.4, 0.2, 0.08); fillStroke(g, sand, 0.04); g.restore();
  }
  g.beginPath(); g.rect(-0.55, -0.55, 1.1, 1.1); fillStroke(g, alive ? '#5a4a36' : '#2e2924', 0.06); // 木棚
  g.strokeStyle = alive ? '#3e3226' : '#221e1a'; g.lineWidth = 0.03;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-0.55, k * 0.2); g.lineTo(0.55, k * 0.2); g.stroke(); }
  g.beginPath(); g.rect(-0.3, -0.3, 0.6, 0.6); fillStroke(g, alive ? '#4f5a48' : '#2a2b27', 0.05); // 頂
  if (alive) { circ(g, 0.3, -0.3, 0.1); g.fillStyle = '#d9c99a'; g.fill(); } // 射燈
}
function baseArt(g, alive) {
  g.beginPath(); g.rect(-0.95, -0.95, 1.9, 1.9); fillStroke(g, alive ? '#6b6a5e' : '#3a3934', 0.06); // 圍牆
  g.beginPath(); g.rect(-0.78, -0.78, 1.56, 1.56); fillStroke(g, alive ? '#3e423a' : '#24251f', 0.04);  // 院子
  g.beginPath(); g.rect(-0.55, -0.45, 1.0, 0.8); fillStroke(g, alive ? '#4f5a48' : '#2a2b27', 0.05);  // 屋
  g.strokeStyle = alive ? '#3a4236' : '#1e1f1b'; g.lineWidth = 0.025;
  for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(-0.55 + k * 0.2, -0.45); g.lineTo(-0.55 + k * 0.2, 0.35); g.stroke(); }
  for (const [x, y] of [[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82]]) { circ(g, x, y, 0.16); fillStroke(g, alive ? '#8a7f62' : '#4a463c', 0.04); }
  g.beginPath(); g.rect(-0.2, 0.62, 0.4, 0.2); fillStroke(g, '#2a2622', 0.04); // 閘
  if (alive) { g.strokeStyle = INK; g.lineWidth = 0.04; g.beginPath(); g.moveTo(0.3, -0.3); g.lineTo(0.3, -0.62); g.stroke(); g.fillStyle = '#e8842c'; g.fillRect(0.3, -0.62, 0.22, 0.12); } // 旗
}
export function structSprite(kind, alive) {
  return get(`s:${kind}:${alive}`, g => (kind === 'base' ? baseArt : towerArt)(g, alive), 1.05, kind === 'base' ? 240 : 160);
}

// 屍巢、巢穴：一堆會郁嘅爛肉，有膿包同觸鬚；有殼（未打得）時係深色骨甲
function nestArt(g, kind, shell) {
  const rnd = (k) => Math.abs(Math.sin(k * 12.9898 + (kind === 'nest' ? 3 : 7)) * 43758.5453) % 1;
  g.strokeStyle = '#3a1210'; g.lineWidth = 0.06;
  for (let k = 0; k < 9; k++) { // 觸鬚
    const a = k / 9 * TAU + rnd(k) * 0.4, l = 1.05 + rnd(k + 9) * 0.35;
    g.beginPath(); g.moveTo(Math.cos(a) * 0.7, Math.sin(a) * 0.7);
    g.quadraticCurveTo(Math.cos(a + 0.25) * l * 0.9, Math.sin(a + 0.25) * l * 0.9, Math.cos(a - 0.1) * l, Math.sin(a - 0.1) * l); g.stroke();
  }
  g.beginPath();
  for (let k = 0; k <= 20; k++) { const a = k / 20 * TAU, r = 0.86 + rnd(k % 20) * 0.12; k ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); fillStroke(g, shell ? '#2e1a17' : '#4a1c18', 0.06);
  if (shell) { // 骨甲
    g.fillStyle = '#8a8070';
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.save(); g.rotate(a); g.beginPath(); g.ellipse(0.55, 0, 0.18, 0.28, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.03; g.stroke(); g.restore(); }
  }
  for (let k = 0; k < 8; k++) { // 膿包
    const a = rnd(k + 20) * TAU, r = rnd(k + 30) * 0.55;
    circ(g, Math.cos(a) * r, Math.sin(a) * r, 0.06 + rnd(k + 40) * 0.08); g.fillStyle = shell ? '#4a2a24' : '#7a3a2a'; g.fill();
  }
  circ(g, 0, 0, kind === 'nest' ? 0.28 : 0.2); fillStroke(g, '#6e2a24', 0.04); // 心
  circ(g, 0, 0, kind === 'nest' ? 0.14 : 0.1); g.fillStyle = '#9a3a2e'; g.fill();
}
export function nestSprite(kind, shell) { return get(`n:${kind}:${shell}`, g => nestArt(g, kind, shell), 1.5, 200); }
