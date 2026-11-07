# 屍城戰線（暫定名）

用 OpenStreetMap 真實街道做戰場嘅末世喪屍遊戲。完整計劃睇 [PLAN.md](PLAN.md)。

而家做到：**第 1 階段：中地圖 demo**。高雄鹽埕區一個大約 400 米嘅街區，你＋3 個 AI 隊友，撐夠 5 分鐘喪屍潮。

- 網址（開咗 GitHub Pages 之後）：https://fiveathree.github.io/OpenStreetZombie/

## 玩法

| | 電腦 | 手機 |
|---|---|---|
| 移動 | WASD／方向鍵（或者撳住滑鼠拖） | 撳住畫面任何位置拖動（虛擬搖桿） |
| 攻擊 | 自動 | 自動 |
| 指揮 | 1 跟我、2 散開、3 守住、4 集火（或者撳右下角） | 撳右下角四個掣 |

- **跟我**：隊友企喺你身邊，坦克喺前、醫療喺後。
- **散開**：隊友散開大約 8 米，睇住唔同方向。
- **守住**：隊友企喺撳掣嗰陣嘅位置唔郁（地上有 ✕）。
- **集火**：全隊優先打你附近最硬嗰隻（紅色準星）。
- **藥房 ✚**：企喺虛線圈入面自動補血；藥用完要等一陣先再有。
- **倒地**：隊員血清咗會倒地，20 秒內有隊友企喺身邊就救得返（醫療救得快一倍）。你自己死咗，或者全隊同時倒地，就輸。
- **升級**：殺屍儲經驗，每次升級三選一，可以強化你、某個隊友，或者全隊。
- 第 100 秒、180 秒、275 秒有屍潮；第 240 秒屍王出場。

## 喺自己部機開

遊戲用 ES modules 同 `fetch` 讀地圖，所以要經網頁伺服器開，唔可以直接雙擊 `index.html`：

```bash
npx http-server -c-1
```

然後開 http://localhost:8080 。

## 發佈（GitHub Pages）

repo 頂部 **Settings → Pages → Build and deployment**：Source 揀 **Deploy from a branch**，Branch 揀 `main`、資料夾揀 `/ (root)`，撳 **Save**。唔使建置。

## 檔案

| 檔案 | 做乜 |
|---|---|
| `index.html`、`style.css` | 頁面同 HUD |
| `src/map.js` | **共用**：讀地圖 JSON、整導航格（行得／行唔得）、視線、貼牆滑行、畫地圖 |
| `src/flowfield.js` | **共用**：流場圖，成群喪屍共用一張路線圖 |
| `src/stats.js` | **共用**：職業、喪屍、屍潮、升級卡數值。改難度改呢度 |
| `src/squad.js` | **共用**：隊員、受傷、倒地互救、自動攻擊 |
| `src/ally-ai.js` | **共用**：隊友 AI 五步：跟住你 → 揀目標 → 放技能 → 救人 → 執行指令 |
| `src/spatial.js` | 空間網格，快速搵附近喪屍 |
| `src/input.js` | 鍵盤同虛擬搖桿 |
| `src/scenes/mid.js` | 中地圖場景：出屍、屍潮、藥房、畫面 |
| `data/yancheng.json` | 預處理好嘅鹽埕區地圖 |
| `tools/fetch-osm.mjs` | 一次性：用 Overpass API 下載街區，轉成上面個 JSON |
| `tools/og.html` | 用真遊戲畫面整分享圖 `og.png` 同 `icon-180.png` |

## 換地圖

```bash
node tools/fetch-osm.mjs 22.6244 120.2838 200 data/yancheng.json
```

參數：中心緯度、經度、半徑（米）、輸出檔。OSM 喺台灣嘅建築輪廓唔齊，所以遊戲當「道路同空地以外」全部都係密集街屋（障礙物、擋子彈）。

## 重整分享圖

開住本機伺服器，然後用 Edge 或者 Chrome 無頭模式截圖：

```bash
msedge --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=30000 --screenshot=og.png http://localhost:8080/tools/og.html
```

```bash
msedge --headless=new --hide-scrollbars --window-size=180,180 --virtual-time-budget=30000 --screenshot=icon-180.png "http://localhost:8080/tools/og.html?icon"
```

## 技術

- 同截蛇大亂鬥（`fiveathree/snake`）一樣：純 HTML + Canvas 2D + JavaScript，空間網格做碰撞，鏡頭跟人，冇用框架、唔使建置。
- 喪屍尋路：道路光柵化成 2 米一格嘅導航格，用一張共用流場圖（BFS），唔係每隻屍自己計路。
- 地圖用瀏覽器 canvas 光柵化同畫；唔用 OSM 官方地圖圖塊。
- 字型：Google Fonts 嘅 Noto Sans TC 同 IBM Plex Mono。

## 授權

地圖資料 © OpenStreetMap contributors，以 [ODbL](https://www.openstreetmap.org/copyright) 授權。
