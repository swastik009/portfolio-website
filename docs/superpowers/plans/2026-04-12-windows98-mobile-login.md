# Windows 98 Boot Sequence & Mobile Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login dialog with an authentic Win98 boot sequence, fix the desktop flash, and add a Win98-faithful mobile shell for screens ≤768px.

**Architecture:** A new `boot-sequence.js` owns the POST→splash→desktop boot flow and acts as the browser autoplay gate. `boot.js` (existing) is refactored to expose `initDesktop()` and drop its login/mobile-block logic. A new `mobile.css` overrides layout at ≤768px with no modern UI patterns — everything must look like it shipped with Windows 98.

**Tech Stack:** Vanilla JS, jQuery 3.7.1, jQuery UI 1.12.1, CSS animations, static HTML — no build tool. Source files are loaded directly from `index.html` (switching away from `dist/app.min.js`).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `index.html` | Modify | Remove `#alert-box`, add `#boot-screen`, add `display:none` to `#main-content`, swap script tags, add `mobile.css` link |
| `alert.css` | Delete | No longer needed once login dialog is removed |
| `app.css` | Modify | Add boot screen styles (POST, splash, progress bar) |
| `boot-sequence.js` | Create | POST phase, splash phase, audio gate, calls `window.initDesktop()` |
| `boot.js` | Modify | Remove login handler, remove mobile block, expose `window.initDesktop()`, add mobile JS (double-tap, disable drag/resize) |
| `mobile.css` | Create | All mobile overrides ≤768px — icon grid, full-screen windows, My Documents single-column, resume buttons, start menu, Clippy pin |
| `assets/images/win98-logo.png` | Add | Authentic Windows 98 wordmark for splash screen |

---

## Task 1: Flash Fix

**Files:**
- Modify: `index.html` (one attribute change)

- [ ] **Step 1: Add `display:none` inline to `#main-content`**

In `index.html` line 99, change:
```html
<div id="main-content">
```
to:
```html
<div id="main-content" style="display:none">
```

- [ ] **Step 2: Verify**

Open `index.html` in a browser. The teal desktop background should NOT be visible before the login dialog appears. Previously there was a split-second flash of icons — it should be gone.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: hide main-content in HTML to eliminate pre-login flash"
```

---

## Task 2: Remove Login Dialog & Wire Up Boot Screen HTML

**Files:**
- Modify: `index.html`
- Delete: `alert.css`

- [ ] **Step 1: Remove `#alert-box` from `index.html`**

Delete lines 52–97 (the entire `#alert-box` div):
```html
<!-- DELETE from here -->
<div id="alert-box" class="alert-window">
  ...
</div>
<!-- to here -->
```

- [ ] **Step 2: Add `#boot-screen` above `#main-content`**

Insert the following immediately before `<div id="main-content" style="display:none">`:

```html
<div id="boot-screen">
  <div id="boot-post">
    <div id="boot-post-text">
      <p>SWASTIK THAPALIYA BIOS v98.0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(C) 1998 Swastik Inc.</p>
      <br />
      <p>CPU: Pentium II 450MHz</p>
      <p>Memory Test: 524288K OK</p>
      <p>Detecting Primary Master... Seagate ST34311A</p>
      <p>Detecting IDE drives... OK</p>
      <br />
      <p>Starting Windows 98...</p>
      <br />
      <p id="boot-press-key">Press any key to continue</p>
    </div>
  </div>
  <div id="boot-splash">
    <img src="assets/images/win98-logo.png" alt="Windows 98" id="boot-logo" />
    <div id="boot-progress-bar">
      <div id="boot-progress-inner"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Replace script tag and remove alert.css link**

Remove this line:
```html
<link rel="stylesheet" href="alert.css" type="text/css" />
```

Replace:
```html
<script defer src="dist/app.min.js"></script>
```
with:
```html
<script defer src="boot-sequence.js"></script>
<script defer src="boot.js"></script>
```

- [ ] **Step 4: Delete alert.css**

```bash
rm /Users/swastik/Documents/personal-website/main/alert.css
```

- [ ] **Step 5: Verify**

Open `index.html`. You should see a black screen (boot screen) — possibly blank since no CSS/JS yet, but no login dialog and no desktop flash.

- [ ] **Step 6: Commit**

```bash
git add index.html
git rm alert.css
git commit -m "chore: remove login dialog, wire boot screen HTML, swap script tags"
```

---

## Task 3: Boot Screen CSS

**Files:**
- Modify: `app.css` (append to end of file)

- [ ] **Step 1: Append boot screen styles to `app.css`**

Add the following to the bottom of `app.css`:

```css
/* ============================================================
   Boot Screen
   ============================================================ */

#boot-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #000;
  z-index: 999999;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  transition: opacity 0.5s ease;
}

/* Phase 1: POST screen */
#boot-post {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 20px;
}

#boot-post-text {
  color: #c0c0c0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
}

#boot-post-text p {
  margin: 0;
  padding: 0;
}

#boot-press-key {
  color: #c0c0c0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
}

#boot-press-key::after {
  content: '_';
  animation: blink-cursor 1s step-end infinite;
}

@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* Phase 2: Win98 Splash screen */
#boot-splash {
  display: none;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

#boot-logo {
  width: 240px;
  height: auto;
}

/* Authentic Win98 indeterminate progress bar */
#boot-progress-bar {
  width: 300px;
  height: 12px;
  background: #000;
  border-top: 2px solid #808080;
  border-left: 2px solid #808080;
  border-bottom: 2px solid #fff;
  border-right: 2px solid #fff;
  overflow: hidden;
}

#boot-progress-inner {
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    #000080 0px,
    #000080 14px,
    #000000 14px,
    #000000 18px
  );
  width: 500%;
  animation: win98-march 0.6s linear infinite;
}

@keyframes win98-march {
  from { transform: translateX(0); }
  to   { transform: translateX(-18px); }
}
```

- [ ] **Step 2: Verify**

Open `index.html`. You should see a black screen with the POST-style text visible in grey monospace, and the blinking cursor after "Press any key to continue".

- [ ] **Step 3: Commit**

```bash
git add app.css
git commit -m "feat: add boot screen CSS (POST phase and Win98 splash styles)"
```

---

## Task 4: Download Win98 Logo Asset

**Files:**
- Add: `assets/images/win98-logo.png`

- [ ] **Step 1: Download the Windows 98 wordmark**

Use WebFetch or a browser to download an authentic Windows 98 logo PNG (black background, the official "Windows 98" wordmark with the four-color flag icon). Save it to:

```
assets/images/win98-logo.png
```

The image should look like the actual Windows 98 splash screen logo — the waving flag in four colors (red, green, blue, yellow) beside "Windows" in thin white text and "98" below it. Target dimensions: approximately 240px wide so it renders sharply at `width: 240px` in the splash screen.

If the sourced image has a non-black background, open it in any image editor and remove the background so it renders cleanly on the black splash screen.

- [ ] **Step 2: Verify**

Open `index.html` — the splash screen isn't visible yet (JS not written), but check the asset exists:
```bash
ls -la assets/images/win98-logo.png
```

- [ ] **Step 3: Commit**

```bash
git add assets/images/win98-logo.png
git commit -m "feat: add Win98 wordmark asset for boot splash screen"
```

---

## Task 5: Create boot-sequence.js

**Files:**
- Create: `boot-sequence.js`

- [ ] **Step 1: Create `boot-sequence.js`**

Create `/Users/swastik/Documents/personal-website/main/boot-sequence.js` with the following content:

```javascript
(function () {
  var bootScreen = document.getElementById('boot-screen');
  var bootPost = document.getElementById('boot-post');
  var bootSplash = document.getElementById('boot-splash');
  var audio = document.getElementById('win98-startup');
  var interacted = false;

  function onUserInteraction() {
    if (interacted) return;
    interacted = true;

    document.removeEventListener('keydown', onUserInteraction);
    document.removeEventListener('touchstart', onUserInteraction);
    document.removeEventListener('click', onUserInteraction);

    // Play startup sound — this is inside a user gesture so autoplay is allowed
    if (audio) {
      audio.play().catch(function () {
        // Autoplay blocked — fail silently, desktop still loads
      });
    }

    // Switch from POST to splash phase
    bootPost.style.display = 'none';
    bootSplash.style.display = 'flex';

    // After splash display duration, fade out and show desktop
    setTimeout(function () {
      bootScreen.style.opacity = '0';
      setTimeout(function () {
        bootScreen.style.display = 'none';
        if (typeof window.initDesktop === 'function') {
          window.initDesktop();
        }
      }, 500); // matches CSS transition: opacity 0.5s
    }, 2200); // splash visible for ~2.2s
  }

  document.addEventListener('keydown', onUserInteraction);
  document.addEventListener('touchstart', onUserInteraction);
  document.addEventListener('click', onUserInteraction);
})();
```

- [ ] **Step 2: Verify**

Open `index.html`. You should see the POST screen. Press any key (or tap on mobile). The POST text should disappear, the Win98 splash (logo + scrolling progress bar) should appear for ~2 seconds, then fade out. The desktop will be blank since `initDesktop()` isn't exposed yet — that's expected.

- [ ] **Step 3: Commit**

```bash
git add boot-sequence.js
git commit -m "feat: add boot-sequence.js with POST, splash, and audio gate"
```

---

## Task 6: Refactor boot.js — Remove Login, Expose initDesktop

**Files:**
- Modify: `boot.js`

- [ ] **Step 1: Replace the login handler and mobile block with `initDesktop`**

In `boot.js`, the current `$(document).ready(function () {` block starts with:
1. `$("#alert-box").fadeIn()` — remove
2. `$("#main-content").hide()` — remove
3. `$("#alert-accept").click(function () { ... })` — remove the entire click handler
4. The `load_third_parties()` function — keep, but inline it into `initDesktop`
5. The `if (width <= 1024) { ... }` mobile block — remove entirely

Replace all of the above (lines 1–71 in the current `boot.js`) with the following block at the top of `$(document).ready(...)`:

```javascript
$(document).ready(function () {

  // Called by boot-sequence.js after boot completes
  window.initDesktop = function () {
    $('#main-content').fadeIn();
    $('.desktop-icon').hide();

    // Stagger desktop icon appearance
    $('.desktop-icon').each(function (index, element) {
      var minDelay = 500;
      var maxDelay = 1000;
      var randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      setTimeout(function () {
        $(element).show();
      }, randomDelay);
    });

    // Initialize Clippy
    clippy.load('Clippy', function (agent) {
      setTimeout(function () {
        agent.show();
        agent.play('Greeting');
        agent.speak(
          "Hey, Swastik just released a new open-source gem called Docsmith—check it out at My Documents > Docsmith.url"
        );
        setInterval(function () {
          agent.animate();
        }, 10000);
      }, 1500);
    });
  };

  // ... rest of boot.js continues unchanged below (zIndexCounter, sound, clock, etc.)
```

The rest of `boot.js` (z-index counter, sound toggle, resume download, clock, window management) stays exactly as-is.

- [ ] **Step 2: Verify**

Open `index.html`. Go through the full boot sequence: POST → press key → splash → desktop fades in with icons staggering in, Clippy appears. The full desktop experience should be working.

- [ ] **Step 3: Commit**

```bash
git add boot.js
git commit -m "feat: expose initDesktop() in boot.js, remove login handler and mobile block"
```

---

## Task 7: Create mobile.css

**Files:**
- Create: `mobile.css`
- Modify: `index.html` (add link tag)

- [ ] **Step 1: Add `mobile.css` link to `index.html`**

After the existing `<link rel="stylesheet" href="my_documents.css" ...>` line, add:
```html
<link rel="stylesheet" href="mobile.css" type="text/css" />
```

- [ ] **Step 2: Create `mobile.css`**

Create `/Users/swastik/Documents/personal-website/main/mobile.css`:

```css
/* ============================================================
   Windows 98 Mobile Shell — ≤768px
   Rule: if it doesn't look like it shipped with Win98, cut it.
   No smooth transitions. No rounded corners. No modern patterns.
   ============================================================ */

@media (max-width: 768px) {

  /* Allow body to participate in layout — icons need flow */
  body {
    overflow: hidden;
  }

  /* Desktop: reflow icons into a 2-column touch grid */
  #main-content {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    padding: 8px;
    padding-bottom: 50px; /* clear taskbar */
    height: calc(100vh - 40px);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Override inline top/left positioning on icons */
  .desktop-icon {
    position: static !important;
    top: auto !important;
    left: auto !important;
    width: 80px;
    margin: 6px;
  }

  /* Hide MSN icon — web archive link not useful on mobile */
  #msn-icon {
    display: none !important;
  }

  /* ---- Windows: full-screen, no drag, authentic Win98 chrome ---- */

  .window {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: calc(100% - 40px) !important;
    resize: none !important;
  }

  /* Window content area scrollable */
  .window-content,
  .window-resume-content,
  .window-biography-content {
    overflow-y: auto;
    overflow-x: hidden;
    height: calc(100% - 26px); /* title bar is ~26px including border */
  }

  /* Hide jQuery UI resize handles */
  .ui-resizable-handle {
    display: none !important;
  }

  /* ---- My Documents: single-column, no left pane ---- */

  .left-pane {
    display: none !important;
  }

  .right-pane {
    width: 100% !important;
    flex: 1;
  }

  /* Single-column list instead of icon grid */
  .items-grid {
    grid-template-columns: 1fr !important;
    gap: 0 !important;
    padding: 0 !important;
  }

  .folder-item {
    flex-direction: row !important;
    width: 100% !important;
    text-align: left !important;
    padding: 8px 10px !important;
    border-bottom: 1px solid #c0c0c0;
    gap: 10px;
  }

  .folder-icon {
    width: 24px !important;
    height: 24px !important;
    margin-bottom: 0 !important;
    flex-shrink: 0;
  }

  /* Status bar stays — it fits at any width */

  /* ---- Résumé: hide PDF embed, show buttons stacked ---- */

  #pdf-container {
    display: none !important;
  }

  .resume-alert-buttons {
    flex-direction: column !important;
    gap: 10px;
    width: 100%;
  }

  .resume-alert-button {
    width: 100% !important;
    padding: 10px !important;
    justify-content: center;
  }

  /* ---- Start menu: no sidebar, wider for touch ---- */

  .start-menu-sidebar {
    display: none !important;
  }

  .start-menu {
    width: 220px !important;
  }

  .start-menu-item {
    padding: 8px 10px !important;
    font-size: 14px !important;
  }

  .start-menu-item-icon {
    width: 24px !important;
    height: 24px !important;
  }

  /* ---- Taskbar items: truncate long titles ---- */

  .taskbar-item {
    min-width: 100px !important;
    max-width: 130px;
  }

  .taskbar-item span {
    display: inline-block;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }

  /* ---- Lottie biography: scale to width ---- */

  lottie-player,
  dotlottie-player {
    width: 100% !important;
    height: auto !important;
  }

  /* ---- Clippy: pin above taskbar, bottom-right ---- */
  /* The Clippy library sets position via inline styles — use !important */

  .clippy {
    bottom: 50px !important;
    right: 10px !important;
    top: auto !important;
    left: auto !important;
  }

  .clippy-balloon {
    max-width: 160px;
  }

  /* ---- Boot screen: readable on small screens ---- */

  #boot-post-text {
    font-size: 12px;
  }

  #boot-logo {
    width: 180px;
  }

  #boot-progress-bar {
    width: 220px;
  }

}
```

- [ ] **Step 3: Verify**

Open `index.html` in browser dev tools at 375px width (iPhone viewport). After booting:
- Icons should appear in a 2-column wrap layout (no absolute positioning)
- Tapping an icon should select it (highlight)
- Start menu tap should open instantly with no sidebar, wider items
- MSN icon should be gone

- [ ] **Step 4: Commit**

```bash
git add mobile.css index.html
git commit -m "feat: add mobile.css — Win98 mobile shell layout overrides"
```

---

## Task 8: Mobile JS — Double-Tap, Disable Drag/Resize, My Documents Click

**Files:**
- Modify: `boot.js`

- [ ] **Step 1: Add mobile JS block to `boot.js`**

After the `window.initDesktop = function () { ... };` block and before the `let zIndexCounter = 1000;` line, insert the following:

```javascript
  // ---- Mobile shell (≤768px) ----
  var isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Double-tap detection for desktop icons
    // On mobile, the existing ondblclick won't fire reliably on touch.
    // We detect two taps within 300ms and trigger dblclick programmatically.
    var lastTap = {};
    $(document).on('touchend', '.desktop-icon', function (e) {
      var $icon = $(this);
      // Use the icon's position in the DOM as a stable key
      var iconKey = $('.desktop-icon').index($icon);
      var now = Date.now();
      var last = lastTap[iconKey] || 0;
      if (now - last < 300 && now - last > 0) {
        $icon.trigger('dblclick');
        lastTap[iconKey] = 0;
      } else {
        lastTap[iconKey] = now;
      }
    });

    // My Documents: on mobile, folder item tap opens the link directly
    // (no left-pane detail panel). Override the folder-item click handler
    // by adding a touchend handler that fires window.open on double-tap.
    var lastFolderTap = {};
    $(document).on('touchend', '.folder-item', function (e) {
      var $item = $(this);
      var itemKey = $item.data('title') || $item.index();
      var now = Date.now();
      var last = lastFolderTap[itemKey] || 0;
      if (now - last < 300 && now - last > 0) {
        var link = $item.data('link');
        if (link) {
          window.open(link, '_blank');
        }
        lastFolderTap[itemKey] = 0;
      } else {
        lastFolderTap[itemKey] = now;
      }
    });
  }
  // ---- End mobile shell ----
```

- [ ] **Step 2: Disable drag and resize for mobile in `openWindow`**

In `boot.js`, find the `window.openWindow = function (id) { ... }` function. Locate these two blocks near the end:

```javascript
    $window.draggable({
      handle: ".window-header",
      containment: "window",
      stack: ".window",
    });

    if (!isResizeAble) {
      $window.resizable({
        minWidth: 200,
        minHeight: 200,
        containment: "window",
      });
    }
```

Wrap both in an `if (!isMobile)` guard:

```javascript
    if (!isMobile) {
      $window.draggable({
        handle: ".window-header",
        containment: "window",
        stack: ".window",
      });

      if (!isResizeAble) {
        $window.resizable({
          minWidth: 200,
          minHeight: 200,
          containment: "window",
        });
      }
    }
```

Note: `isMobile` is declared in the outer `$(document).ready` scope, so it is accessible inside `openWindow`.

- [ ] **Step 3: Verify double-tap on mobile**

In browser dev tools at 375px (touch simulation on):
1. Boot through to desktop
2. Double-tap "My Documents" icon — the My Documents window should open full-screen
3. Double-tap "Résumé" icon — the Résumé window should open full-screen, showing only the Download and View buttons (no PDF)
4. Double-tap a folder item in My Documents — should open the link in a new tab
5. Switch to desktop width (>768px) — icons should be absolutely positioned as before, windows should be draggable

- [ ] **Step 4: Commit**

```bash
git add boot.js
git commit -m "feat: add mobile JS — double-tap detection, disable drag/resize on mobile"
```

---

## Task 9: Final Verification

- [ ] **Desktop smoke test**

Open `index.html` at full desktop width (>768px):
- POST screen shows → press key → startup sound plays → splash shows with scrolling progress bar → desktop fades in
- Icons stagger in one by one
- Clippy appears and speaks
- All windows open, drag, resize, minimize, maximize, close correctly
- Start menu opens, all links work
- Sound toggle works
- Clock ticks

- [ ] **Mobile smoke test**

Open `index.html` in browser dev tools at 375px (iPhone SE), touch simulation on:
- Boot sequence completes on tap
- Icons appear in 2-column grid
- MSN icon is hidden
- Tapping Start → menu opens without sidebar, wider items
- Double-tap "Résumé" → full-screen window with Download + View buttons, no PDF embed
- Double-tap "My Documents" → full-screen window, single-column file list, no left pane
- Double-tap a file → opens link in new tab
- Double-tap "My Computer" → full-screen window with Lottie scaled to width (verify it renders cleanly — if distorted, note it needs the icon hidden in mobile.css)

- [ ] **If My Computer Lottie looks broken on mobile**

Add to `mobile.css` inside the `@media (max-width: 768px)` block:
```css
  /* My Computer animation distorts on mobile — hide icon */
  #desktop-icon-biography {
    display: none !important;
  }
```

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete Win98 boot sequence and mobile shell"
```
