# Clippy Boot Gate & 1:1 Win98 Boot Sequence — Design

**Date:** 2026-08-25
**Project:** swastikthapaliya.com.np — personal portfolio
**Supersedes:** the boot/mobile portions of `2026-04-12-windows98-mobile-login-design.md`

---

## Problem Statement

The site opens on a fake Windows 98 login dialog (`#alert-box`). It has no authentication
logic. Its only real function is to satisfy browser autoplay policy — the Win98 startup sound
needs a user gesture before it can play.

A fake login is a dull way to spend the visitor's one required interaction. It also reads as a
barrier rather than as part of the experience.

Additionally, `#main-content` is hidden only in JS, so the teal desktop flashes between first
paint and script execution.

---

## Goals

- Replace the login dialog with a Clippy-hosted entry that is funny, minimal, and unmistakably
  1998 — while still capturing the one gesture that unlocks audio.
- A **pixel-faithful** Award BIOS POST and Windows 98 splash, compressed into a ~6 second boot.
- Never make a returning visitor sit through the boot twice.
- A Clippy guided tour after boot that **never blocks interaction**.
- An automated fidelity check, so boot accuracy is a measured number rather than a judgement call.

## Non-Goals

- No change to the mobile display. Mobile keeps its current "your device is smarter than this
  site" screen exactly as it is.
- No screensaver (gate or idle). Explicitly dropped.
- No Winamp. Revisit only when it can be genuinely functional; a non-working skin is not worth
  shipping.
- No redesign of the desktop, windows, taskbar, Start menu, or My Documents.

## Guiding Principle

Every visual decision must look like it shipped with Windows 98 in 1998. If a feature cannot be
made to look period-correct, it is cut or simplified — never styled to look "close enough."

---

## Critical Deployment Context

**Read this before touching anything.**

1. `index.html` loads `dist/app.min.js`, **not** `personal_win.js`. Editing the source has zero
   effect on the page until you re-minify:
   ```bash
   npx terser personal_win.js -c -m -o dist/app.min.js
   ```
   This command reproduces the committed bundle byte-for-byte (verified 2026-08-25).
2. Bump the cache-buster in `index.html` (`dist/app.min.js?v=YYYYMMDD`) on every JS change.
3. **Cloudflare auto-deploys from git on push.** There is no staging. A pushed commit is live.
   Verify locally and run the smoke test before pushing.
4. `boot.js` is dead code — a byte-identical copy of `personal_win.js` lines 1–72, referenced by
   nothing. Delete it as part of this work.

---

## Section 1 — The Entry Gate

### Autoplay constraint

Audio unlock requires **sticky activation**, granted by `click`, `touchend`, or `keydown` (any key
except Escape and browser shortcuts). Sticky activation does **not** survive a page load, so
*every* visit needs a fresh gesture — including returning visitors. The gate is therefore
permanent; only the boot animation behind it is skippable.

### Visual design — minimal

- Pure black full-viewport screen. `#main-content` carries inline `style="display:none"` so the
  desktop can never flash (fixes the existing flash bug).
- Before Clippy arrives: a single blinking underscore, top-left, in the VGA font. Nothing else.
- No logo, no name, no "loading" text, no scanlines, no vignette.
- Clippy sits slightly below centre with his balloon above him.
- Balloon: Win98 tooltip yellow (`#FFC`), 1px solid black, MS Sans Serif — this is the existing
  `.clippy-balloon` style in `assets/css/clippy.css`, reused unchanged.
- Buttons: standard raised Win98 bevel — `background:#c0c0c0; border:2px solid;
  border-color:#fff #000 #000 #fff`, inverted on `:active`. MS Sans Serif 13px.

### Sequence

| Time | Beat | Clippy animation |
|---|---|---|
| 0.0s | Black screen, blinking underscore | — |
| ~0.4s | Clippy slides up from bottom | `Show` → `Wave` |
| 0.6s | Balloon types out, word by word | `Explain` |
| wait | Two buttons appear beneath the balloon | `IdleEyeBrowRaise` / `IdleFingerTap`, looped |
| click | **Either** button. Audio unlocks here. | `GetTechy` |
| +0.3s | Clippy exits, black holds a beat | `Hide` |
| +0.5s | Boot begins (Section 2) | — |

### Copy (first visit)

> It looks like you're trying to visit a portfolio. This PC has been powered off since 1998.
> Shall I boot it up?

`[Yes, boot it up]`  `[No thanks]`

**Both buttons boot.** `No thanks` first shows:

> Booting anyway. I'm an assistant, not a democracy.

…held for ~1.2s, then the boot proceeds identically. This is deliberate: any gesture unlocks
audio, so both buttons must lead somewhere, and the joke turns that requirement into the payoff.
There is no dead end and no way to decline.

### Copy (return visit, within 10 days)

> Welcome back. Warm boot — this'll be quick.

`[Let's go]`  `[Fine]`

Both proceed. POST is skipped; see Section 3.

### Implementation notes

`clippy.js` is vendored and hand-patched by the site owner. **Do not refactor it.** Two facts
govern the integration:

- `Balloon.speak(complete, text, hold)` renders via `.text()` and types word-by-word at
  `WORD_SPEAK_TIME` (200ms). HTML cannot be injected into the balloon content.
- Passing `hold = true` keeps the balloon open indefinitely instead of auto-hiding after
  `CLOSE_BALLOON_DELAY` (2000ms).

Therefore: call `speak(text, true)`, and on the completion callback **append a button row as a
sibling inside `.clippy-balloon`**, styled by our own CSS. No modification to the vendored file.

`clippy.Agent` appends itself to `#main-content` (`assets/js/clippy.js:8`). Since `#main-content`
is hidden during the gate, the gate's Clippy must mount into the boot screen container instead.
Handle this by mounting the gate Clippy into `#boot-screen` and moving/reloading the agent for the
post-boot tour — do not change the vendored selector.

### Sprite loading

`agents/Clippy/map.png` is 3348×3162, 1.27MB, and **already an 8-bit colormap PNG — it does not
compress further.** Measured 2026-08-25: pngquant produced *larger* files at every quality setting
(1.37MB at `--quality=65-85`); lossy WebP was 2.3MB; lossless WebP 1.36MB. Do not spend time here.

Mitigation:
- `<link rel="preload" as="image" href="agents/Clippy/map.png">` in `<head>`.
- Keep `agents/Clippy/sounds-ogg.js` (86KB) off the critical path.
- The black screen doubles as the loading screen — diegetically correct for a powered-off PC.

If the black screen feels slow in testing, the fallback is a cropped intro sheet containing only
`Show`, `Wave`, `Explain`, `IdleFingerTap`, `Hide` (~70 of 918 frames, ≈100KB), generated by a
script that reads frame coordinates from `agents/Clippy/agent.js` and emits a remapped JSON, with
the full sheet preloading during the boot. **Not** in scope for the first implementation.

---

## Section 2 — The Boot Sequence

### Fidelity standard

**1:1 in space, compressed in time.** Every frame is pixel-faithful to
`windows-98-boot-animation.mp4`: same glyphs, same character cells, same colours, same wipe
geometry. Only the dwell between beats is shortened.

### The font is the whole game

A BIOS POST is VGA text mode: an **80×25 grid of 8×16 bitmap glyphs**, every character in a fixed
cell. CSS `monospace` produces wrong glyph shapes and drifting metrics — it reads as "a terminal,"
not "a BIOS." This is the single most likely cause of a botched reconstruction.

- Font: **Px437 IBM VGA 8x16**, from VileR's Ultimate Oldschool PC Font Pack (int10h.org).
- Licence: **CC BY-SA 4.0 — attribution required.** Add a credit line alongside the existing
  98.js.org / donchia.tech credits in the Résumé window.
- Self-host next to `fonts/MS-Sans-Serif.ttf`.
- Render into a fixed 80×25 grid, scaled with `image-rendering: pixelated`, so every glyph lands
  in the same cell as the original.

### Phase A — POST (verbatim text)

Header block, white on black, with the blue Energy Star sphere glyph on line 1 and the blue Award
ribbon glyph on line 2:

```
 Award Modular BIOS v4.51PG, An Energy Star Ally
 Copyright (C) 1984-97, Award Software, Inc.

(55XWUQ0E) Intel i430VX PCIset(TM)

PENTIUM-S CPU at 120MHz
Memory Test :   65536K OK

Award Plug and Play BIOS Extension  v1.0A
Copyright (C) 1997, Award Software, Inc.
```

Footer block, bottom of screen, `DEL` and `ESC` rendered bold/bright:

```
Press DEL to enter SETUP, ESC to skip memory test
12/10/97-i430VX,UMC8669-2A59GH2BC-00
```

The EPA Energy Star logo sits top-right: yellow line-art `energy` script with a yellow star, over
green `EPA POLLUTION PREVENTER` text. Asset already exists at `icons/epa.png` (from the
`feat/win98-boot-mobile` branch).

Memory Test counts up `640K` → `65536K` before settling on `65536K OK`.

IDE detection block, appearing line by line:

```
Award Plug and Play BIOS Extension  v1.0A
Copyright (C) 1997, Award Software, Inc.
    Detecting IDE Primary Master   ... PCemHD
    Detecting IDE Primary Slave    ... PCemCD
    Detecting IDE Secondary Master ... None
    Detecting IDE Secondary Slave  ... None
```

with `(Press F4 to skip)` shown transiently against the in-progress line.

### Phase B — System Configuration table

A double-line box (`╔ ═ ╗ ║ ╚ ╝`) titled `System Configuration`, two columns:

```
CPU Type          : PENTIUM-S        Base Memory       :   640K
Co-Processor      : Installed        Extended Memory   : 64512K
CPU Clock         : 120MHz           Cache Memory      :   None

Diskette Drive A  : 2.88M, 3.5 in.   Display Type      : EGA/VGA
Diskette Drive B  : None             Serial Port(s)    : 3F8 2F8
Pri. Master  Disk : LBA ,Mode 2, 1048MB  Parallel Port(s) : 378
Pri. Slave   Disk : CDROM,Mode 4     EDO DRAM at Row(s) : None
Sec. Master  Disk : None             SDRAM at Row(s)   : 0 1 2 3 4
Sec. Slave   Disk : None             L2 Cache Type     : None
```

Followed by the PCI device listing:

```
PCI device listing.....
Bus No. Device No. Func No. Vendor ID  Device ID  Device Class        IRQ
--------------------------------------------------------------------------
   0        7         1       8086       1230     IDE Controller       14
   0       17         0       1274       1371     Multimedia Device    11

Verifying DMI Pool Data .......
```

with a trailing block cursor after the dots.

> Exact column alignment must be taken from the reference frames during implementation, not
> guessed. Extract with:
> `ffmpeg -ss 11.6 -i windows-98-boot-animation.mp4 -frames:v 1 -vf "crop=940:420:10:230,scale=iw*2:ih*2:flags=neighbor" out.png`

### Phase C — The clouds wipe

Measured from the reference at 12fps across the transition:

- The splash is **anchored to the bottom edge and revealed upward**, black above.
- Duration **~950ms, linear**. Not a fade, not a scroll — a curtain rising.
- Implementation: `clip-path: inset(N% 0 0 0)` animating `100%` → `0%`, `background-position:
  bottom`, `linear` easing.

Assets already fetched on the `feat/win98-boot-mobile` branch — cherry-pick rather than re-source:

| File | Size | Source |
|---|---|---|
| `assets/images/win98-splash-bg.jpg` | 121K | archive.org |
| `assets/images/win98-logo-3d.png` | 42K | archive.org |
| `icons/epa.png` | — | Wikimedia Commons |

### Timing budget (~6.0s total)

| Duration | Beat |
|---|---|
| 0.4s | Black hold after Clippy exits |
| 0.6s | Memory count-up |
| 0.6s | PnP + IDE detection |
| 0.8s | System Configuration table + PCI listing |
| 0.3s | `Verifying DMI Pool Data .......` |
| 0.95s | Clouds wipe (Phase C) |
| 1.0s | Splash hold, progress sweep |
| 0.8s | Splash fades, desktop fades in, icons stagger (existing behaviour) |

### Startup sound

`assets/audio/win98-startup.mp3` is **7.92s** — longer than the whole boot. It starts at the
beginning of the clouds wipe and is still ringing as the desktop appears, which is what the real
machine did. Do not trim it.

---

## Section 3 — Return Visits

`localStorage` key `win98_boot_seen`, value = ISO timestamp of last full boot.

| Condition | Behaviour |
|---|---|
| Key absent, or stamp older than 10 days | Full boot. Write a fresh stamp. |
| Stamp within 10 days | **Skip Phases A and B.** Gate → clouds wipe → splash → desktop (~2.75s). No tour offer. |

The gate itself always runs — sticky activation cannot be cached.

All reads and writes must be wrapped in `try`/`catch`; private-mode browsers throw on access. On
any error, fall back to the full boot.

---

## Section 4 — The Clippy Tour

Offered once, only after a **full** boot, ~1.5s after the desktop settles.

> Want the tour? I promise to be less annoying than I was in 1998.

`[Show me around]`  `[No thanks]`

`No thanks` dismisses Clippy to his resting position; he stays available but silent.

### Non-blocking is a hard requirement

- **No overlay, no modal, no backdrop, no pointer-events trap.** Every icon, window, button and
  link stays fully interactive throughout.
- The tour never moves, opens, or closes a window on the visitor's behalf without their click.
- Clicking anything not part of the tour ends the tour silently. No "are you sure."
- Clippy is draggable and dismissible at every step.

### Steps

Use `agent.gestureAt(x, y)` — it picks the correct directional animation automatically, and all
four `GestureLeft/Right/Up/Down` frames exist in the sheet.

1. Point at **My Computer** — mention it becomes `Doom.exe` when opened.
2. Point at **My Documents** — mention Docsmith.
3. Point at **Résumé**.
4. Point at the **Start button**.
5. Rest pose, tour over.

Each step advances on a timer or on a `[Next]` click, whichever comes first. All 43 animations in
`agents/Clippy/agent.js` are available; `Processing` and `GetTechy` suit the boot, `Congratulate`
and `Wave` the tour's end.

---

## Section 5 — Mobile

**Byte-for-byte unchanged from today.** At `width <= 1024` the visitor sees the existing
"Warning: Your device is smarter than this site" message with the Résumé button, rendered by the
existing `#alert-box` markup and `alert.css`.

**Mobile skips the gate entirely.** It does not see Clippy, the black screen, or the boot. The
reasoning is decisive: mobile never plays the startup sound today, so there is no audio to unlock
and therefore no gesture required. Running the gate on mobile would buy nothing and would cost a
1.27MB sprite download on a phone connection.

`boot-gate.js` therefore branches on width at the very start:

| Width | Path |
|---|---|
| `<= 1024` | Show `#alert-box` with the existing mobile copy. Nothing else runs. Identical to today. |
| `> 1024` | Black screen → Clippy gate → boot → desktop. |

This means **`#alert-box` and `alert.css` are retained**, not deleted — they are the mobile screen.
They are simply no longer shown on desktop.

No new mobile shell, no `mobile.css`. The mobile work described in the 2026-04-12 plan is
explicitly **not** part of this project.

---

## Section 6 — Verification Harness (build alongside, not after)

Modelled on `~/Documents/tennis_for_two/poc`.

**`serve.py`** — `python3 -m http.server` with `Cache-Control: no-cache`, so the browser can never
serve a stale `index.html` / `dist/app.min.js` pair. That failure mode looks exactly like a broken
build.

**`.smoke.cjs`** — headless Chromium via Playwright:
- Fails on any `pageerror` or console error.
- Drives gate → boot → desktop → tour, asserting each phase is reached.
- Asserts the audio element actually played (`currentTime > 0`).
- Asserts the localStorage skip path produces the short boot on a second load.
- Screenshots each phase.

**Fidelity diff** — the distinguishing piece:
- Extract reference frames from `windows-98-boot-animation.mp4` at the beat boundaries.
- Render ours headless at the same beats, at the reference's 4:3 aspect.
- Pixel-diff, emit a similarity score per beat plus diff images.
- Fail the run below an agreed threshold.

**`window.__DEV` hooks** (dev-only, stripped or inert in the bundle):
`__DEV.skipGate()`, `__DEV.skipBoot()`, `__DEV.replayBoot()`, `__DEV.clearBootStamp()`,
`__DEV.phase()`.

---

## Section 7 — File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Modify | Add `#boot-screen` + `#clippy-gate`; add `style="display:none"` to `#main-content`; **keep `#alert-box`** (mobile only) but default it hidden; preload sprite + VGA font; bump cache-buster |
| `alert.css` | Keep | Still renders the mobile screen. Not loaded/shown on desktop. |
| `boot-gate.js` | Create | Black screen, Clippy gate, button row, gesture capture, audio unlock, localStorage stamp |
| `boot-sequence.js` | Create | POST grid renderer, config table, DMI, clouds wipe, splash, hand-off to `initDesktop()` |
| `boot.css` | Create | VGA font-face, 80×25 grid, POST colours, wipe/splash animation, gate button styles |
| `personal_win.js` | Modify | Move the login handler and the `width <= 1024` mobile branch into `boot-gate.js` (the mobile copy itself is unchanged, only relocated); expose `window.initDesktop()`; add the tour |
| `dist/app.min.js` | Rebuild | `npx terser personal_win.js -c -m -o dist/app.min.js` |
| `boot.js` | Delete | Dead duplicate |
| `fonts/PxPlus_IBM_VGA_8x16.woff2` | Add | POST font (CC BY-SA 4.0, attribution required) |
| `serve.py`, `.smoke.cjs` | Create | Section 6 |

Implement on a fresh branch off `master`. The existing `feat/win98-boot-mobile` branch is
superseded — cherry-pick its three image assets, then abandon it.

---

## Risks

| Risk | Mitigation |
|---|---|
| 1.27MB sprite delays the gate on slow connections | Preload; black screen reads as intentional; cropped intro sheet held in reserve |
| Vendored `clippy.js` was hand-patched by the owner | Do not refactor it. Ask the owner what was patched before extending balloon/positioning behaviour. |
| POST column alignment guessed rather than measured | Extract reference frames; fidelity diff fails the build |
| Push deploys straight to production | Smoke test before push; never push a red run |
| VGA font licence | CC BY-SA 4.0 attribution line in the Résumé window credits |

## Open Questions

1. Should `windows-98-boot-animation.mp4` (877KB) be committed so the fidelity test is
   reproducible from a clean clone, or kept local and gitignored? Owner's call.
2. What exactly was patched in the vendored `clippy.js`? Needed before extending it.
