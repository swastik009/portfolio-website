# Clippy Boot Gate & 1:1 Win98 Boot Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake Win98 login dialog with a Clippy-hosted black-screen gate that captures the one gesture browser autoplay policy requires, followed by a pixel-faithful Award BIOS POST and clouds-wipe splash compressed to ~6 seconds.

**Architecture:** Two new source files split by responsibility. `boot-gate.js` owns the entry decision (mobile vs desktop), the Clippy question, and the audio unlock. `boot-sequence.js` owns the POST → table → wipe → splash animation and calls `window.initDesktop()` when done. `personal_win.js` keeps all existing desktop logic but stops owning the entry flow. A Playwright smoke test plus an ffmpeg SSIM fidelity diff verify every commit against the reference video.

**Tech Stack:** Vanilla JS, jQuery 3.7.1, jQuery UI 1.12.1, CSS animations, static HTML. No bundler, no framework. Playwright (headless Chromium) + ffmpeg for tests. Terser for the production bundle.

**Spec:** `docs/superpowers/specs/2026-08-25-clippy-boot-sequence-design.md` — read it before starting. This plan argues from it.

## Global Constraints

- **Design hard rule:** every visual decision must look like it shipped with Windows 98 in 1998. No rounded corners, no soft shadows, no modern easing, no system-font stacks. If it cannot be made period-correct, cut it.
- **`index.html` loads `dist/app.min.js`, not `personal_win.js`.** After ANY edit to `personal_win.js` run `npx terser personal_win.js -c -m -o dist/app.min.js` and bump the `?v=` cache-buster in `index.html`. Verified byte-reproducible 2026-08-25.
- **Cloudflare auto-deploys from git on push.** There is no staging. Never push a commit whose smoke test is red. Committing locally is safe; pushing is publishing.
- **Do NOT add a `package.json`.** Cloudflare Pages detects it and will attempt a build step, breaking the deploy. Playwright resolves from the user's home-level `node_modules` (`/Users/swastik/node_modules/playwright`, verified working with cached Chromium).
- **Do NOT refactor `assets/js/clippy.js` or `agents/Clippy/*`.** Vendored and hand-patched by the owner. Extend from outside only.
- **Mobile is byte-for-byte unchanged.** `width <= 1024` sees the existing `#alert-box` message and nothing else. No gate, no boot, no Clippy, no sprite download.
- **VGA font licence:** Px437 IBM VGA 8x16 is CC BY-SA 4.0 and requires an attribution line in the Résumé window credits.
- **localStorage key:** `win98_boot_seen`, value = ISO-8601 timestamp. Expiry 10 days. All access wrapped in try/catch; on any error fall back to the full boot.

## Interfaces defined by this plan

Use these exact names. Later tasks depend on them.

```js
window.initDesktop()          // personal_win.js — builds desktop, icons, clock. Idempotent.
window.startClippyTour()      // personal_win.js — non-blocking guided tour.
window.BootSequence.run(opts) // boot-sequence.js — opts: { skipPost: bool, onComplete: fn }
window.BootGate.run()         // boot-gate.js — entry point, called on $(document).ready
window.__DEV                  // dev hooks: skipGate, skipBoot, replayBoot, clearBootStamp, phase
```

---

## Task 1: Dev Server and Smoke Harness

Establishes the test cycle everything else depends on. Nothing else can be verified until this exists.

**Files:**
- Create: `serve.py`
- Create: `.smoke.cjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `python3 serve.py 8123` serving the repo with no-cache; `node .smoke.cjs` exiting 0 on success, 1 on failure

- [ ] **Step 1: Write the dev server**

Create `serve.py`:

```python
#!/usr/bin/env python3
"""Dev server for the Win98 portfolio: python3 serve.py [port]

Same as `python3 -m http.server` but sends `Cache-Control: no-cache`, so the
browser always revalidates instead of serving a stale index.html against a
fresh dist/app.min.js. That mismatch looks exactly like a broken build.
"""
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
print(f'serving on http://localhost:{port} (no-cache)')
ThreadingHTTPServer(('', port), Handler).serve_forever()
```

- [ ] **Step 2: Write the failing smoke test**

Create `.smoke.cjs`. At this stage it only asserts the current site loads clean — it will fail on the phases we have not built yet, which is correct.

```js
/* headless smoke test — drives the boot gate and desktop, fails on any error */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BASE = process.env.BASE || 'http://localhost:8123';
const OUT = process.env.OUT || '/tmp/win98';

(async () => {
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const failures = [];

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => failures.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') failures.push('CONSOLE: ' + m.text());
  });

  const shot = n => page.screenshot({ path: `${OUT}/${n}.png` });
  const check = (name, ok) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failures.push('ASSERT: ' + name);
  };

  await page.goto(BASE, { waitUntil: 'load' });
  await sleep(500);
  await shot('01_load');

  check('desktop is hidden at first paint',
    await page.locator('#main-content').isHidden());

  await browser.close();

  if (failures.length) {
    console.log('\n--- FAILURES ---');
    failures.forEach(f => console.log(f));
    process.exit(1);
  }
  console.log('\nall green');
})();
```

- [ ] **Step 3: Run it to verify it fails**

```bash
python3 serve.py 8123 &
sleep 1
node .smoke.cjs
```

Expected: `FAIL  desktop is hidden at first paint`, exit code 1. `#main-content` is currently only hidden by JS, so it is visible at first paint — this is the flash bug, and the test now proves it exists.

- [ ] **Step 4: Ignore test output**

Append to `.gitignore`:

```
.worktrees/
.DS_Store
/tmp/win98/
```

- [ ] **Step 5: Commit**

```bash
git add serve.py .smoke.cjs .gitignore
git commit -m "test: add dev server and headless smoke harness"
```

---

## Task 2: Fix the Desktop Flash and Scaffold the Boot Screen

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `.smoke.cjs` from Task 1
- Produces: `#boot-screen`, `#boot-post`, `#boot-splash`, `#clippy-gate` DOM nodes; `#main-content` hidden at first paint

- [ ] **Step 1: Hide `#main-content` at first paint**

In `index.html`, change:

```html
<div id="main-content">
```

to:

```html
<div id="main-content" style="display: none">
```

- [ ] **Step 2: Hide `#alert-box` at first paint**

`#alert-box` is now the mobile-only screen. It must not flash on desktop. Change:

```html
<div id="alert-box" class="alert-window">
```

to:

```html
<div id="alert-box" class="alert-window" style="display: none">
```

Leave every child element of `#alert-box` exactly as it is. The mobile copy is unchanged.

- [ ] **Step 3: Add the boot screen markup**

Immediately before `<div id="main-content" ...>`, insert:

```html
<div id="boot-screen">
  <div id="boot-cursor">_</div>
  <div id="clippy-gate"></div>
  <div id="boot-post">
    <img id="boot-epa-logo" src="icons/epa.png" alt="EPA Energy Star" />
    <pre id="boot-post-text"></pre>
  </div>
  <div id="boot-splash">
    <div id="boot-splash-art"></div>
  </div>
</div>
```

- [ ] **Step 4: Run the smoke test to verify it passes**

```bash
node .smoke.cjs
```

Expected: `PASS  desktop is hidden at first paint`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix: hide desktop at first paint, scaffold boot screen"
```

---

## Task 3: VGA Font and the 80x25 POST Grid

The single highest-risk detail in the project. A BIOS POST is VGA text mode — an 80x25 grid of 8x16 bitmap glyphs in fixed cells. CSS `monospace` gets the glyph shapes and metrics wrong and reads as "a terminal", not "a BIOS".

**Files:**
- Create: `fonts/PxPlus_IBM_VGA_8x16.woff2` (downloaded)
- Create: `boot.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `#boot-screen` markup from Task 2
- Produces: `.boot-grid` class rendering an exact 80x25 character grid; CSS custom properties `--vga-fg`, `--vga-cyan`, `--vga-white`

- [ ] **Step 1: Download the font**

```bash
curl -L -o /tmp/oldschool.zip \
  "https://int10h.org/oldschool-pc-fonts/download/oldschool_pc_font_pack_v2.2_linux.zip"
unzip -j /tmp/oldschool.zip "*Px437_IBM_VGA_8x16*" -d /tmp/vgafont
ls /tmp/vgafont
```

If the archive layout differs, the file needed is any `Px437_IBM_VGA_8x16` in `.woff2`, `.woff`, or `.ttf`. Copy it to `fonts/PxPlus_IBM_VGA_8x16.woff2` (convert with `fonttools` if only TTF is available: `pip install fonttools brotli && fonttools ttLib.woff2 compress <file>.ttf`).

If the download fails, STOP and ask the owner rather than substituting a different font. The font is the fidelity.

- [ ] **Step 2: Write `boot.css`**

```css
/* boot.css — BIOS POST and Win98 splash. Period-correct only. */

@font-face {
  font-family: "PxVGA";
  src: url("./fonts/PxPlus_IBM_VGA_8x16.woff2") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

:root {
  --vga-white: #aaaaaa;
  --vga-bright: #ffffff;
  --vga-cyan: #00aaaa;
  --vga-blue: #0000aa;
  --vga-green: #00aa00;
  --vga-yellow: #aaaa00;
}

#boot-screen {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 100000;
  overflow: hidden;
}

/* blinking underscore, top-left, before Clippy arrives */
#boot-cursor {
  position: absolute;
  top: 16px;
  left: 16px;
  font-family: "PxVGA", monospace;
  font-size: 16px;
  line-height: 16px;
  color: var(--vga-white);
  animation: boot-blink 1s steps(1) infinite;
}

@keyframes boot-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

/* The POST is a true 80x25 grid of 8x16 cells = 640x400, scaled up as a unit
   so every glyph lands in the same cell as the reference. */
#boot-post {
  display: none;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 640px;
  height: 400px;
  transform: translate(-50%, -50%) scale(var(--boot-scale, 1.6));
  transform-origin: center center;
  image-rendering: pixelated;
}

#boot-post-text {
  margin: 0;
  padding: 0;
  font-family: "PxVGA", monospace;
  font-size: 16px;
  line-height: 16px;
  letter-spacing: 0;
  color: var(--vga-white);
  white-space: pre;
  tab-size: 8;
}

#boot-epa-logo {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 128px;
  height: auto;
  image-rendering: pixelated;
}

.bios-bright { color: var(--vga-bright); }
.bios-cyan   { color: var(--vga-cyan); }
.bios-green  { color: var(--vga-green); }
```

- [ ] **Step 3: Link the stylesheet and preload the font**

In `index.html` `<head>`, after the existing `<link rel="stylesheet" href="app.css" ...>` line, add:

```html
<link rel="stylesheet" href="boot.css" type="text/css" />
<link rel="preload" as="font" type="font/woff2"
      href="fonts/PxPlus_IBM_VGA_8x16.woff2" crossorigin />
<link rel="preload" as="image" href="agents/Clippy/map.png" />
```

- [ ] **Step 4: Verify the grid geometry**

Add to `.smoke.cjs` before `browser.close()`:

```js
  const cell = await page.evaluate(() => {
    const el = document.createElement('span');
    el.style.cssText = 'font-family:PxVGA,monospace;font-size:16px;position:absolute;white-space:pre';
    el.textContent = '01234567890123456789012345678901234567890123456789012345678901234567890123456789';
    document.body.appendChild(el);
    const w = el.getBoundingClientRect().width;
    el.remove();
    return w / 80;
  });
  check('VGA cell is exactly 8px wide (got ' + cell.toFixed(3) + ')',
    Math.abs(cell - 8) < 0.05);
```

Run: `node .smoke.cjs`
Expected: `PASS  VGA cell is exactly 8px wide (got 8.000)`. If the width is not 8px the wrong font loaded — stop and fix before continuing, because every later fidelity check depends on this.

- [ ] **Step 5: Commit**

```bash
git add boot.css index.html fonts/PxPlus_IBM_VGA_8x16.woff2 .smoke.cjs
git commit -m "feat: add VGA text-mode font and 80x25 POST grid"
```

---

## Task 4: Boot Gate — Mobile Branch and Black Screen

**Files:**
- Create: `boot-gate.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `#boot-screen`, `#alert-box`, `#clippy-gate` from Task 2
- Produces: `window.BootGate.run()`; `window.__DEV.phase()` returning one of `'gate' | 'boot' | 'desktop' | 'mobile'`

- [ ] **Step 1: Write the failing test**

Add to `.smoke.cjs`, before `browser.close()`:

```js
  check('desktop phase is "gate" after load',
    (await page.evaluate(() => window.__DEV && window.__DEV.phase())) === 'gate');

  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(BASE, { waitUntil: 'load' });
  await sleep(400);
  check('mobile phase is "mobile"',
    (await mob.evaluate(() => window.__DEV && window.__DEV.phase())) === 'mobile');
  check('mobile shows the existing alert box',
    await mob.locator('#alert-box').isVisible());
  check('mobile never shows the boot screen',
    await mob.locator('#boot-screen').isHidden());
  await mob.screenshot({ path: `${OUT}/02_mobile.png` });
  await mob.close();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: FAIL on all four — `window.__DEV` is undefined.

- [ ] **Step 3: Write `boot-gate.js`**

```js
/* boot-gate.js — owns the entry decision, the Clippy question, and the audio
   unlock. Mobile never reaches the gate: it sees the existing #alert-box and
   nothing else, exactly as it did before this file existed. */
(function () {
  var MOBILE_MAX_WIDTH = 1024;
  var phase = 'gate';

  function isMobile() {
    return $(window).width() <= MOBILE_MAX_WIDTH;
  }

  function runMobile() {
    phase = 'mobile';
    $('#boot-screen').hide();
    $('#alert-accept').hide();
    $("input[name='username']").closest('div').hide();
    $("input[name='password']").closest('div').hide();
    $('.alert-message > div:first').html(
      'Looks like this Windows version wasn’t built for pocket-sized supercomputers.<br>' +
        'For the full retro vibes, try checking it out on a desktop.<br><br>' +
        'But hey, since you made it here, feel free to browse the resume anyway 📄😉'
    );
    $('.alert-header').text('Warning: Your device is smarter than this site');
    $("button:contains('Resume')").css({
      padding: '12px 24px',
      'font-size': '16px',
      'font-weight': 'bold'
    });
    $('#alert-box').fadeIn();
  }

  function runDesktop() {
    phase = 'gate';
    $('#alert-box').hide();
    $('#boot-screen').show();
    // Clippy question is wired in Task 5.
  }

  window.BootGate = {
    run: function () {
      if (isMobile()) {
        runMobile();
      } else {
        runDesktop();
      }
    },
    _setPhase: function (p) { phase = p; }
  };

  window.__DEV = window.__DEV || {};
  window.__DEV.phase = function () { return phase; };

  $(document).ready(function () {
    window.BootGate.run();
  });
})();
```

Note: the mobile copy above is copied verbatim from `personal_win.js`. Do not reword it.

- [ ] **Step 4: Load it in `index.html`**

Replace the single script tag:

```html
<script defer src="dist/app.min.js?v=20260412"></script>
```

with, in this exact order (`defer` scripts execute in document order, so `initDesktop` is defined before `BootGate` runs):

```html
<script defer src="./assets/js/clippy.js"></script>
<script defer src="dist/app.min.js?v=20260825"></script>
<script defer src="boot-sequence.js?v=20260825"></script>
<script defer src="boot-gate.js?v=20260825"></script>
```

Then delete the now-duplicate `<script src="./assets/js/clippy.js"></script>` from the bottom of `<body>`.

- [ ] **Step 5: Create a placeholder `boot-sequence.js` so the tag resolves**

```js
/* boot-sequence.js — POST, config table, clouds wipe, splash. Filled in Task 6-8. */
(function () {
  window.BootSequence = {
    run: function (opts) {
      opts = opts || {};
      if (typeof opts.onComplete === 'function') opts.onComplete();
    }
  };
})();
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: all four new checks PASS.

- [ ] **Step 7: Commit**

```bash
git add boot-gate.js boot-sequence.js index.html .smoke.cjs
git commit -m "feat: add boot gate with mobile branch, keep mobile screen unchanged"
```

---

## Task 5: The Clippy Question and Audio Unlock

**Files:**
- Modify: `boot-gate.js`
- Modify: `boot.css`

**Interfaces:**
- Consumes: `window.BootGate` from Task 4, vendored `clippy.load`
- Produces: audio unlocked; `window.BootSequence.run()` invoked on either button

- [ ] **Step 1: Write the failing test**

Add to `.smoke.cjs` after the `'gate'` phase check:

```js
  await page.waitForSelector('.clippy-gate-button', { timeout: 15000 });
  await shot('03_gate');
  const btnCount = await page.locator('.clippy-gate-button').count();
  check('gate shows exactly two buttons', btnCount === 2);
  check('gate button 1 reads "Yes, boot it up"',
    (await page.locator('.clippy-gate-button').first().textContent()).trim() === 'Yes, boot it up');

  await page.locator('.clippy-gate-button').first().click();
  await sleep(300);
  check('phase advances to "boot"',
    (await page.evaluate(() => window.__DEV.phase())) === 'boot');
  await sleep(1200);
  check('startup sound is playing',
    await page.evaluate(() => {
      const a = document.getElementById('win98-startup');
      return !!a && a.currentTime > 0;
    }));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: timeout waiting for `.clippy-gate-button`.

- [ ] **Step 3: Add the gate styles to `boot.css`**

```css
/* Clippy gate — minimal: black screen, Clippy, balloon, two buttons. */
#clippy-gate {
  display: none;
  position: absolute;
  inset: 0;
}

#clippy-gate.active { display: block; }

.clippy-gate-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #000;
}

.clippy-gate-button {
  background: #c0c0c0;
  border: 2px solid;
  border-color: #fff #000 #000 #fff;
  padding: 3px 12px;
  font-family: "MS Sans Serif", Arial, sans-serif;
  font-size: 13px;
  color: #000;
  cursor: default;
}

.clippy-gate-button:active {
  border-color: #000 #fff #fff #000;
}
```

- [ ] **Step 4: Wire the question into `boot-gate.js`**

Replace the body of `runDesktop()` with:

```js
  function runDesktop() {
    phase = 'gate';
    $('#alert-box').hide();
    $('#boot-screen').show();
    $('#clippy-gate').addClass('active');

    // Vendored clippy.Agent appends itself to #main-content, which is hidden
    // during the gate. Move the element into the gate container instead of
    // patching the vendored selector.
    clippy.load('Clippy', function (agent) {
      $('.clippy').appendTo('#clippy-gate');
      $('.clippy-balloon').appendTo('#clippy-gate');
      $('#boot-cursor').hide();

      agent.show();
      agent.play('Wave');
      agent.play('Explain');

      var seen = readBootStamp();
      var copy = seen ? RETURN_COPY : FIRST_COPY;

      agent.speak(copy.question, true);

      // speak() types word-by-word; buttons appear once typing is done.
      setTimeout(function () {
        showButtons(agent, copy);
      }, copy.question.split(/[^\S-]/).length * 200 + 300);
    });
  }

  var FIRST_COPY = {
    question: "It looks like you're trying to visit a portfolio. " +
              "This PC has been powered off since 1998. Shall I boot it up?",
    yes: 'Yes, boot it up',
    no: 'No thanks',
    refusal: "Booting anyway. I'm an assistant, not a democracy."
  };

  var RETURN_COPY = {
    question: "Welcome back. Warm boot — this'll be quick.",
    yes: "Let's go",
    no: 'Fine',
    refusal: null
  };

  function showButtons(agent, copy) {
    var $row = $('<div class="clippy-gate-buttons"></div>');
    var $yes = $('<button class="clippy-gate-button"></button>').text(copy.yes);
    var $no = $('<button class="clippy-gate-button"></button>').text(copy.no);
    $row.append($yes).append($no);
    $('.clippy-balloon').append($row);

    // Both buttons boot. "No" only earns a line first. Any gesture unlocks
    // audio, so both must lead somewhere — the joke IS the requirement.
    $yes.on('click', function () { begin(agent, false, copy); });
    $no.on('click', function () { begin(agent, !!copy.refusal, copy); });
  }

  function begin(agent, withRefusal, copy) {
    $('.clippy-gate-button').off('click').prop('disabled', true);

    var go = function () {
      phase = 'boot';
      agent.play('GetTechy');
      $('.clippy-balloon').remove();
      agent.hide();
      $('#clippy-gate').removeClass('active');

      var skipPost = !!readBootStamp();
      writeBootStamp();

      setTimeout(function () {
        window.BootSequence.run({
          skipPost: skipPost,
          onComplete: function () {
            phase = 'desktop';
            if (typeof window.initDesktop === 'function') window.initDesktop();
            if (!skipPost && typeof window.startClippyTour === 'function') {
              setTimeout(window.startClippyTour, 1500);
            }
          }
        });
      }, 500);
    };

    if (withRefusal) {
      $('.clippy-gate-buttons').remove();
      agent.speak(copy.refusal, true);
      setTimeout(go, 1200 + copy.refusal.split(/[^\S-]/).length * 200);
    } else {
      go();
    }
  }
```

`readBootStamp` and `writeBootStamp` are stubbed in this task and implemented in Task 10. Add above `runDesktop`:

```js
  function readBootStamp() { return false; }
  function writeBootStamp() {}
```

- [ ] **Step 5: Play the audio on the gesture**

Inside `begin()`'s `go` function, as the very first statement (it must run inside the click handler's call stack to count as a user gesture):

```js
      var audio = document.getElementById('win98-startup');
      if (audio) { audio.play().catch(function () {}); }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: all gate checks PASS, including `startup sound is playing`.

- [ ] **Step 7: Commit**

```bash
git add boot-gate.js boot.css .smoke.cjs
git commit -m "feat: Clippy gate question with both-buttons-boot and audio unlock"
```

---

## Task 6: POST Phase A — Header, Memory Count, IDE Detection

Text must be verbatim. Transcribed from `windows-98-boot-animation.mp4` at 2026-08-25.

**Files:**
- Modify: `boot-sequence.js`

**Interfaces:**
- Consumes: `#boot-post`, `#boot-post-text` from Task 2; `.boot-grid` styles from Task 3
- Produces: `window.BootSequence.run({skipPost, onComplete})` rendering Phase A

- [ ] **Step 1: Write the failing test**

Add to `.smoke.cjs` after the boot phase check:

```js
  await sleep(900);
  await shot('04_post');
  const postText = await page.locator('#boot-post-text').textContent();
  check('POST header is verbatim',
    postText.includes('Award Modular BIOS v4.51PG, An Energy Star Ally'));
  check('POST copyright is verbatim',
    postText.includes('Copyright (C) 1984-97, Award Software, Inc.'));
  check('POST chipset line is verbatim',
    postText.includes('(55XWUQ0E) Intel i430VX PCIset(TM)'));
  check('POST CPU line is verbatim',
    postText.includes('PENTIUM-S CPU at 120MHz'));
  check('EPA logo is visible during POST',
    await page.locator('#boot-epa-logo').isVisible());
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: FAIL — `#boot-post-text` is empty.

- [ ] **Step 3: Implement Phase A**

Replace `boot-sequence.js` entirely:

```js
/* boot-sequence.js — 1:1 Award BIOS POST and Win98 splash, compressed in time.
   Text transcribed verbatim from windows-98-boot-animation.mp4. Do not reword. */
(function () {
  var $post, $text, $splash;

  var HEADER = [
    ' Award Modular BIOS v4.51PG, An Energy Star Ally',
    ' Copyright (C) 1984-97, Award Software, Inc.',
    '',
    '(55XWUQ0E) Intel i430VX PCIset(TM)',
    '',
    'PENTIUM-S CPU at 120MHz'
  ];

  var PNP = [
    '',
    'Award Plug and Play BIOS Extension  v1.0A',
    'Copyright (C) 1997, Award Software, Inc.',
    '    Detecting IDE Primary Master   ... PCemHD',
    '    Detecting IDE Primary Slave    ... PCemCD',
    '    Detecting IDE Secondary Master ... None',
    '    Detecting IDE Secondary Slave  ... None'
  ];

  var FOOTER = [
    'Press DEL to enter SETUP, ESC to skip memory test',
    '12/10/97-i430VX,UMC8669-2A59GH2BC-00'
  ];

  var lines = [];

  function render() {
    // Pad to a full 25-row grid so the footer sits on rows 24-25, as VGA does.
    var grid = lines.slice(0, 23);
    while (grid.length < 23) grid.push('');
    $text.text(grid.concat(FOOTER).join('\n'));
  }

  function push(line) { lines.push(line); render(); }

  function memoryCountUp(done) {
    // Reference counts 640K -> 65536K. 0.6s budget.
    var idx = lines.length;
    lines.push('Memory Test :       640K');
    render();
    var value = 640;
    var step = setInterval(function () {
      value = Math.min(65536, value + 4096);
      lines[idx] = 'Memory Test :     ' + value + 'K';
      render();
      if (value >= 65536) {
        clearInterval(step);
        lines[idx] = 'Memory Test :     65536K OK';
        render();
        done();
      }
    }, 35);
  }

  function phaseA(done) {
    HEADER.forEach(function (l) { push(l); });
    memoryCountUp(function () {
      var i = 0;
      var tick = setInterval(function () {
        if (i >= PNP.length) { clearInterval(tick); done(); return; }
        push(PNP[i++]);
      }, 85);
    });
  }

  window.BootSequence = {
    run: function (opts) {
      opts = opts || {};
      $post = $('#boot-post');
      $text = $('#boot-post-text');
      $splash = $('#boot-splash');
      lines = [];

      var finish = function () {
        if (typeof opts.onComplete === 'function') opts.onComplete();
      };

      if (opts.skipPost) { finish(); return; }

      $post.show();
      phaseA(finish);
    }
  };
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: all five POST checks PASS.

- [ ] **Step 5: Commit**

```bash
git add boot-sequence.js .smoke.cjs
git commit -m "feat: POST phase A - header, memory count-up, IDE detection"
```

---

## Task 7: POST Phase B — System Configuration Table and DMI

**Files:**
- Modify: `boot-sequence.js`

**Interfaces:**
- Consumes: `phaseA` and `push`/`render` from Task 6
- Produces: `phaseB(done)` internal function

- [ ] **Step 1: Extract the reference frame to check alignment against**

```bash
ffmpeg -ss 11.6 -i windows-98-boot-animation.mp4 -frames:v 1 \
  -vf "crop=940:420:10:230,scale=iw*2:ih*2:flags=neighbor" /tmp/win98/ref_table.png
```

Open it. Column positions below were transcribed from this frame — verify them against it before trusting this plan.

- [ ] **Step 2: Write the failing test**

Add to `.smoke.cjs`:

```js
  await sleep(1100);
  await shot('05_table');
  const tbl = await page.locator('#boot-post-text').textContent();
  check('config table title present', tbl.includes('System Configuration'));
  check('PCI listing header present',
    tbl.includes('Bus No. Device No. Func No. Vendor ID  Device ID  Device Class'));
  check('IDE controller row present', tbl.includes('IDE Controller'));
  check('DMI line present', tbl.includes('Verifying DMI Pool Data'));
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: FAIL on all four.

- [ ] **Step 4: Implement Phase B**

Add to `boot-sequence.js` above `window.BootSequence`:

```js
  var TABLE = [
    '        ╔════════════════════ System Configuration ════════════════════╗',
    '        ║ CPU Type          : PENTIUM-S    │ Base Memory      :   640K ║',
    '        ║ Co-Processor      : Installed    │ Extended Memory  : 64512K ║',
    '        ║ CPU Clock         : 120MHz       │ Cache Memory     :   None ║',
    '        ║                                  │                           ║',
    '        ║ Diskette Drive A  : 2.88M, 3.5in │ Display Type     : EGA/VGA ║',
    '        ║ Diskette Drive B  : None         │ Serial Port(s)   : 3F8 2F8 ║',
    '        ║ Pri. Master  Disk : LBA ,Mode 2  │ Parallel Port(s) : 378     ║',
    '        ║ Pri. Slave   Disk : CDROM,Mode 4 │ EDO DRAM at Row  : None    ║',
    '        ║ Sec. Master  Disk : None         │ SDRAM at Row(s)  : 0 1 2 3 4║',
    '        ║ Sec. Slave   Disk : None         │ L2 Cache Type    : None    ║',
    '        ╚════════════════════════════════════════════════════════════╝',
    '',
    'PCI device listing.....',
    'Bus No. Device No. Func No. Vendor ID  Device ID  Device Class        IRQ',
    '------------------------------------------------------------------------',
    '   0        7         1       8086       1230     IDE Controller       14',
    '   0       17         0       1274       1371     Multimedia Device    11',
    ''
  ];

  function phaseB(done) {
    lines = [];               // POST clears before the summary screen
    render();
    var i = 0;
    var tick = setInterval(function () {
      if (i >= TABLE.length) {
        clearInterval(tick);
        push('Verifying DMI Pool Data .......');
        setTimeout(done, 300);
        return;
      }
      push(TABLE[i++]);
    }, 40);
  }
```

Then chain it — change `phaseA(finish)` to:

```js
      phaseA(function () { phaseB(finish); });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: all four PASS.

- [ ] **Step 6: Visually compare against the reference frame**

Open `/tmp/win98/05_table.png` and `/tmp/win98/ref_table.png` side by side. Column separators must line up. If they do not, adjust the padding in `TABLE` — the test only checks presence, your eyes check alignment, and Task 12 will score it.

- [ ] **Step 7: Commit**

```bash
git add boot-sequence.js .smoke.cjs
git commit -m "feat: POST phase B - system configuration table, PCI listing, DMI"
```

---

## Task 8: Phase C — The Clouds Wipe and Splash

Measured from the reference at 12fps: the splash is anchored to the bottom edge and revealed **upward**, black above, over **~950ms linear**. Not a fade, not a scroll — a curtain rising.

**Files:**
- Modify: `boot-sequence.js`
- Modify: `boot.css`
- Add: `assets/images/win98-splash-bg.jpg`, `assets/images/win98-logo-3d.png`

**Interfaces:**
- Consumes: `phaseB` from Task 7, `#boot-splash`/`#boot-splash-art` from Task 2
- Produces: `phaseC(done)`; boot completes and calls `onComplete`

- [ ] **Step 1: Cherry-pick the splash assets from the superseded branch**

```bash
git checkout feat/win98-boot-mobile -- \
  assets/images/win98-splash-bg.jpg \
  assets/images/win98-logo-3d.png
ls -lh assets/images/win98-splash-bg.jpg assets/images/win98-logo-3d.png
```

Expected: 121K and 42K respectively.

- [ ] **Step 2: Write the failing test**

```js
  await sleep(1400);
  await shot('06_splash');
  check('splash is visible', await page.locator('#boot-splash').isVisible());
  await sleep(2200);
  check('phase reaches "desktop"',
    (await page.evaluate(() => window.__DEV.phase())) === 'desktop');
  check('boot screen is gone', await page.locator('#boot-screen').isHidden());
  await shot('07_desktop');
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: FAIL — splash never shows, phase stays `boot`.

- [ ] **Step 4: Add the splash styles**

Append to `boot.css`:

```css
#boot-splash {
  display: none;
  position: absolute;
  inset: 0;
  background: #000;
}

#boot-splash-art {
  position: absolute;
  inset: 0;
  background-image: url("assets/images/win98-splash-bg.jpg");
  background-repeat: no-repeat;
  background-position: center bottom;
  background-size: cover;
  /* curtain rising: reveal from the bottom edge upward */
  clip-path: inset(100% 0 0 0);
}

#boot-splash-art.wipe {
  animation: boot-wipe 950ms linear forwards;
}

@keyframes boot-wipe {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

#boot-screen.fading {
  opacity: 0;
  transition: opacity 500ms linear;
}
```

- [ ] **Step 5: Implement Phase C**

Add to `boot-sequence.js`:

```js
  function phaseC(done) {
    $post.hide();
    $splash.show();
    $('#boot-splash-art').addClass('wipe');
    // 950ms wipe + 1000ms hold, then hand off to the desktop.
    setTimeout(function () {
      $('#boot-screen').addClass('fading');
      setTimeout(function () {
        $('#boot-screen').hide();
        done();
      }, 500);
    }, 1950);
  }
```

Chain it — replace the `run` body's phase call with:

```js
      if (opts.skipPost) { $post.hide(); phaseC(finish); return; }
      $post.show();
      phaseA(function () { phaseB(function () { phaseC(finish); }); });
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: splash visible, phase reaches `desktop`, boot screen hidden.

- [ ] **Step 7: Commit**

```bash
git add boot-sequence.js boot.css assets/images/win98-splash-bg.jpg assets/images/win98-logo-3d.png .smoke.cjs
git commit -m "feat: clouds wipe and Win98 splash, 950ms bottom-anchored reveal"
```

---

## Task 9: Refactor `personal_win.js` and Rebuild the Bundle

**Files:**
- Modify: `personal_win.js`
- Modify: `index.html`
- Delete: `boot.js`
- Rebuild: `dist/app.min.js`

**Interfaces:**
- Consumes: nothing new
- Produces: `window.initDesktop()`

- [ ] **Step 1: Remove the entry logic from `personal_win.js`**

Delete lines 1–71 of the `$(document).ready` body — everything from `$("#alert-box").fadeIn();` through the closing brace of the `if (width <= 1024) { ... }` block. That code now lives in `boot-gate.js`. Do NOT delete anything below it.

- [ ] **Step 2: Expose `initDesktop`**

At the top of the `$(document).ready(function () {` body, insert:

```js
  var desktopReady = false;

  window.initDesktop = function () {
    if (desktopReady) return;   // idempotent — the tour and __DEV may re-call
    desktopReady = true;

    $('#main-content').fadeIn();
    $('.desktop-icon').hide();

    // staggered icon reveal, unchanged from the original entry flow
    $('.desktop-icon').each(function (index, element) {
      var minDelay = 500;
      var maxDelay = 1000;
      var randomDelay =
        Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      setTimeout(function () { $(element).show(); }, randomDelay);
    });
  };
```

- [ ] **Step 3: Delete the dead file**

```bash
git rm boot.js
```

`boot.js` is a byte-identical copy of `personal_win.js` lines 1–72, referenced by nothing.

- [ ] **Step 4: Rebuild the bundle and bump the cache-buster**

```bash
npx terser personal_win.js -c -m -o dist/app.min.js
```

In `index.html` confirm the tag reads `dist/app.min.js?v=20260825`.

- [ ] **Step 5: Verify the bundle actually changed**

```bash
grep -c "alert-accept" dist/app.min.js
```

Expected: `0`. The login handler is gone from the bundle. If it still appears, terser did not re-run — fix before committing.

- [ ] **Step 6: Run the full smoke test**

Run: `node .smoke.cjs`
Expected: all green, including the desktop phase.

- [ ] **Step 7: Commit**

```bash
git add personal_win.js dist/app.min.js index.html
git rm --cached boot.js 2>/dev/null; git add -u
git commit -m "refactor: move entry flow out of personal_win.js, expose initDesktop, drop dead boot.js"
```

---

## Task 10: The 10-Day localStorage Skip

**Files:**
- Modify: `boot-gate.js`

**Interfaces:**
- Consumes: the `readBootStamp`/`writeBootStamp` stubs from Task 5
- Produces: `window.__DEV.clearBootStamp()`, `window.__DEV.replayBoot()`

- [ ] **Step 1: Write the failing test**

```js
  // second load in the same context should take the short path
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('.clippy-gate-button', { timeout: 15000 });
  check('return visit copy differs',
    (await page.locator('.clippy-gate-button').first().textContent()).trim() === "Let's go");
  const t0 = Date.now();
  await page.locator('.clippy-gate-button').first().click();
  await page.waitForFunction(() => window.__DEV.phase() === 'desktop', { timeout: 10000 });
  const elapsed = Date.now() - t0;
  check('return boot is under 4s (was ' + elapsed + 'ms)', elapsed < 4000);
  check('POST was skipped on return visit',
    await page.locator('#boot-post').isHidden());
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: FAIL — the stub always returns `false`, so the full boot runs again.

- [ ] **Step 3: Implement the stamp**

Replace the stubs in `boot-gate.js`:

```js
  var BOOT_KEY = 'win98_boot_seen';
  var BOOT_TTL_MS = 10 * 24 * 60 * 60 * 1000;   // 10 days

  function readBootStamp() {
    try {
      var raw = window.localStorage.getItem(BOOT_KEY);
      if (!raw) return false;
      var when = Date.parse(raw);
      if (isNaN(when)) return false;
      if (Date.now() - when > BOOT_TTL_MS) return false;
      return true;
    } catch (e) {
      return false;   // private mode throws — fall back to the full boot
    }
  }

  function writeBootStamp() {
    try {
      window.localStorage.setItem(BOOT_KEY, new Date().toISOString());
    } catch (e) { /* nothing to do; next visit gets the full boot */ }
  }
```

- [ ] **Step 4: Add the dev hooks**

```js
  window.__DEV.clearBootStamp = function () {
    try { window.localStorage.removeItem(BOOT_KEY); } catch (e) {}
  };
  window.__DEV.replayBoot = function () {
    window.__DEV.clearBootStamp();
    window.location.reload();
  };
  window.__DEV.skipGate = function () {
    $('.clippy-gate-button').first().click();
  };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: return-visit checks PASS, short boot under 4s.

- [ ] **Step 6: Commit**

```bash
git add boot-gate.js .smoke.cjs
git commit -m "feat: skip POST for return visits within 10 days"
```

---

## Task 11: The Non-Blocking Clippy Tour

**Files:**
- Modify: `personal_win.js`
- Rebuild: `dist/app.min.js`

**Interfaces:**
- Consumes: `window.initDesktop` from Task 9; vendored `agent.gestureAt(x, y)`
- Produces: `window.startClippyTour()`

- [ ] **Step 1: Write the failing test**

```js
  await page.evaluate(() => window.__DEV.clearBootStamp());
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('.clippy-gate-button', { timeout: 15000 });
  await page.locator('.clippy-gate-button').first().click();
  await page.waitForFunction(() => window.__DEV.phase() === 'desktop', { timeout: 15000 });
  await page.waitForSelector('.clippy-tour-button', { timeout: 8000 });
  await shot('08_tour_offer');

  // the hard requirement: the tour must never block the page
  check('desktop icons stay clickable during the tour offer',
    await page.locator('.desktop-icon').first().isEnabled());
  const blocked = await page.evaluate(() => {
    const el = document.elementFromPoint(60, 60);   // over the first desktop icon
    return !!el && !!el.closest('.clippy-balloon');
  });
  check('no overlay covers the desktop', blocked === false);

  await page.locator('.desktop-icon').first().dblclick();
  await sleep(800);
  check('opening a window ends the tour silently',
    (await page.locator('.clippy-tour-button').count()) === 0);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node .smoke.cjs`
Expected: timeout waiting for `.clippy-tour-button`.

- [ ] **Step 3: Implement the tour**

Add inside the `$(document).ready` body of `personal_win.js`:

```js
  var tourAgent = null;
  var tourActive = false;

  var TOUR_STEPS = [
    { sel: '#desktop-icon-biography',
      say: 'My Computer. Open it and it becomes Doom.exe. I do not make the rules.' },
    { sel: '#desktop-icon-documents',
      say: 'My Documents — articles, and Docsmith, a Ruby gem Swastik shipped.' },
    { sel: '#desktop-icon-resume',
      say: 'The résumé. You can read it here or download it.' },
    { sel: '.start-button',
      say: 'And the Start menu, for everywhere else on the internet.' }
  ];

  function endTour() {
    if (!tourActive) return;
    tourActive = false;
    $('.clippy-tour-buttons').remove();
    if (tourAgent) { tourAgent.play('RestPose'); }
  }

  function tourStep(i) {
    if (!tourActive || i >= TOUR_STEPS.length) { endTour(); return; }
    var step = TOUR_STEPS[i];
    var $el = $(step.sel);
    if (!$el.length) { tourStep(i + 1); return; }

    var box = $el[0].getBoundingClientRect();
    tourAgent.gestureAt(box.left + box.width / 2, box.top + box.height / 2);
    tourAgent.speak(step.say, true);

    var $row = $('<div class="clippy-tour-buttons"></div>');
    var $next = $('<button class="clippy-gate-button clippy-tour-button">Next</button>');
    var $done = $('<button class="clippy-gate-button clippy-tour-button">Stop</button>');
    $('.clippy-tour-buttons').remove();
    $row.append($next).append($done);
    $('.clippy-balloon').append($row);

    $next.on('click', function (e) { e.stopPropagation(); tourStep(i + 1); });
    $done.on('click', function (e) { e.stopPropagation(); endTour(); });
  }

  window.startClippyTour = function () {
    clippy.load('Clippy', function (agent) {
      tourAgent = agent;
      tourActive = true;
      agent.show();
      agent.play('Greeting');
      agent.speak('Want the tour? I promise to be less annoying than I was in 1998.', true);

      var $row = $('<div class="clippy-tour-buttons"></div>');
      var $yes = $('<button class="clippy-gate-button clippy-tour-button">Show me around</button>');
      var $no = $('<button class="clippy-gate-button clippy-tour-button">No thanks</button>');
      $row.append($yes).append($no);
      $('.clippy-balloon').append($row);

      $yes.on('click', function (e) { e.stopPropagation(); tourStep(0); });
      $no.on('click', function (e) { e.stopPropagation(); endTour(); });
    });

    // Non-blocking hard requirement: any interaction with the real desktop
    // ends the tour silently. No overlay, no backdrop, no confirmation.
    $(document).on('mousedown.tour', function (e) {
      if ($(e.target).closest('.clippy-balloon, .clippy').length) return;
      endTour();
      $(document).off('mousedown.tour');
    });
  };
```

- [ ] **Step 4: Rebuild the bundle**

```bash
npx terser personal_win.js -c -m -o dist/app.min.js
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node .smoke.cjs`
Expected: all tour checks PASS, including the two non-blocking assertions.

- [ ] **Step 6: Commit**

```bash
git add personal_win.js dist/app.min.js .smoke.cjs
git commit -m "feat: non-blocking Clippy guided tour"
```

---

## Task 12: The Fidelity Diff

Turns "does it look right" into a number. This is the task that prevents a botched reconstruction from shipping.

**Files:**
- Create: `.fidelity.cjs`

**Interfaces:**
- Consumes: `window.__DEV` hooks; `windows-98-boot-animation.mp4`
- Produces: per-beat SSIM scores and diff images in `/tmp/win98/fidelity/`

- [ ] **Step 1: Confirm the metric works**

```bash
mkdir -p /tmp/win98/fidelity
ffmpeg -v error -ss 9.5 -i windows-98-boot-animation.mp4 -frames:v 1 -y /tmp/win98/fidelity/a.png
ffmpeg -v error -ss 9.6 -i windows-98-boot-animation.mp4 -frames:v 1 -y /tmp/win98/fidelity/b.png
ffmpeg -hide_banner -v error -i /tmp/win98/fidelity/a.png -i /tmp/win98/fidelity/b.png \
  -lavfi "ssim=stats_file=-" -f null - 2>&1 | tail -1
```

Expected: `All:0.999...`. Two very different frames score around `0.03`, so the metric discriminates sharply. Verified 2026-08-25.

- [ ] **Step 2: Write the fidelity script**

```js
/* .fidelity.cjs — scores our boot against the reference video, beat by beat.
   Reference frames come from windows-98-boot-animation.mp4; ours from a
   headless render at the matching beat. Metric is SSIM via ffmpeg. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:8123';
const REF = 'windows-98-boot-animation.mp4';
const DIR = '/tmp/win98/fidelity';
const THRESHOLD = Number(process.env.THRESHOLD || 0.80);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// beat name -> [reference timestamp in the mp4, ms to wait after the gate click]
const BEATS = {
  post_header: [4.0, 500],
  post_pnp:    [9.5, 1000],
  post_table:  [11.6, 1900],
  splash:      [15.0, 3600]
};

function ssim(ours, ref) {
  const out = execSync(
    `ffmpeg -hide_banner -v error -i "${ours}" -i "${ref}" ` +
    `-lavfi "[0:v]scale=960:720,setsar=1[a];[1:v]scale=960:720,setsar=1[b];` +
    `[a][b]ssim=stats_file=-" -f null - 2>&1 | tail -1`,
    { shell: '/bin/bash', encoding: 'utf8' }
  );
  const m = out.match(/All:([0-9.]+)/);
  return m ? Number(m[1]) : 0;
}

(async () => {
  if (!fs.existsSync(REF)) {
    console.error(`missing ${REF} — the fidelity test needs the reference video`);
    process.exit(2);
  }
  fs.mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const [name, [refT, waitMs]] of Object.entries(BEATS)) {
    execSync(`ffmpeg -v error -ss ${refT} -i "${REF}" -frames:v 1 -y ${DIR}/${name}_ref.png`);

    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.evaluate(() => window.__DEV.clearBootStamp());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.clippy-gate-button', { timeout: 15000 });
    await page.locator('.clippy-gate-button').first().click();
    await sleep(waitMs);
    await page.screenshot({ path: `${DIR}/${name}_ours.png` });
    await page.close();

    const score = ssim(`${DIR}/${name}_ours.png`, `${DIR}/${name}_ref.png`);
    results.push([name, score]);
    console.log(`${score >= THRESHOLD ? 'PASS' : 'FAIL'}  ${name.padEnd(14)} SSIM ${score.toFixed(4)}`);
  }

  await browser.close();
  const failed = results.filter(([, s]) => s < THRESHOLD);
  console.log(`\ncompare images in ${DIR}/`);
  if (failed.length) { console.log(`${failed.length} beat(s) below ${THRESHOLD}`); process.exit(1); }
  console.log('fidelity OK');
})();
```

- [ ] **Step 3: Run it and record the baseline**

```bash
node .fidelity.cjs
```

The first run establishes where you actually are. Open every `*_ours.png` next to its `*_ref.png` in `/tmp/win98/fidelity/` and fix the largest visual gaps — most likely font scale, POST vertical offset, or EPA logo size. Re-run until each beat clears `0.80`.

Do not lower `THRESHOLD` to make it pass. If a beat cannot clear 0.80, the reconstruction is wrong; fix the reconstruction.

- [ ] **Step 4: Commit**

```bash
git add .fidelity.cjs
git commit -m "test: add SSIM fidelity diff against the reference boot video"
```

---

## Task 13: Attribution, Final Verification, Deploy

**Files:**
- Modify: `index.html`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the font attribution**

CC BY-SA 4.0 requires it. In `index.html`, extend the existing credits line in `#resume-subtitle`:

```html
<p id="resume-subtitle">
  Inspired by
  <a href="https://www.donchia.tech/" target="_blank" rel="noopener noreferrer"><b>dochia.tech</b></a>
  &amp;
  <a href="https://98.js.org/" target="_blank" rel="noopener noreferrer"><b>98.js.org</b></a>
  &middot; BIOS type set in
  <a href="https://int10h.org/oldschool-pc-fonts/" target="_blank" rel="noopener noreferrer"><b>Px437 IBM VGA</b></a>
  by VileR (CC BY-SA 4.0)
</p>
```

- [ ] **Step 2: Document the new architecture**

In `CLAUDE.md`, replace the "Boot gate" paragraph under **Architecture** with a description of the three-file entry flow (`boot-gate.js` → `boot-sequence.js` → `initDesktop`), and add `serve.py` / `.smoke.cjs` / `.fidelity.cjs` to the **Build & run** section.

- [ ] **Step 3: Full verification**

```bash
node .smoke.cjs && node .fidelity.cjs
```

Expected: both exit 0. **Do not proceed if either is red.**

- [ ] **Step 4: Confirm the bundle is current**

```bash
npx terser personal_win.js -c -m -o /tmp/check.min.js
diff /tmp/check.min.js dist/app.min.js && echo "bundle is current"
```

Expected: `bundle is current`. If it differs, the committed bundle is stale — rebuild and amend.

- [ ] **Step 5: Manual check in a real browser**

```bash
python3 serve.py 8123
```

Open `http://localhost:8123`. Confirm: black screen, Clippy asks, both buttons boot, sound plays, POST looks like the video, clouds rise from the bottom, desktop appears, tour does not block anything. Then reload and confirm the short path.

- [ ] **Step 6: Commit and deploy**

```bash
git add index.html CLAUDE.md
git commit -m "docs: font attribution and updated architecture notes"
git push origin <branch>
```

**Pushing publishes.** Only push once both test suites are green and you have looked at the site in a real browser.

---

## Self-Review Notes

- **Spec coverage:** Section 1 → Tasks 4, 5, 10. Section 2 → Tasks 3, 6, 7, 8. Section 3 → Task 10. Section 4 → Task 11. Section 5 → Task 4 (mobile branch). Section 6 → Tasks 1, 12. Section 7 file map → Tasks 2, 3, 4, 9, 13.
- **Deferred by design:** the cropped Clippy intro sheet (spec Section 1, "Not in scope for the first implementation"). Revisit only if the black screen measurably drags.
- **Open questions carried from the spec:** whether to commit the 877KB reference mp4 (Task 12 needs it present; currently untracked), and what the owner patched in the vendored `clippy.js`.
