# Dusklight

A 2D platformer between two worlds. Ember platforms are only solid in Ember, Frost platforms only in Frost. Switch worlds (even mid-jump) to make your path appear.

## Run

```bash
npm start            # node server.mjs (no-cache dev server on port 5173)
# then open http://localhost:5173
```

No build step: plain ES modules, Canvas 2D and WebAudio.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | A/D or ←/→ | Left stick / D-pad |
| Jump (hold to jump higher) | Space, W, ↑ | A |
| Dash (once per jump) | X, K | X / RT |
| Switch world | Shift, J, C | B / Y / RB |
| Pause / resume | Esc, P | Start |
| Restart level / mute | R / M | |

On first launch an animated tutorial shows each move as a live, scripted game scene (replay it from Settings). Touch devices get on-screen buttons. The in-game **Settings** page lists every control and has master, music and effects volume, mute, screen shake, reduced effects, a timer toggle and a progress reset.

## Levels

| # | Name | Focus |
|---|---|---|
| 1 | Awakening | moving, jumping, first world switch |
| 2 | Tides | switching mid-air, dash |
| 3 | Hall of Mirrors | springs, phase corridor, one-way platforms |
| 4 | Threshold | no floor, two-tile platforms |
| 5 | Thorn Hall | hanging spikes: control your jump height |
| 6 | Flux | phase spikes that only hurt in their own world |
| 7 | Star Leap | spring chains, dash gaps over a spike floor |
| 8 | Zenith | everything combined, single tiles, few checkpoints |

## Structure

- `src/world.js` – pure simulation (fixed 120 Hz step, coyote time, jump buffer, dash, springs, one-way platforms, phase collision)
- `src/levels.js` – the 8 levels, written with a small builder API
- `src/render.js` – procedural parallax backdrop, world colour blend, particles, scarf physics
- `src/audio.js` – synthesised effects and an ambient pad on separate music and effects buses
- `src/settings.js` – persisted player settings
- `src/demos.js` – scripted tutorial scenes running on the real simulation
- `src/main.js` – state machine, UI, camera, save data (localStorage)

## Tests

```bash
npm test                # swap regression test + tutorial demo check + solver
npm run solve           # solver: every level is finishable and every shard reachable, using the real physics
node tests/profile.mjs  # difficulty profile: deadly columns, hazards, landing widths, checkpoint spacing
```

## Deploy

Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`. The workflow copies only the game files (`index.html`, `styles.css`, `src/`) and replaces `__V__` with the commit hash, so every release gets fresh, consistent URLs. When you add a module to `src/`, list it in the import map in `index.html` (`node tests/importmap.mjs` checks this).
