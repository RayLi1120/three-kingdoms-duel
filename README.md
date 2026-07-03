# 三國對弈 — Three Kingdoms Duel

A turn-based 1-v-1 dueling game with a Three Kingdoms cast. Speed-ordered turns,
cooldown skills, an energy-gated ultimate and a rich status kit, with
*Clair Obscur: Expedition 33*-style timed combat on top — you play on **both**
turns. UI mimics the Pokémon FireRed/LeafGreen battle screen.

**▶ Play:** https://rayli1120.github.io/three-kingdoms-duel/

## How to play
- **3v3 team battles**: pick a team of 3 from the 25-hero roster (or 隨機隊伍 for a random
  team; `?team=guan_yu,zhang_fei,zhou_yu` in the URL to share a lineup). KO the enemy's
  whole team to win.
- **換將 (SWAP)** costs your action — the foe hits your incoming hero for free. When your
  hero falls, the replacement pick is free. 鎖定 (lock) prevents swapping. Watch the
  3 team pips and the foe's 戰意 bar (a full bar means an ultimate is coming); the
  ▲/▼ hint shows the class matchup.
- **銅錢 economy**: every KO pays out — down an enemy hero for **+250**, get **+100**
  consolation when yours falls; **+500** for winning the battle, **+150** for losing.
  Money persists (localStorage). Spend it in the **商店** tab on the team screen:
  金創藥 (heal 35%), 淨心散 (cleanse), 烈酒 (+50 戰意), 護心鏡 (shield). Use items
  in battle from **道具 (BAG)** — it costs your action, like swapping.
- Pick a skill from the **技能 (FIGHT)** menu each turn; both sides resolve in speed order.
- Slot 1 is free, slots 2–3 have cooldowns, slot 4 is an ultimate gated by the 戰意 gauge.
- **Timed hits (hard mode)** — every skill has its own input pattern
  (完美 ×1.3 dmg +戰意, 不錯 ×1.0, 失手 ×0.55 **and no 戰意 gained**):
  - *Free skill*: a ring converges on the foe — click / press Space as it closes.
  - *Combo skill*: a 4-step **mixed** sequence — key chips (WASD/JK) and ⊙ aim-dots that
    must be clicked on the field; one wrong input = fail, flawless & fast = perfect.
  - *Heavy skill* (破甲/火攻): **hold** mouse or Space to charge, release the instant the
    growing ring meets the target — overcharge and it fizzles.
  - *Ultimate*: four **drifting** rings chain around the foe — each must be clicked
    dead-on (keyboard won't do; aim matters).
- **連擊 streak**: consecutive perfects stack +6% damage each (max +30%); any miss resets it.
- Faster enemies have tighter parry windows. Sloppy parries build your own break gauge fast.
- **Parry**: when the foe attacks, an orange ring converges on you — perfect timing
  takes **zero damage and counterattacks** (+戰意); good halves it; miss eats it all.
- **架勢 Break**: clean hits build the foe's break gauge (sloppy defense builds yours);
  at 100 the unit **staggers** — stunned + vulnerable.
- Class counter-triangle: 猛 › 守 › 謀 › 猛 (奇 is a wildcard). Beating your counter deals ×1.25.
- Keyboard: **1–4** menus/skills, **Esc** back, **Space/Enter/J** for timing.
- Reload for a fresh random matchup from the 25-hero roster.

## Run locally
It's a static site — no build step. From this folder:

```
python3 -m http.server 8451
```

then open http://localhost:8451/ .

*Placeholder emblem-badge sprites for now; real character art comes later.*
