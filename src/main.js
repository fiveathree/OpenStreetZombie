// 開機同畫面切換：標題 → 安全屋 → 小／中／大地圖 → 升級三選一 → 結算 → 安全屋；仲有各模式 HUD。
import { loadMap } from './map.js';
import { createInput } from './input.js';
import { createMidScene } from './scenes/mid.js';
import { createStreetScene, pickStreet, TROOPS } from './scenes/street.js';
import { createBigScene } from './scenes/big.js';
import { MATCH_TIME, xpNeed, rollUpgrades, activeBonds, heroXpNeed, heroLevelCost, RES_NAMES, TREAT_COST, ULT_BOOST_LEVEL, BIG } from './stats.js';
import { loadSave, writeSave, resetSave, canLevel, levelUp, treat, recruit, canRecruit, recruitNeed, owned, unlockAll, applyResult } from './save.js';
import { loadCast, hero, castList, CORE, rollSurvivor, factionBonds } from './heroes.js';
import { CHAPTERS, currentChapter, completeChapter } from './story.js';

const $ = s => document.querySelector(s);
const canvas = $('#c'), ctx = canvas.getContext('2d', { alpha: false });
const ov = $('#ov'), card = $('#card');
const mobile = matchMedia('(pointer: coarse)').matches;
const WHO = { player: '你', tank: '坦克', medic: '醫療', dps: '輸出', control: '控場', support: '支援', all: '全隊' };
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const day = Math.floor(Date.now() / 86400000);

// 中地圖：按城市分。主線嘅地圖跟劇情解鎖；need = 要先過咗邊張圖
const CITIES = [['kh', '高雄'], ['hk', '香港'], ['tp', '台北'], ['tk', '東京'], ['os', '大阪']];
const MIDS = {
  yancheng: { city: 'kh', name: '鹽埕街區', desc: '白天・藥房多', hard: 1.4 },
  qixian: { city: 'kh', name: '七賢路街區', desc: '夜晚・有警局同油站', hard: 1.6, night: true, need: 'yancheng' },
  'kh-liuhe': { city: 'kh', name: '六合夜市', desc: '夜晚・夜市攤檔、美麗島站', hard: 1.6, night: true, need: 'big' },
  'kh-cijin': { city: 'kh', name: '旗津老街', desc: '白天・海邊廟街', hard: 1.5, need: 'big' },
  'hk-mongkok': { city: 'hk', name: '旺角', desc: '白天・唐樓窄街', hard: 1.5 },
  'hk-tst': { city: 'hk', name: '尖沙咀', desc: '夜晚・海旁鐘樓', hard: 1.7, night: true },
  'hk-central': { city: 'hk', name: '中環', desc: '白天・斜路同石板街', hard: 1.75 },
  'tp-ximen': { city: 'tp', name: '西門町', desc: '白天・紅樓行人區', hard: 1.8 },
  'tp-xinyi': { city: 'tp', name: '信義・101', desc: '夜晚・大廣場', hard: 1.85, night: true },
  'tk-shibuya': { city: 'tk', name: '澀谷', desc: '白天・十字路口', hard: 1.9 },
  'tk-shinjuku': { city: 'tk', name: '新宿歌舞伎町', desc: '夜晚・窄巷', hard: 1.95, night: true },
  'os-dotonbori': { city: 'os', name: '道頓堀', desc: '夜晚・河邊招牌街', hard: 2, night: true },
  'os-shinsekai': { city: 'os', name: '新世界・通天閣', desc: '白天・通天閣', hard: 2.05 },
};
// 大地圖：每個城市一張。spots = 主城同巢穴嘅經緯度（三條路自動揀）；hard = 喪屍強度倍數
const BIGS = {
  big: { city: 'kh', name: '愛河大戰', desc: '三路經愛河三條橋・打爆東岸巢穴', won: '愛河兩岸安全', need: 'qixian', why: '兩個街區都過咗先開' },
  'hk-big': { city: 'hk', name: '九龍大戰', desc: '主城喺尖沙咀・三路北上打爆油麻地巢穴', won: '九龍安全', spots: { base: [22.2995, 114.1720], nest: [22.3100, 114.1700] }, hard: 1.3 },
  'tp-big': { city: 'tp', name: '台北城大戰', desc: '主城喺中正紀念堂・打爆台北車站巢穴', won: '台北城安全', spots: { base: [25.0360, 121.5200], nest: [25.0478, 121.5170] }, hard: 1.2 },
  'tk-big': { city: 'tk', name: '新宿大戰', desc: '主城喺新宿御苑・打爆歌舞伎町巢穴', won: '新宿安全', spots: { base: [35.6872, 139.7060], nest: [35.6960, 139.7000] }, hard: 1.4 },
  'os-big': { city: 'os', name: '難波決戰', desc: '主城喺日本橋・打爆道頓堀巢穴', won: '大阪安全', spots: { base: [34.6590, 135.5050], nest: [34.6690, 135.5015] }, hard: 1.6 },
};
for (const id in MIDS) MIDS[id].file = `data/${id}.json`;
for (const id in BIGS) BIGS[id].file = `data/${id}.json`;
// 開唔開：過咗就開；有 need 就睇 need；主線地圖要之前嘅章節全部做完
function mapOpen(id) {
  const M = MIDS[id] || BIGS[id];
  if (save.cleared[id]) return true;
  if (M.need) return !!save.cleared[M.need];
  const i = CHAPTERS.findIndex(c => c.mission === id);
  const done = new Set(save.story?.done || []);
  return i < 0 || CHAPTERS.slice(0, i).every(c => done.has(c.id));
}
const cityOpen = c => Object.keys(MIDS).some(id => MIDS[id].city === c && mapOpen(id));
let cityTab = null; // 安全屋揀緊邊個城市；null = 跟主線
const CMDS = {
  mid: [['follow', '跟我'], ['spread', '散開'], ['hold', '守住'], ['focus', '集火']],
  big: [['top', '推上路'], ['mid', '推中路'], ['bot', '推下路'], ['base', '守主城'], ['follow', '集合'], ['boss', '打 Boss']],
};

await loadCast(); // 屍城日誌角色
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
  const B = BIGS[id];
  return (maps[id] = await loadMap(B ? B.file : MIDS[id].file, B ? { cell: 4, detail: false } : {}));
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
const input = createInput(canvas, $('#stick'), zoom, (x, y) => { // 撳一下畫面（大地圖）：揀咗人就派佢去；冇揀人就開建築面板
  if (mode !== 'play' || scene?.kind !== 'big') return;
  const t = scene.tap(x, y, W, H);
  if (sel > 0) { if (t.struct) scene.assign(t.struct, sel); else scene.sendTo(sel, t.x, t.y); }
  else if (t.struct) openDispatch(t.struct);
});
// 大地圖：揀咗邊個隊友（squad 入面嘅位置；-1 = 冇揀）
let sel = -1;
function selectAlly(i) {
  sel = sel === i ? -1 : i;
  scene?.select?.(sel);
  const hint = $('#selHint');
  hint.hidden = sel < 0;
  if (sel > 0) hint.textContent = `已揀 ${scene.squad[sel].name}：撳指揮掣、撳地圖或者小地圖派佢去（再撳佢名取消）`;
  rows.forEach((r, k) => r.li.classList.toggle('sel', k === sel));
}
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

// ---- 劇情對白 ----
const SPEAKER = { narr: { name: '' }, radio: { name: '無線電', glyph: '訊' }, you: { name: '你', glyph: '你' } };
function speaker(who) {
  if (SPEAKER[who]) return SPEAKER[who];
  const H = hero(who);
  return { name: H?.name || who, glyph: H?.glyph || [...(H?.name || '？')].find(c => c !== '阿' && c !== '小' && c !== ' ') };
}
const fillText = t => t.replace('{street}', maps.big ? pickStreet(maps.big, day).name : '大街');
let talkKey = null;
addEventListener('keydown', e => { if (mode === 'talk' && talkKey) talkKey(e); });
// lines：[{ who, text }]；播完叫 done()
function playScene(title, lines, done) {
  if (!lines?.length) return done();
  setMode('talk');
  let i = 0;
  let ended = false;
  const finish = () => { if (ended) return; ended = true; card.onclick = null; talkKey = null; done(); };
  const next = () => { if (++i >= lines.length) finish(); else show(); };
  function show() {
    const L = lines[i], S = speaker(L.who);
    const cls = L.who === 'radio' ? 'radio' : L.who === 'you' ? 'you' : '';
    card.className = 'card talk' + (L.who === 'narr' ? ' narr' : '');
    card.innerHTML = `<p class="eyebrow">${esc(title)}・${i + 1}/${lines.length}</p>
      ${L.who === 'narr' ? '' : `<div class="who"><i class="${cls}">${esc(S.glyph || '')}</i><b>${esc(S.name)}</b></div>`}
      <p class="line">${esc(fillText(L.text))}</p>
      <div class="talkbar"><button class="go" id="next">${i + 1 < lines.length ? '下一句' : '繼續'}</button><button class="link" id="skip">略過</button></div>`;
    ov.hidden = false;
    $('#next').onclick = e => { e.stopPropagation(); next(); };
    $('#skip').onclick = e => { e.stopPropagation(); finish(); };
    $('#next').focus();
  }
  setTimeout(() => { card.onclick = () => next(); }, 0); // 等開對白嗰下撳完先接，唔係會跳過第一句
  talkKey = e => { if (e.key === 'Escape') finish(); };
  show();
}

// 冇出擊嘅章（序章、第四章）：入安全屋時自動播
function storyAuto() {
  const ch = currentChapter(save);
  if (!ch || ch.mission) return false;
  playScene(ch.title, ch.intro, () => { finishChapter(ch); showSafehouse(ch.reward?.hero ? `${esc(hero(ch.reward.hero)?.name || "新隊友")} 加入咗隊伍！` : ''); });
  return true;
}
function finishChapter(ch) {
  completeChapter(save, ch.id);
  const r = ch.reward?.hero;
  if (r) { save.heroes[r] ||= { lvl: 1, xp: 0, injured: false, owned: false, shards: 0 }; save.heroes[r].owned = true; }
  writeSave(save);
}

// ---- 安全屋 ----
const ROLE_LABEL = { tank: '坦克', medic: '醫療', dps: '輸出', control: '控場', support: '支援' };
function teamIds() { return save.team.filter(id => save.heroes[id]?.owned && hero(id)).slice(0, 3); }
function showSafehouse(msg) {
  if (storyAuto()) return;
  setMode('safe');
  const chap = currentChapter(save);
  const tab = cityTab || (MIDS[chap?.mission] || BIGS[chap?.mission])?.city || 'kh';
  const team = teamIds();
  const bonds = [...activeBonds(team).map(b => b.name), ...factionBonds(team).map(f => `陣營：${f.name}`)];
  const street = maps.big ? pickStreet(maps.big, day).name : '今日嘅街';
  const resRow = Object.entries(RES_NAMES).map(([k, n]) => `<div><span>${n}</span><b>${save.res[k]}</b></div>`).join('') + `<div><span>通用碎片</span><b>${save.shards}</b></div>`;
  const tag = H => `${H.rarity ? `<i class="rar r-${H.rarity}">${H.rarity}</i>` : ''}`;
  const teamCard = id => {
    const H = hero(id), h = save.heroes[id], need = heroXpNeed(h.lvl), cost = heroLevelCost(h.lvl);
    return `<div class="hero on" data-act="drop" data-r="${id}">
      <b>${tag(H)}${esc(H.name)} <em>Lv${h.lvl}</em></b><span>${esc(H.job)}・${ROLE_LABEL[H.role]}${H.core ? '' : '・屍城日誌'}${h.lvl >= ULT_BOOST_LEVEL ? '・大招強化' : ''}</span>
      <i class="bar"><em style="width:${Math.min(100, h.xp / need * 100)}%"></em></i>
      ${h.injured ? `<small class="hurt">受傷：血 −30%</small><button data-act="treat" data-r="${id}" ${save.res.meds >= TREAT_COST.meds ? '' : 'disabled'}>醫好（藥品 ${TREAT_COST.meds}）</button>` : ''}
      ${h.xp >= need ? `<button data-act="level" data-r="${id}" ${canLevel(save, id) ? '' : 'disabled'}>升級（食物 ${cost.food}、藥品 ${cost.meds}）</button>` : `<small>經驗 ${h.xp}/${need}</small>`}
    </div>`;
  };
  const empty = `<div class="hero empty"><span>撳下面嘅人加入</span></div>`;
  const reserve = owned(save).filter(id => !team.includes(id)).sort((a, b) => save.heroes[b].lvl - save.heroes[a].lvl);
  const chip = id => { const H = hero(id), h = save.heroes[id]; return `<button class="chip" data-act="pick" data-r="${id}">${tag(H)}${esc(H.name)}<span>${ROLE_LABEL[H.role]} Lv${h.lvl}${h.injured ? '・傷' : ''}</span></button>`; };
  const recruitable = Object.keys(save.heroes).filter(id => hero(id) && !save.heroes[id].owned && (save.heroes[id].shards > 0 || CORE[id]))
    .sort((a, b) => (save.heroes[b].shards / recruitNeed(b)) - (save.heroes[a].shards / recruitNeed(a)));
  const rchip = id => { const H = hero(id), h = save.heroes[id], need = recruitNeed(id); return `<button class="chip rec" data-act="recruit" data-r="${id}" ${canRecruit(save, id) ? '' : 'disabled'} title="${esc(H.bio || H.job)}">${tag(H)}${esc(H.name)}<span>${ROLE_LABEL[H.role]}・碎片 ${h.shards}/${need}</span></button>`; };
  const zbOwned = owned(save).filter(id => !CORE[id]).length;
  const mission = (id, title, desc, ok, why) => {
    const main = chap?.mission === id, open = ok || main;
    return `<button class="mission${main ? ' main' : ''}" data-go="${id}" ${open ? '' : 'disabled'}>${main ? '<em>主線</em>' : ''}<b>${title}</b><span>${open ? desc : why}</span></button>`;
  };
  card.className = 'card wide';
  card.innerHTML = `
    <p class="eyebrow">安全屋・第 ${save.runs + 1} 次出擊</p>
    ${chap ? `<div class="quest"><b>主線　${esc(chap.title)}</b><span>${esc(fillText(chap.goal || ''))}</span></div>` : '<div class="quest"><b>主線：全部章節完</b><span>所有地圖可以自由出擊</span></div>'}
    <div class="res">${resRow}</div>
    <h3>出擊隊伍（3 個；大地圖會多帶 1 個後備）</h3>
    <div class="heroes">${team.map(teamCard).join('')}${empty.repeat(Math.max(0, 3 - team.length))}</div>
    <p class="bonds">${bonds.length ? '羈絆：' + bonds.map(b => `<b>${esc(b)}</b>`).join('、') : '羈絆：未有（例如消防員＋化學老師，或者兩個同陣營）'}</p>
    ${reserve.length ? `<div class="chips"><small>後備</small>${reserve.slice(0, 12).map(chip).join('')}</div>` : ''}
    ${recruitable.length ? `<div class="chips"><small>招募</small>${recruitable.slice(0, 8).map(rchip).join('')}</div>` : ''}
    <p class="tiny">屍城日誌角色：已招募 ${zbOwned}/${castList().length}。救倖存者有佢哋嘅專屬碎片，運氣好仲會即刻加入幫手。</p>
    <h3>出擊</h3>
    <div class="cities">${CITIES.map(([c, n]) => `<button class="city${c === tab ? ' on' : ''}" data-city="${c}" ${cityOpen(c) ? '' : 'disabled'}>${n}${cityOpen(c) ? '' : '<small>未開</small>'}</button>`).join('')}</div>
    <div class="missions">
      ${mission('street', '小地圖：街道衝鋒', `今日：${esc(street)}・1–2 分鐘・賺資源同碎片`, true)}
      ${Object.entries(MIDS).filter(([, M]) => M.city === tab).map(([id, M]) => mission(id, '中地圖：' + M.name + (save.cleared[id] ? ' ✓' : ''), M.desc + '・撐 5 分鐘', mapOpen(id), M.need ? `過咗${M.need === 'big' ? '愛河大戰' : MIDS[M.need].name}先開` : '跟主線解鎖')).join('')}
      ${Object.entries(BIGS).filter(([, B]) => B.city === tab).map(([id, B]) => mission(id, '大地圖：' + B.name + (save.cleared[id] ? ' ✓' : ''), B.desc, mapOpen(id), B.why || '跟主線解鎖')).join('')}
    </div>
    ${msg ? `<p class="msg">${msg}</p>` : ''}
    <p class="tiny"><button class="link" id="cheat">全部解鎖（試玩用）</button>・<button class="link" id="wipe">重置存檔</button></p>`;
  ov.hidden = false;
  card.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    const id = el.dataset.r, act = el.dataset.act;
    if (act === 'pick') { save.team = [...teamIds(), id].slice(-3); writeSave(save); }
    else if (act === 'drop') { save.team = teamIds().filter(x => x !== id); writeSave(save); }
    else if (act === 'level') levelUp(save, id);
    else if (act === 'treat') treat(save, id);
    else if (act === 'recruit') { if (recruit(save, id)) { save.team = [...teamIds(), id].slice(-3); writeSave(save); return showSafehouse(`${esc(hero(id).name)} 加入咗！`); } }
    showSafehouse();
  }));
  card.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { cityTab = null; startMission(b.dataset.go); });
  card.querySelectorAll('[data-city]').forEach(b => b.onclick = e => { e.stopPropagation(); cityTab = b.dataset.city; showSafehouse(); });
  $('#cheat').onclick = () => { for (const id in { ...MIDS, ...BIGS }) save.cleared[id] = true; unlockAll(save); showSafehouse('已經全部解鎖：資源 300、通用碎片 30。'); };
  $('#wipe').onclick = () => { if (confirm('重置存檔？所有進度會清走。')) { save = resetSave(); showSafehouse('存檔已重置。'); } };
}

// ---- 開波 ----
// 主線嗰章：第一次出擊先播對白
async function startMission(id) {
  const ch = currentChapter(save);
  if (ch?.mission !== id) return start(id, null);
  if (id === 'street') await getMap('big'); // 對白要用今日條街嘅名
  save.story ||= { done: [] };
  save.story.seen ||= {};
  const first = !save.story.seen[ch.id];
  save.story.seen[ch.id] = true;
  writeSave(save);
  playScene(ch.title, first ? ch.intro : [], () => start(id, ch));
}
async function start(id, chapter = null) {
  const team = teamIds();
  if (team.length < 1) { showSafehouse('最少要揀 1 個隊友。'); return; }
  card.innerHTML = '<p>載入緊地圖…</p>';
  const spec = hid => ({ role: hero(hid).role, heroId: hid, name: hero(hid).name, lvl: save.heroes[hid].lvl, injured: save.heroes[hid].injured });
  const rescueRoll = () => rollSurvivor(new Set(owned(save)));
  try {
    if (id === 'street') {
      const map = await getMap('big');
      scene = createStreetScene(map, { day, captains: team.map(spec), rescue: rescueRoll });
      runInfo = { id, kind: 'street', team };
    } else if (BIGS[id]) {
      const map = await getMap(id);
      const extra = owned(save).filter(r => !team.includes(r) && !save.heroes[r].injured).slice(0, 1);
      const four = [...team, ...extra];
      scene = createBigScene(map, { team: [{ role: 'player' }, ...four.map(spec)], maxZombies: mobile ? 200 : 280, spots: BIGS[id].spots, hard: BIGS[id].hard });
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
  sel = -1; $('#selHint').hidden = true;
  runInfo.chapter = chapter; runInfo.cues = new Set();
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
  const members = kind === 'street' ? [] : scene.squad.filter(m => m.role !== 'player');
  const squadOut = kind === 'street'
    ? scene.caps.map(c => ({ heroId: c.heroId, state: 'ok' })) // 小地圖唔會受傷
    : members.filter(m => !m.guest).map(m => ({ heroId: m.heroId, state: kind === 'big' ? ((m.deaths || 0) >= 2 ? 'dead' : 'ok') : m.state }));
  const recruits = members.filter(m => m.guest && m.state !== 'dead' && (kind !== 'big' || (m.deaths || 0) < 2)).map(m => m.heroId); // 即時加入又捱到最後：正式入隊
  const xp = kind === 'street' ? 30 + s.kills * 0.2 : kind === 'big' ? (win ? 200 : 80) + s.kills * 0.1 : (win ? 80 : 30) + s.kills * 0.05;
  const loot = { ...s.loot };
  if (kind === 'mid' && win) { loot.food += 30; loot.meds += 12; loot.parts += 15; loot.ammo += 15; }
  if (kind === 'big' && win) { loot.food += 80; loot.meds += 40; loot.parts += 50; loot.ammo += 50; }
  const shards = (s.shards || 0) + (kind === 'big' && win ? 3 : 0);
  const { got, joined } = applyResult(save, { win, loot, shards, charShards: s.charShards, recruits, xp: Math.round(xp), squad: squadOut, mapId: kind === 'street' ? null : runInfo.id, street: kind === 'street' && win ? 1 : 0 });
  const hurtNow = squadOut.filter(m => m.state === 'dead').map(m => hero(m.heroId)?.name).filter(Boolean);
  const found = Object.entries(s.charShards || {}).map(([id, n]) => `${hero(id)?.name}（${hero(id)?.rarity}）×${n}`);
  const title = kind === 'street' ? (win ? `衝到 ${esc(s.street)} 街尾！` : '小隊全滅') : kind === 'big' ? (win ? '打爆咗喪屍巢穴！' + BIGS[runInfo.id].won : '主城失守') : (win ? `過關！${esc(MIDS[runInfo.id].name)}暫時安全` : '全軍覆沒');
  const stat = kind === 'street' ? `<div><span>跑咗</span><b>${Math.round(s.s)} 米</b></div><div><span>擊殺</span><b>${s.kills}</b></div>`
    : `<div><span>${kind === 'big' ? '打咗' : '撐咗'}</span><b>${mmss(s.t)}</b></div><div><span>擊殺</span><b>${s.kills}</b></div>`;
  const ch = runInfo.chapter;
  if (ch && win) finishChapter(ch);
  card.className = 'card';
  card.innerHTML = `
    <p class="eyebrow">${win ? '任務完成' : '任務失敗・資源只帶返一半'}</p>
    ${ch ? `<p class="msg">${win ? '主線完成：' + esc(ch.title) : esc(ch.lose || '')}</p>` : ''}
    ${ch && win && ch.reward?.hero ? `<p class="msg">${esc(hero(ch.reward.hero)?.name || "新隊友")} 加入咗隊伍！</p>` : ''}
    <h2>${title}</h2>
    <div class="res">${stat}${Object.entries(got).filter(([, v]) => v).map(([k, v]) => `<div><span>${RES_NAMES[k]}</span><b>+${v}</b></div>`).join('')}${shards ? `<div><span>通用碎片</span><b>+${shards}</b></div>` : ''}</div>
    <p>每個隊友經驗 +${Math.round(xp)}。${hurtNow.length ? `受傷：${esc(hurtNow.join('、'))}（下一場抖一場，或者帶傷上陣）` : ''}</p>
    ${found.length ? `<p>救到嘅屍城日誌角色（專屬碎片）：${esc(found.join('、'))}</p>` : ''}
    ${joined.length ? `<p class="msg">正式入隊：${esc(joined.map(id => hero(id).name).join('、'))}！</p>` : ''}
    ${kind === 'mid' && win && runInfo.id === 'yancheng' && !save.cleared.qixian ? '<p class="msg">解鎖咗鄰近街區：七賢路！</p>' : ''}
    ${kind === 'mid' && win && runInfo.id === 'qixian' ? '<p class="msg">兩個街區都佔領咗：大地圖「愛河大戰」開放！</p>' : ''}
    <button class="go" id="go">返安全屋</button>`;
  ov.hidden = false;
  $('#go').onclick = () => { scene = backdrop; if (ch && win) playScene(ch.title, ch.win, () => showSafehouse()); else showSafehouse(); };
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
    buildSquadRows();
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
function buildSquadRows() {
  squadEl.innerHTML = scene.squad.map(m => `<li class="r-${m.role}${m.guest ? ' guest' : ''}"><b>${esc(m.name)}</b><span>${m.role === 'player' ? '' : esc(m.label) + (m.guest ? '・幫手' : ' Lv' + m.lvl)}</span><i><em></em></i><small></small></li>`).join('');
  rows = [...squadEl.children].map(li => ({ li, bar: li.querySelector('em'), note: li.querySelector('small') }));
  rows.forEach((r, k) => r.li.classList.toggle('sel', k === sel));
}
squadEl.addEventListener('pointerdown', e => {
  const li = e.target.closest('li');
  if (!li || scene?.kind !== 'big' || mode !== 'play') return;
  const i = [...squadEl.children].indexOf(li);
  if (i > 0) { e.preventDefault(); selectAlly(i); }
});
function setCommand(c) {
  if (!scene?.command || mode === 'title') return;
  if (scene.kind === 'big' && sel > 0) return scene.command(c, sel); // 淨係派揀咗嗰個
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
    if (e.key === 'Escape') { if (sel > 0) selectAlly(sel); return closeDispatch(); }
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
function closeDispatch() { dispId = null; dispEl.hidden = true; dispEl._html = ''; }
// 面板每 0.1 秒更新一次數字；只有內容真係變咗先換 HTML，掣用「撳落」觸發（唔使等放手），咁先撳得到
function renderDispatch() {
  if (!dispId || scene?.kind !== 'big') return closeDispatch();
  const d = scene.info(dispId);
  const html = `
    <header><b>${esc(d.name)}</b><span>${Math.round(d.hp)}/${Math.round(d.maxHp)}</span><button class="x" data-do="close" aria-label="關閉">✕</button></header>
    <p>守點隊友 ${d.guards.length}/${d.cap}・守備兵 ${d.soldierN}・零件 ${d.parts}</p>
    <div class="dlist">${d.allies.map(a => `<div><b>${esc(a.name)}</b><span>${a.state !== 'ok' ? (a.state === 'dead' ? '復活中' : '倒地') : a.here ? '守緊呢度' : a.mode?.kind === 'garrison' ? '守緊第度' : '跟隊'}</span>
      ${a.here ? `<button data-do="recall" data-r="${a.idx}">召回</button>` : `<button data-do="assign" data-r="${a.idx}" ${d.guards.length >= d.cap ? 'disabled' : ''}>派去守</button>`}</div>`).join('')}</div>
    <div class="drow"><button data-do="squad" ${d.parts >= BIG.squadCost && d.soldierN < 6 ? '' : 'disabled'}>造守備小隊（零件 ${BIG.squadCost}）</button><button data-do="upgrade" ${d.parts >= BIG.upgradeCost ? '' : 'disabled'}>升級（零件 ${BIG.upgradeCost}）</button></div>`;
  if (html !== dispEl._html) { dispEl.innerHTML = html; dispEl._html = html; }
}
dispEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled || !dispId) return;
  e.preventDefault();
  const r = Number(b.dataset.r);
  switch (b.dataset.do) {
    case 'close': return closeDispatch();
    case 'assign': scene.assign(dispId, r); break;
    case 'recall': scene.recallAlly(r); break;
    case 'squad': scene.buildSquad(dispId); break;
    case 'upgrade': scene.upgrade(dispId); break;
  }
  renderDispatch();
});
const mm = $('#minimap'), mmCtx = mm.getContext('2d');
// 小地圖：撳邊度鏡頭就去邊度睇（可以拖住移）；淨係撳一下而又撳中建築，就開派遣面板
let mmDrag = null;
const mmPos = e => { const r = mm.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
mm.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (!scene?.lookAt) return;
  mm.setPointerCapture(e.pointerId);
  mmDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  if (sel < 0) scene.lookAt(...mmPos(e)); // 揀咗人時，撳一下係派人，唔係移鏡頭
});
mm.addEventListener('pointermove', e => {
  if (!mmDrag || e.pointerId !== mmDrag.id) return;
  if (Math.hypot(e.clientX - mmDrag.x, e.clientY - mmDrag.y) > 6) mmDrag.moved = true;
  scene.lookAt(...mmPos(e));
});
const mmEnd = e => {
  if (!mmDrag || e.pointerId !== mmDrag.id) return;
  if (!mmDrag.moved && e.type === 'pointerup' && scene.kind === 'big') {
    const [fx, fy] = mmPos(e), id = scene.tapMinimap(fx, fy);
    if (sel > 0) { if (id) scene.assign(id, sel); else scene.sendTo(sel, fx * scene.size, fy * scene.size); }
    else if (id) openDispatch(id);
  }
  mmDrag = null;
};
mm.addEventListener('pointerup', mmEnd);
mm.addEventListener('pointercancel', mmEnd);
$('#lookBack').addEventListener('pointerdown', e => { e.preventDefault(); scene?.lookBack?.(); });

let hudT = 0, toastT = 0, radioT = 0;
// 打緊嘅時候，隊友用無線電講嘢（唔會停低遊戲）
function radioSay(c) {
  const S = speaker(c.who), el = $('#radio');
  el.innerHTML = `<b>${esc(S.name)}</b>${esc(fillText(c.text))}`;
  el.hidden = false;
  radioT = 6;
}
const toastQ = [];
function hud(dt) {
  const s = scene.state;
  const ch = runInfo?.chapter;
  if (ch?.radio) for (const c of ch.radio) if (!runInfo.cues.has(c) && ((c.t != null && s.t >= c.t) || (c.s != null && s.s >= c.s))) { runInfo.cues.add(c); radioSay(c); }
  if (radioT > 0 && (radioT -= dt) <= 0) $('#radio').hidden = true;
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
    $('#lookBack').hidden = !scene.isLooking();
  } else {
    $('#time').textContent = Math.round(s.s) + 'm';
    $('#v1').textContent = s.kills; $('#v2').textContent = s.shards;
    $('#prog').style.width = (s.s / s.len * 100) + '%';
    $('#crossName').textContent = s.cross ? '路口：' + s.cross : '';
    [...capsEl.querySelectorAll('button')].forEach((b, i) => { const c = scene.caps[i]; b.querySelector('em').textContent = c.alive ? c.n + (c.tier > 1 ? ' ★' + c.tier : '') : '倒下'; b.classList.toggle('on', s.target === i); b.classList.toggle('dead', !c.alive); });
  }
  if (kind !== 'street' && rows.length !== scene.squad.length) buildSquadRows(); // 有倖存者加入
  if (kind !== 'street') scene.squad.forEach((m, i) => {
    const r = rows[i]; if (!r) return;
    r.bar.style.width = (m.hp / m.maxHp) * 100 + '%';
    r.li.dataset.state = m.state;
    const where = kind === 'big' && m.mode ? { follow: '跟你', garrison: '守點', lane: ['推上路', '推中路', '推下路'][m.mode.lane], boss: '打Boss', base: '守城', point: '去指定點' }[m.mode.kind] : '';
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
  if (mode === 'play' || mode === 'cards') { hud(dt); scene.renderMinimap?.(mmCtx, mm.width); if (scene.isLooking) $('#lookBack').hidden = !scene.isLooking(); }
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
