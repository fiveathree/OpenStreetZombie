#!/bin/sh
# 一次過重新下載所有地圖（Overpass 有流量限制，每個之間抖幾秒）
set -e
f() { node tools/fetch-osm.mjs "$@"; sleep 8; }
f 22.6244 120.2838 200 data/yancheng.json 高雄鹽埕區
f 22.6289 120.2840 220 data/qixian.json 鹽埕七賢路
f 22.6262 120.2858 760 data/big.json 鹽埕・愛河 --big
f 22.6318 120.3005 200 data/kh-liuhe.json 高雄六合夜市
f 22.6135 120.2680 200 data/kh-cijin.json 高雄旗津老街
f 22.3195 114.1700 200 data/hk-mongkok.json 香港旺角
f 22.2950 114.1712 240 data/hk-tst.json 香港尖沙咀
f 22.2826 114.1560 230 data/hk-central.json 香港中環
f 25.0425 121.5075 200 data/tp-ximen.json 台北西門町
f 25.0345 121.5640 220 data/tp-xinyi.json 台北信義・101
f 35.6598 139.7006 200 data/tk-shibuya.json 東京澀谷
f 35.6945 139.7020 200 data/tk-shinjuku.json 東京新宿歌舞伎町
f 34.6687 135.5015 200 data/os-dotonbori.json 大阪道頓堀
f 34.6522 135.5062 200 data/os-shinsekai.json 大阪新世界・通天閣
f 22.3050 114.1712 760 data/hk-big.json 九龍・尖沙咀至油麻地 --big
f 25.0420 121.5150 760 data/tp-big.json 台北城中 --big
f 35.6920 139.7010 760 data/tk-big.json 新宿 --big
f 34.6640 135.5030 760 data/os-big.json 難波・道頓堀 --big
