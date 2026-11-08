// 主線劇情：序章 → 五章。每章有出擊前嘅對白（intro）、打緊時嘅無線電（radio）、贏咗之後嘅對白（win）。
// who：'narr' 旁白、'radio' 無線電、'you' 你，或者英雄 id（tank、medic、dps、control、support、zb_u_shen…）。
// radio 用時間（秒）觸發；街道衝鋒用距離（米，s）。{street} 會換成今日條街嘅名。
// 地方用真實地名，但所有人物、船名、事件都係虛構。

export const CHAPTERS = [
  {
    id: 'prologue', title: '序章　海晏號', mission: null,
    intro: [
      { who: 'narr', text: '港灣市封城第二十一日。電視仍然講「情況受控」，但已經冇人信。' },
      { who: 'narr', text: '凌晨，一艘冇人應無線電嘅貨櫃船「海晏號」，自己飄入高雄港，撞埋三號碼頭。' },
      { who: 'radio', text: '……港警呼叫……碼頭有人咬人……重複，碼頭有人咬人……請求支援……' },
      { who: 'narr', text: '朝早七點，鹽埕。你返嚟執拾阿嫲留低嘅舊騎樓屋，大勇路靜得出奇。' },
      { who: 'narr', text: '然後，第一聲尖叫由港邊傳過嚟。' },
      { who: 'tank', text: '喂！你！唔好企喺度！鹽埕分隊得返我一架車，入面仲有空位——上車！' },
      { who: 'dps', text: '車死火咗。阿坤，佢哋由五福四路嗰邊嚟緊，起碼幾十隻。' },
      { who: 'medic', text: '我係附近診所嘅護士小芳。後面藥房有藥，有人受傷可以帶過嚟。' },
      { who: 'tank', text: '好，聽住：阿傑攞住條街口，小芳顧住傷者，你……識唔識揸槍？' },
      { who: 'you', text: '……唔識都要識。' },
    ],
    win: [],
  },
  {
    id: 'c1', title: '第一章　鹽埕第一夜', mission: 'yancheng', goal: '喺鹽埕街區撐 5 分鐘，等阿坤駁通分隊',
    intro: [
      { who: 'tank', text: '架車個無線電仲有電。我要五分鐘駁通分隊，叫佢哋派人嚟。' },
      { who: 'dps', text: '五分鐘。三個人一支槍，加你。' },
      { who: 'medic', text: '受傷就返嚟藥房個綠圈，我幫你包紮。唔好逞強。' },
      { who: 'tank', text: '我哋四個，守住呢幾條街。一個都唔准倒低喺度。' },
    ],
    radio: [
      { t: 8, who: 'medic', text: '藥房喺度，企入綠色虛線圈就會慢慢補血。' },
      { t: 45, who: 'dps', text: '有人喺巷入面叫救命——白色嗰點，企喺佢身邊就救到。' },
      { t: 95, who: 'tank', text: '分隊冇人應……再試多次。撐住！' },
      { t: 150, who: 'medic', text: '嗰啲淺紫色嘅會尖叫，叫更多過嚟。見到就集火佢！' },
      { t: 238, who: 'dps', text: '……嗰隻大嘢係乜嚟？！全部人退後，放大招！' },
      { t: 285, who: 'tank', text: '最後幾十秒！唔好鬆手！' },
    ],
    win: [
      { who: 'narr', text: '天光。街上嘅屍體終於唔再郁。' },
      { who: 'tank', text: '……分隊覆咗我。成個分隊，得返一個人應——係錄音。' },
      { who: 'medic', text: '即係冇人會嚟。' },
      { who: 'dps', text: '咁我哋就自己嚟。騎樓二樓有間舊照相館，鐵閘夠厚，可以做安全屋。' },
      { who: 'tank', text: '由今日起，呢度就係我哋嘅地方。' },
    ],
    lose: '天未光，你哋已經守唔住。再嚟過。',
  },
  {
    id: 'c2', title: '第二章　學校嘅燈', mission: 'street', goal: '沿住今日條大街衝到街尾，救出發燈號嘅人',
    intro: [
      { who: 'narr', text: '第三晚。照相館天台望出去，成個鹽埕得返一點光。' },
      { who: 'dps', text: '學校方向，化學室。一長兩短……係摩斯碼。' },
      { who: 'dps', text: '「化、學、室……三、人……有、火……求、救」。' },
      { who: 'tank', text: '要過去，就要沿住{street}衝。大街好闊，屍好多，但係最快。' },
      { who: 'medic', text: '我哋人少，沿路撿多啲被困嘅人一齊走。' },
      { who: 'you', text: '揀邊度過，睇門。好嘅門射多幾槍，數字仲會升。' },
    ],
    radio: [
      { s: 60, who: 'dps', text: '前面啲門：綠色加人，紅色扣人。射紅門射到夠，會變返綠。' },
      { s: 180, who: 'tank', text: '路上油桶！射爆佢，炸埋附近嘅屍。' },
      { s: 330, who: 'medic', text: '籠入面有人！射開個籠救佢哋出嚟！' },
      { s: 520, who: 'control', text: '……收到嗎？我係陳老師！我見到你哋喇！' },
      { s: 640, who: 'control', text: '街尾有隻好大嘅……佢一直企喺學校門口，唔肯走！' },
    ],
    win: [
      { who: 'control', text: '你哋……真係嚟咗。我仲以為個燈號冇人睇得明。' },
      { who: 'control', text: '我姓陳，教化學。呢幾日我發現兩樣嘢：第一，佢哋怕火。' },
      { who: 'control', text: '第二，佢哋唔係亂咁行。佢哋好似聽住某種好低沉嘅聲，一齊向東面行。' },
      { who: 'tank', text: '東面……愛河。' },
      { who: 'control', text: '我實驗室仲有啲材料，整得出汽油彈。帶埋我走啦。' },
      { who: 'narr', text: '陳老師加入咗隊伍。' },
    ],
    lose: '小隊衝唔到街尾。學校嘅燈仲閃緊，再試一次。',
    reward: { hero: 'control' },
  },
  {
    id: 'c3', title: '第三章　七賢路之夜', mission: 'qixian', goal: '夜晚喺七賢路街區撐 5 分鐘：用警局武器同油站',
    intro: [
      { who: 'radio', text: '喂喂？有冇人？我係送外賣嘅阿明，困咗喺七賢路！' },
      { who: 'support', text: '我知條街每一個後巷！派出所槍房我睇住佢哋鎖咗，仲有個油站——' },
      { who: 'control', text: '油站？如果引晒佢哋過去，一下……' },
      { who: 'tank', text: '夜晚出去好危險。不過如果有槍，又有一個熟路嘅人……值得。' },
      { who: 'medic', text: '帶夠手電筒。夜晚佢哋行得特別快。' },
    ],
    radio: [
      { t: 6, who: 'support', text: '派出所喺南邊！入去個藍圈拎武器，全隊傷害加好多！' },
      { t: 40, who: 'control', text: '油站喺北邊。企入圈點火，四秒之後爆——記住走開！' },
      { t: 110, who: 'support', text: '……河對面點解有光？好似成群嘢喺度郁……' },
      { t: 175, who: 'dps', text: '尖叫屍又嚟，先打佢。' },
      { t: 240, who: 'tank', text: '大隻嗰隻！引佢去油站！' },
    ],
    win: [
      { who: 'support', text: '多謝晒！我叫阿明，送咗五年外賣，鹽埕每條巷我都識。' },
      { who: 'narr', text: '你哋行上七賢橋。天就嚟光，愛河東岸嘅景象令所有人停低。' },
      { who: 'narr', text: '幾千隻喪屍圍住一座建築，疊成一座肉山。一下、一下，好似心跳。' },
      { who: 'control', text: '就係呢個聲。佢哋聽住嘅……就係呢個。' },
      { who: 'dps', text: '一個巢。' },
      { who: 'narr', text: '阿明加入咗隊伍。' },
    ],
    lose: '七賢路嘅夜太長。再嚟過。',
    reward: { hero: 'support' },
  },
  {
    id: 'c4', title: '第四章　港灣市嚟嘅人', mission: null,
    intro: [
      { who: 'narr', text: '第七日。一隻漁船沿住愛河口慢慢駛入，船頭企住一個人。' },
      { who: 'zb_u_shen', text: '唔好開槍。我冇變——我唔會變。' },
      { who: 'tank', text: '你邊個？' },
      { who: 'zb_u_shen', text: '沈默。由港灣市嚟。嗰邊……已經冇乜人。' },
      { who: 'zb_u_shen', text: '我被咬過，但冇事。Grace Holloway 醫生話我係抗體宿主。佢叫我將呢本筆記帶出嚟。' },
      { who: 'control', text: '（揭筆記）……「母體」？' },
      { who: 'zb_u_shen', text: '每一個巢都有一個母體，用嗰個低頻聲叫晒附近嘅屍。母體死咗，屍群會亂，會散。' },
      { who: 'zb_u_shen', text: '港灣市嘅母體我哋冇打到。你哋嘅……仲有機會。' },
      { who: 'support', text: '要過河，得三條橋：七賢橋、中正橋、高雄橋。' },
      { who: 'dps', text: '巢外面有三個屍巢擋住。要先拆一個，巢穴先打得入。' },
      { who: 'tank', text: '咁就三條路一齊推。照相館做主城，沿路起塔。' },
      { who: 'narr', text: '沈默加入咗隊伍。大地圖「愛河大戰」準備好。' },
    ],
    win: [],
    reward: { hero: 'zb_u_shen' },
  },
  {
    id: 'c5', title: '第五章　愛河決戰', mission: 'big', goal: '三路過河，拆屍巢，打爆愛河東岸嘅巢穴',
    intro: [
      { who: 'zb_u_shen', text: '記住：巢穴有層殼。先拆一個屍巢，殼先會破。' },
      { who: 'tank', text: '主城同箭塔要有人守。派邊個去，你話事——撳個名，再撳地圖。' },
      { who: 'support', text: '野區有物資同被困嘅人，有空就去拎。' },
      { who: 'control', text: '火準備好。' },
      { who: 'medic', text: '大家……活住返嚟。' },
    ],
    radio: [
      { t: 10, who: 'zb_u_shen', text: '三條路都有屍湧過嚟。睇小地圖，紅格係屍巢。' },
      { t: 70, who: 'tank', text: '箭塔血少會求救，小地圖會閃紅。派人過去！' },
      { t: 180, who: 'support', text: '野區 Boss 出咗！打低佢，我哋啲兵會勁好多。' },
      { t: 295, who: 'zb_u_shen', text: '……佢嚟咗。喪屍王會揀我哋最弱嗰條路打。' },
      { t: 480, who: 'medic', text: '撐住！夜晚嚟喇，跟住光行。' },
      { t: 720, who: 'dps', text: '巢穴心跳變快咗——佢都驚。' },
    ],
    win: [
      { who: 'narr', text: '母體最後一下心跳，好似一聲好長嘅嘆氣。' },
      { who: 'narr', text: '東岸嘅屍群停低，然後好似失咗方向咁，向四面八方散開。' },
      { who: 'control', text: '成功咗……佢哋唔再一齊行。' },
      { who: 'tank', text: '鹽埕守住咗。' },
      { who: 'zb_u_shen', text: '多謝。我要將呢個方法帶返港灣市。嗰邊仲有人等緊。' },
      { who: 'medic', text: '你一個人？' },
      { who: 'zb_u_shen', text: '……如果你哋肯嚟，就唔係一個人。' },
      { who: 'narr', text: '第一部完。鹽埕、七賢路同愛河兩岸已經佔領，所有地圖可以自由出擊；遲啲會有更多街區同港灣市。' },
    ],
    lose: '主城失守。退返照相館，重整再嚟。',
  },
];

export const chapterById = id => CHAPTERS.find(c => c.id === id);

// 而家要做邊一章（未完成嘅第一章）
export function currentChapter(save) {
  const done = new Set(save.story?.done || []);
  return CHAPTERS.find(c => !done.has(c.id)) || null;
}

export function completeChapter(save, id) {
  save.story ||= { done: [] };
  if (!save.story.done.includes(id)) save.story.done.push(id);
}
