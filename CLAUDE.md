# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio for Swastik Thapaliya (https://www.swastikthapaliya.com.np), built as a
working **Windows 98 desktop** in the browser: login dialog → desktop with icons → draggable/
resizable windows → taskbar + Start menu → Clippy.

Static site. No package.json, no bundler, no framework, no tests. Runtime deps are loaded from
CDN: jQuery 3.7.1, jQuery UI 1.12.1 (draggable/resizable), `@dotlottie/player-component` and
`lottie-player`. Vendored: `assets/js/clippy.js` + `agents/Clippy/` (sprite sheet + sound data).

## THE HARD RULE: Windows 98 or nothing

Every visual decision must look like it shipped with Windows 98 in 1998. This is the whole point
of the site, not a theme layered on top of it.

- **If a feature can't be made to look like Win98, cut or simplify it — never "close enough."**
- No modern UI patterns: no rounded corners, no soft/elevated shadows, no gradients other than
  the title-bar one, no easing curves, no flat/material/glass, no modern icon sets, no
  system-font stacks, no hamburger menus, no toasts, no dark mode.
- Reuse existing chrome before inventing new chrome. Anything new must be assembled from the
  same primitives: 2px bevels, `#c0c0c0` face, 16px raster icons, MS Sans Serif.

### Design tokens (already established in CSS — match them exactly)

| Purpose | Value |
|---|---|
| Desktop background | `#008080` (teal) |
| Window/dialog/taskbar face | `#c0c0c0` |
| Title bar, active | `linear-gradient(to right, #000080, #3366cc)` + white bold text |
| Title bar, inactive | `#9e9e9e` (`.window-header.inactive`) |
| Selection highlight | `#000080` bg, white text, `1px dotted #fff` focus rect |
| Bevel highlight / shadow | `#fff` / `#000`, mid-shadow `#808080`, `#868a8e` |
| Hatch fill (pressed Start, active taskbar item, scrollbar track) | `assets/images/dot.png` + `image-rendering: pixelated` |

- **Raised bevel:** `border: 2px solid; border-color: #fff #000 #000 #fff`
- **Pressed/inset:** invert it — `border-color: #000 #fff #fff #000` (see `:active` rules)
- **Fonts:** `"MS Sans Serif"` (self-hosted, `fonts/MS-Sans-Serif.ttf`) everywhere; Verdana bold
  12px for title-bar text and the active taskbar item.
- **Cursor:** `assets/sprites/mouse.cur` (set on `body` in `my_documents.css`).
- **Keyboard mnemonics:** underline the accelerator letter with `<u>` (`<u>I</u>nstagram`).
- **Icons:** 16px in chrome, 32px on the desktop, from `icons/`. Window control buttons are one
  sprite sheet (`icons/window-control-button.png`) positioned with `background-position`.

Period-authentic assets are sourced from real Win98 material (Wikimedia Commons, archive.org,
98.js.org, donchia.tech — the last two are credited in the Résumé window). Keep sourcing that way;
do not substitute modern lookalikes.

## Build & run

There is no build step for HTML/CSS — edit and reload. Serve over HTTP (not `file://`) so the
PDF embed, audio and Lottie JSON load:

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

**JS is the exception — `index.html` loads `dist/app.min.js`, not the source file.** Edits to
`personal_win.js` do nothing until you re-minify. Verified to reproduce the committed bundle
byte-for-byte:

```bash
npx terser personal_win.js -c -m -o dist/app.min.js
```

Then bump the cache-buster in `index.html` (`<script defer src="dist/app.min.js?v=20260412">`) to
today's date. Forgetting either step is the #1 way a change appears to "not work."

## Architecture

**Boot gate.** `#alert-box` (a fake Win98 login dialog, credentials hardcoded and inert) covers
the page; `#main-content` is hidden by JS on `document.ready`. Clicking **OK** hides the dialog,
fades in the desktop, plays `assets/audio/win98-startup.mp3`, staggers the desktop icons in with
random 500–1000ms delays, and loads Clippy. The dialog exists **to satisfy browser autoplay
policy** — the startup sound needs a user gesture. Any replacement must preserve that gesture.

**Windows are cloned from hidden templates.** Each window's markup lives in the page as a hidden
`<div id="{id}-content" data-title="..." style="display:none">`. `window.openWindow(id)` reads
`data-title` + `innerHTML`, wraps them in the window-chrome template string, appends to `body`,
then wires draggable/resizable, the taskbar item, and minimize/maximize/close. Consequences:

- Adding a window = add a hidden `#{id}-content` div + a `.desktop-icon` with
  `ondblclick="openWindow('id')"`, plus a case in `resolveImagePath()` for its title-bar icon.
- The template's IDs get **duplicated** into the DOM when a window opens. Look elements up scoped
  to `$(this).closest(".window")`, never by bare `#id`.
- Per-window behavior is branched inside `openWindow` by `id` (`biography` = fixed 640×360,
  non-resizable, maximize disabled; `resume` = `.window-resume-content`).
- Reopening an existing window shows it and bumps `zIndexCounter` instead of re-creating it.

**Stacking & focus.** A single module-level `zIndexCounter` (starts at 1000) increments on every
open/focus/taskbar click. "Focus" is cosmetic: `deactivateWindow()` adds `.inactive` to every
`.window-header` and removes it from the active one. Minimize = `.hide()`, close = `.remove()`
(plus removing the taskbar item).

**My Documents explorer.** `#documents-content` is a full Win98 Explorer: menu bar, address bar,
left detail pane, icon grid, status bar. Each `.folder-item` carries its metadata in
`data-title` / `data-created` / `data-description`, and `ondblclick` opens the real external URL.
Clicking one copies those attributes into the left pane and swaps
`.left-pane-content-inactive` ⇄ `.left-pane-content-active` and the two status-bar spans. To add
a document, copy a `.folder-item` block — no JS change needed.

**Easter egg.** Opening **My Computer** swaps its icon and title to DoomGuy / `Doom.exe`
(`changeLogoToSlayer`); closing it restores them (`changeLogoToMyComputer`).

**Clippy.** `clippy.load("Clippy", cb)` reads `clippy.BASE_PATH = "./agents/"` →
`agents/Clippy/{agent.js,map.png,sounds-*.js}`. The greeting text (currently the Docsmith gem
plug) is inline in `personal_win.js`, and a random animation fires every 10s. Clippy mounts
inside `#main-content`.

**Taskbar tray.** Clock updates every second via `toLocaleTimeString`. The speaker icon toggles
`#taskbar-sound-on`/`#taskbar-sound-mute` and pauses+rewinds every `<audio>` element.

**Mobile today:** at `width <= 1024` the boot dialog hides the OK button and inputs and shows a
"try this on a desktop" message with only a Résumé button — the desktop is unreachable. Replacing
this is the subject of the in-flight work below.

## File map

| File | Role |
|---|---|
| `index.html` | Everything structural: meta/SEO, desktop icons, hidden window templates, Start menu, taskbar |
| `personal_win.js` | **The** application source — boot gate, `openWindow`, taskbar, clock, Clippy, easter egg |
| `dist/app.min.js` | Minified `personal_win.js`; this is what the page actually loads |
| `boot.js` | **Stale.** A byte-identical copy of `personal_win.js` lines 1–72 (boot gate only). Not referenced by `index.html`, not in the bundle. Ignore it or delete it — do not edit it expecting an effect |
| `app.css` | Core Win98 shell: font-face, taskbar, Start menu, window chrome, desktop icons, résumé window |
| `alert.css` | The login/boot dialog only |
| `my_documents.css` | Explorer window only (also sets the global custom cursor) |
| `assets/css/clippy.css`, `assets/js/clippy.js`, `agents/Clippy/` | Vendored Clippy — treat as third-party, don't refactor |
| `assets/body-movin/optimized-mycomputer.json` | Lottie animation inside the My Computer window |
| `assets/files/resume.pdf` | Served by the Résumé window's `<embed>`, the Download button and the Start menu |
| `docs/superpowers/` | Design spec + implementation plan for the in-flight boot/mobile work |

> The `docs/superpowers/` spec states that `boot.js` is the minified source and `personal_win.js`
> is the stale copy. That is backwards — verify against the bundle before trusting it.

## In-flight work

Branch `feat/win98-boot-mobile` (git worktree at `.worktrees/`, which is gitignored) implements
`docs/superpowers/plans/2026-04-12-windows98-mobile-login.md`: replace the login dialog with an
authentic BIOS POST → Win98 splash boot sequence (`boot-sequence.js`), fix the pre-login desktop
flash, and add a Win98-faithful mobile shell at ≤768px (`mobile.css`). Read the plan and spec in
`docs/superpowers/` before touching boot or mobile code.

## Conventions

- jQuery-first, everything inside one `$(document).ready`. Functions called from inline HTML
  handlers must be attached to `window` (`window.openWindow`, `window.viewResume`).
- Behavior is wired with inline `ondblclick` / `onclick` in `index.html`. Match that style rather
  than introducing a separate event-registration layer.
- External links: `target="_blank"`. Period links (MSN, microsoft.com) point at web.archive.org
  captures from 1998–99 on purpose — keep them pointing at era-correct snapshots.
- **Push = deploy.** Cloudflare auto-deploys from git, so anything committed to the tracked branch is live immediately — there is no staging step. Verify locally, re-minify `dist/app.min.js`, and bump the cache-buster BEFORE pushing. Deploys track `master`; `origin/main` also exists. Update `sitemap.xml` if URLs ever change.
