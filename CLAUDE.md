# Dusklight – Projektregeln für Claude

2D-Jump-and-Run im Browser: zwei Welten (Ember/Frost), Plattformen sind nur in ihrer Welt fest. Vanilla ES-Module + Canvas 2D + WebAudio, **kein Build-Schritt**. Live: https://robinsp5.github.io/dusklight/ · Repo: github.com/RobinSp5/dusklight

## Skills: immer nutzen, wenn es passt

| Aufgabe | Skill / Agent |
|---|---|
| UI, Menüs, Screens, Styles ändern oder neu bauen | `taste-skill` (Design-Read + Pre-Flight-Check) und `web-design-guidelines` (Review gegen die Vercel-Regeln) |
| Etwas im Browser prüfen, Screenshots, E2E-Abläufe | `playwright-cli` (läuft gegen `http://localhost:5173`, Gamepad per `navigator.getGamepads`-Mock testbar) |
| Größere Features planen/umsetzen | oh-my-claudecode: Plan in `tasks/todo.md`, unabhängige Arbeit an Subagenten (`oh-my-claudecode:executor`, bei Leveldesign/Analyse mit `model: opus`) |
| Nach jeder größeren Änderung | **separater Review-Pass** mit `oh-my-claudecode:code-reviewer` (nie selbst absegnen), Funde mit Test reproduzieren und fixen |
| Neue Features / kreative Arbeit beginnen | `superpowers:brainstorming` bzw. kurzer Plan, dann umsetzen |
| Trailer / Demo-Video | `brag` (Workflow) + `hyperframes-core`, `hyperframes-cli`, `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-creative` |
| Bugs | `superpowers:systematic-debugging`: Ursache finden, nicht raten |

## Befehle

```bash
npm start              # node server.mjs → http://localhost:5173 (Cache-Control: no-store)
npm test               # Unit-Tests, Fairness, Tutorial-Demos, Solver (~2 Min.)
node tests/profile.mjs # Schwierigkeitsprofil pro Level
ONLY=5 node tests/solve.mjs   # Solver nur für ein Level
```

## Architektur

- `src/world.js` – **reine, deterministische Simulation** (fester Schritt 1/120 s, kein DOM, kein `Math.random`). Solver, Ghost, Tutorial-Demos und Trailer hängen davon ab: Determinismus nie brechen.
- `src/levels.js` – 8 Level über die Builder-API. Schilder-Tokens wie `{jump}` werden zur aktuellen Taste/Touch-Taste.
- `src/render.js` – Renderer (Parallax, Phasen-Blend, Partikel, Skins, Ghost). `new Renderer(canvas, { fit, viewH, minW })` für kleine Canvases.
- `src/progress.js` – Sterne/Par, Ghost-RLE, Skins, Todes-Log, Sanitizer für localStorage (rein, getestet).
- `src/input.js` – frei belegbare Tasten (`normalizeBindings`/`rebind`: keine Taste doppelt, Esc pausiert immer), Gamepad inkl. Menünavigation.
- `src/demos.js` + `src/demo-player.js` – geskriptete Szenen für Tutorial und Garderobe.
- `src/main.js` – Zustandsautomat, UI, Kamera, Speicherstand.

## Regeln, die beim Ändern gelten

1. **Level geändert →** `npm test` muss grün sein: Solver (jedes Level schaffbar, jeder Splitter erreichbar), `tests/fairness.mjs` (keine Deckendornen-Entscheidung um wenige Pixel) und `tests/profile.mjs` (tödliche Spalten und Gefahren steigen von Level 1 bis 8 **streng** an). Par-Zeiten in `src/progress.js` ggf. anpassen.
2. **Neues Modul in `src/` →** in die Import-Map in `index.html` eintragen (`tests/importmap.mjs` prüft das, sonst bricht der Deploy ab).
3. **Neues Icon →** Klasse `ph-…` in `assets/icons/icons.css` ergänzen (getrimmte, selbst gehostete Phosphor-CSS; `tests/icons.mjs` prüft das).
4. **Keine Drittanbieter-Requests** (DSGVO): Fonts und Icons liegen in `assets/`. Kein Google Fonts, kein CDN im Spiel.
5. **Tutorial-Demo geändert →** `node tests/demos.mjs`; Timings per Rastersuche mit Sicherheitsabstand wählen, nicht schätzen.
6. **localStorage-Daten** immer validieren (siehe Sanitizer in `progress.js`); der Spiel-Loop läuft in `try/finally`.
7. UI-Texte sind **Englisch**, Zahlenformat `en-US`. Keine Em-Dashes im sichtbaren Text.
8. `prefers-reduced-motion`/„Reduced effects“ respektieren, sichtbare Fokus-Zustände, `aria-label` für Icon-Buttons.

## Verifikation vor „fertig“

- `npm test` grün **und** Playwright-Durchlauf der betroffenen Screens (Desktop 1440×900 und Handy 390×844), 0 Konsolenfehler.
- Screenshots ansehen, nicht nur Zustände abfragen.

## Deploy

- Push auf `main` → GitHub Actions baut `_site` (nur `index.html`, `styles.css`, `src/`, `assets/`, Trailer) und ersetzt `__V__` durch den Commit-Hash (Cache-Busting).
- **Vor jedem Push den Nutzer fragen.** Danach Live-Seite mit Playwright prüfen.
- Commits mit `Co-Authored-By`-Zeile; `tasks/` und `brag-output*/` sind gitignored.

## Bekannte Fallstricke

- Playwright startet mit leerem Cache, der Nutzer nicht: nach Änderungen an HTML + JS einen Hard-Reload (Cmd+Shift+R) empfehlen.
- Shell ist **zsh**: `ffmpeg -map '0:a?'` quoten, `echo ===` vermeiden, für Wortaufteilung `bash -c` nutzen.
- GitHub zeigt große MP4s nicht im Repo an; der Trailer wird über Pages ausgeliefert (`/trailer.mp4`), die README nutzt ein GIF als Vorschau.
- Trailer-Musik (ENDE.APP) ist CC BY 4.0: Credit in der README behalten.
