// 主線劇情：序章 → 五章。每章有出擊前嘅對白（intro）、打緊時嘅無線電（radio）、贏咗之後嘅對白（win）。
// who：'narr' 旁白、'radio' 無線電、'you' 你，或者英雄 id（tank、medic、dps、control、support、zb_u_shen…）。
// radio 用時間（秒）觸發；街道衝鋒用距離（米，s）。{street} 會換成今日條街嘅名。
// 地方用真實地名，但所有人物、船名、事件都係虛構。

export const CHAPTERS = [
  {
    id: 'prologue', title: '序章　海晏號', mission: null, part: '第一部：高雄',
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
      { who: 'narr', text: '第一部完。鹽埕、七賢路同愛河兩岸已經佔領；高雄嘅六合夜市同旗津亦都可以去。' },
    ],
    lose: '主城失守。退返照相館，重整再嚟。',
  },
  // ======== 第二部：香港 ========
  {
    id: 'hk0', title: '第六章　海晏號嘅艙單', mission: null, part: '第二部：香港',
    intro: [
      { who: 'narr', text: '愛河之後第三日。阿明喺海晏號船艙搵到一本濕咗嘅艙單。' },
      { who: 'support', text: '呢隻船唔係由港灣市直接嚟。佢中途停過四個港：香港、基隆、橫濱、大阪。' },
      { who: 'zb_u_shen', text: '每個港都落過貨。Grace 嘅筆記話：母體係由貨櫃入面嘅「種」長出嚟。' },
      { who: 'control', text: '即係……四個城市，可能已經各有一個巢。' },
      { who: 'tank', text: '照相館交俾鹽埕啲街坊。我哋跟住艙單行，一個港一個港咁拆。' },
      { who: 'radio', text: '……呢度係旺角……仲有冇人聽到……我哋喺西洋菜街一座唐樓頂……' },
      { who: 'zb_u_shen', text: '第一站，香港。' },
      { who: 'narr', text: '第二部「香港」開始。安全屋可以揀香港嘅地圖。' },
    ],
    win: [],
  },
  {
    id: 'hk1', title: '第七章　旺角唐樓', mission: 'hk-mongkok', goal: '喺旺角撐 5 分鐘，接應唐樓頂嘅倖存者',
    intro: [
      { who: 'narr', text: '彌敦道塞滿死車。招牌一個疊一個，好多已經跌落街。' },
      { who: 'radio', text: '我係阿飛！我喺天台之間跳嚟跳去先避得開佢哋。你哋喺街守住，我帶人落嚟！' },
      { who: 'dps', text: '街窄、人多、屍多。散開就死，記住跟住隊。' },
      { who: 'medic', text: '藥房喺邊？……好，小地圖上面綠色嗰啲。' },
    ],
    radio: [
      { t: 10, who: 'radio', text: '阿飛：我睇到你哋！再撐多陣，我搵緊落嚟條路！' },
      { t: 90, who: 'support', text: '後巷好多屍湧出嚟，唔好企喺巷口！' },
      { t: 170, who: 'radio', text: '阿飛：有個阿伯行唔郁……再俾我一分鐘！' },
      { t: 260, who: 'tank', text: '最後一輪！頂住！' },
    ],
    win: [
      { who: 'zb_s_fei', text: '十二個人，一個都冇少。多謝晒！' },
      { who: 'zb_s_fei', text: '你哋搵巢？我喺天台見過——海旁嗰邊，夜晚會有低沉嘅聲。' },
      { who: 'zb_u_shen', text: '尖沙咀。' },
      { who: 'narr', text: '阿飛加入咗隊伍。' },
    ],
    lose: '旺角嘅街太窄。再嚟過。',
    reward: { hero: 'zb_s_fei' },
  },
  {
    id: 'hk2', title: '第八章　鐘樓下', mission: 'hk-tst', goal: '夜晚喺尖沙咀撐 5 分鐘，搵出低頻聲嘅來源',
    intro: [
      { who: 'narr', text: '夜晚。維港對岸一片黑，得返海旁嘅鐘樓仲企喺度。' },
      { who: 'zb_s_fei', text: '聲係由海底隧道入口嗰邊傳出嚟。' },
      { who: 'control', text: '屍群會跟住聲行。我哋喺佢哋條路上面，要頂住。' },
    ],
    radio: [
      { t: 8, who: 'zb_u_shen', text: '夜晚佢哋快好多。跟住街燈行。' },
      { t: 120, who: 'zb_s_fei', text: '隧道口有嘢郁緊……好大。' },
      { t: 220, who: 'control', text: '聲停咗一下——佢知道我哋喺度！' },
    ],
    win: [
      { who: 'narr', text: '天光。隧道口嘅肉牆萎縮咗，但係心跳聲冇停。' },
      { who: 'zb_u_shen', text: '呢個唔係母體，只係觸鬚。真身喺海峽對面——中環。' },
    ],
    lose: '尖沙咀嘅夜太長。再嚟過。',
  },
  {
    id: 'hk3', title: '第九章　中環斜路', mission: 'hk-central', goal: '喺中環撐 5 分鐘，打爆香港嘅母體',
    intro: [
      { who: 'narr', text: '中環。玻璃幕牆碎晒，石板街上面一級級都係屍。' },
      { who: 'radio', text: '……後生仔，我喺皇后大道中。我知道條船點解會嚟——我幫佢哋簽過張單。' },
      { who: 'tank', text: '你邊個？' },
      { who: 'radio', text: '何定邦。以前做疊碼仔，而家……想贖罪。' },
    ],
    radio: [
      { t: 10, who: 'dps', text: '斜路！喺高處企好，等佢哋行上嚟。' },
      { t: 150, who: 'radio', text: '何定邦：母體喺舊銀行大廈地庫，等佢出嚟就係機會！' },
      { t: 240, who: 'zb_u_shen', text: '佢出嚟喇！全部大招！' },
    ],
    win: [
      { who: 'narr', text: '香港嘅母體倒低。整個港島嘅屍群好似突然失咗魂。' },
      { who: 'zb_s_ho', text: '艙單上面下一個港係基隆。貨櫃第二日就用貨車運咗入台北。' },
      { who: 'zb_s_ho', text: '我同你哋去。我欠嘅，我要還。' },
      { who: 'narr', text: '何定邦加入咗隊伍。第二部完。' },
    ],
    lose: '中環守唔住。退返海旁，再嚟。',
    reward: { hero: 'zb_s_ho' },
  },
  // ======== 第三部：台北 ========
  {
    id: 'tp0', title: '第十章　基隆港', mission: null, part: '第三部：台北',
    intro: [
      { who: 'narr', text: '船泊基隆。港口嘅貨櫃門全部向外打開，好似有嘢由入面爬出嚟。' },
      { who: 'support', text: '台北我熟！我阿叔喺西門町開麵線舖。' },
      { who: 'radio', text: '……這裡是西門町紅樓，我們有十幾個人，有食物，但是快守不住了……' },
      { who: 'tank', text: '有食物？咁仲等乜。' },
      { who: 'narr', text: '第三部「台北」開始。安全屋可以揀台北嘅地圖。' },
    ],
    win: [],
  },
  {
    id: 'tp1', title: '第十一章　紅樓', mission: 'tp-ximen', goal: '喺西門町撐 5 分鐘，守住紅樓嘅倖存者',
    intro: [
      { who: 'narr', text: '西門町。行人專用區嘅招牌仲著住，喇叭重複播緊同一首歌。' },
      { who: 'radio', text: '我是林阿明，夜市總舖師！紅樓裡面有一大鍋湯，你們撐住，我請大家吃！' },
      { who: 'support', text: '又一個阿明……' },
    ],
    radio: [
      { t: 12, who: 'radio', text: '林阿明：喇叭會引牠們過來，想辦法離遠一點！' },
      { t: 140, who: 'medic', text: '藥房喺邊？我哋傷員多咗。' },
      { t: 250, who: 'radio', text: '林阿明：湯好了！再撐一下！' },
    ],
    win: [
      { who: 'zb_s_lin', text: '來來來，先吃飯。天塌下來都要吃飯先講。' },
      { who: 'zb_s_lin', text: '那些東西每晚都往東邊走，往信義區，往 101 那邊。' },
      { who: 'narr', text: '林阿明加入咗隊伍。' },
    ],
    lose: '紅樓失守。再嚟過。',
    reward: { hero: 'zb_s_lin' },
  },
  {
    id: 'tp2', title: '第十二章　一〇一之夜', mission: 'tp-xinyi', goal: '夜晚喺信義區撐 5 分鐘，打爆台北嘅母體',
    intro: [
      { who: 'narr', text: '夜晚。101 冇晒燈，但係樓底下有一團暗紅色嘅光，一閃一閃。' },
      { who: 'zb_u_shen', text: '母體揀咗最高嗰座樓。佢想個聲傳得更遠。' },
      { who: 'control', text: '汽油彈夠晒。今晚燒乾淨佢。' },
    ],
    radio: [
      { t: 10, who: 'zb_s_ho', text: '廣場好闊，唔好俾佢哋包圍。' },
      { t: 130, who: 'support', text: '佢哋由捷運站湧出嚟！' },
      { t: 240, who: 'zb_u_shen', text: '母體出嚟喇！' },
    ],
    win: [
      { who: 'narr', text: '天光。台北嘅心跳聲停咗。' },
      { who: 'zb_s_ho', text: '下一站，橫濱。貨櫃運咗入東京。' },
      { who: 'narr', text: '第三部完。' },
    ],
    lose: '信義區太闊，守唔住。再嚟過。',
  },
  // ======== 第四部：東京 ========
  {
    id: 'tk0', title: '第十三章　無聲嘅東京', mission: null, part: '第四部：東京',
    intro: [
      { who: 'narr', text: '東京灣。一千幾萬人嘅城市，靜到聽到烏鴉叫。' },
      { who: 'radio', text: '（日文）……有冇人收到？我係渡邊，秋葉原。我一直聽住軍方頻道……' },
      { who: 'zb_u_shen', text: '佢講佢截到軍方訊號：自衛隊喺新宿設咗最後防線，但係已經失聯三日。' },
      { who: 'dps', text: '先去澀谷，同佢會合。' },
      { who: 'narr', text: '第四部「東京」開始。安全屋可以揀東京嘅地圖。' },
    ],
    win: [],
  },
  {
    id: 'tk1', title: '第十四章　十字路口', mission: 'tk-shibuya', goal: '喺澀谷撐 5 分鐘，等渡邊趕到',
    intro: [
      { who: 'narr', text: '澀谷。世界最繁忙嘅十字路口，而家四面八方都係屍。' },
      { who: 'tank', text: '路口太闊，四邊都會嚟。守住中間！' },
    ],
    radio: [
      { t: 15, who: 'radio', text: '渡邊：我喺車站，啲閘口鎖死咗，俾我幾分鐘！' },
      { t: 150, who: 'control', text: '佢哋好似識得包抄……東京啲屍唔同。' },
      { t: 260, who: 'radio', text: '渡邊：開咗！我嚟緊！' },
    ],
    win: [
      { who: 'narr', text: '渡邊健司揹住一部改裝收音機跑出嚟。' },
      { who: 'zb_r_kenji', text: '新宿防線最後一段訊息：「歌舞伎町，地底有嘢」。' },
    ],
    lose: '十字路口四面受敵。再嚟過。',
  },
  {
    id: 'tk2', title: '第十五章　歌舞伎町', mission: 'tk-shinjuku', goal: '夜晚喺新宿撐 5 分鐘，打爆東京嘅母體',
    intro: [
      { who: 'narr', text: '新宿。夜晚嘅歌舞伎町冇晒燈，只得遠處一下下嘅心跳聲。' },
      { who: 'zb_r_kenji', text: '我可以用收音機干擾佢嘅低頻聲，但係要時間。' },
      { who: 'zb_u_shen', text: '你哋守住，佢負責收音機。' },
    ],
    radio: [
      { t: 10, who: 'zb_r_kenji', text: '干擾開始。佢哋會亂一陣，但係母體會好嬲。' },
      { t: 160, who: 'zb_r_kenji', text: '頻率鎖定！母體喺地鐵出口下面！' },
      { t: 250, who: 'zb_u_shen', text: '佢出嚟喇——收尾！' },
    ],
    win: [
      { who: 'narr', text: '東京嘅母體倒低。收音機入面，自衛隊嘅頻道傳嚟一句：「收到。多謝。」' },
      { who: 'zb_r_kenji', text: '艙單最後一個港：大阪。我同你哋去。' },
      { who: 'narr', text: '渡邊健司加入咗隊伍。第四部完。' },
    ],
    lose: '歌舞伎町嘅夜太黑。再嚟過。',
    reward: { hero: 'zb_r_kenji' },
  },
  // ======== 第五部：大阪 ========
  {
    id: 'os0', title: '第十六章　最後一個港', mission: null, part: '第五部：大阪',
    intro: [
      { who: 'narr', text: '大阪港。海晏號嘅最後一批貨櫃，就喺呢度落。' },
      { who: 'zb_u_shen', text: 'Grace 筆記最後一頁：「最早嘅種，最大嘅母體」。' },
      { who: 'radio', text: '……道頓堀……我喺橋底……有一個用刀嘅女人救咗我哋……' },
      { who: 'tank', text: '用刀？' },
      { who: 'narr', text: '第五部「大阪」開始。安全屋可以揀大阪嘅地圖。' },
    ],
    win: [],
  },
  {
    id: 'os1', title: '第十七章　道頓堀', mission: 'os-dotonbori', goal: '夜晚喺道頓堀撐 5 分鐘，同用刀嘅人會合',
    intro: [
      { who: 'narr', text: '道頓堀。河兩邊嘅大招牌熄晒，河面浮住好多嘢。' },
      { who: 'dps', text: '河邊窄，橋上面好守。' },
    ],
    radio: [
      { t: 12, who: 'radio', text: '（遠處）……右邊！再右邊！' },
      { t: 150, who: 'control', text: '有人喺橋上面斬緊屍——一個人！' },
      { t: 255, who: 'tank', text: '過去幫佢！' },
    ],
    win: [
      { who: 'zb_u_mio', text: '宮本澪。京都嚟嘅。我本來喺港灣市表演，一直斬到返日本。' },
      { who: 'zb_u_mio', text: '你哋要搵嘅嘢喺新世界，通天閣下面。我去過，一個人入唔到去。' },
      { who: 'narr', text: '宮本澪加入咗隊伍。' },
    ],
    lose: '道頓堀守唔住。再嚟過。',
    reward: { hero: 'zb_u_mio' },
  },
  {
    id: 'os2', title: '第十八章　通天閣', mission: 'os-shinsekai', goal: '喺新世界撐 5 分鐘，打爆最大嘅母體',
    intro: [
      { who: 'narr', text: '新世界。通天閣成座塔被肉膜包住，好似一條巨大嘅脈。' },
      { who: 'zb_u_shen', text: '最早嘅種。打低佢，艙單上面嘅所有巢都會失去源頭。' },
      { who: 'tank', text: '由鹽埕一路到呢度。最後一次——一個都唔准倒低。' },
    ],
    radio: [
      { t: 10, who: 'zb_u_mio', text: '佢哋會由塔底湧出嚟，守住街口！' },
      { t: 120, who: 'zb_r_kenji', text: '低頻聲好強，干擾頂唔住！' },
      { t: 200, who: 'zb_s_fei', text: '塔頂有嘢郁緊——好大！' },
      { t: 270, who: 'zb_u_shen', text: '就係而家！' },
    ],
    win: [
      { who: 'narr', text: '通天閣嘅肉膜一層層剝落。遠至香港、台北、東京，屍群同一刻停低。' },
      { who: 'control', text: '……完咗？' },
      { who: 'zb_u_shen', text: '艙單上面嘅都完咗。但係海晏號最初由邊度出發？' },
      { who: 'zb_s_ho', text: '……港灣市。' },
      { who: 'tank', text: '咁就去港灣市。' },
      { who: 'narr', text: '全部章節完。所有地圖可以自由出擊；港灣市篇，遲啲再講。' },
    ],
    lose: '通天閣下面太危險。退返道頓堀，再嚟。',
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
