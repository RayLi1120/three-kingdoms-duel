/* 三國對弈 — data model. Heroes with 5 stats + 4 distinct skills, and the class counter-triangle.
   This is the reworked turn-based model (vs. the old auto-battler). Pure data + helpers; no DOM. */

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
      { name: "拖刀計", power: 1.5, cd: 2, type: "atk", fx: "pierce",  desc: "破甲 150%，無視護盾" },
      { name: "武聖之威", power: 0, cd: 3, type: "buff", fx: "atkup",   desc: "自身攻擊+50%，淨化" },
      { name: "威震華夏", power: 1.9, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  lu_bu: {
    name: "呂布", emblem: "呂", cls: "猛", lv: 42,
    maxHp: 3000, atk: 160, spd: 110, crit: 25, armor: 0.08,
    skills: [
      { name: "方天畫戟", power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "無雙亂舞", power: 1.6, cd: 2, type: "atk", fx: "pierce", desc: "破甲 160%，無視護盾" },
      { name: "赤兔追風", power: 0,   cd: 3, type: "buff", fx: "rage",  desc: "捨身換取攻擊+疾風" },
      { name: "轅門射戟", power: 2.1, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  ma_chao: {
    name: "馬超", emblem: "馬", cls: "猛", lv: 42,
    maxHp: 3050, atk: 146, spd: 112, crit: 22, armor: 0.09,
    skills: [
      { name: "銀月槍",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "西涼鐵騎", power: 1.4, cd: 2, type: "atk", fx: "slow",   desc: "衝鋒 140% + 遲緩" },
      { name: "獅盔耀世", power: 0,   cd: 3, type: "buff", fx: "atkup", desc: "自身攻擊+50%，淨化" },
      { name: "錦馬超",   power: 2.0, cd: 0, type: "ult", fx: "nuke",   desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  xu_chu: {
    name: "許褚", emblem: "褚", cls: "猛", lv: 42,
    maxHp: 3300, atk: 138, spd: 86, crit: 16, armor: 0.12,
    skills: [
      { name: "裸衣鬥",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "虎癡蠻力", power: 1.3, cd: 2, type: "atk", fx: "stun",   desc: "重擊，可能暈眩" },
      { name: "虎衛親軍", power: 0,   cd: 3, type: "buff", fx: "shield", desc: "護盾 + 嘲諷" },
      { name: "力拔山兮", power: 2.1, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  huang_zhong: {
    name: "黃忠", emblem: "黃", cls: "猛", lv: 42,
    maxHp: 2950, atk: 150, spd: 92, crit: 28, armor: 0.08,
    skills: [
      { name: "定軍弓",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "百步穿楊", power: 1.4, cd: 2, type: "atk", fx: "pierce", desc: "穿透 140%，無視護盾" },
      { name: "老當益壯", power: 0,   cd: 3, type: "buff", fx: "atkup", desc: "自身攻擊+50%，淨化" },
      { name: "神射定軍", power: 2.2, cd: 0, type: "ult", fx: "nuke",   desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  sun_ce: {
    name: "孫策", emblem: "策", cls: "猛", lv: 42,
    maxHp: 3050, atk: 145, spd: 106, crit: 22, armor: 0.09,
    skills: [
      { name: "霸王槍",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "江東猛虎", power: 1.5, cd: 2, type: "atk", fx: "pierce", desc: "破甲 150%，無視護盾" },
      { name: "小霸王",   power: 0,   cd: 3, type: "buff", fx: "rage",  desc: "捨身換取攻擊+疾風" },
      { name: "傳國玉璽", power: 2.0, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },

  // ───────── 守 Resilient — 高血厚甲、控場護盾 ─────────
  zhang_fei: {
    name: "張飛", emblem: "飛", cls: "守", lv: 42,
    maxHp: 3460, atk: 118, spd: 78, crit: 10, armor: 0.18,
    skills: [
      { name: "蛇矛",   power: 1.0, cd: 0, type: "atk", fx: "slow",   desc: "傷害 + 遲緩" },
      { name: "據水斷橋", power: 0, cd: 2, type: "buff", fx: "shield", desc: "嘲諷 + 護盾" },
      { name: "燕人咆哮", power: 1.1, cd: 3, type: "atk", fx: "stun",  desc: "暈眩 + 遲緩" },
      { name: "萬軍辟易", power: 0, cd: 0, type: "ult", fx: "heal",    desc: "治療 + 淨化（需戰意）" },
    ],
  },
  zhao_yun: {
    name: "趙雲", emblem: "趙", cls: "守", lv: 42,
    maxHp: 3300, atk: 128, spd: 96, crit: 16, armor: 0.15,
    skills: [
      { name: "龍膽槍",   power: 1.0, cd: 0, type: "atk", fx: "bleed", desc: "100% 傷害，可能流血" },
      { name: "七進七出", power: 1.3, cd: 2, type: "atk", fx: "stun",  desc: "突陣，可能暈眩" },
      { name: "一身是膽", power: 0,   cd: 3, type: "buff", fx: "dodge", desc: "閃避 + 淨化" },
      { name: "單騎救主", power: 0,   cd: 0, type: "ult", fx: "heal",  desc: "治療 + 淨化（需戰意）" },
    ],
  },
  xiahou_dun: {
    name: "夏侯惇", emblem: "惇", cls: "守", lv: 42,
    maxHp: 3400, atk: 124, spd: 80, crit: 12, armor: 0.17,
    skills: [
      { name: "矛盾交擊", power: 1.0, cd: 0, type: "atk", fx: "slow",   desc: "傷害 + 遲緩" },
      { name: "拔矢啖睛", power: 1.3, cd: 2, type: "atk", fx: "pierce", desc: "破甲 130%，無視護盾" },
      { name: "獨目悍將", power: 0,   cd: 3, type: "buff", fx: "atkup", desc: "自身攻擊+50%，淨化" },
      { name: "烈魂衝陣", power: 1.9, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  cao_ren: {
    name: "曹仁", emblem: "仁", cls: "守", lv: 42,
    maxHp: 3550, atk: 116, spd: 74, crit: 10, armor: 0.20,
    skills: [
      { name: "鐵壁槍",   power: 1.0, cd: 0, type: "atk", fx: "slow",   desc: "傷害 + 遲緩" },
      { name: "拒守樊城", power: 1.1, cd: 3, type: "atk", fx: "stun",   desc: "鎮守，可能暈眩" },
      { name: "金城湯池", power: 0,   cd: 2, type: "buff", fx: "shield", desc: "護盾 + 嘲諷" },
      { name: "將軍金甲", power: 0,   cd: 0, type: "ult", fx: "heal",   desc: "治療 + 淨化（需戰意）" },
    ],
  },
  dian_wei: {
    name: "典韋", emblem: "韋", cls: "守", lv: 42,
    maxHp: 3350, atk: 132, spd: 82, crit: 14, armor: 0.15,
    skills: [
      { name: "雙鐵戟",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "帳前飛戟", power: 1.3, cd: 2, type: "atk", fx: "stun",   desc: "飛戟，可能暈眩" },
      { name: "古之惡來", power: 0,   cd: 3, type: "buff", fx: "shield", desc: "護盾 + 嘲諷" },
      { name: "死戰不退", power: 1.9, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  huang_gai: {
    name: "黃蓋", emblem: "蓋", cls: "守", lv: 42,
    maxHp: 3450, atk: 120, spd: 80, crit: 12, armor: 0.16,
    skills: [
      { name: "鐵鞭",     power: 1.0, cd: 0, type: "atk", fx: "slow",   desc: "傷害 + 遲緩" },
      { name: "火船突陣", power: 1.4, cd: 2, type: "atk", fx: "burn",   desc: "火攻 + 灼燒" },
      { name: "受刑明志", power: 0,   cd: 3, type: "buff", fx: "shield", desc: "護盾 + 嘲諷" },
      { name: "縱火焚船", power: 2.2, cd: 0, type: "ult", fx: "burn",   desc: "大範圍灼燒（需戰意）" },
    ],
  },

  // ───────── 謀 Cunning — 高攻速暴擊、狀態與爆發 ─────────
  zhou_yu: {
    name: "周瑜", emblem: "瑜", cls: "謀", lv: 42,
    maxHp: 2680, atk: 158, spd: 112, crit: 15, armor: 0.05,
    skills: [
      { name: "樂律",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "苦肉計", power: 0,   cd: 3, type: "buff", fx: "rage",     desc: "獻血換取攻擊+疾風" },
      { name: "連環計", power: 1.2, cd: 2, type: "atk", fx: "lock",     desc: "鎖定 + 破綻" },
      { name: "火燒赤壁", power: 2.2, cd: 0, type: "ult", fx: "burn",    desc: "大範圍灼燒（需戰意）" },
    ],
  },
  zhuge_liang: {
    name: "諸葛亮", emblem: "亮", cls: "謀", lv: 42,
    maxHp: 2540, atk: 150, spd: 90, crit: 15, armor: 0.05,
    skills: [
      { name: "羽扇",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "空城計", power: 0,   cd: 2, type: "buff", fx: "dodge",   desc: "閃避 + 淨化" },
      { name: "八陣圖", power: 1.0, cd: 3, type: "atk", fx: "stun",     desc: "暈眩 + 遲緩" },
      { name: "借東風", power: 2.0, cd: 0, type: "ult", fx: "nuke",     desc: "疾風 + 爆發（需戰意）" },
    ],
  },
  sima_yi: {
    name: "司馬懿", emblem: "懿", cls: "謀", lv: 42,
    maxHp: 2650, atk: 156, spd: 104, crit: 16, armor: 0.06,
    skills: [
      { name: "鷹視狼顧", power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "堅壁拒戰", power: 1.2, cd: 2, type: "atk", fx: "lock",    desc: "鎖定 + 破綻" },
      { name: "韜光養晦", power: 0,   cd: 3, type: "buff", fx: "dodge",  desc: "閃避 + 淨化" },
      { name: "鷹揚河洛", power: 2.1, cd: 0, type: "ult", fx: "nuke",    desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  guo_jia: {
    name: "郭嘉", emblem: "嘉", cls: "謀", lv: 42,
    maxHp: 2520, atk: 162, spd: 114, crit: 18, armor: 0.05,
    skills: [
      { name: "鬼才",     power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "十勝十敗", power: 1.3, cd: 2, type: "atk", fx: "pierce",  desc: "洞察弱點 130%，無視護盾" },
      { name: "遺計定遼", power: 0,   cd: 3, type: "buff", fx: "atkup",  desc: "自身攻擊+50%，淨化" },
      { name: "天妒英才", power: 2.2, cd: 0, type: "ult", fx: "nuke",    desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  pang_tong: {
    name: "龐統", emblem: "統", cls: "謀", lv: 42,
    maxHp: 2580, atk: 158, spd: 100, crit: 16, armor: 0.05,
    skills: [
      { name: "鳳雛策",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "鐵索連環", power: 1.2, cd: 2, type: "atk", fx: "lock",    desc: "鎖定 + 破綻" },
      { name: "醉理百事", power: 0,   cd: 3, type: "buff", fx: "atkup",  desc: "自身攻擊+50%，淨化" },
      { name: "鳳雛驚世", power: 2.1, cd: 0, type: "ult", fx: "nuke",    desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  lu_xun: {
    name: "陸遜", emblem: "遜", cls: "謀", lv: 42,
    maxHp: 2600, atk: 154, spd: 108, crit: 16, armor: 0.06,
    skills: [
      { name: "儒將劍",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "火攻連營", power: 1.4, cd: 2, type: "atk", fx: "burn",    desc: "火攻 + 灼燒" },
      { name: "後發制人", power: 0,   cd: 3, type: "buff", fx: "dodge",  desc: "閃避 + 淨化" },
      { name: "火燒七百里", power: 2.2, cd: 0, type: "ult", fx: "burn",  desc: "大範圍灼燒（需戰意）" },
    ],
  },
  jia_xu: {
    name: "賈詡", emblem: "詡", cls: "謀", lv: 42,
    maxHp: 2620, atk: 152, spd: 102, crit: 15, armor: 0.06,
    skills: [
      { name: "算無遺策", power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "亂武毒謀", power: 1.3, cd: 2, type: "atk", fx: "bleed",   desc: "毒傷，可能流血" },
      { name: "明哲保身", power: 0,   cd: 3, type: "buff", fx: "atkup",  desc: "自身攻擊+50%，淨化" },
      { name: "毒士之謀", power: 2.0, cd: 0, type: "ult", fx: "rend",    desc: "撕裂 + 破綻（需戰意）" },
    ],
  },

  // ───────── 奇 Wildcard — 無剋制邊、刺客與奇門 ─────────
  diao_chan: {
    name: "貂蟬", emblem: "貂", cls: "奇", lv: 42,
    maxHp: 2700, atk: 140, spd: 110, crit: 18, armor: 0.07,
    skills: [
      { name: "閉月舞",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "連環美人", power: 1.2, cd: 2, type: "atk", fx: "lock",    desc: "鎖定 + 破綻" },
      { name: "傾國傾城", power: 0,   cd: 3, type: "buff", fx: "dodge",  desc: "閃避 + 淨化" },
      { name: "鳳儀亭",   power: 2.0, cd: 0, type: "ult", fx: "nuke",    desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  hua_tuo: {
    name: "華佗", emblem: "華", cls: "奇", lv: 42,
    maxHp: 2750, atk: 130, spd: 96, crit: 14, armor: 0.09,
    skills: [
      { name: "青囊刀",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "麻沸散",   power: 1.2, cd: 2, type: "atk", fx: "stun",   desc: "麻醉，可能暈眩" },
      { name: "五禽戲",   power: 0,   cd: 3, type: "buff", fx: "dodge", desc: "閃避 + 淨化" },
      { name: "青囊回春", power: 0,   cd: 0, type: "ult", fx: "heal",   desc: "治療 + 淨化（需戰意）" },
    ],
  },
  zuo_ci: {
    name: "左慈", emblem: "慈", cls: "奇", lv: 42,
    maxHp: 2680, atk: 148, spd: 112, crit: 18, armor: 0.06,
    skills: [
      { name: "擲杯戲",   power: 1.0, cd: 0, type: "atk", fx: "distract", desc: "傷害 + 擾亂" },
      { name: "神行符",   power: 1.3, cd: 2, type: "atk", fx: "slow",    desc: "符咒 + 遲緩" },
      { name: "分身術",   power: 0,   cd: 3, type: "buff", fx: "dodge",  desc: "閃避 + 淨化" },
      { name: "五嶽遁形", power: 2.1, cd: 0, type: "ult", fx: "nuke",    desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  gan_ning: {
    name: "甘寧", emblem: "甘", cls: "奇", lv: 42,
    maxHp: 2850, atk: 150, spd: 116, crit: 24, armor: 0.07,
    skills: [
      { name: "錦帆賊",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "百騎劫營", power: 1.5, cd: 2, type: "atk", fx: "pierce", desc: "夜襲 150%，無視護盾" },
      { name: "鈴聲奪魄", power: 0,   cd: 3, type: "buff", fx: "rage",  desc: "捨身換取攻擊+疾風" },
      { name: "錦帆夜襲", power: 2.1, cd: 0, type: "ult", fx: "rend",   desc: "撕裂 + 破綻（需戰意）" },
    ],
  },
  taishi_ci: {
    name: "太史慈", emblem: "太", cls: "奇", lv: 42,
    maxHp: 2900, atk: 146, spd: 108, crit: 22, armor: 0.08,
    skills: [
      { name: "神射手",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "神亭酣鬥", power: 1.4, cd: 2, type: "atk", fx: "pierce", desc: "酣鬥 140%，無視護盾" },
      { name: "信義篤烈", power: 0,   cd: 3, type: "buff", fx: "atkup", desc: "自身攻擊+50%，淨化" },
      { name: "北海揚名", power: 2.0, cd: 0, type: "ult", fx: "nuke",   desc: "爆發 + 破綻（需戰意）" },
    ],
  },
  sun_shangxiang: {
    name: "孫尚香", emblem: "尚", cls: "奇", lv: 42,
    maxHp: 2780, atk: 138, spd: 114, crit: 22, armor: 0.07,
    skills: [
      { name: "弓腰姬",   power: 1.0, cd: 0, type: "atk", fx: "bleed",  desc: "100% 傷害，可能流血" },
      { name: "連弩疾射", power: 1.3, cd: 2, type: "atk", fx: "slow",   desc: "連射 + 遲緩" },
      { name: "巾幗志",   power: 0,   cd: 3, type: "buff", fx: "dodge", desc: "閃避 + 淨化" },
      { name: "梟姬奪魄", power: 2.0, cd: 0, type: "ult", fx: "nuke",   desc: "爆發 + 破綻（需戰意）" },
    ],
  },
};

const ROSTER = Object.keys(HERO_DB);

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

if (typeof module !== "undefined") module.exports = { HERO_DB, ROSTER, makeUnit, triMult, randomIds, CLASS_BEATS, CLASS_NAME, CLASS_COLOR };
