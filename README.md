# 三國對弈 — Three Kingdoms Duel

A turn-based 1-v-1 dueling game with a Three Kingdoms cast. Speed-ordered turns,
cooldown skills, an energy-gated ultimate and a rich status kit, with
*Clair Obscur: Expedition 33*-style timed combat on top — you play on **both**
turns. UI mimics the Pokémon FireRed/LeafGreen battle screen.

**▶ Play:** https://rayli1120.github.io/three-kingdoms-duel/

## How to play
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
