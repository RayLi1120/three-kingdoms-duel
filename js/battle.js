/* 三國對弈 — battle engine + UI controller + animation driver. FRLG-style flow +
   Expedition 33-style timed combat: 光圈收合瞬間出手 → 強化攻擊；敵襲時 → 格擋反擊；架勢集滿 → 崩潰. */
(() => {
const $ = id => document.getElementById(id);
const FAST = /[?&]fast\b/.test(location.search);   // test mode: instant text, short waits
const wait = ms => new Promise(r => setTimeout(r, FAST ? Math.min(ms, 40) : ms));
const rand = p => Math.random() < p;

const state = { ally: null, foe: null, busy: true, over: false };
// debug/verification hooks: DUEL.forceQte = 'perfect'|'good'|'miss' resolves QTEs instantly
const DUEL = window.DUEL = { state, forceQte: null };

// ---------- rendering ----------
function paintUnit(side) {
  const u = side === "ally" ? state.ally : state.foe;
  $(`${side}Name`).textContent = u.name;
  $(`${side}Lv`).textContent = u.lv;
  const cls = $(`${side}Cls`); cls.textContent = u.cls; cls.style.background = CLASS_COLOR[u.cls];
  $(`${side}Emblem`).textContent = u.emblem;
  const sp = $(`${side}Sprite`).querySelector(".sprite-body"); sp.style.background = CLASS_COLOR[u.cls];
  const pct = Math.max(0, u.hp / u.maxHp * 100);
  const hp = $(`${side}Hp`); hp.style.width = pct + "%";
  hp.style.background = pct > 50 ? "var(--hp-green)" : pct > 20 ? "var(--hp-amber)" : "var(--hp-red)";
  $(`${side}Bk`).style.width = (u.break || 0) + "%";
  if (side === "ally") {
    $("allyHpNum").textContent = `${Math.max(0, Math.round(u.hp))}/ ${u.maxHp}`;
    $("allyEn").style.width = (u.energy / u.energyMax * 100) + "%";
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
function punch() { replay($("field"), "punch"); }

async function lunge(side) {
  replay($(`${side}Sprite`), side === "ally" ? "lunge-ally" : "lunge-foe");
  await wait(230);   // peak thrust (~48% of the .5s lunge) lands as hit() fires
}
async function hit(side, big) {
  const sp = $(`${side}Sprite`);
  replay(sp, "hit");
  impact(side, big);
  if (big) replay($("stage"), "shake");
  await wait(420);
  sp.classList.remove("hit"); $("stage").classList.remove("shake");
}

// ---------- QTE (timed input) ----------
const QTE_CFG = {
  strike: { dur: 950, perfect: 85, good: 250, label: "看準時機——點擊或按空白鍵！" },
  parry:  { dur: 950, perfect: 95, good: 260, label: "敵襲——點擊或按空白鍵格擋！" },
};
function qte(kind, side) {
  if (DUEL.forceQte) return Promise.resolve(DUEL.forceQte);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve("good");
  const cfg = QTE_CFG[kind];
  return new Promise(res => {
    const { cx, cy } = spriteCenter(side);
    const tgt = document.createElement("div"); tgt.className = "qte-target" + (kind === "parry" ? " parry" : "");
    const ring = document.createElement("div"); ring.className = "qte-ring" + (kind === "parry" ? " parry" : "");
    for (const n of [tgt, ring]) { n.style.left = cx + "cqw"; n.style.top = cy + "cqw"; }
    ring.style.animationDuration = cfg.dur + "ms";
    $("fxLayer").append(tgt, ring);
    $("msg").textContent = cfg.label;
    const t0 = performance.now();
    let done = false;
    const finish = q => {
      if (done) return; done = true;
      clearTimeout(timer);
      $("stage").removeEventListener("pointerdown", onPress);
      document.removeEventListener("keydown", onKey);
      setTimeout(() => { tgt.remove(); ring.remove(); }, 140);
      res(q);
    };
    const onPress = e => {
      e.preventDefault();
      const dt = Math.abs(performance.now() - t0 - cfg.dur);   // 光圈收合瞬間 = dur
      finish(dt <= cfg.perfect ? "perfect" : dt <= cfg.good ? "good" : "miss");
    };
    const onKey = e => { if (e.code === "Space" || e.code === "Enter" || e.code === "KeyJ") onPress(e); };
    const timer = setTimeout(() => finish("miss"), cfg.dur + cfg.good + 80);
    $("stage").addEventListener("pointerdown", onPress);
    document.addEventListener("keydown", onKey);
  });
}

const VERDICT_TXT = {
  strike: { perfect: ["完美！", "#ffd23f"], good: ["不錯！", "#9fe08a"], miss: ["失手…", "#aab6c8"] },
  parry:  { perfect: ["完美格擋！", "#ffd23f"], good: ["格擋！", "#9fe08a"], miss: ["破防！", "#ff8a70"] },
};
function verdict(side, kind, q) {
  const [txt, color] = VERDICT_TXT[kind][q];
  const { cx, cy } = spriteCenter(side);
  const n = document.createElement("div");
  n.className = "qte-verdict"; n.textContent = txt; n.style.color = color;
  n.style.left = cx + "cqw"; n.style.top = (cy - 8) + "cqw";
  $("fxLayer").appendChild(n);
  setTimeout(() => n.remove(), 950);
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
  if (def.statuses.dodge && rand(0.75)) { m *= 0.25; dodged = true; }
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
    case "stun": if (rand(0.6)) def.statuses.stun = 1; break;
    case "lock": def.statuses.lock = 2; def.statuses.vulnerable = 2; break;
    case "rend": def.statuses.vulnerable = 2; break;
    case "nuke": def.statuses.vulnerable = 2; break;
  }
}

// timing quality → damage multiplier & 架勢 accumulation
const STRIKE_MULT  = { perfect: 1.3, good: 1.0, miss: 0.7 };
const PARRY_MULT   = { perfect: 0,   good: 0.5, miss: 1.0 };
const STRIKE_BREAK = { perfect: 30,  good: 15,  miss: 5   };   // 我方命中 → 敵方架勢
const PARRY_BREAK  = { perfect: 0,   good: 8,   miss: 18  };   // 敵方命中 → 我方架勢

async function addBreak(side, n) {
  if (!n) return;
  const u = side === "ally" ? state.ally : state.foe;
  if (u.hp <= 0) return;
  u.break = Math.min(100, (u.break || 0) + n);
  paintUnit(side);
  if (u.break >= 100) {
    u.break = 0; u.statuses.stun = 1; u.statuses.vulnerable = 2;
    replay($(`${side}Sprite`), "hit"); punch();
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
  else att.energy = Math.min(att.energyMax, att.energy + 25);

  // buffs / self-effects（無時機判定）
  if (sk.type === "buff" || sk.fx === "heal") {
    await lunge(attSide);
    if (sk.fx === "atkup") { att.statuses.atkup = 3; await say(`${att.name} 攻擊大幅提升！`, 500); }
    else if (sk.fx === "shield") { att.statuses.shield = 2; await say(`${att.name} 豎起護盾，並嘲諷敵方！`, 500); }
    else if (sk.fx === "dodge") { att.statuses.dodge = 2; await say(`${att.name} 身形飄忽，難以捉摸！`, 500); }
    else if (sk.fx === "rage") { att.hp = Math.round(att.hp * 0.85); att.statuses.atkup = 3; att.statuses.speed = 2; await say(`${att.name} 以苦肉換取爆發！`, 500); }
    else if (sk.fx === "heal") { const h = Math.round(att.maxHp * 0.35); att.hp = Math.min(att.maxHp, att.hp + h); for (const k of ["burn","bleed","slow","distract","vulnerable","stun"]) delete att.statuses[k]; floatDmg(attSide, h, "heal"); await say(`${att.name} 回復了體力並淨化！`, 500); }
    paintUnit(attSide);
    return;
  }

  // ---- timed input：我方出手＝強化時機（光圈在敵方），敵方出手＝格擋時機（光圈在我方）----
  const q = attSide === "ally" ? await qte("strike", "foe") : await qte("parry", "ally");
  verdict(defSide, attSide === "ally" ? "strike" : "parry", q);

  await lunge(attSide);
  const r = computeDamage(att, def, sk);
  const tm = attSide === "ally" ? STRIKE_MULT[q] : PARRY_MULT[q];
  r.dmg = Math.round(r.dmg * tm);
  await hit(defSide, sk.type === "ult" || r.crit || q === "perfect");
  if (r.dodged) { await say("攻擊被閃開了！", 500); return; }

  if (attSide === "foe" && q === "perfect") {
    // 完美格擋：無傷、蓄戰意、立即反擊（不吃狀態、不積架勢）
    flash();
    const c = Math.round(def.atk * 0.35);
    att.hp = Math.max(0, att.hp - c);
    def.energy = Math.min(def.energyMax, def.energy + 20);
    replay($("allySprite"), "lunge-ally");
    floatDmg("foe", c, "crit");
    paintUnit("ally"); paintUnit("foe");
    await say("完美格擋，立即反擊！", 450);
    return;
  }
  if (attSide === "ally" && q === "perfect") {
    flash(); punch();
    att.energy = Math.min(att.energyMax, att.energy + 10);   // 完美出手：額外蓄戰意
  }

  def.hp = Math.max(0, def.hp - r.dmg);
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
      const d = Math.round(u.maxHp * 0.06);
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
  if (ult) return ult;
  const atks = usable.filter(x => x.s.type === "atk").sort((a, b) => b.s.power - a.s.power);
  const buff = usable.find(x => x.s.type === "buff");
  if (buff && !hasAnyBuff(u) && rand(0.4)) return buff;
  return atks[0] || usable[0];
}
function hasAnyBuff(u) { return u.statuses.atkup || u.statuses.shield || u.statuses.dodge; }

// ---------- turn ----------
async function takeTurn(playerIdx) {
  if (state.busy || state.over) return;
  state.busy = true; closeMenus();
  state.ally.cd[playerIdx] = state.ally.skills[playerIdx].cd;
  const pAction = { side: "ally", sk: state.ally.skills[playerIdx] };
  const fp = aiPick(state.foe); state.foe.cd[fp.i] = fp.s.cd;
  const eAction = { side: "foe", sk: fp.s };

  const order = effSpeed(state.ally) >= effSpeed(state.foe) ? [pAction, eAction] : [eAction, pAction];
  for (const a of order) {
    if (state.ally.hp <= 0 || state.foe.hp <= 0) break;
    await act(a.side, a.sk);
    await wait(180);
    if (await checkFaint()) return;
  }
  await upkeep("ally"); await upkeep("foe");
  if (await checkFaint()) return;
  paintUnit("ally"); paintUnit("foe");
  state.busy = false;
  await say(`${state.ally.name} 該怎麼做？`);
  openMenu();
}

async function checkFaint() {
  for (const side of ["foe", "ally"]) {
    const u = side === "foe" ? state.foe : state.ally;
    if (u.hp <= 0 && !u._fainted) {
      u._fainted = true;
      $(`${side}Sprite`).classList.add("faint");
      await say(`${u.name} 倒下了！`, 700);
      state.over = true; state.busy = true;
      await say(side === "foe" ? `你贏了！　▶ 點擊任意處再戰` : `你輸了…　▶ 點擊任意處再戰`);
      $("stage").addEventListener("click", () => location.reload(), { once: true });
      return true;
    }
  }
  return false;
}

// ---------- menus ----------
function openMenu() { $("mainMenu").hidden = false; $("skillMenu").hidden = true; }
function closeMenus() { $("mainMenu").hidden = true; $("skillMenu").hidden = true; }
function openSkills() {
  const m = $("skillMenu"); m.innerHTML = "";
  state.ally.skills.forEach((s, i) => {
    const locked = s.type === "ult" && state.ally.energy < state.ally.energyMax;
    const onCd = state.ally.cd[i] > 0;
    const b = document.createElement("button");
    b.className = "skill" + (onCd || locked ? " disabled" : "");
    b.innerHTML = `<span class="sk-nm">${s.name}</span><span class="sk-meta">${s.desc}</span>` +
      (onCd ? `<span class="sk-cd">CD${state.ally.cd[i]}</span>` : locked ? `<span class="sk-cd">戰意</span>` : ``);
    if (!onCd && !locked) b.onclick = () => takeTurn(i);
    m.appendChild(b);
  });
  const back = document.createElement("button");
  back.className = "skill back"; back.textContent = "← 返回";
  back.onclick = openMenu; m.appendChild(back);
  $("mainMenu").hidden = true; m.hidden = false;
}

function bindMenu() {
  $("mainMenu").querySelectorAll(".mbtn").forEach(btn => {
    btn.onclick = () => {
      if (state.busy) return;
      const act = btn.dataset.act;
      if (act === "fight") openSkills();
      else if (act === "run") say("無法從對戰中逃走！");
      else if (act === "bag") say("道具系統尚未開放。");
      else if (act === "party") say("換將系統尚未開放。");
    };
  });
}

// keyboard: 1–4 選單/招式、Esc 返回（QTE 的空白鍵有自己的監聽，只在 busy 時生效）
function bindKeys() {
  document.addEventListener("keydown", e => {
    if (state.busy || state.over) return;
    const mm = $("mainMenu"), sm = $("skillMenu");
    if (!mm.hidden) {
      if (e.key === "1" || e.code === "Space" || e.code === "Enter") { e.preventDefault(); openSkills(); }
      else if (e.key === "2") say("道具系統尚未開放。");
      else if (e.key === "3") say("換將系統尚未開放。");
      else if (e.key === "4") say("無法從對戰中逃走！");
    } else if (!sm.hidden) {
      if (e.key >= "1" && e.key <= "4") { const b = sm.children[+e.key - 1]; if (b && !b.classList.contains("disabled")) b.click(); }
      else if (e.key === "Escape" || e.key === "b") openMenu();
    }
  });
}

// ---------- boot ----------
async function start() {
  const [allyId, foeId] = randomIds(2);   // random matchup from the 25-hero roster
  state.ally = makeUnit(allyId);
  state.foe = makeUnit(foeId);
  paintUnit("ally"); paintUnit("foe");
  bindMenu(); bindKeys(); closeMenus();
  $("foeSprite").classList.add("enter-foe"); $("foeInfo").classList.add("enter-foe");
  $("allySprite").classList.add("enter-ally"); $("allyInfo").classList.add("enter-ally");
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
