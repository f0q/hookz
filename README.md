# Video Mixer

A macOS desktop app by **Jamal The Creator** that burns a styled text overlay onto hook videos and concatenates each one with a main video — producing one ready-to-publish `.mp4` per hook.

---

## What it does

1. You select one **Main Video** (your evergreen content, e.g. a product demo).
2. You add one or more **Hook Videos** — each with its own text overlay, style (font, size, color, position, shadow, box) and a live preview.
3. You pick an **Output Directory**.
4. Click **Generate** — the app renders every hook → main concatenation in sequence and saves the outputs as `.mp4` files.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | bundled with Node |
| macOS | 12+ (Monterey) | Apple Silicon (arm64) assumed |

---

## Installation

```bash
git clone <repo-url>
cd video-mixer
npm install
```

`npm install` downloads all dependencies including the Electron binary, ffmpeg and ffprobe static binaries, and all build tools. It takes about a minute on first run.

---

## Running in development

```bash
npm start
```

Runs `webpack` (builds the React renderer into `dist/`) then opens the Electron app. Use this during active development.

For hot-reload while editing React code:

```bash
npm run dev
```

Starts webpack in `--watch` mode and re-launches Electron automatically once the first build is ready. Subsequent code changes to `src/` are picked up on the next manual app reload (`Cmd+R` in the DevTools window).

> **Note:** DevTools open automatically in `npm start` / `npm run dev`. They do not open in the packaged app.

---

## Packaging (creating a standalone .app)

### When to run this

Run `npm run package` any time you want a distributable, double-clickable macOS app — after any round of code changes that you want to "ship" to yourself or someone else.

You do **not** need to run it just to test changes; use `npm start` for that.

### Command

```bash
npm run package
```

This does two things in sequence:

1. **`npm run build`** — Webpack compiles `src/` into `dist/bundle.js` + `dist/index.html`.
2. **`electron-builder --mac --dir`** — Packages everything into a self-contained macOS app.

Output: `release/mac-arm64/Video Mixer.app`

The `--dir` flag produces a `.app` bundle only (no DMG installer). This is fast (~1 min) and is all you need for personal use.

### Installing to Applications

```bash
cp -r "release/mac-arm64/Video Mixer.app" /Applications/
```

Or drag `release/mac-arm64/Video Mixer.app` to `/Applications` in Finder.

### First launch after copying

Because the app is **unsigned** (no Apple Developer certificate), macOS Gatekeeper will block the first open. Do this once:

1. **Right-click** `Video Mixer.app` → **Open**
2. Click **Open** in the security dialog

After that, double-clicking works normally forever.

### Rebuilding after code changes

```bash
npm run package
cp -r "release/mac-arm64/Video Mixer.app" /Applications/
```

If the app is already running, quit it first (`Cmd+Q`), then copy.

### Optional: create a DMG installer

```bash
npm run package:dmg
```

Produces `release/Video Mixer-1.0.0-arm64.dmg` — a drag-to-install disk image, useful for sharing with others.

---

## Project structure

```
video-mixer/
├── electron/
│   ├── main.js          # Electron main process — BrowserWindow, all IPC handlers
│   ├── preload.js       # contextBridge — secure API exposed to the renderer
│   └── processor.js     # All FFmpeg logic (text overlay, concat, preview, fonts)
├── src/
│   ├── App.jsx          # Root React component — state, generate handler
│   ├── index.jsx        # React entry point
│   ├── styles.css       # Dark theme styles
│   └── components/
│       ├── VideoSelector.jsx    # Reusable file/folder picker button
│       ├── HookList.jsx         # Hook list with bulk-add
│       ├── HookItem.jsx         # Individual hook: video + text textarea
│       ├── OverlayEditor.jsx    # Live preview + style controls + presets
│       └── ProgressOverlay.jsx  # Full-screen progress bar with Stop button
├── dist/                # Webpack output (generated — do not edit)
├── release/             # electron-builder output (generated)
├── package.json
└── webpack.config.js
```

---

## FFmpeg pipeline

Each hook is processed in two passes:

### Pass 1 — Text overlay (temp file)
- Reads the hook video with `ffprobe` to detect resolution, audio presence, and duration.
- Runs `ffmpeg` with a `drawtext` filter using the chosen font, size, color, and position.
- Text is written to a temp `.txt` file (avoids all shell-escaping issues, supports multi-line text).
- Output is encoded as **ProRes 422 HQ** (`.mov`) — a near-lossless intermediate that prevents quality degradation before the final encode.
- If the source has no audio, a silent AAC stereo track is synthesised.

### Pass 2 — Concatenation (final file)
- Takes the ProRes hook + the main video.
- Uses `filter_complex` concat to guarantee perfect A/V sync (both streams go through the filter graph — no timing drift).
- Both video streams are scaled and letterboxed to the main video's resolution.
- Both audio streams are resampled to 44100 Hz stereo before concat.
- Final encode: **h264_videotoolbox** (Apple Silicon hardware encoder) at the main video's source bitrate (minimum 8 Mbps) + AAC 320 kbps.
- The ProRes temp file is deleted immediately after.

---

## Libraries

| Library | Role |
|---------|------|
| [Electron](https://www.electronjs.org) v28 | Desktop app shell — BrowserWindow, IPC, native dialogs |
| [React](https://react.dev) v18 | UI renderer |
| [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) v2 | Node.js wrapper around the FFmpeg binary |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) v5 | Bundles a pre-built FFmpeg binary (no system install needed) |
| [ffprobe-static](https://github.com/joshwnj/ffprobe-static) v3 | Bundles a pre-built ffprobe binary for video metadata |
| [webpack](https://webpack.js.org) v5 | Bundles React + CSS into a single `bundle.js` |
| [electron-builder](https://www.electron.build) v24 | Packages the app into a distributable macOS `.app` / DMG |
| Babel | Transpiles JSX and modern JS for webpack |

---

## Preset storage

Text-style presets (font, size, color, position, shadow, box settings) are saved to:

```
~/Library/Application Support/video-mixer/text-style-presets.json
```

This file is created automatically on first save and persists across app updates. Deleting it clears all saved presets.

---

## npm scripts reference

| Script | What it does |
|--------|-------------|
| `npm start` | Build renderer + open app (development) |
| `npm run dev` | Webpack watch + auto-open (hot-reload dev) |
| `npm run build` | Webpack only — compile `src/` → `dist/` |
| `npm run package` | Build + package → `release/mac-arm64/Video Mixer.app` |
| `npm run package:dmg` | Build + package → `release/*.dmg` installer |
