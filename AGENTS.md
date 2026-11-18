# Toon shading guide

A step-by-step web guide (steps 0–12) that rebuilds SakuraRabbit's ToonRain toon look in Blender 5.3 EEVEE, from a bare mesh to the full shader, lights and compositor. Each step has text, Blender UI screenshots, a downloadable `.blend`, and a three.js 3D view that reproduces that step's math in the browser.

Live: https://toon-guide-production.up.railway.app

## Layout

- `blender/guide_lib.py` is the single source of truth for every step. `STEPS[n]` is a list of `Sub(key, fn, on, shot)`:
  - `on` says what a sub-step edits: `mats` (Skin, then Sweater), `sweater`, `floor` or `scene`.
  - `shot` says what `shots.py` captures after it; see the `Sub` docstring.
  - The constants at the top (`CEL_LO`, `SELF_SHADOW`, `SPOTS`, `RIM`, ...) are SakuraRabbit's Unity material values.
- `blender/build_guide.py` builds `web/public/blend/stepN.blend`, the web assets, the reference renders `web/public/ref/*.png` (the `REFS` dict), and `web/src/generated/scene.json`.
- `blender/shots.py` captures the Blender UI screenshots in `web/public/shots/<sub key>.png`, plus `sN_viewport.png`.
- `web/` is a Vite 8 + TypeScript + three.js app:
  - `src/content/stepN.ts`: page text, built with the helpers in `content/kit.ts`: `sec(viewState, html)`, `shot`, `img`, `box('do'|'why'|'num'|'warn')`, `widget`.
  - `src/viewer.ts`: the 3D view. One ShaderMaterial; `ViewState.mode`/`lv`/`show` pick how far down the node tree to evaluate. The `lv` codes are listed on `ViewState`.
  - `src/widgets.ts`: the 2D explainer canvases.
  - `src/main.ts`: routing (`#/N`), and which section drives the 3D view.

## Inputs outside this repo

These are read from the parent folder `C:\Users\frixa\stuff\unity-sr\` and are not committed:

- `blender/export/` (mesh JSON, `lights_final.json`, `scene.json`) and `blender/textures/`.
- `ToonRain/Assets/Shader/Toon/*.hlsl`: the Unity shader the math follows. `ToonLighting.hlsl` is the main reference.
- `blender/ToonRain.blend`: the full port, used for comparisons.

`web/public/` is generated from the model and is gitignored: the model's license is personal use only. Never commit it, any render, or any texture.

## Commands

The shell is PowerShell. Python exists only inside Blender:

`$B = "C:\Users\frixa\blender-launcher\stable\blender-5.3.0-stable.02f0899d78e3\blender.exe"`

- Build `.blend` files, assets and refs (takes several minutes):
  `& $B -b --factory-startup --python-exit-code 1 --python blender\build_guide.py`
  - `GUIDE_STEPS="4,5"` limits the steps.
  - `GUIDE_ONLY_REF=1` renders refs only.
- Screenshots need a real window, not `-b`:
  `Start-Process $B '--factory-startup','--enable-event-simulate','--window-geometry','0','0','2400','1340','--python','blender\shots.py'`
  - `GUIDE_SHOTS="4,5"` limits the steps.
  - `GUIDE_NO_VIEWPORT=1` skips the 14 s viewport shots.
  - Blender 5.3 needs `--enable-event-simulate` for `window.event_simulate`.
  - The screen is 2560×1440.
- Web, from `web/`:
  - `npm run dev` serves on port 5173.
  - `npm run build` runs `tsc --noEmit` and `vite build`.

## Keeping things in sync

- A change to a step's math goes in `guide_lib.py`. Rebuild that step, and mirror the change in `viewer.ts`'s shader so Compare (browser view vs `ref/*.png`) still lines up.
- Numbers shown on the web come from `scene.json`. Don't hard-code a value that `build_guide.py` exports.
- After changing a sub-step, rerun `shots.py` for that step and look at the new screenshots.

## Writing the content

- The reader is a programmer comfortable with math and physics, and a Blender beginner who knows a few shader nodes.
  - Explain every node from first principles: what question it answers and why this formula. "Just to get the colour we want" is not an explanation.
  - Introduce a concept where it's first used.
- Every "add this / wire X to Y" instruction gets a screenshot. Each section's `data-state` should show the value being discussed (`show: ...`).
- Only state Blender or Unity behaviour that has been checked. Otherwise word it as a possibility.
- Page text sits inside template literals. In a single-quoted string inside one, such as a `shot()` caption, an apostrophe must be written `\'`, or the build breaks.

## Verify

1. Run `npm run build`.
2. Open the affected step at `localhost:5173` with `agent-browser`.
3. Scroll each changed section into view, screenshot it with Compare on and off, and look at the result.

## Deploy

The Railway service is `toon-guide` in the `main` project (workspace `personal`). It deploys from the local folder, so the gitignored assets go up too. Pushing to GitHub does not deploy.

From `web/`:

```powershell
railway link -w personal -p main -s toon-guide   # once per machine
railway up --no-gitignore --service toon-guide --ci
```

`web/Dockerfile` builds the app with Node and serves `dist/` with Caddy on `$PORT`. `.railwayignore` keeps `node_modules` and `dist` out of the upload.

Deploy only when asked.
