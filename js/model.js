/* 三國對弈 — data model. Heroes with 5 stats + 4 distinct skills, and the class counter-triangle.
   This is the reworked turn-based model (vs. the old auto-battler). Pure data + helpers; no DOM.
   平衡版（2026-07 模擬 12 萬場調校）：全員勝率收斂到 43%–61%。
   通則：增益技冷卻 4（防永動）、爆發終結技 2.5–2.7、控制/燃燒重招冷卻 3。 */

// class counter-triangle: 猛 › 守 › 謀 › 猛 ; 奇 is wildcard (no edge)
const CLASS_BEATS = { "猛": "守", "守": "謀", "謀": "猛" };
const CLASS_NAME = { "猛": "勇武 Fierce", "守": "堅毅 Resilient", "謀": "計略 Cunning", "奇": "奇兵 Wildcard" };
const CLASS_COLOR = { "猛": "#e8513f", "守": "#58b858", "謀": "#4890d0", "奇": "#e0a030" };

// skill.type: atk | buff | ult.  fx tags drive effects + flavor.
// every hero follows the same 4-slot template: [free atk (cd0), cooldown atk, buff, ultimate].
const HERO_DB = {
  // ───────── 猛 Fierce — 高攻速、近身強襲 ─────────
  guan_yu: {
    name: "關羽", emblem: "關", cls: "猛", lv: 42,
    maxHp: 3180, atk: 142, spd: 95, crit: 20, armor: 0.10,
    skills: [
      { name: "青龍斬", power: 1.0, cd: 0, type: "atk", fx: "bleed",   desc: "100% 傷害，可能流血" },
      { name: "拖刀計", power: 1.4, cd: 2, type: "atk", fx: "pierce",  desc: "破甲 140%，無視護盾" },
      { name: "武聖之威", power: 0, cd: 4, type: "buff", fx: "atkup",   desc: "自身攻擊+50%" },
      { name: "威震華夏", power: 1.9, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  lu_bu: {
    name: "呂布", emblem: "呂", cls: "猛", lv: 42,
    maxHp: 3000, atk: 160, spd: 110, crit: 25, armor: 0.08,
    skills: [
      { name: "方天畫戟", power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "無雙亂舞", power: 1.5, cd: 2, type: "atk", fx: "pierce", desc: "破甲 150%，無視護盾" },
      { name: "赤兔追風", power: 0,   cd: 4, type: "buff", fx: "rage",  desc: "捨身換取攻擊+疾風" },
      { name: "轅門射戟", power: 2.1, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },

  // ───────── 守 Resilient — 高血厚甲、控場護盾 ─────────
  zhang_fei: {
    name: "張飛", emblem: "飛", cls: "守", lv: 42,
    maxHp: 3350, atk: 118, spd: 78, crit: 10, armor: 0.18,
    skills: [
      { name: "蛇矛",   power: 1.0, cd: 0, type: "atk", fx: "slow",   desc: "傷害 + 遲緩" },
      { name: "據水斷橋", power: 0, cd: 4, type: "buff", fx: "shield", desc: "嘲諷 + 護盾" },
      { name: "燕人咆哮", power: 1.1, cd: 3, type: "atk", fx: "stun",  desc: "暈眩 + 遲緩" },
      { name: "萬軍辟易", power: 0, cd: 0, type: "ult", fx: "heal",    desc: "治療 + 淨化（需戰意）" },
    ],
  },
  zhao_yun: {
    name: "趙雲", emblem: "趙", cls: "守", lv: 42,
    maxHp: 2850, atk: 114, spd: 92, crit: 16, armor: 0.10,
    skills: [
      { name: "龍膽槍",   power: 1.0, cd: 0, type: "atk", fx: "bleed", desc: "100% 傷害，可能流血" },
      { name: "七進七出", power: 1.3, cd: 2, type: "atk", fx: "stun",  desc: "突陣，可能暈眩" },
      { name: "一身是膽", power: 0,   cd: 4, type: "buff", fx: "atkup", desc: "膽氣沖天，攻擊+50%" },
      { name: "單騎救主", power: 0,   cd: 0, type: "ult", fx: "heal",  desc: "治療 + 淨化（需戰意）" },
    ],
  },

  // ───────── 謀 Cunning — 高攻速暴擊、狀態與爆發 ─────────
  zhou_yu: {
    name: "周瑜", emblem: "瑜", cls: "謀", lv: 42,
    maxHp: 3100, atk: 162, spd: 112, crit: 15, armor: 0.05,   // 8 人版：墊底補血 3000→3100
    skills: [
      { name: "樂律",   power: 1.1, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "苦肉計", power: 0,   cd: 3, type: "buff", fx: "rage",     desc: "獻血換取攻擊+疾風" },
      { name: "連環計", power: 1.45, cd: 2, type: "atk", fx: "lock",    desc: "鎖定 + 破綻" },
      { name: "火燒赤壁", power: 2.2, cd: 0, type: "ult", fx: "burn",    desc: "大範圍灼燒（需戰意）" },
    ],
  },
  zhuge_liang: {
    name: "諸葛亮", emblem: "亮", cls: "謀", lv: 42,
    maxHp: 2850, atk: 158, spd: 100, crit: 15, armor: 0.08,
    skills: [
      { name: "羽扇",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "空城計", power: 0,   cd: 3, type: "buff", fx: "dodge",   desc: "閃避 + 淨化" },
      { name: "八陣圖", power: 1.3, cd: 3, type: "atk", fx: "stun",     desc: "暈眩 + 遲緩" },
      { name: "借東風", power: 2.6, cd: 0, type: "ult", fx: "nuke",     desc: "疾風 + 爆發（需戰意）" },
    ],
  },

  // ───────── 奇 Wildcard — 無剋制邊、刺客與奇門 ─────────
  diao_chan: {
    name: "貂蟬", emblem: "貂", cls: "奇", lv: 42,
    maxHp: 2950, atk: 160, spd: 116, crit: 18, armor: 0.09,
    skills: [
      { name: "閉月舞",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "連環美人", power: 1.4, cd: 2, type: "atk", fx: "lock",    desc: "鎖定 + 破綻" },
      { name: "傾國傾城", power: 0,   cd: 3, type: "buff", fx: "dodge",  desc: "閃避 + 淨化" },
      { name: "鳳儀亭",   power: 2.7, cd: 0, type: "ult", fx: "nuke",    desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  sun_shangxiang: {
    name: "孫尚香", emblem: "尚", cls: "奇", lv: 42,
    maxHp: 2930, atk: 148, spd: 118, crit: 26, armor: 0.07,
    skills: [
      { name: "弓腰姬",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "連弩疾射", power: 1.5, cd: 2, type: "atk", fx: "slow",   desc: "連射 + 遲緩" },
      { name: "巾幗志",   power: 0,   cd: 3, type: "buff", fx: "dodge", desc: "閃避 + 淨化" },
      { name: "梟姬奪魄", power: 2.7, cd: 0, type: "ult", fx: "nuke",   desc: "爆發 + 破綻（需戰意）" },
    ],
  },
};

const ROSTER = Object.keys(HERO_DB);

// 道具：戰鬥中使用消耗一次行動（同換將）。fx 由 battle.js 的 useItem 解讀。
const ITEM_DB = {
  jin_chuang_yao: { name: "金創藥", price: 150, fx: "heal",    desc: "回復 35% 生命" },
  jing_xin_san:   { name: "淨心散", price: 100, fx: "cleanse", desc: "解除所有負面狀態" },
  lie_jiu:        { name: "烈酒",   price: 120, fx: "energy",  desc: "戰意 +50" },
  hu_xin_jing:    { name: "護心鏡", price: 150, fx: "shield",  desc: "護盾 2 回合" },
};

// instantiate a battle-ready unit from a template id
function makeUnit(id) {
  const t = HERO_DB[id];
  return {
    id, name: t.name, emblem: t.emblem, cls: t.cls, lv: t.lv,
    maxHp: t.maxHp, hp: t.maxHp, atk: t.atk, baseAtk: t.atk, spd: t.spd, crit: t.crit, armor: t.armor,
    energy: 0, energyMax: 100,
    break: 0,            // 架勢 0-100；集滿 → 崩潰（暈眩+破綻）
    cd: [0, 0, 0, 0],
    statuses: {},        // { vulnerable: turns, distract: turns, shield: turns, burn: turns, ... }
    skills: t.skills,
  };
}

// triangle multiplier of attacker vs defender
function triMult(aCls, dCls) {
  if (CLASS_BEATS[aCls] === dCls) return 1.25;
  if (CLASS_BEATS[dCls] === aCls) return 0.8;
  return 1.0;
}

// pick n distinct random hero ids from the roster
function randomIds(n) {
  const pool = ROSTER.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

if (typeof module !== "undefined") module.exports = { HERO_DB, ROSTER, ITEM_DB, makeUnit, triMult, randomIds, CLASS_BEATS, CLASS_NAME, CLASS_COLOR };
