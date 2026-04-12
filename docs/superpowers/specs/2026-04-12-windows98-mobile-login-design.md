# Windows 98 Boot Sequence & Mobile Shell Design

**Date:** 2026-04-12
**Project:** swastikthapaliya.com.np — personal portfolio

---

## Problem Statement

Two issues degrade the user experience:

1. **Login screen flash** — `#main-content` is hidden via jQuery on `document.ready`, meaning the desktop briefly renders before the login dialog covers it. Users on fast connections see a split-second flash of the desktop.
2. **Mobile block** — users on screens ≤1024px see a "this site wasn't built for mobile" message and only a Resume button. The full Windows 98 desktop is completely inaccessible.

Additionally, the login screen's sole functional purpose is to satisfy browser autoplay policy so the Win98 startup sound can play. It has no authentication logic. A more authentic Win98 entry experience can replace it while preserving the audio gate.

---

## Goals

- Replace the login dialog with an authentic Win98 boot sequence on all devices.
- Fix the desktop flash so `#main-content` is never visible before boot completes.
- Provide a mobile shell (≤768px) that looks and feels like Windows 98 — no modern UI patterns, no compromises on aesthetic.
- Keep the existing desktop experience exactly as-is.

**Guiding principle:** if a feature cannot be made to look like it shipped with Windows 98, it is cut or simplified — not styled to look "close enough."

---

## Section 1 — Flash Fix

**Problem:** `#main-content` is not hidden in CSS, only in JS (`personal_win.js` line 4: `$("#main-content").hide()`). Between first paint and script execution, the desktop is visible.

**Fix:** Add `style="display:none"` directly to the `#main-content` div in `index.html`. The existing `fadeIn()` call in JS continues to work as before. No other changes needed.

---

## Section 2 — Boot Sequence (replaces login dialog)

The `#alert-box` login dialog and its CSS (`alert.css`) are removed. A new `#boot-screen` overlay is added to `index.html` above `#main-content`. It is visible from first paint (no `display:none`) and removed after the sequence completes.

### Boot Screen Structure

```html
<div id="boot-screen">
  <div id="boot-post"></div>       <!-- Phase 1: POST text -->
  <div id="boot-splash"></div>     <!-- Phase 2: Win98 logo + progress bar -->
</div>
```

### Phase 1 — POST Screen

- Black background, white `monospace` text.
- Displays static BIOS-style lines (non-interactive, ~1.5s display):
  ```
  SWASTIK THAPALIYA BIOS v98.0 (C) 1998
  CPU: Pentium II 450MHz
  Memory Test: 524288K OK
  Detecting IDE drives... OK
  Loading Windows 98...
  ```
- Bottom line blinks: `Press any key to continue_` (cursor blink via CSS `animation`).
- On keydown or touchstart anywhere on the screen: play startup sound, transition to Phase 2.
- This is the browser autoplay gate — the user gesture unlocks audio.

### Phase 2 — Win98 Splash Screen

- Black background.
- Centered Win98 wordmark image (authentic logo asset — to be sourced or recreated as SVG matching original colors: "Windows" in grey, "98" in the four-color logo treatment).
- Below the logo: the authentic indeterminate progress bar.
  - Bar dimensions: ~300px wide, ~10px tall.
  - Composed of repeating blue block segments (`#000080` or `#0000AA`) that cycle left-to-right in a repeating CSS animation — not a fill animation, a marquee/scroll of blocks.
  - Pure CSS implementation, no image required.
- Displays for ~2s then fades out (the one CSS transition allowed — Win98 did fade its splash).
- On fade-out: `#boot-screen` is removed from DOM, `#main-content` fades in, desktop icons stagger in (existing `load_third_parties()` logic unchanged).

### Build System Note

There is no build tool (no `package.json`, no webpack). `dist/app.min.js` is a manually maintained minified file. `boot.js` is the current window management source file — it is what gets minified into `dist/app.min.js`. `personal_win.js` is an older copy and is not loaded by `index.html`.

**Implementation approach:** Switch `index.html` to load source files directly (unminified) instead of `dist/app.min.js`. This removes the manual minification step and makes editing straightforward. Two `<script>` tags replace the single `dist/app.min.js` tag:
```html
<script defer src="boot-sequence.js"></script>
<script defer src="boot.js"></script>
```

### Files Changed

| File | Change |
|------|--------|
| `index.html` | Remove `#alert-box`. Add `#boot-screen` above `#main-content`. Add `display:none` to `#main-content`. Replace `dist/app.min.js` script tag with `boot-sequence.js` + `boot.js`. |
| `alert.css` | Delete entirely (only used by login dialog). |
| `boot-sequence.js` | New file. Owns the POST → splash → desktop sequence. Plays audio on user interaction. Calls into `boot.js` to initialize the desktop after boot. |
| `boot.js` | Remove login dialog click handler and mobile-block branch (`width <= 1024`). Keep all window/taskbar/Clippy logic. Expose `initDesktop()` function for `boot-sequence.js` to call. |
| `app.css` | Add `#boot-screen`, `#boot-post`, `#boot-splash`, and progress bar styles. |
| `assets/images/` | Add Win98 wordmark asset (PNG — to be downloaded, authentic original). |

---

## Section 3 — Mobile Shell (≤768px)

A `mobile.css` file and a mobile JS block within `personal_win.js` activate at `window.innerWidth <= 768`. The desktop code path is untouched.

### Guiding Rule

Every element must look like it belongs in Windows 98. No smooth slide animations, no rounded corners, no modern patterns. Windows appear instantly (no transition). The start menu appears instantly. Win98 grey (`#c0c0c0`), inset/outset borders, MS Sans Serif — all preserved.

### Desktop Icons

- Reflowed into a 2-column grid via CSS flexbox/grid, positioned at top-left of the screen (below any status area, above the taskbar).
- Same icon images and label text as desktop.
- Single-tap selects (adds `selected` class, same highlight style as desktop).
- Double-tap opens the window. On touch devices, double-tap is detected via a 300ms tap interval check in JS.
- Icons that are excluded on mobile (hidden via `mobile.css`):
  - **MSN** — opens a web archive URL, not meaningful on mobile.
  - **Email** — `mailto:` links work on mobile natively; the icon can stay if space allows, cut if it crowds the grid.

### Windows

- Open full-screen: `position: fixed; top: 0; left: 0; width: 100%; height: calc(100% - 40px)` (40px = taskbar height).
- Keep authentic Win98 window chrome: title bar with icon + title text, three control buttons (minimize, maximize, close) using existing CSS classes.
- No `draggable()` initialized on mobile.
- No `resizable()` initialized on mobile.
- Maximize button is functional (already defaults to full-screen on mobile, so it is visually pressed/active by default).
- Window content scrolls vertically via `overflow-y: auto` on the content div — no styling changes, native scroll.

### Window-Specific Mobile Behavior

**My Computer (biography)**
- Lottie player width set to `100%` (overrides fixed `640px`).
- Height set to `auto`. If the animation does not scale cleanly at mobile widths, the `#biography-content` desktop icon is hidden on mobile and the window is not openable.
- Evaluated during implementation — include only if it renders correctly.

**My Documents**
- The split-pane layout (left pane + right pane) does not work at mobile width.
- On mobile: left pane is hidden. Right pane takes full width. Folder items display as a single-column list instead of a grid.
- Clicking a folder item opens the link directly (`window.open`) — no left-pane detail panel.
- Status bar remains at the bottom (it fits at any width).

**Résumé**
- The `<embed>` PDF is hidden on mobile via `mobile.css` (`display: none`).
- The existing Download and View buttons (already in `index.html` in `#resume-header`) are displayed full-width, stacked vertically.
- Button style unchanged — same Win98 button appearance.

### Start Menu

- Triggered by tapping the Start button (existing handler works for touch).
- On mobile: sidebar image (`.start-menu-sidebar`) is hidden — too narrow.
- Menu items go full-width.
- Menu appears instantly (no transition). Disappears on tap outside (existing `$(document).click()` handler covers this via touch events).
- Start menu width expands to `220px` on mobile to accommodate touch targets.

### Taskbar

- No changes. Already `position: fixed; bottom: 0; width: 100%`. Renders correctly on mobile.
- Clock, sound icon, and taskbar items all carry over.
- Taskbar items (minimized windows) truncate title text with `text-overflow: ellipsis` if needed — added in `mobile.css`.

### Clippy

- Loads on mobile if screen width allows (≥375px).
- Pinned to `position: fixed; bottom: 50px; right: 10px` (above taskbar) via `mobile.css`.
- Tap triggers animation/speech (existing `agent.animate()` / `agent.speak()` behavior).
- If Clippy's iframe/canvas visually breaks on mobile at any point during implementation, it is cut from the mobile shell entirely.

### Files Added/Changed

| File | Change |
|------|--------|
| `mobile.css` | New file. All mobile overrides under `@media (max-width: 768px)`. Loaded after `app.css` in `index.html`. |
| `boot.js` | Mobile JS block added here (replaces existing `width <= 1024` branch). Disable `draggable()`/`resizable()` on mobile. Handle double-tap detection for icons. |
| `my_documents.css` | Mobile overrides for split-pane layout moved to `mobile.css`. |

---

## Section 4 — What Does Not Change

- All desktop window logic (`openWindow`, draggable, resizable, z-index stacking).
- Taskbar JS (clock, sound toggle, taskbar items).
- Start menu desktop behavior.
- Clippy desktop behavior and animations.
- All CSS for desktop (`.window`, `.taskbar`, `.start-menu`, `.desktop-icon`, etc.).
- `my_documents.css` desktop styles.
- `app.css` desktop styles.
- All existing HTML content (biography, documents, resume window contents).

---

## Out of Scope

- Any backend or server-side changes.
- SEO / meta tag changes.
- New portfolio content (articles, projects).
- Winamp window or other new desktop features.
- IE browser compatibility.
