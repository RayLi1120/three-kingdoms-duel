# 三國對弈 — Three Kingdoms Duel

A turn-based 1-v-1 dueling game with a Three Kingdoms cast. Speed-ordered turns,
cooldown skills, an energy-gated ultimate and a rich status kit, with
*Clair Obscur: Expedition 33*-style timed combat on top — you play on **both**
turns. UI mimics the Pokémon FireRed/LeafGreen battle screen.

**▶ Play:** https://rayli1120.github.io/three-kingdoms-duel/

## How to play
- Pick a skill from the **技能 (FIGHT)** menu each turn; both sides resolve in speed order.
- Slot 1 is free, slots 2–3 have cooldowns, slot 4 is an ultimate gated by the 戰意 gauge.
- **Timed hits** — every skill has its own input pattern (完美 ×1.3 dmg +戰意, 不錯 ×1.0, 失手 ×0.7):
  - *Free skill*: a ring converges on the foe — click / press Space as it closes.
  - *Combo skill*: a 3-key sequence (WASD/JK) appears — type it in order (or click the
    key chips); fast & flawless = perfect, one wrong key = fail.
  - *Heavy skill* (破甲/火攻): **hold** mouse or Space to charge, release the instant the
    growing ring meets the target — overcharge and it fizzles.
  - *Ultimate*: three rings chain at random spots around the foe — hit each one.
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
