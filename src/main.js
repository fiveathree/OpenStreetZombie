// 開機、畫面切換（標題 → 遊戲 → 升級 → 結算）同 HUD
import { loadMap } from './map.js';
import { createInput } from './input.js';
import { createMidScene } from './scenes/mid.js';
import { MATCH_TIME, xpNeed, rollUpgrades } from './stats.js';

const $ = s => document.querySelector(s);
const canvas = $('#c'), ctx = canvas.getContext('2d', { alpha: false });
const ov = $('#ov'), card = $('#card');
const input = createInput(canvas, $('#stick'));
const mobile = matchMedia('(pointer: coarse)').matches;
const WHO = { player: '你', tank: '坦克', medic: '醫療', dps: '輸出', all: '全隊' };
const CMDS = ['follow', 'spread', 'hold', 'focus'];

let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
}
addEventListener('resize', resize);
resize();

let map, scene, mode = 'title';
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

function showTitle() {
  mode = 'title';
  document.body.classList.remove('playing');
  card.innerHTML = `
    <p class="eyebrow">${esc(map.name)}・第 1 關</p>
    <h1>屍城<em>戰線</em></h1>
    <p>喪屍沿住真實街道湧過嚟。帶住三個隊友，撐夠 5 分鐘。</p>
    <dl class="ctrls">
      <dt>移動</dt><dd>${mobile ? '撳住畫面拖動' : 'WASD／方向鍵（或者撳住滑鼠拖）'}</dd>
      <dt>攻擊</dt><dd>自動</dd>
      <dt>指揮</dt><dd>右下角四個掣${mobile ? '' : '，或者撳 1 2 3 4'}</dd>
      <dt>補血</dt><dd>企喺藥房 ✚ 虛線圈入面</dd>
      <dt>救人</dt><dd>企喺倒地隊友身邊</dd>
    </dl>
    <button class="go" id="go">出擊</button>`;
  ov.hidden = false;
  $('#go').onclick = start;
  $('#go').focus();
}

function start() {
  scene = createMidScene(map, { maxZombies: mobile ? 170 : 260 });
  mode = 'play';
  ov.hidden = true;
  document.body.classList.add('playing');
  setCommand('follow');
  buildSquadHud();
}

function showCards() {
  mode = 'cards';
  const picks = rollUpgrades(scene.squad);
  card.innerHTML = `<p class="eyebrow">升級・等級 ${scene.state.level + 1}</p><h2>揀一樣</h2>
    <div class="picks">${picks.map((u, i) => `<button class="pick" data-i="${i}"><span>${WHO[u.who]}</span><b>${esc(u.title)}</b><small>${esc(u.desc)}</small>${mobile ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('')}</div>`;
  ov.hidden = false;
  card.querySelectorAll('.pick').forEach(b => { b.onclick = () => choose(picks[b.dataset.i]); });
  card.querySelector('.pick').focus();
  showCards.picks = picks;
}
function choose(u) {
  if (mode !== 'cards' || !u) return;
  scene.pickUpgrade(u);
  if (scene.state.pendingLevels > 0) showCards();
  else { mode = 'play'; ov.hidden = true; }
}

function showEnd() {
  mode = 'end';
  const s = scene.state, win = s.over === 'win';
  const alive = scene.squad.filter(m => m.role !== 'player' && m.state !== 'dead').length;
  card.innerHTML = `
    <p class="eyebrow">${win ? '撐住咗' : '失守'}</p>
    <h2>${win ? '過關！鹽埕暫時安全' : '全軍覆沒'}</h2>
    <div class="res">
      <div><span>撐咗</span><b>${mmss(s.t)}</b></div>
      <div><span>擊殺</span><b>${s.kills}</b></div>
      <div><span>等級</span><b>${s.level}</b></div>
      <div><span>隊友生還</span><b>${alive}/3</b></div>
    </div>
    <button class="go" id="go">再嚟一次</button>`;
  ov.hidden = false;
  $('#go').onclick = start;
  $('#go').focus();
}

// ---- 指揮掣 ----
function setCommand(c) {
  if (!scene || mode === 'title') return;
  scene.command(c);
  document.querySelectorAll('#cmds button').forEach(b => b.classList.toggle('on', b.dataset.cmd === c));
}
document.querySelectorAll('#cmds button').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); setCommand(b.dataset.cmd); });
});
addEventListener('keydown', e => {
  const n = '1234'.indexOf(e.key);
  if (n < 0) return;
  if (mode === 'play') setCommand(CMDS[n]);
  else if (mode === 'cards') choose(showCards.picks[n]);
});

// ---- HUD ----
const squadEl = $('#squad');
let rows = [];
function buildSquadHud() {
  squadEl.innerHTML = scene.squad.map(m => `<li class="r-${m.role}"><b>${esc(m.name)}</b><span>${m.role === 'player' ? '' : esc(m.label)}</span><i><em></em></i><small></small></li>`).join('');
  rows = [...squadEl.children].map(li => ({ li, bar: li.querySelector('em'), note: li.querySelector('small') }));
}
let hudT = 0, toastT = 0;
function hud(dt) {
  const s = scene.state;
  if (s.toast) { $('#toast').textContent = s.toast; $('#toast').classList.add('show'); toastT = 2.5; s.toast = null; }
  if (toastT > 0 && (toastT -= dt) <= 0) $('#toast').classList.remove('show');
  if ((hudT -= dt) > 0) return;
  hudT = 0.1;
  $('#time').textContent = mmss(Math.max(0, MATCH_TIME - s.t));
  $('#kills').textContent = s.kills;
  $('#lvl').textContent = s.level;
  $('#xp').style.width = Math.min(100, (s.xp / xpNeed(s.level + s.pendingLevels)) * 100) + '%';
  scene.squad.forEach((m, i) => {
    const r = rows[i];
    r.bar.style.width = (m.hp / m.maxHp) * 100 + '%';
    r.li.dataset.state = m.state;
    r.note.textContent = m.state === 'down' ? `倒地 ${Math.ceil(m.bleed)}` : m.state === 'dead' ? '陣亡' : '';
  });
}

// ---- 主循環 ----
let last = performance.now(), clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (mode === 'play') {
    scene.update(dt, input.vector());
    if (scene.state.pendingLevels > 0) showCards();
    else if (scene.state.over) showEnd();
  } else if (mode === 'title') scene.idle(clock);
  scene.render(ctx, W, H, dpr, dt);
  if (mode !== 'title') hud(dt);
  requestAnimationFrame(frame);
}

try {
  map = await loadMap('data/yancheng.json');
  scene = createMidScene(map);
  showTitle();
  requestAnimationFrame(frame);
} catch (err) {
  card.innerHTML = `<h2>載入唔到地圖</h2><p>${esc(err.message)}</p><p>要用網頁伺服器開（例如 GitHub Pages），唔可以直接雙擊 index.html。</p>`;
  ov.hidden = false;
}
