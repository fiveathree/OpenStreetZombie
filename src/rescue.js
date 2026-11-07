// 共用救人：被困倖存者係屍城日誌嘅角色。救到一定有佢嘅專屬碎片，仲有機會即刻加入幫手（最多 2 個）。
// 加入咗又捱到最後，結算時就正式入隊。
import { rollSurvivor, JOIN_CHANCE } from './heroes.js';
import { createMember } from './squad.js';

export const MAX_GUESTS = 2;

// st 要有 charShards（{id: n}）同 shards；返回加入咗嘅隊員或者 null
export function rescue(st, squad, at, toast) {
  const c = rollSurvivor(new Set(squad.map(m => m.heroId)));
  if (!c) { st.shards++; toast('救到倖存者！招募碎片 +1'); return null; }
  st.charShards[c.id] = (st.charShards[c.id] || 0) + 1;
  st.rescued = (st.rescued || 0) + 1;
  if (squad.filter(m => m.guest).length < MAX_GUESTS && Math.random() < (JOIN_CHANCE[c.rarity] ?? 0.4)) {
    const m = createMember(c.role, at.x, at.y, { heroId: c.id, lvl: 1, guest: true });
    squad.push(m);
    toast(`${c.name}（${c.rarity}）即刻加入幫手！`);
    return m;
  }
  toast(`救到 ${c.name}（${c.rarity}・${c.job}）！專屬碎片 +1`);
  return null;
}
