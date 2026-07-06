/* 三國對弈 — battle engine + UI controller + animation driver. FRLG-style flow +
   Expedition 33-style timed combat: 光圈收合瞬間出手 → 強化攻擊；敵襲時 → 格擋反擊；架勢集滿 → 崩潰. */
(() => {
const $ = id => document.getElementById(id);
const FAST = /[?&]fast\b/.test(location.search);   // test mode: instant text, short waits
const wait = ms => new Promise(r => setTimeout(r, FAST ? Math.min(ms, 40) : ms));
const rand = p => Math.random() < p;

// 3v3 隊伍戰：ally/foe 指向出戰中的武將；Team 陣列存整隊
const state = { allyTeam: [], foeTeam: [], allyIdx: 0, foeIdx: 0, ally: null, foe: null, busy: true, over: false, combo: 0,
  stats: { turns: 0, perfect: 0, good: 0, miss: 0, dealt: 0, taken: 0, earned: 0 } };   // 戰報

// ---------- 銅錢與道具（localStorage 存檔）----------
// 擊倒敵將 +250、我將陣亡 +100（安慰獎）、勝利 +500、敗北 +150
const PAY = { foeKO: 250, allyKO: 100, win: 500, lose: 150 };
const SAVE_KEY = "sgdy_save";
const save = Object.assign({ money: 300, items: {} },
  (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })());
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
function addMoney(n) { save.money += n; persist(); paintMoney(); if (state.stats) state.stats.earned += n; sfx("coin"); }
function paintMoney() { const el = $("tsMoney"); if (el) el.textContent = `銅錢 ${save.money}`; }

// ---------- sound（WebAudio 合成，無音檔；M 鍵靜音，記憶在存檔）----------
let audioCtx = null;
function sfx(kind) {
  if (save.muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const tone = (freq, dur, type = "square", gain = 0.04, when = 0, slide = 0) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t + when);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + when + dur);
      g.gain.setValueAtTime(gain, t + when);
      g.gain.exponentialRampToValueAtTime(0.0001, t + when + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + when); o.stop(t + when + dur + 0.02);
    };
    switch (kind) {
      case "hit":     tone(160, 0.12, "sawtooth", 0.05, 0, -80); break;
      case "crit":    tone(120, 0.18, "sawtooth", 0.07, 0, -60); tone(1200, 0.08, "square", 0.03, 0.02); break;
      case "perfect": tone(880, 0.07, "square", 0.045); tone(1320, 0.09, "square", 0.045, 0.07); break;
      case "miss":    tone(220, 0.15, "triangle", 0.04, 0, -120); break;
      case "parry":   tone(1568, 0.05, "square", 0.05); tone(2093, 0.1, "square", 0.04, 0.05); break;
      case "heal":    tone(523, 0.09, "sine", 0.05); tone(784, 0.12, "sine", 0.05, 0.09); break;
      case "stagger": tone(90, 0.3, "sawtooth", 0.08, 0, -40); break;
      case "faint":   tone(330, 0.4, "triangle", 0.05, 0, -260); break;
      case "win":     [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "square", 0.05, i * 0.13)); break;
      case "lose":    [392, 330, 262].forEach((f, i) => tone(f, 0.2, "triangle", 0.05, i * 0.18)); break;
      case "coin":    tone(988, 0.05, "square", 0.035); tone(1319, 0.1, "square", 0.035, 0.05); break;
    }
  } catch {}
}
// debug/verification hooks: DUEL.forceQte = 'perfect'|'good'|'miss' resolves QTEs instantly
const DUEL = window.DUEL = { state, save, forceQte: null };

// ---------- rendering ----------
function paintUnit(side) {
  const u = side === "ally" ? state.ally : state.foe;
  $(`${side}Name`).textContent = u.name;
  $(`${side}Lv`).textContent = u.lv;
  const cls = $(`${side}Cls`); cls.textContent = u.cls; cls.style.background = CLASS_COLOR[u.cls];
  $(`${side}Emblem`).textContent = u.emblem;
  const sp = $(`${side}Sprite`).querySelector(".sprite-body");
  sp.style.backgroundColor = CLASS_COLOR[u.cls];
  sp.style.borderColor = CLASS_COLOR[u.cls];                                    // 職業色環
  sp.style.backgroundImage = `url(img/${u.id}${side === "ally" ? "_b" : ""}.png)`;   // _b＝我方鏡像立繪
  const pct = Math.max(0, u.hp / u.maxHp * 100);
  const hp = $(`${side}Hp`); hp.style.width = pct + "%";
  hp.style.background = pct > 50 ? "var(--hp-green)" : pct > 20 ? "var(--hp-amber)" : "var(--hp-red)";
  $(`${side}Bk`).style.width = (u.break || 0) + "%";
  $(`${side}En`).style.width = (u.energy / u.energyMax * 100) + "%";   // 敵我都顯示戰意（可預判終結技）
  if (side === "ally") $("allyHpNum").textContent = `${Math.max(0, Math.round(u.hp))}/ ${u.maxHp}`;
  // 剋制提示：▲ 我剋制對方 / ▼ 我被剋制 / — 無剋制
  if (state.ally && state.foe) {
    const t = triMult(state.ally.cls, state.foe.cls);
    const h = $("matchHint");
    h.textContent = t > 1 ? "▲" : t < 1 ? "▼" : "—";
    h.style.color = t > 1 ? "#3c8c3c" : t < 1 ? "#c23a2a" : "#8b93a7";
    h.title = t > 1 ? "你剋制對方（×1.25）" : t < 1 ? "你被剋制（×0.8）" : "互不剋制";
  }
}

// 隊伍狀態點：出戰中 / 存活 / 陣亡
function paintPips() {
  for (const side of ["ally", "foe"]) {
    const team = side === "ally" ? state.allyTeam : state.foeTeam;
    const idx = side === "ally" ? state.allyIdx : state.foeIdx;
    [...$(`${side}Pips`).children].forEach((p, i) => {
      const u = team[i];
      p.className = !u ? "" : u.hp <= 0 ? "dead" : i === idx ? "active" : "alive";
    });
  }
}

let typing = null;
function say(text, hold = 0) {
  return new Promise(res => {
    clearInterval(typing);
    const el = $("msg"); el.textContent = ""; let i = 0;
    if (FAST) { el.textContent = text; setTimeout(res, 30); return; }
    typing = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(typing); setTimeout(res, hold); }
    }, 22);
  });
}

function statusLine(u) {
  const tags = [];
  if (u.statuses.atkup) tags.push("鼓舞"); if (u.statuses.shield) tags.push("護盾");
  if (u.statuses.dodge) tags.push("閃避"); if (u.statuses.vulnerable) tags.push("破綻");
  if (u.statuses.distract) tags.push("擾亂"); if (u.statuses.slow) tags.push("遲緩");
  if (u.statuses.burn) tags.push("灼燒"); if (u.statuses.bleed) tags.push("流血");
  if (u.statuses.stun) tags.push("暈眩"); if (u.statuses.speed) tags.push("疾風");
  return tags;
}

// ---------- fx ----------
// center of a sprite in fx-layer cqw coords (y scaled ×0.667 because the stage is 3:2)
function spriteCenter(side) {
  const sp = $(`${side}Sprite`).getBoundingClientRect();
  const st = $("stage").getBoundingClientRect();
  return {
    cx: (sp.left - st.left + sp.width / 2) / st.width * 100,
    cy: (sp.top - st.top + sp.height / 2) / st.height * 100 * 0.667,
  };
}

function floatDmg(side, amount, kind) {
  const sp = $(`${side}Sprite`).getBoundingClientRect();
  const st = $("stage").getBoundingClientRect();
  const n = document.createElement("div");
  n.className = "dmg-num" + (kind === "crit" ? " crit" : "");
  n.textContent = kind === "heal" ? "+" + amount : amount;
  n.style.color = kind === "heal" ? "#5cd05c" : kind === "crit" ? "#ffd23f" : "#fff";
  n.style.left = (sp.left - st.left + sp.width * 0.3) / st.width * 100 + "cqw";
  n.style.top = (sp.top - st.top + sp.height * 0.1) / st.height * 100 * 0.667 + "cqw";
  $("fxLayer").appendChild(n);
  setTimeout(() => n.remove(), 1000);
}

// re-trigger a one-shot animation class even if it's already present (remove → reflow → add)
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// slash streak + expanding shockwave ring, centered on the struck unit
function impact(side, big) {
  const { cx, cy } = spriteCenter(side);
  const rot = (side === "foe" ? -22 : 22) + (Math.random() * 24 - 12);
  const ring = document.createElement("div");
  ring.className = "impact-ring" + (big ? " big" : "");
  ring.style.left = cx + "cqw"; ring.style.top = cy + "cqw";
  const slash = document.createElement("div");
  slash.className = "slash" + (big ? " big" : "");
  slash.style.left = cx + "cqw"; slash.style.top = cy + "cqw";
  slash.style.setProperty("--rot", rot + "deg");
  $("fxLayer").append(ring, slash);
  setTimeout(() => { ring.remove(); slash.remove(); }, 480);
}

function flash() { const f = document.createElement("div"); f.className = "flash"; $("fxLayer").appendChild(f); setTimeout(() => f.remove(), 240); }

async function lunge(side) {
  replay($(`${side}Sprite`), side === "ally" ? "lunge-ally" : "lunge-foe");
  await wait(230);   // peak thrust (~48% of the .5s lunge) lands as hit() fires
}
async function hit(side, big) {
  const sp = $(`${side}Sprite`);
  replay(sp, "hit");
  impact(side, big);          // static UI: 不震螢幕，大招回饋交給 flash/impact
  sfx(big ? "crit" : "hit");
  await wait(420);
  sp.classList.remove("hit");
}

// ---------- QTE (timed-input minigames) ----------
// 每招式有自己的輸入模式：ring 光圈 / seq 連按 / hold 蓄力 / targets 連擊；敵襲一律 parry 光圈。
// 硬派時機窗（ms）。parry 另依敵方速度再收窄（見 act）。
const QTE_CFG = {
  ring:   { dur: 850, perfect: 60, good: 170, label: "看準時機——光圈收合瞬間出手！" },
  parry:  { dur: 850, perfect: 75, good: 190, label: "敵襲——點擊或按空白鍵格擋！" },
  target: { dur: 650, perfect: 60, good: 150, label: "" },       // 連擊的單發（訊息由 targetsQte 統一顯示）
  seq:    { perKey: 700, perClick: 900, perfectFrac: 0.55 },
  hold:   { armWait: 1200, dur: 1100, sweetAt: 840, perfect: 65, good: 160 },
};
const KEY_POOL = ["W", "A", "S", "D", "J", "K"];

// common short-circuits: forced result (testing) / reduced-motion auto-good
function qteGuard() {
  if (DUEL.forceQte) return DUEL.forceQte;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "good";
  return null;
}

// 光圈：ring converges onto a target circle; press when they meet.
// opts: dx/dy 位移(cqw)、tighten 收窄時窗(ms)、aim 必須點中光圈、clickOnly 不收鍵盤、drift 光圈漂移。
function ringQte(kind, side, opts = {}) {
  const g = qteGuard(); if (g) return Promise.resolve(g);
  const cfg = QTE_CFG[kind];
  const pw = Math.max(45, cfg.perfect - (opts.tighten || 0));
  const gw = Math.max(pw + 55, cfg.good - (opts.tighten || 0) * 2);
  return new Promise(res => {
    const { cx, cy } = spriteCenter(side);
    const x = cx + (opts.dx || 0), y = cy + (opts.dy || 0);
    const tgt = document.createElement("div"); tgt.className = "qte-target" + (kind === "parry" ? " parry" : "");
    const ring = document.createElement("div"); ring.className = "qte-ring" + (kind === "parry" ? " parry" : "");
    for (const n of [tgt, ring]) { n.style.left = x + "cqw"; n.style.top = y + "cqw"; }
    ring.style.animationDuration = cfg.dur + "ms";
    $("fxLayer").append(tgt, ring);
    if (opts.drift) {                                      // 漂移目標：邊收合邊滑動
      void ring.offsetWidth;                               // 先提交起始位置（同步，不依賴 rAF）
      const ang = Math.random() * Math.PI * 2, dd = 7;
      const nx = x + Math.cos(ang) * dd, ny = y + Math.sin(ang) * dd * 0.5;
      for (const n of [tgt, ring]) {
        n.style.transition = `left ${cfg.dur}ms linear, top ${cfg.dur}ms linear`;
        n.style.left = nx + "cqw"; n.style.top = ny + "cqw";
      }
    }
    if (cfg.label) $("msg").textContent = cfg.label;
    const t0 = performance.now();
    let done = false;
    const finish = q => {
      if (done) return; done = true;
      clearTimeout(timer);
      ring.dataset.q = q;                                  // debug/測試可讀的判定結果
      $("stage").removeEventListener("pointerdown", onPress);
      document.removeEventListener("keydown", onKey);
      setTimeout(() => { tgt.remove(); ring.remove(); }, 140);
      res(q);
    };
    const onPress = e => {
      e.preventDefault();
      if (opts.aim && e.clientX !== undefined) {           // 瞄準判定：點偏＝失手
        const r = tgt.getBoundingClientRect();
        const ox = e.clientX - (r.left + r.width / 2), oy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(ox, oy) > r.width * 0.8) return finish("miss");
      }
      const dt = Math.abs(performance.now() - t0 - cfg.dur);   // 光圈收合瞬間 = dur
      finish(dt <= pw ? "perfect" : dt <= gw ? "good" : "miss");
    };
    const onKey = e => { if (e.code === "Space" || e.code === "Enter" || e.code === "KeyJ") onPress(e); };
    const timer = setTimeout(() => finish("miss"), cfg.dur + gw + 80);
    $("stage").addEventListener("pointerdown", onPress);
    if (!opts.clickOnly) document.addEventListener("keydown", onKey);
  });
}

// 混合連按：4 步，混合「按鍵」與「點擊場上瞄準點」。按錯鍵、點錯處、逾時＝失手；全對且夠快＝完美。
function seqQte() {
  const g = qteGuard(); if (g) return Promise.resolve(g);
  const cfg = QTE_CFG.seq;
  const steps = Array.from({ length: 4 }, () =>
    Math.random() < 0.4 ? { type: "click" } : { type: "key", k: KEY_POOL[Math.floor(Math.random() * KEY_POOL.length)] });
  if (!steps.some(s => s.type === "click")) steps[3] = { type: "click" };                 // 至少混一個點擊
  if (!steps.some(s => s.type === "key")) steps[0] = { type: "key", k: KEY_POOL[Math.floor(Math.random() * KEY_POOL.length)] };
  const budget = steps.reduce((t, s) => t + (s.type === "click" ? cfg.perClick : cfg.perKey), 0);
  return new Promise(res => {
    const box = document.createElement("div"); box.className = "qte-seq";
    const chips = steps.map(s => { const c = document.createElement("button"); c.className = "qte-key";
      c.textContent = s.type === "click" ? "⊙" : s.k; box.appendChild(c); return c; });
    $("fxLayer").appendChild(box);
    $("msg").textContent = "依序輸入——按鍵或點中瞄準點！";
    let i = 0, stepTimer = null, dot = null, done = false;
    const t0 = performance.now();
    const clearDot = () => { if (dot) { dot.remove(); dot = null; } $("stage").removeEventListener("pointerdown", onStray); };
    const finish = q => {
      if (done) return; done = true;
      clearTimeout(stepTimer); clearDot();
      document.removeEventListener("keydown", onKey);
      setTimeout(() => box.remove(), 350);
      res(q);
    };
    const advance = ok => {
      chips[i].classList.remove("cur");
      chips[i].classList.add(ok ? "ok" : "bad");
      clearDot();
      if (!ok) return finish("miss");
      if (++i >= steps.length) {
        const frac = (performance.now() - t0) / budget;
        return finish(frac <= cfg.perfectFrac ? "perfect" : "good");
      }
      arm();
    };
    const onStray = e => { e.preventDefault(); advance(false); };   // 點擊步驟點錯處＝失手
    const arm = () => {
      const s = steps[i];
      chips[i].classList.add("cur");
      clearTimeout(stepTimer);
      stepTimer = setTimeout(() => { chips[i].classList.add("bad"); finish("miss"); },
        s.type === "click" ? cfg.perClick : cfg.perKey);
      if (s.type === "click") {                                     // 生成瞄準點（場上隨機位置）
        dot = document.createElement("div"); dot.className = "qte-dot";
        dot.style.left = (14 + Math.random() * 72) + "cqw";
        dot.style.top = (8 + Math.random() * 24) + "cqw";
        dot.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); advance(true); });
        $("fxLayer").appendChild(dot);
        $("stage").addEventListener("pointerdown", onStray);
      }
    };
    const onKey = e => {
      if (e.repeat) return;
      const k = (e.code || "").replace("Key", "");
      if (!KEY_POOL.includes(k)) return;
      e.preventDefault();
      advance(steps[i].type === "key" && k === steps[i].k);          // 點擊步驟按鍵＝失手
    };
    chips.forEach((c, idx) => c.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation();
      advance(steps[i].type === "key" && idx === i); }));
    document.addEventListener("keydown", onKey);
    arm();
  });
}

// 蓄力：按住（滑鼠或空白鍵）光圈脹大，與目標圈重合瞬間放開；過度蓄力＝失手。
function holdQte(side) {
  const g = qteGuard(); if (g) return Promise.resolve(g);
  const cfg = QTE_CFG.hold;
  return new Promise(res => {
    const { cx, cy } = spriteCenter(side);
    const tgt = document.createElement("div"); tgt.className = "qte-target";
    const ring = document.createElement("div"); ring.className = "qte-ring grow";
    for (const n of [tgt, ring]) { n.style.left = cx + "cqw"; n.style.top = cy + "cqw"; }
    $("fxLayer").append(tgt, ring);
    $("msg").textContent = "按住蓄力——光圈重合瞬間放開！";
    let pressT = 0, done = false, armT = null, overT = null;
    const finish = q => {
      if (done) return; done = true;
      clearTimeout(armT); clearTimeout(overT);
      $("stage").removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      setTimeout(() => { tgt.remove(); ring.remove(); }, 140);
      res(q);
    };
    const onDown = e => {
      if (pressT) return;
      e.preventDefault();
      clearTimeout(armT); pressT = performance.now();
      ring.style.animation = `qteGrow ${cfg.dur}ms linear forwards`;
      overT = setTimeout(() => finish("miss"), cfg.dur + 40);   // 爆發過度
    };
    const onUp = () => {
      if (!pressT) return;
      const dt = Math.abs(performance.now() - pressT - cfg.sweetAt);
      finish(dt <= cfg.perfect ? "perfect" : dt <= cfg.good ? "good" : "miss");
    };
    const onKeyDown = e => { if (e.repeat) return; if (e.code === "Space" || e.code === "Enter" || e.code === "KeyJ") onDown(e); };
    const onKeyUp = e => { if (e.code === "Space" || e.code === "Enter" || e.code === "KeyJ") onUp(); };
    armT = setTimeout(() => finish("miss"), cfg.armWait);       // 遲遲不按也算失手
    $("stage").addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
  });
}

// 連擊：四發漂移光圈在敵方周圍接連出現，必須用滑鼠「點中」每一發（鍵盤無效）。
async function targetsQte(side) {
  const g = qteGuard(); if (g) return g;
  $("msg").textContent = "連續打擊——瞄準並點中每個光圈！";
  let score = 0;
  for (let n = 0; n < 4; n++) {
    const q = await ringQte("target", side, {
      dx: Math.random() * 28 - 14, dy: Math.random() * 14 - 7,
      aim: true, clickOnly: true, drift: true,
    });
    score += q === "perfect" ? 2 : q === "good" ? 1 : 0;
    await wait(90);
  }
  return score >= 6 ? "perfect" : score >= 3 ? "good" : "miss";
}

// 我方出手的輸入模式：終結技＝連擊；冷卻重招＝蓄力（破甲/火攻）或連按；免費招＝光圈。
function strikeQte(sk) {
  if (sk.type === "ult") return targetsQte("foe");
  if (sk.cd > 0) return (sk.fx === "pierce" || sk.fx === "burn") ? holdQte("foe") : seqQte();
  return ringQte("ring", "foe");
}

const VERDICT_TXT = {
  strike: { perfect: ["完美！", "#ffd23f"], good: ["不錯！", "#9fe08a"], miss: ["失手…", "#aab6c8"] },
  parry:  { perfect: ["完美格擋！", "#ffd23f"], good: ["格擋！", "#9fe08a"], miss: ["破防！", "#ff8a70"] },
};
function verdict(side, kind, q) {
  state.stats[q]++;                                        // 戰報：玩家時機統計
  sfx(q === "perfect" ? (kind === "parry" ? "parry" : "perfect") : q === "miss" ? "miss" : "");
  const [txt, color] = VERDICT_TXT[kind][q];
  const { cx, cy } = spriteCenter(side);
  const n = document.createElement("div");
  n.className = "qte-verdict"; n.textContent = txt; n.style.color = color;
  n.style.left = cx + "cqw"; n.style.top = (cy - 8) + "cqw";
  $("fxLayer").appendChild(n);
  setTimeout(() => n.remove(), 950);
}

// 連擊計數（≥2 才顯示；文字更新，不做動畫 — static UI）
function updateCombo() {
  const b = $("comboBadge");
  if (state.combo >= 2) { b.hidden = false; b.textContent = `連擊 ×${state.combo}`; }
  else b.hidden = true;
}

// ---------- combat math ----------
function effSpeed(u) { return u.spd * (u.statuses.slow ? 0.5 : 1) * (u.statuses.speed ? 1.5 : 1); }

function computeDamage(att, def, sk) {
  let base = att.atk * sk.power;
  const crit = rand(att.crit / 100);
  let m = crit ? 1.5 : 1;
  m *= triMult(att.cls, def.cls);
  if (att.statuses.distract) m *= 0.5;
  if (att.statuses.atkup) m *= 1.5;
  if (def.statuses.vulnerable) m *= 1.25;
  if (def.statuses.shield && sk.fx !== "pierce") m *= 0.5;
  m *= (sk.fx === "pierce") ? 1 : (1 - def.armor);
  // dodge: chance to greatly reduce
  let dodged = false;
  if (def.statuses.dodge && rand(0.5)) { m *= 0.25; dodged = true; }   // 平衡版：75%→50%
  let dmg = Math.round(base * m);
  if (sk.fx === "rend") dmg += Math.round(def.hp * 0.25);   // 撕裂: % current hp
  return { dmg, crit, tri: triMult(att.cls, def.cls), dodged };
}

function applyOnHit(att, def, sk) {
  switch (sk.fx) {
    case "bleed": if (rand(0.4)) def.statuses.bleed = 3; break;
    case "burn": def.statuses.burn = 3; break;
    case "distract": def.statuses.distract = 2; break;
    case "slow": def.statuses.slow = 2; break;
    case "stun": if (rand(0.6)) def.statuses.stun = 2; break;   // 2＝就算目標已行動也能撐到下回合
    case "lock": def.statuses.lock = 2; def.statuses.vulnerable = 2; break;
    case "rend": def.statuses.vulnerable = 2; break;
    case "nuke": def.statuses.vulnerable = 2; break;
  }
}

// timing quality → damage multiplier & 架勢 accumulation（硬派：失手懲罰加重）
const STRIKE_MULT  = { perfect: 1.3, good: 1.0, miss: 0.55 };
const PARRY_MULT   = { perfect: 0,   good: 0.5, miss: 1.0  };
const STRIKE_BREAK = { perfect: 30,  good: 15,  miss: 5    };   // 我方命中 → 敵方架勢
const PARRY_BREAK  = { perfect: 0,   good: 8,   miss: 25   };   // 敵方命中 → 我方架勢

async function addBreak(side, n) {
  if (!n) return;
  const u = side === "ally" ? state.ally : state.foe;
  if (u.hp <= 0) return;
  u.break = Math.min(100, (u.break || 0) + n);
  paintUnit(side);
  if (u.break >= 100) {
    // stun=2：若目標本回合已行動，撐過同回合 upkeep 的遞減，下回合必定跳過（act 消耗時整個刪除）
    u.break = 0; u.statuses.stun = 2; u.statuses.vulnerable = 2;
    replay($(`${side}Sprite`), "hit"); flash(); sfx("stagger");
    paintUnit(side);
    await say(`${u.name} 架勢崩潰，露出破綻！`, 550);
  }
}

// ---------- a single action ----------
async function act(attSide, sk) {
  const att = attSide === "ally" ? state.ally : state.foe;
  const defSide = attSide === "ally" ? "foe" : "ally";
  const def = attSide === "ally" ? state.foe : state.ally;

  if (att.statuses.stun) { delete att.statuses.stun; await say(`${att.name} 動彈不得！`, 600); return; }

  await say(`${att.name} 使出 ${sk.name}！`, 250);

  if (sk.type === "ult") att.energy = 0;
  else if (sk.type === "buff" || sk.fx === "heal") att.energy = Math.min(att.energyMax, att.energy + 25);
  // 攻擊招的蓄氣延後到時機判定之後（失手＝不蓄氣）

  // buffs / self-effects（無時機判定）
  if (sk.type === "buff" || sk.fx === "heal") {
    await lunge(attSide);
    if (sk.fx === "atkup") { att.statuses.atkup = 3; await say(`${att.name} 攻擊大幅提升！`, 500); }
    else if (sk.fx === "shield") { att.statuses.shield = 2; await say(`${att.name} 豎起護盾，並嘲諷敵方！`, 500); }
    else if (sk.fx === "dodge") { att.statuses.dodge = 2; await say(`${att.name} 身形飄忽，難以捉摸！`, 500); }
    else if (sk.fx === "rage") { att.hp = Math.round(att.hp * 0.85); att.statuses.atkup = 3; att.statuses.speed = 2; await say(`${att.name} 以苦肉換取爆發！`, 500); }
    else if (sk.fx === "heal") { const h = Math.round(att.maxHp * 0.22); att.hp = Math.min(att.maxHp, att.hp + h); for (const k of ["burn","bleed","slow","distract","vulnerable","stun"]) delete att.statuses[k]; floatDmg(attSide, h, "heal"); sfx("heal"); await say(`${att.name} 回復了體力並淨化！`, 500); }   // 平衡版：35%→22%
    paintUnit(attSide);
    return;
  }

  // ---- timed input：我方出手＝該招式的輸入模式，敵方出手＝格擋光圈（越快的敵人窗口越窄）----
  const q = attSide === "ally"
    ? await strikeQte(sk)
    : await ringQte("parry", "ally", { tighten: Math.min(25, Math.max(0, (att.spd - 90) * 0.4)) });
  DUEL.lastQte = { side: attSide, sk: sk.name, q };
  verdict(defSide, attSide === "ally" ? "strike" : "parry", q);

  // 攻擊招蓄氣：失手不蓄氣（終結技已歸零，不再蓄）
  if (sk.type !== "ult") {
    const gain = (attSide === "ally" && q === "miss") ? 0 : 25;
    att.energy = Math.min(att.energyMax, att.energy + gain);
  }

  // 連擊 streak：完美+1、失手歸零（好壞不變）；加成用「出手前」的層數
  const comboMult = attSide === "ally" ? 1 + 0.06 * Math.min(state.combo, 5) : 1;
  if (q === "perfect") state.combo++;
  else if (q === "miss") state.combo = 0;
  updateCombo();

  await lunge(attSide);
  const r = computeDamage(att, def, sk);
  const tm = attSide === "ally" ? STRIKE_MULT[q] : PARRY_MULT[q];
  r.dmg = Math.round(r.dmg * tm * comboMult);
  await hit(defSide, sk.type === "ult" || r.crit || q === "perfect");
  if (r.dodged) { await say("攻擊被閃開了！", 500); return; }

  if (attSide === "foe" && q === "perfect") {
    // 完美格擋：無傷、蓄戰意、立即反擊（不吃狀態、不積架勢）
    flash();
    const c = Math.round(def.atk * 0.35);
    att.hp = Math.max(0, att.hp - c);
    state.stats.dealt += c;
    def.energy = Math.min(def.energyMax, def.energy + 20);
    replay($("allySprite"), "lunge-ally");
    floatDmg("foe", c, "crit");
    paintUnit("ally"); paintUnit("foe");
    await say("完美格擋，立即反擊！", 450);
    return;
  }
  if (attSide === "ally" && q === "perfect") {
    flash();
    att.energy = Math.min(att.energyMax, att.energy + 10);   // 完美出手：額外蓄戰意
  }

  def.hp = Math.max(0, def.hp - r.dmg);
  state.stats[attSide === "ally" ? "dealt" : "taken"] += r.dmg;
  floatDmg(defSide, r.dmg, r.crit ? "crit" : "");
  paintUnit(defSide); paintUnit(attSide);
  applyOnHit(att, def, sk);
  await addBreak(defSide, attSide === "ally" ? STRIKE_BREAK[q] : PARRY_BREAK[q]);

  if (r.crit) await say("會心一擊！", 450);
  if (r.tri > 1) await say("效果絕佳！", 450);
  else if (r.tri < 1) await say("效果不彰…", 450);
}

// ---------- damage-over-time + upkeep ----------
async function upkeep(side) {
  const u = side === "ally" ? state.ally : state.foe;
  for (const dot of ["burn", "bleed"]) {
    if (u.statuses[dot] && u.hp > 0) {
      const d = Math.round(u.maxHp * 0.05);   // 平衡版：6%→5%
      u.hp = Math.max(0, u.hp - d);
      floatDmg(side, d, ""); paintUnit(side);
      await say(`${u.name} 受到${dot === "burn" ? "灼燒" : "流血"}傷害！`, 500);
    }
  }
  for (const k in u.statuses) { if (--u.statuses[k] <= 0) delete u.statuses[k]; }
  for (let i = 0; i < u.cd.length; i++) if (u.cd[i] > 0) u.cd[i]--;
  u.energy = Math.min(u.energyMax, u.energy + 8);
}

// ---------- AI ----------
function aiPick(u) {
  const usable = u.skills.map((s, i) => ({ s, i }))
    .filter(({ s, i }) => u.cd[i] === 0 && (s.type !== "ult" || u.energy >= u.energyMax));
  const ult = usable.find(x => x.s.type === "ult");
  if (ult) {
    // 治療終結技留到真的受傷（<65% 或身上有持續傷害）再用，不再滿血浪費
    if (ult.s.fx === "heal") { if (u.hp < u.maxHp * 0.65 || u.statuses.burn || u.statuses.bleed) return ult; }
    else return ult;
  }
  const atks = usable.filter(x => x.s.type === "atk").sort((a, b) => b.s.power - a.s.power);
  const buff = usable.find(x => x.s.type === "buff");
  if (buff && !hasAnyBuff(u) && rand(0.4)) return buff;
  return atks[0] || buff || usable[0];
}

// AI 整體決策：被剋制、瀕危且板凳有合適人選時會主動換將（70% 執行，留點人味）
function aiDecide() {
  const foe = state.foe;
  const bench = aliveBench(state.foeTeam, state.foeIdx);
  if (bench.length && !foe.statuses.lock && foe.hp < foe.maxHp * 0.4 &&
      triMult(state.ally.cls, foe.cls) > 1 && rand(0.7)) {
    const better = bench.find(x => triMult(state.ally.cls, x.u.cls) <= 1);
    if (better) return { type: "swap", to: better.i };
  }
  const fp = aiPick(foe);
  return { type: "skill", fp };
}
function hasAnyBuff(u) { return u.statuses.atkup || u.statuses.shield || u.statuses.dodge; }

// ---------- party ----------
function aliveBench(team, curIdx) { return team.map((u, i) => ({ u, i })).filter(x => x.i !== curIdx && x.u.hp > 0); }

// 換上第 idx 位（保留該武將的 HP/戰意/狀態/冷卻）
async function swapIn(side, idx, announce = true) {
  const team = side === "ally" ? state.allyTeam : state.foeTeam;
  if (side === "ally") { state.allyIdx = idx; state.ally = team[idx]; }
  else { state.foeIdx = idx; state.foe = team[idx]; }
  const sp = $(`${side}Sprite`);
  sp.classList.remove("faint");
  paintUnit(side); paintPips();
  replay(sp, side === "ally" ? "enter-ally" : "enter-foe");
  setTimeout(() => sp.classList.remove("enter-ally", "enter-foe"), 700);
  if (announce) await say(side === "ally" ? `上吧，${team[idx].name}！` : `對手派出了 ${team[idx].name}！`, 500);
}

// 對出戰中的我方武將使用道具
async function useItem(id) {
  const it = ITEM_DB[id], u = state.ally;
  save.items[id]--; if (save.items[id] <= 0) delete save.items[id];
  persist();
  await say(`使用了 ${it.name}！`, 300);
  if (it.fx === "heal") { const h = Math.round(u.maxHp * 0.35); u.hp = Math.min(u.maxHp, u.hp + h); floatDmg("ally", h, "heal"); sfx("heal"); await say(`${u.name} 回復了體力！`, 450); }
  else if (it.fx === "cleanse") { for (const k of ["burn", "bleed", "slow", "distract", "vulnerable", "stun", "lock"]) delete u.statuses[k]; await say(`${u.name} 的負面狀態一掃而空！`, 450); }
  else if (it.fx === "energy") { u.energy = Math.min(u.energyMax, u.energy + 50); await say(`${u.name} 戰意高漲！`, 450); }
  else if (it.fx === "shield") { u.statuses.shield = 2; await say(`${u.name} 豎起護盾！`, 450); }
  paintUnit("ally");
}

async function endBattle(win) {
  state.over = true; state.busy = true;
  sfx(win ? "win" : "lose");
  const bonus = win ? PAY.win : PAY.lose;
  addMoney(bonus);
  await say(win ? `敵方全軍覆沒——你贏了！獲得 ${bonus} 銅錢` : `我方全軍覆沒——你輸了…獲得 ${bonus} 銅錢`, 600);
  const st = state.stats;
  await say(`戰報：${st.turns} 回合｜完美 ${st.perfect}・不錯 ${st.good}・失手 ${st.miss}｜輸出 ${st.dealt}・承受 ${st.taken}｜進帳 ${st.earned} 銅錢`, 1400);
  await say(`目前共有 ${save.money} 銅錢。　▶ 點擊任意處再戰`);
  $("stage").addEventListener("click", () => location.reload(), { once: true });
  return true;
}

// ---------- turn ----------
// action: { type:'skill', idx } 或 { type:'swap', to }（換將消耗行動，敵方白打一輪）
async function takeTurn(action) {
  if (state.busy || state.over) return;
  state.busy = true; closeMenus();
  const ai = aiDecide();
  if (ai.type === "skill") state.foe.cd[ai.fp.i] = ai.fp.s.cd;

  // 敵方的行動：出招，或把行動花在換將上
  const foeAct = async () => {
    if (state.foe.hp <= 0) return false;
    if (ai.type === "swap") { await say("對手鳴金換將！", 300); await swapIn("foe", ai.to); return false; }
    await act("foe", ai.fp.s);
    await wait(180);
    return await checkFaint();
  };

  if (action.type === "swap") {
    await say(`回來吧，${state.ally.name}！`, 300);
    await swapIn("ally", action.to);
    if (await foeAct()) return;
  } else if (action.type === "item") {
    await useItem(action.id);            // 用道具＝消耗行動，敵方照打
    if (await foeAct()) return;
  } else if (ai.type === "swap") {
    // 敵方換將＝它的行動；我方照常出招
    await say("對手鳴金換將！", 300);
    await swapIn("foe", ai.to);
    await act("ally", state.ally.skills[action.idx]);
    state.ally.cd[action.idx] = state.ally.skills[action.idx].cd;
    await wait(180);
    if (await checkFaint()) return;
  } else {
    state.ally.cd[action.idx] = state.ally.skills[action.idx].cd;
    // who: 綁定選招的武將——若中途倒下被替補，替補者不繼承亡者的行動
    const pAction = { side: "ally", sk: state.ally.skills[action.idx], who: state.ally };
    const eAction = { side: "foe", sk: ai.fp.s, who: state.foe };
    const order = effSpeed(state.ally) >= effSpeed(state.foe) ? [pAction, eAction] : [eAction, pAction];
    for (const a of order) {
      if (state.ally.hp <= 0 || state.foe.hp <= 0) break;
      if ((a.side === "ally" ? state.ally : state.foe) !== a.who) continue;   // 選招者已不在場
      await act(a.side, a.sk);
      await wait(180);
      if (await checkFaint()) return;
    }
  }
  state.stats.turns++;
  await upkeep("ally"); await upkeep("foe");
  if (await checkFaint()) return;
  paintUnit("ally"); paintUnit("foe");
  state.busy = false;
  await say(`${state.ally.name} 該怎麼做？`);
  openMenu();
}

// 倒下處理：敵方自動換下一位；我方免費強制選人（不耗行動）；全隊覆沒→勝負
async function checkFaint() {
  if (state.foe.hp <= 0 && !state.foe._fainted) {
    state.foe._fainted = true;
    $("foeSprite").classList.add("faint");
    paintPips(); sfx("faint");
    addMoney(PAY.foeKO);
    await say(`${state.foe.name} 倒下了！獲得 ${PAY.foeKO} 銅錢`, 700);
    const bench = aliveBench(state.foeTeam, state.foeIdx);
    if (!bench.length) return endBattle(true);
    await wait(300);
    await swapIn("foe", bench[0].i);
  }
  if (state.ally.hp <= 0 && !state.ally._fainted) {
    state.ally._fainted = true;
    $("allySprite").classList.add("faint");
    paintPips(); sfx("faint");
    addMoney(PAY.allyKO);
    await say(`${state.ally.name} 倒下了！獲得撫恤 ${PAY.allyKO} 銅錢`, 700);
    const bench = aliveBench(state.allyTeam, state.allyIdx);
    if (!bench.length) return endBattle(false);
    await say("選擇下一位出戰武將！", 200);
    openParty(true);            // 強制選人：免費，選完才繼續
    return true;                // 中斷本回合流程
  }
  return false;
}

// ---------- menus ----------
function openMenu() { $("mainMenu").hidden = false; $("skillMenu").hidden = true; $("partyMenu").hidden = true; $("bagMenu").hidden = true; }
function closeMenus() { $("mainMenu").hidden = true; $("skillMenu").hidden = true; $("partyMenu").hidden = true; $("bagMenu").hidden = true; }
function openSkills() {
  const m = $("skillMenu"); m.innerHTML = "";
  state.ally.skills.forEach((s, i) => {
    const locked = s.type === "ult" && state.ally.energy < state.ally.energyMax;
    const onCd = state.ally.cd[i] > 0;
    const b = document.createElement("button");
    b.className = "skill" + (onCd || locked ? " disabled" : "");
    b.innerHTML = `<span class="sk-nm">${s.name}</span><span class="sk-meta">${s.desc}</span>` +
      (onCd ? `<span class="sk-cd">CD${state.ally.cd[i]}</span>` : locked ? `<span class="sk-cd">戰意</span>` : ``);
    if (!onCd && !locked) b.onclick = () => takeTurn({ type: "skill", idx: i });
    m.appendChild(b);
  });
  const back = document.createElement("button");
  back.className = "skill back"; back.textContent = "← 返回";
  back.onclick = openMenu; m.appendChild(back);
  $("mainMenu").hidden = true; $("partyMenu").hidden = true; m.hidden = false;
}

// 換將選單。forced=true：出戰武將倒下後的免費選人（不耗行動、不能返回）
function openParty(forced = false) {
  const m = $("partyMenu"); m.innerHTML = "";
  state.allyTeam.forEach((u, i) => {
    const active = i === state.allyIdx, dead = u.hp <= 0;
    const b = document.createElement("button");
    b.className = "skill" + ((active || dead) ? " disabled" : "");
    b.innerHTML = `<span class="sk-nm">${u.name} <small style="color:${CLASS_COLOR[u.cls]}">${u.cls}</small></span>` +
      `<span class="sk-meta">${dead ? "已倒下" : `HP ${Math.max(0, Math.round(u.hp))}/${u.maxHp}`}${active ? "（出戰中）" : ""}</span>`;
    if (!active && !dead) b.onclick = async () => {
      if (forced) {           // 免費補位：直接換上，回到指令選單
        m.hidden = true;
        await swapIn("ally", i);
        state.busy = false;
        await say(`${state.ally.name} 該怎麼做？`);
        openMenu();
      } else takeTurn({ type: "swap", to: i });
    };
    m.appendChild(b);
  });
  if (!forced) {
    const back = document.createElement("button");
    back.className = "skill back"; back.textContent = "← 返回";
    back.onclick = openMenu; m.appendChild(back);
  }
  $("mainMenu").hidden = true; $("skillMenu").hidden = true; m.hidden = false;
}

function tryOpenParty() {
  if (state.ally.statuses.lock) { say(`${state.ally.name} 被鎖定，無法換將！`); return; }
  if (!aliveBench(state.allyTeam, state.allyIdx).length) { say("沒有可替換的武將了！"); return; }
  openParty(false);
}

// 道具袋：列出持有的道具，點擊使用（消耗行動）
function openBag() {
  const owned = Object.keys(save.items).filter(id => save.items[id] > 0 && ITEM_DB[id]);
  if (!owned.length) { say("沒有道具了——戰前可到商店採購。"); return; }
  const m = $("bagMenu"); m.innerHTML = "";
  owned.forEach(id => {
    const it = ITEM_DB[id];
    const b = document.createElement("button");
    b.className = "skill";
    b.innerHTML = `<span class="sk-nm">${it.name} <small>×${save.items[id]}</small></span><span class="sk-meta">${it.desc}</span>`;
    b.onclick = () => takeTurn({ type: "item", id });
    m.appendChild(b);
  });
  const back = document.createElement("button");
  back.className = "skill back"; back.textContent = "← 返回";
  back.onclick = openMenu; m.appendChild(back);
  $("mainMenu").hidden = true; $("skillMenu").hidden = true; $("partyMenu").hidden = true; m.hidden = false;
}

function bindMenu() {
  $("mainMenu").querySelectorAll(".mbtn").forEach(btn => {
    btn.onclick = () => {
      if (state.busy) return;
      const act = btn.dataset.act;
      if (act === "fight") openSkills();
      else if (act === "run") say("無法從對戰中逃走！");
      else if (act === "bag") openBag();
      else if (act === "party") tryOpenParty();
    };
  });
}

// keyboard: 1–4 選單/招式、Esc 返回（QTE 的空白鍵有自己的監聽，只在 busy 時生效）
function bindKeys() {
  document.addEventListener("keydown", e => {
    if (e.key === "m" || e.key === "M") {                  // 靜音切換（隨時可按，記憶在存檔）
      save.muted = !save.muted; persist();
      say(save.muted ? "音效已關閉（按 M 開啟）" : "音效已開啟（按 M 關閉）");
      return;
    }
    const pm = $("partyMenu");
    if (!pm.hidden) {          // 換將選單（含強制選人，busy 時也要能用）
      if (e.key >= "1" && e.key <= "3") { const b = pm.children[+e.key - 1]; if (b && !b.classList.contains("disabled")) b.click(); }
      else if ((e.key === "Escape" || e.key === "b") && !state.busy) openMenu();
      return;
    }
    if (state.busy || state.over) return;
    const mm = $("mainMenu"), sm = $("skillMenu"), bm = $("bagMenu");
    if (!mm.hidden) {
      if (e.key === "1" || e.code === "Space" || e.code === "Enter") { e.preventDefault(); openSkills(); }
      else if (e.key === "2") openBag();
      else if (e.key === "3") tryOpenParty();
      else if (e.key === "4") say("無法從對戰中逃走！");
    } else if (!sm.hidden) {
      if (e.key >= "1" && e.key <= "4") { const b = sm.children[+e.key - 1]; if (b && !b.classList.contains("disabled")) b.click(); }
      else if (e.key === "Escape" || e.key === "b") openMenu();
    } else if (!bm.hidden) {
      if (e.key >= "1" && e.key <= "4") { const b = bm.children[+e.key - 1]; if (b && !b.classList.contains("back")) b.click(); }
      else if (e.key === "Escape" || e.key === "b") openMenu();
    }
  });
}

// ---------- shop ----------
function renderShop() {
  const g = $("shopGrid"); g.innerHTML = "";
  Object.entries(ITEM_DB).forEach(([id, it]) => {
    const b = document.createElement("button");
    b.className = "shop-item";
    b.disabled = save.money < it.price;
    b.innerHTML = `<span class="shop-icon">${it.name[0]}</span>` +
      `<span class="shop-info"><span class="shop-nm">${it.name}<small>　持有 ×${save.items[id] || 0}</small></span>` +
      `<span class="shop-desc">${it.desc}</span></span>` +
      `<span class="shop-price">${it.price} 銅錢</span>`;
    b.onclick = () => {
      if (save.money < it.price) return;
      save.money -= it.price;
      save.items[id] = (save.items[id] || 0) + 1;
      persist(); paintMoney(); renderShop();
    };
    g.appendChild(b);
  });
}

// ---------- team select ----------
function showTeamSelect() {
  return new Promise(res => {
    const grid = $("tsGrid"); grid.innerHTML = "";
    const startB = $("tsStart");
    // 分頁：出戰隊伍 / 商店
    const setTab = shop => {
      $("tabTeam").classList.toggle("sel", !shop);
      $("tabShop").classList.toggle("sel", shop);
      $("tsGrid").hidden = shop; $("shopGrid").hidden = !shop;
      $("tsTitle").textContent = shop ? "商店——銅錢採購道具（戰鬥中於道具選單使用）" : "選擇出戰隊伍（3 名）";
      $("tsRandom").hidden = shop;
      if (shop) renderShop();
    };
    $("tabTeam").onclick = () => setTab(false);
    $("tabShop").onclick = () => setTab(true);
    paintMoney();
    let picked = [];
    const renumber = () => {
      grid.querySelectorAll(".ts-chip").forEach(c => {
        const n = picked.indexOf(c.dataset.id);
        c.classList.toggle("sel", n >= 0);
        let tag = c.querySelector(".ts-n");
        if (n >= 0) {
          if (!tag) { tag = document.createElement("span"); tag.className = "ts-n"; c.appendChild(tag); }
          tag.textContent = n + 1;
        } else tag?.remove();
      });
      startB.disabled = picked.length !== 3;
      startB.textContent = picked.length === 3 ? "開戰！" : `開戰！（${picked.length}/3）`;
    };
    ROSTER.forEach(id => {
      const h = HERO_DB[id];
      const b = document.createElement("button");
      b.className = "ts-chip"; b.dataset.id = id;
      b.innerHTML = `<span class="ts-badge" style="background-color:${CLASS_COLOR[h.cls]};border-color:${CLASS_COLOR[h.cls]};background-image:url(img/${id}.png)"></span>` +
        `<span class="ts-nm">${h.name}</span><span class="ts-cls" style="color:${CLASS_COLOR[h.cls]}">${h.cls} ${CLASS_NAME[h.cls].split(" ")[0]}</span>`;
      b.title = `${h.name}｜HP ${h.maxHp}｜攻 ${h.atk}｜速 ${h.spd}｜暴 ${h.crit}%｜甲 ${Math.round(h.armor * 100)}%`;
      b.onclick = () => {
        const k = picked.indexOf(id);
        if (k >= 0) picked.splice(k, 1);
        else if (picked.length < 3) picked.push(id);
        renumber();
      };
      grid.appendChild(b);
    });
    $("tsRandom").onclick = () => { picked = randomIds(3); renumber(); };
    startB.onclick = () => { if (picked.length === 3) { $("teamSelect").hidden = true; res(picked.slice()); } };
    renumber();
    $("teamSelect").hidden = false;
  });
}

// ---------- boot ----------
async function start() {
  bindMenu(); bindKeys(); closeMenus();
  // ?team=guan_yu,zhang_fei,zhou_yu 直接開戰（分享陣容／測試用）
  const qs = (location.search.match(/[?&]team=([^&]+)/) || [])[1];
  let ids = qs ? decodeURIComponent(qs).split(",").filter(id => HERO_DB[id]).slice(0, 3) : null;
  if (!ids || ids.length !== 3) ids = await showTeamSelect();
  state.allyTeam = ids.map(makeUnit); state.allyIdx = 0; state.ally = state.allyTeam[0];
  // 敵隊：從剩餘 22 名隨機抽 3（不與玩家重複）
  const pool = ROSTER.filter(id => !ids.includes(id));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  state.foeTeam = pool.slice(0, 3).map(makeUnit); state.foeIdx = 0; state.foe = state.foeTeam[0];
  state.combo = 0; updateCombo();
  state.stats = { turns: 0, perfect: 0, good: 0, miss: 0, dealt: 0, taken: 0, earned: 0 };
  paintUnit("ally"); paintUnit("foe"); paintPips();
  // static UI: 資訊框不滑入，只有角色進場
  $("foeSprite").classList.add("enter-foe");
  $("allySprite").classList.add("enter-ally");
  await wait(650);
  // drop the entrance class so it can't out-cascade the lunge animation later (both set `animation`)
  $("foeSprite").classList.remove("enter-foe"); $("allySprite").classList.remove("enter-ally");
  await say(`對手派出了 ${state.foe.name}！`, 700);
  await say(`就決定是你了，${state.ally.name}！`, 700);
  state.busy = false;
  await say(`${state.ally.name} 該怎麼做？`);
  openMenu();
}

document.addEventListener("DOMContentLoaded", start);
})();
