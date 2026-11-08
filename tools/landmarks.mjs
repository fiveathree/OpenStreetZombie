// 地標：手揀嘅出名地標（經緯度）＋ OSM 自己有嘅（淨係要有漢字、唔太長、冇假名嘅名）。
// fetch-osm.mjs 下載完會自動用；亦可以單獨行：node tools/landmarks.mjs data/*.json
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

export const CURATED = {
  'hk-mongkok': [['西洋菜南街', 22.3180, 114.1703], ['女人街', 22.3189, 114.1716], ['波鞋街', 22.3197, 114.1724], ['朗豪坊', 22.3184, 114.1685], ['旺角站', 22.3193, 114.1694]],
  'hk-tst': [['尖沙咀鐘樓', 22.2936, 114.1694], ['1881', 22.2953, 114.1703], ['文化中心', 22.2937, 114.1702], ['星光大道', 22.2932, 114.1739], ['半島酒店', 22.2951, 114.1718], ['尖沙咀站', 22.2976, 114.1722]],
  'hk-central': [['石板街', 22.2832, 114.1553], ['中環街市', 22.2843, 114.1556], ['置地廣場', 22.2810, 114.1585], ['中環站', 22.2820, 114.1580], ['大館', 22.2814, 114.1541], ['半山扶手電梯', 22.2826, 114.1545]],
  'tp-ximen': [['西門紅樓', 25.0420, 121.5068], ['西門町徒步區', 25.0435, 121.5065], ['西門站', 25.0420, 121.5082], ['電影街', 25.0453, 121.5063]],
  'tp-xinyi': [['台北101', 25.0340, 121.5645], ['台北市政府', 25.0375, 121.5637], ['新光三越', 25.0367, 121.5667], ['台北世貿中心', 25.0335, 121.5620]],
  'tk-shibuya': [['澀谷十字路口', 35.6595, 139.7005], ['忠犬八公像', 35.6590, 139.7006], ['澀谷站', 35.6580, 139.7016], ['SHIBUYA 109', 35.6596, 139.6988], ['中心街', 35.6605, 139.6990]],
  'tk-shinjuku': [['歌舞伎町一番街', 35.6937, 139.7020], ['哥斯拉頭', 35.6950, 139.7019], ['新宿區役所', 35.6938, 139.7036], ['西武新宿站', 35.6956, 139.7000], ['黃金街', 35.6940, 139.7045]],
  'os-dotonbori': [['固力果招牌', 34.6688, 135.5013], ['戎橋', 34.6688, 135.5016], ['法善寺', 34.6676, 135.5029], ['大阪松竹座', 34.6687, 135.4997], ['道頓堀川', 34.6684, 135.5040]],
  'os-shinsekai': [['通天閣', 34.6525, 135.5063], ['新世界本通', 34.6520, 135.5057], ['動物園前站', 34.6497, 135.5057], ['天王寺動物園', 34.6510, 135.5085]],
  'kh-liuhe': [['美麗島站', 22.6315, 120.3020], ['六合夜市', 22.6323, 120.2990]],
};

const HAN = /[一-鿿]/, KANA = /[぀-ヿ]/;
// 重複或者唔似地標嘅名
const BLOCK = new Set(['渋谷駅 A0', '涩谷', '渋谷', '東翼', '前水警總部', '心斋桥筋商店街', '天龍山法善寺', '臺北101/世貿', '台北101觀景台', '道頓堀川遊覽船']);
const okName = n => !BLOCK.has(n) && HAN.test(n) && !KANA.test(n) && [...n].length <= 9;

// data：fetch-osm 出嚟嘅 JSON；id：檔名（冇 .json）
export function mergeLandmarks(data, id) {
  const [lat, lon] = data.center, half = data.size / 2, R = 6378137, rad = Math.PI / 180;
  const proj = (la, lo) => [Math.round(((lo - lon) * rad * R * Math.cos(lat * rad) + half) * 10) / 10, Math.round((half - (la - lat) * rad * R) * 10) / 10];
  const out = [];
  const add = (name, x, y) => {
    if (x < 5 || y < 5 || x > data.size - 5 || y > data.size - 5) return;
    if (out.some(o => o.name === name || Math.hypot(o.x - x, o.y - y) < 35)) return;
    out.push({ name, x, y });
  };
  for (const [name, la, lo] of CURATED[id] || []) add(name, ...proj(la, lo));
  for (const l of data.landmarks || []) if (okName(l.name)) add(l.name, l.x, l.y);
  data.landmarks = out.slice(0, 12);
  return data;
}

if (process.argv[1]?.endsWith('landmarks.mjs')) {
  for (const f of process.argv.slice(2)) {
    if (f.includes('zomibee')) continue;
    const data = mergeLandmarks(JSON.parse(await readFile(f, 'utf8')), basename(f, '.json'));
    await writeFile(f, JSON.stringify(data));
    console.log(`${f}：${data.landmarks.map(l => l.name).join('、')}`);
  }
}
