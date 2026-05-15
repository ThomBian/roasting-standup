# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-05-13
> Files: 10 tracked

## ./

- `CLAUDE.md` — OpenWolf + RTK instructions (~1315 tok)
- `package.json` — Vite + React deps (~30 tok)
- `vite.config.js` — Vite config with React plugin (~10 tok)
- `index.html` — Entry HTML, loads Google Fonts (Bricolage Grotesque + Epilogue) (~20 tok)

## src/

- `main.jsx` — React entry point (~15 tok)
- `index.css` — Global CSS reset, design tokens (OKLCH colors, spacing, font vars) (~80 tok)
- `App.jsx` — Main app: all state (participants, rotation), all logic (shuffle, skip, pick, next, move), renders idle/done phases + StandupStage for running (~180 tok)
- `App.css` — Full component styles: header, panels, rotation list, buttons, empty states, responsive. Includes .main--stage for full-bleed running layout (~260 tok)
- `StandupStage.jsx` — Overdrive running phase: FLIP animation, fly-in, absolute-positioned cards (active spotlight + queue + done with emoji), TimerRing, AmbientCanvas. Action row below card: skip btn (non-last) or finish btn (last speaker) (~210 tok)
- `StandupStage.css` — Styles for StandupStage: pcard variants, spotlight glow @property, emoji-stamp, tring animations, stage-action-row with skip/finish btns (~200 tok)

## .claude/

- `settings.json` (~441 tok)

## .rtk/

- `filters.toml` — Project-local RTK filters (~136 tok)
