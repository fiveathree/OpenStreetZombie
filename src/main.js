// 開機同畫面切換：標題 → 安全屋 → 小／中／大地圖 → 升級三選一 → 結算 → 安全屋；仲有各模式 HUD。
import { loadMap } from './map.js';
import { createInput } from './input.js';
import { createMidScene } from './scenes/mid.js';
import { createStreetScene, pickStreet, TROOPS } from './scenes/street.js';
import { createBigScene } from './scenes/big.js';
import { MATCH_TIME, xpNeed, rollUpgrades, ROLES, HEROES, activeBonds, heroXpNeed, heroLevelCost, RES_NAMES, TREAT_COST, RECRUIT_SHARDS, ULT_BOOST_LEVEL, BIG } from './stats.js';
import { loadSave, writeSave, resetSave, canLevel, levelUp, treat, recruit, unlockAll, applyResult } from './save.js';

const $ = s => document.querySelector(s);
const canvas = $('#c'), ctx = canvas.getContext('2d', { alpha: false });
const ov = $('#ov'), card = $('#card');
const mobile = matchMedia('(pointer: coarse)').matches;
const WHO = { player: '你', tank: '坦克', medic: '醫療', dps: '輸出', control: '控場', support: '支援', all: '全隊' };
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const day = Math.floor(Date.now() / 86400000);

// 中地圖兩個街區：過咗第一個先開第二個；兩個都過咗開大地圖
const MIDS = {
  yancheng: { file: 'data/yancheng.json', name: '鹽埕街區', desc: '白天・藥房多', hard: 1.4, night: false },
  qixian: { file: 'data/qixian.json', name: '七賢路街區', desc: '夜晚・有警局同油站', hard: 1.6, night: true, need: 'yancheng' },
};
const CMDS = {
  mid: [['follow', '跟我'], ['spread', '散開'], ['hold', '守住'], ['focus', '集火']],
  big: [['top', '推上路'], ['mid', '推中路'], ['bot', '推下路'], ['base', '守主城'], ['follow', '集合'], ['boss', '打 Boss']],
};

let save = loadSave();
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
}
addEventListener('resize', resize);
resize();

const maps = {};
async function getMap(id) {
  if (maps[id]) return maps[id];
  const big = id === 'big';
  return (maps[id] = await loadMap(big ? 'data/big.json' : MIDS[id].file, big ? { cell: 4, detail: false } : {}));
}

let scene = null, mode = 'title', backdrop = null, runInfo = null;

// ---- zoom ----
let zoomSaved = 1;
try { zoomSaved = Number(localStorage.getItem('osz-zoom')) || 1; } catch {}
function zoom(f) {
  if (!scene?.zoomBy || mode !== 'play') return;
  zoomSaved = scene.zoomBy(f);
  try { localStorage.setItem('osz-zoom', zoomSaved); } catch {}
}
const input = createInput(canvas, $('#stick'), zoom, (x, y) => { // 撳一下畫面：大地圖揀建築
  if (mode === 'play' && scene?.kind === 'big') { const id = scene.tap(x, y, W, H); if (id) openDispatch(id); }
});
document.querySelectorAll('#zoom button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); zoom(b.dataset.z > 0 ? 1.25 : 0.8); }));

// ---- 畫面切換 ----
function setMode(m, kind) {
  mode = m;
  document.body.className = m === 'play' || m === 'cards' ? 'playing m-' + kind : '';
}

function showTitle() {
  setMode('title');
  card.className = 'card';
  card.innerHTML = `
    <p class="eyebrow">高雄鹽埕區・OpenStreetMap 真實街道</p>
    <h1>屍城<em>戰線</em></h1>
    <p>喪屍沿住真實街道湧過嚟。帶住隊友，打街道衝鋒、街區求生同愛河大戰。</p>
    <button class="go" id="go">入安全屋</button>`;
  ov.hidden = false;
  $('#go').onclick = () => showSafehouse();
  $('#go').focus();
}

// ---- 安全屋 ----
function teamRoles() { return save.team.filter(r => save.heroes[r]?.owned).slice(0, 3); }
function showSafehouse(msg) {
  setMode('safe');
  const team = teamRoles();
  const bonds = activeBonds(team);
  const street = maps.big ? pickStreet(maps.big, day).name : '今日嘅街';
  const resRow = Object.entries(RES_NAMES).map(([k, n]) => `<div><span>${n}</span><b>${save.res[k]}</b></div>`).join('') + `<div><span>碎片</span><b>${save.shards}</b></div>`;
  const heroCard = r => {
    const h = save.heroes[r], R = ROLES[r], on = team.includes(r), need = heroXpNeed(h.lvl), cost = heroLevelCost(h.lvl);
    if (!h.owned) return `<div class="hero locked"><b>${R.name}</b><span>${R.job}・${R.label}</span><small>未招募</small><button data-act="recruit" data-r="${r}" ${save.shards >= RECRUIT_SHARDS ? '' : 'disabled'}>招募（碎片 ${RECRUIT_SHARDS}）</button></div>`;
    return `<div class="hero ${on ? 'on' : ''}" data-act="pick" data-r="${r}">
      <b>${R.name} <em>Lv${h.lvl}</em></b><span>${R.job}・${R.label}${h.lvl >= ULT_BOOST_LEVEL ? '・大招強化' : ''}</span>
      <i class="bar"><em style="width:${Math.min(100, h.xp / need * 100)}%"></em></i>
      ${h.injured ? `<small class="hurt">受傷：血 −30%</small><button data-act="treat" data-r="${r}" ${save.res.meds >= TREAT_COST.meds ? '' : 'disabled'}>醫好（藥品 ${TREAT_COST.meds}）</button>` : ''}
      ${h.xp >= need ? `<button data-act="level" data-r="${r}" ${canLevel(save, r) ? '' : 'disabled'}>升級（食物 ${cost.food}、藥品 ${cost.meds}）</button>` : `<small>經驗 ${h.xp}/${need}</small>`}
    </div>`;
  };
  const mission = (id, title, desc, ok, why) => `<button class="mission" data-go="${id}" ${ok ? '' : 'disabled'}><b>${title}</b><span>${ok ? desc : why}</span></button>`;
  card.className = 'card wide';
  card.innerHTML = `
    <p class="eyebrow">安全屋・第 ${save.runs + 1} 次出擊</p>
    <div class="res">${resRow}</div>
    <h3>隊伍（揀 3 個；大地圖會多帶 1 個）</h3>
    <div class="heroes">${HEROES.map(heroCard).join('')}</div>
    <p class="bonds">${bonds.length ? '羈絆：' + bonds.map(b => `<b>${b.name}</b>`).join('、') : '羈絆：未有（試下消防員＋化學老師）'}</p>
    <h3>出擊</h3>
    <div class="missions">
      ${mission('street', '小地圖：街道衝鋒', `今日：${esc(street)}・1–2 分鐘・賺資源同碎片`, true)}
      ${mission('yancheng', '中地圖：' + MIDS.yancheng.name + (save.cleared.yancheng ? ' ✓' : ''), MIDS.yancheng.desc + '・撐 5 分鐘', true)}
      ${mission('qixian', '中地圖：' + MIDS.qixian.name + (save.cleared.qixian ? ' ✓' : ''), MIDS.qixian.desc + '・撐 5 分鐘', save.cleared.yancheng, '過咗鹽埕街區先開')}
      ${mission('big', '大地圖：愛河大戰' + (save.cleared.big ? ' ✓' : ''), '三路經愛河三條橋・打爆東岸巢穴', save.cleared.qixian, '兩個街區都過咗先開')}
    </div>
    ${msg ? `<p class="msg">${msg}</p>` : ''}
    <p class="tiny"><button class="link" id="cheat">全部解鎖（試玩用）</button>・<button class="link" id="wipe">重置存檔</button></p>`;
  ov.hidden = false;
  card.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    const r = el.dataset.r, act = el.dataset.act;
    if (act === 'pick') {
      const t = save.team.filter(x => save.heroes[x]?.owned);
      save.team = t.includes(r) ? t.filter(x => x !== r) : [...t, r].slice(-3);
      writeSave(save);
    } else if (act === 'level') levelUp(save, r);
    else if (act === 'treat') treat(save, r);
    else if (act === 'recruit') recruit(save, r);
    showSafehouse();
  }));
  card.querySelectorAll('[data-go]').forEach(b => b.onclick = () => start(b.dataset.go));
  $('#cheat').onclick = () => { unlockAll(save); showSafehouse('已經全部解鎖，資源加到 300。'); };
  $('#wipe').onclick = () => { if (confirm('重置存檔？所有進度會清走。')) { save = resetSave(); showSafehouse('存檔已重置。'); } };
}

// ---- 開波 ----
async function start(id) {
  const team = teamRoles();
  if (team.length < 1) { showSafehouse('最少要揀 1 個隊友。'); return; }
  card.innerHTML = '<p>載入緊地圖…</p>';
  const spec = r => ({ role: r, lvl: save.heroes[r].lvl, injured: save.heroes[r].injured });
  try {
    if (id === 'street') {
      const map = await getMap('big');
      scene = createStreetScene(map, { day, captains: team.map(spec) });
      runInfo = { id, kind: 'street', team };
    } else if (id === 'big') {
      const map = await getMap('big');
      const extra = HEROES.filter(r => save.heroes[r].owned && !team.includes(r)).slice(0, 1);
      const four = [...team, ...extra];
      scene = createBigScene(map, { team: [{ role: 'player' }, ...four.map(spec)], maxZombies: mobile ? 200 : 280 });
      runInfo = { id, kind: 'big', team: four };
    } else {
      const map = await getMap(id), M = MIDS[id];
      scene = createMidScene(map, { team: [{ role: 'player' }, ...team.map(spec)], night: M.night, hard: M.hard, maxZombies: mobile ? 170 : 240, mapId: id });
      runInfo = { id, kind: 'mid', team };
    }
  } catch (err) { showSafehouse('載入失敗：' + esc(err.message)); return; }
  scene.setZoom?.(zoomSaved);
  setMode('play', scene.kind);
  ov.hidden = true;
  buildHud();
}

function showCards() {
  setMode('cards', scene.kind);
  const picks = rollUpgrades(scene.squad);
  card.className = 'card';
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
  else { setMode('play', scene.kind); ov.hidden = true; }
}

function showEnd() {
  const s = scene.state, win = s.over === 'win', kind = scene.kind;
  setMode('end');
  closeDispatch();
  const squadOut = kind === 'street'
    ? scene.caps.map(c => ({ role: c.role, state: 'ok' })) // 小地圖唔會受傷
    : scene.squad.map(m => ({ role: m.role, state: kind === 'big' ? ((m.deaths || 0) >= 2 ? 'dead' : 'ok') : m.state }));
  const xp = kind === 'street' ? 30 + s.kills * 0.2 : kind === 'big' ? (win ? 200 : 80) + s.kills * 0.1 : (win ? 80 : 30) + s.kills * 0.05;
  const loot = { ...s.loot };
  if (kind === 'mid' && win) { loot.food += 30; loot.meds += 12; loot.parts += 15; loot.ammo += 15; }
  if (kind === 'big' && win) { loot.food += 80; loot.meds += 40; loot.parts += 50; loot.ammo += 50; }
  const shards = (s.shards || 0) + (kind === 'big' && win ? 3 : 0);
  const got = applyResult(save, { mode: kind, win, loot, shards, xp: Math.round(xp), squad: squadOut, mapId: kind === 'mid' ? runInfo.id : kind === 'big' ? 'big' : null, street: kind === 'street' && win ? 1 : 0 });
  const hurtNow = squadOut.filter(m => m.state === 'dead' && m.role !== 'player').map(m => ROLES[m.role].name);
  const title = kind === 'street' ? (win ? `衝到 ${esc(s.street)} 街尾！` : '小隊全滅') : kind === 'big' ? (win ? '打爆咗喪屍巢穴！愛河兩岸安全' : '主城失守') : (win ? `過關！${esc(MIDS[runInfo.id].name)}暫時安全` : '全軍覆沒');
  const stat = kind === 'street' ? `<div><span>跑咗</span><b>${Math.round(s.s)} 米</b></div><div><span>擊殺</span><b>${s.kills}</b></div>`
    : `<div><span>${kind === 'big' ? '打咗' : '撐咗'}</span><b>${mmss(s.t)}</b></div><div><span>擊殺</span><b>${s.kills}</b></div>`;
  card.className = 'card';
  card.innerHTML = `
    <p class="eyebrow">${win ? '任務完成' : '任務失敗・資源只帶返一半'}</p>
    <h2>${title}</h2>
    <div class="res">${stat}${Object.entries(got).filter(([, v]) => v).map(([k, v]) => `<div><span>${RES_NAMES[k]}</span><b>+${v}</b></div>`).join('')}${shards ? `<div><span>碎片</span><b>+${shards}</b></div>` : ''}</div>
    <p>每個隊友經驗 +${Math.round(xp)}。${hurtNow.length ? `受傷：${hurtNow.join('、')}（下一場抖一場，或者帶傷上陣）` : ''}</p>
    ${kind === 'mid' && win && runInfo.id === 'yancheng' && !save.cleared.qixian ? '<p class="msg">解鎖咗鄰近街區：七賢路！</p>' : ''}
    ${kind === 'mid' && win && runInfo.id === 'qixian' ? '<p class="msg">兩個街區都佔領咗：大地圖「愛河大戰」開放！</p>' : ''}
    <button class="go" id="go">返安全屋</button>`;
  ov.hidden = false;
  $('#go').onclick = () => { scene = backdrop; showSafehouse(); };
  $('#go').focus();
}

// ---- HUD ----
const cmdsEl = $('#cmds'), squadEl = $('#squad'), capsEl = $('#caps');
let rows = [];
function buildHud() {
  const kind = scene.kind;
  cmdsEl.innerHTML = (CMDS[kind] || []).map(([c, n], i) => `<button data-cmd="${c}"><b>${n}</b><kbd>${i + 1}</kbd></button>`).join('');
  cmdsEl.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); setCommand(b.dataset.cmd); }));
  cmdsEl.dataset.n = (CMDS[kind] || []).length;
  if (kind !== 'street') {
    squadEl.innerHTML = scene.squad.map(m => `<li class="r-${m.role}"><b>${esc(m.name)}</b><span>${m.role === 'player' ? '' : esc(m.label) + ' Lv' + m.lvl}</span><i><em></em></i><small></small></li>`).join('');
    rows = [...squadEl.children].map(li => ({ li, bar: li.querySelector('em'), note: li.querySelector('small') }));
    setCommand(kind === 'big' ? 'follow' : 'follow');
  } else {
    capsEl.innerHTML = scene.caps.map((c, i) => `<button data-i="${i}"><b>${esc(c.name)}</b><span>${TROOPS[c.role].name}</span><em>0</em></button>`).join('') + '<small>撳隊長：門嘅效果加落邊隊</small>';
    capsEl.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); scene.setTarget(+b.dataset.i); }));
    $('#streetName').textContent = scene.state.street;
  }
  $('#timeLabel').textContent = kind === 'mid' ? '撐住' : kind === 'big' ? '時間' : '距離';
  $('#k1').textContent = kind === 'big' ? '零件' : '擊殺';
  $('#k2').textContent = kind === 'big' ? '巢穴' : kind === 'street' ? '碎片' : '等級';
}
function setCommand(c) {
  if (!scene?.command || mode === 'title') return;
  scene.command(c);
  cmdsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.cmd === c));
}
$('#ultBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'play') scene.ult(); });
$('#recallBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'play') scene.recall?.(); });
addEventListener('keydown', e => {
  if (mode === 'play') {
    if (e.key === '+' || e.key === '=') return zoom(1.25);
    if (e.key === '-' || e.key === '_') return zoom(0.8);
    if (e.code === 'Space' || e.code === 'KeyQ') { e.preventDefault(); return scene.ult(); }
    if (e.code === 'KeyB') return scene.recall?.();
    if (e.key === 'Escape') return closeDispatch();
    const list = CMDS[scene.kind] || [];
    const n = e.key && e.key.length === 1 ? '123456'.indexOf(e.key) : -1;
    if (n >= 0 && list[n]) setCommand(list[n][0]);
    if (scene.kind === 'street' && n >= 0 && n < 3) scene.setTarget(n);
  } else if (mode === 'cards') {
    const n = e.key && e.key.length === 1 ? '123'.indexOf(e.key) : -1;
    if (n >= 0) choose(showCards.picks[n]);
  }
});

// ---- 大地圖派遣 ----
const dispEl = $('#dispatch');
let dispId = null;
function openDispatch(id) { dispId = id; renderDispatch(); dispEl.hidden = false; }
function closeDispatch() { dispId = null; dispEl.hidden = true; }
function renderDispatch() {
  if (!dispId || scene?.kind !== 'big') return closeDispatch();
  const d = scene.info(dispId);
  dispEl.innerHTML = `
    <header><b>${esc(d.name)}</b><span>${Math.round(d.hp)}/${Math.round(d.maxHp)}</span><button class="x" id="dx" aria-label="關閉">✕</button></header>
    <p>守點隊友 ${d.guards.length}/${d.cap}・守備兵 ${d.soldierN}・零件 ${d.parts}</p>
    <div class="dlist">${d.allies.map(a => `<div><b>${esc(a.name)}</b><span>${a.state !== 'ok' ? (a.state === 'dead' ? '復活中' : '倒地') : a.here ? '守緊呢度' : a.mode?.kind === 'garrison' ? '守緊第度' : '跟隊'}</span>
      ${a.here ? `<button data-recall="${a.role}">召回</button>` : `<button data-assign="${a.role}" ${d.guards.length >= d.cap ? 'disabled' : ''}>派去守</button>`}</div>`).join('')}</div>
    <div class="drow"><button id="dsq" ${d.parts >= BIG.squadCost && d.soldierN < 6 ? '' : 'disabled'}>造守備小隊（零件 ${BIG.squadCost}）</button><button id="dup" ${d.parts >= BIG.upgradeCost ? '' : 'disabled'}>升級（零件 ${BIG.upgradeCost}）</button></div>`;
  $('#dx').onclick = closeDispatch;
  dispEl.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => { scene.assign(dispId, b.dataset.assign); renderDispatch(); });
  dispEl.querySelectorAll('[data-recall]').forEach(b => b.onclick = () => { scene.recallAlly(b.dataset.recall); renderDispatch(); });
  $('#dsq').onclick = () => { scene.buildSquad(dispId); renderDispatch(); };
  $('#dup').onclick = () => { scene.upgrade(dispId); renderDispatch(); };
}
const mm = $('#minimap'), mmCtx = mm.getContext('2d');
mm.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (scene?.kind !== 'big') return;
  const r = mm.getBoundingClientRect(), id = scene.tapMinimap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  if (id) openDispatch(id);
});

let hudT = 0, toastT = 0;
const toastQ = [];
function hud(dt) {
  const s = scene.state;
  if (s.toasts?.length) { toastQ.push(...s.toasts); s.toasts.length = 0; if (toastQ.length > 3) toastQ.splice(0, toastQ.length - 3); }
  if (toastT > 0) toastT -= dt;
  if (toastT <= 0 && toastQ.length) { $('#toast').textContent = toastQ.shift(); $('#toast').classList.add('show'); toastT = 1.8; }
  else if (toastT <= 0) $('#toast').classList.remove('show');
  if ((hudT -= dt) > 0) return;
  hudT = 0.1;
  const kind = scene.kind, p = scene.squad?.[0];
  if (kind === 'mid') {
    $('#time').textContent = mmss(Math.max(0, MATCH_TIME - s.t));
    $('#v1').textContent = s.kills; $('#v2').textContent = s.level;
    $('#xp').style.width = Math.min(100, (s.xp / xpNeed(s.level + s.pendingLevels)) * 100) + '%';
  } else if (kind === 'big') {
    $('#time').textContent = s.respawn ? '復活 ' + Math.ceil(s.respawn) : s.recall ? '回城 ' + s.recall.toFixed(1) : mmss(s.t);
    $('#v1').textContent = Math.floor(s.parts); $('#k2').textContent = scene.nestOpen() ? '巢穴' : '屍巢'; $('#v2').textContent = scene.nestOpen() ? Math.round(scene.nestHp() * 100) + '%' : scene.outposts() + '/3';
    if (dispId) renderDispatch();
  } else {
    $('#time').textContent = Math.round(s.s) + 'm';
    $('#v1').textContent = s.kills; $('#v2').textContent = s.shards;
    $('#prog').style.width = (s.s / s.len * 100) + '%';
    $('#crossName').textContent = s.cross ? '路口：' + s.cross : '';
    [...capsEl.querySelectorAll('button')].forEach((b, i) => { const c = scene.caps[i]; b.querySelector('em').textContent = c.alive ? c.n + (c.tier > 1 ? ' ★' + c.tier : '') : '倒下'; b.classList.toggle('on', s.target === i); b.classList.toggle('dead', !c.alive); });
  }
  if (kind !== 'street') scene.squad.forEach((m, i) => {
    const r = rows[i]; if (!r) return;
    r.bar.style.width = (m.hp / m.maxHp) * 100 + '%';
    r.li.dataset.state = m.state;
    const where = kind === 'big' && m.mode ? { follow: '', garrison: '守點', lane: '推路', boss: '打Boss', base: '守城' }[m.mode.kind] : '';
    r.note.textContent = m.state === 'down' ? `倒地 ${Math.ceil(m.bleed)}` : m.state === 'dead' ? (kind === 'big' ? '復活中' : '陣亡') : m.ult >= 1 && m === p ? '大招✓' : where;
  });
  const ready = kind === 'street' ? s.ultReady : p && p.ult >= 1;
  $('#ultBtn').classList.toggle('ready', !!ready);
  $('#ultFill').style.height = (kind === 'street' ? (s.ultReady ? 100 : 0) : (p?.ult || 0) * 100) + '%';
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
  } else if (scene === backdrop) backdrop?.idle(clock);
  scene?.render(ctx, W, H, dpr, dt);
  if (mode === 'play' || mode === 'cards') { hud(dt); if (scene.kind === 'big') scene.renderMinimap(mmCtx, mm.width); }
  requestAnimationFrame(frame);
}

try {
  const map = await getMap('yancheng');
  backdrop = scene = createMidScene(map);
  showTitle();
  requestAnimationFrame(frame);
  getMap('big').catch(() => {}); // 背景預先載入大地圖
} catch (err) {
  card.innerHTML = `<h2>載入唔到地圖</h2><p>${esc(err.message)}</p><p>要用網頁伺服器開（例如 GitHub Pages），唔可以直接雙擊 index.html。</p>`;
  ov.hidden = false;
}
