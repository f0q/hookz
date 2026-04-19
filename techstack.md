# Hookz — Tech Stack

## App Shell & Distribution

| Technology | Version | Role |
|------------|---------|------|
| [Electron](https://www.electronjs.org) | v28 | Desktop app shell — creates the native window, menus, and IPC bridge between UI and system |
| [electron-builder](https://www.electron.build) | v24 | Packages the app into a distributable `.app` bundle and `.dmg` installer for macOS |

---d

## Frontend / UI

| Technology | Version | Role |
|------------|---------|------|
| [React](https://react.dev) | v18 | Component-based UI framework — manages state and renders all interface elements |
| [React DOM](https://react.dev) | v18 | Renders React component tree into the Electron browser window |
| Vanilla CSS | — | Dark-theme styles (`src/styles.css`) — no CSS framework, full manual control |

---

## Video Processing

| Technology | Version | Role |
|------------|---------|------|
| [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) | v2 | Node.js fluent API wrapper around the FFmpeg binary |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | v5 | Pre-built FFmpeg binary bundled inside the app — no system FFmpeg install needed |
| [ffprobe-static](https://github.com/joshwnj/ffprobe-static) | v3 | Pre-built ffprobe binary for reading video metadata (resolution, duration, audio presence) |
| `h264_videotoolbox` | — | Apple Silicon hardware H.264 encoder — used for final `.mp4` output (fast, high quality) |
| `prores_ks` (ProRes 422 HQ) | — | Near-lossless intermediate codec used between the text-overlay pass and the concat pass |

---

## Build Tools

| Technology | Version | Role |
|------------|---------|------|
| [Webpack](https://webpack.js.org) | v5 | Bundles `src/` (React + JSX + CSS) into `dist/bundle.js` + `dist/index.html` |
| [webpack-cli](https://webpack.js.org/api/cli/) | v5 | CLI interface for running and watching webpack builds |
| [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin) | v5 | Generates `dist/index.html` with the bundle script tag automatically injected |
| [@babel/core](https://babeljs.io) | v7 | JavaScript transpiler — enables modern JS and JSX syntax |
| [@babel/preset-env](https://babeljs.io/docs/babel-preset-env) | v7 | Transpiles modern JS to a Electron-compatible target |
| [@babel/preset-react](https://babeljs.io/docs/babel-preset-react) | v7 | Transpiles JSX syntax to plain JavaScript |
| [babel-loader](https://github.com/babel/babel-loader) | v9 | Webpack loader that runs Babel on `.js` and `.jsx` files |
| [css-loader](https://github.com/webpack-contrib/css-loader) | v6 | Resolves `@import` and `url()` in CSS files |
| [style-loader](https://github.com/webpack-contrib/style-loader) | v3 | Injects CSS into the Electron renderer window at runtime |
| [concurrently](https://github.com/open-cli-tools/concurrently) | v8 | Runs webpack `--watch` and the Electron process in parallel during `npm run dev` |
| [wait-on](https://github.com/jeffbski/wait-on) | v7 | Waits for `dist/index.html` to exist before launching Electron in dev mode |

---

## Electron Architecture

| Module | File | Role |
|--------|------|------|
| Main Process | `electron/main.js` | Creates the `BrowserWindow`, registers all `ipcMain` handlers (file dialogs, video processing, presets) |
| Preload Script | `electron/preload.js` | `contextBridge` — exposes a safe, typed API (`window.electronAPI`) to the renderer without enabling raw Node access |
| Renderer Process | `src/` (React app) | The UI — runs in the Electron browser window, communicates with the main process exclusively through the preload bridge |
| Video Processor | `electron/processor.js` | All FFmpeg logic — text overlay, concat, preview generation, font listing |

---

## Platform & Runtime

| Technology | Notes |
|------------|-------|
| macOS | Target platform (Monterey 12+ supported, Sequoia tested) |
| Apple Silicon (arm64) | All builds target `arm64` — uses native hardware encoders |
| Node.js | v18+ required (v20 recommended) |
| npm | v9+ (bundled with Node) |

---

## Data Persistence

| What | Where |
|------|-------|
| Text-style presets (font, size, color, position, shadow, box) | `~/Library/Application Support/hookz/text-style-presets.json` |
| Processed video outputs | User-selected output directory |
| Temp files during processing | macOS system `$TMPDIR` — auto-cleaned after each job |

---

## npm Scripts Reference

| Script | What it runs |
|--------|-------------|
| `npm run dev` | Webpack watch + auto-launch Electron (development with live reload on `Cmd+R`) |
| `npm run build` | Webpack one-shot compile `src/` → `dist/` |
| `npm run package` | Build + `electron-builder --mac --dir --arm64` → `release/mac-arm64/Hookz.app` |
| `npm run package:dmg` | Build + `electron-builder --mac --arm64` → `release/Hookz-1.0.0-arm64.dmg` |
