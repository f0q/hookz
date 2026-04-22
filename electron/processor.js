const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ffmpegPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
const ffprobePath = ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// ─── Stop support ────────────────────────────────────────────────────────────

let currentCommand = null;
let stopRequested = false;

function stopProcessing() {
  stopRequested = true;
  if (currentCommand) {
    try { currentCommand.kill('SIGKILL'); } catch (_) {}
    currentCommand = null;
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POSITION_MAP = {
  'top-left':     { x: '30',           y: '30' },
  'top':          { x: '(w-text_w)/2', y: '30' },
  'top-right':    { x: 'w-text_w-30',  y: '30' },
  'left':         { x: '30',           y: '(h-text_h)/2' },
  'center':       { x: '(w-text_w)/2', y: '(h-text_h)/2' },
  'right':        { x: 'w-text_w-30',  y: '(h-text_h)/2' },
  'bottom-left':  { x: '30',           y: 'h-text_h-30' },
  'bottom':       { x: '(w-text_w)/2', y: 'h-text_h-30' },
  'bottom-right': { x: 'w-text_w-30',  y: 'h-text_h-30' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SYSTEM_FONT_DIRS = process.platform === 'win32'
  ? [ path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts') ]
  : process.platform === 'darwin'
  ? [
      '/Library/Fonts',
      '/System/Library/Fonts',
      path.join(os.homedir(), 'Library', 'Fonts'),
    ]
  : [ '/usr/share/fonts', path.join(os.homedir(), '.fonts') ];

function getFontPath() {
  const candidates = {
    darwin: '/Library/Fonts/Arial.ttf',
    win32:  'C:\\Windows\\Fonts\\arial.ttf',
    linux:  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  };
  const candidate = candidates[process.platform] || candidates.linux;
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Returns all .ttf/.otf font files found in standard macOS font directories.
 */
function listFonts() {
  const fonts = [];
  for (const dir of SYSTEM_FONT_DIRS) {
    try {
      for (const file of fs.readdirSync(dir)) {
        if (/\.(ttf|otf)$/i.test(file)) {
          fonts.push({
            name: file.replace(/\.(ttf|otf)$/i, ''),
            path: path.join(dir, file),
          });
        }
      }
    } catch (_) {}
  }
  return fonts.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Escape a filesystem path for use inside FFmpeg filter single-quoted options.
 * Only the path itself needs quoting — text content goes via textfile= (no escaping needed).
 */
function escapePath(p) {
  return p.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe failed for "${filePath}": ${err.message}`));
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
      resolve({
        width:    videoStream ? videoStream.width  : 1920,
        height:   videoStream ? videoStream.height : 1080,
        hasAudio: !!audioStream,
        duration: parseFloat(metadata.format.duration) || 0,
        bitrate:  Math.round((parseFloat(metadata.format.bit_rate) || 8000000) / 1000),
      });
    });
  });
}

/**
 * Build a drawtext filter string using a temp textfile (avoids all text-escaping issues,
 * including newlines, %, ', :, etc.).
 *
 * Returns { filter: string, textFilePath: string }.
 * The caller MUST delete textFilePath after the FFmpeg command finishes.
 *
 * @param {string} text
 * @param {{ fontsize, fontcolor, fontFile, position, customX, customY, shadow, box, boxOpacity }} params
 * @param {string} inputPad
 * @param {string} outputPad
 */
function buildDrawTextFilter(text, params, inputPad = '[0:v]', outputPad = '[outv]') {
  const {
    fontsize   = 72,
    fontcolor  = '#ffffff',
    fontFile   = '',
    position   = 'center',
    customX    = 50,
    customY    = 50,
    shadow     = true,
    box        = true,
    boxOpacity = 0.4,
  } = params || {};

  // Write text to a temp file — avoids ALL filter-string escaping for text content,
  // and makes real newlines (\n in the file) render as line breaks in the video.
  const textFilePath = path.join(
    os.tmpdir(),
    `vidmix-dt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  );
  fs.writeFileSync(textFilePath, text, 'utf8');

  // Resolve x/y position
  let x, y;
  if (position === 'custom') {
    x = `max(0\\, w*${customX / 100}-text_w/2)`;
    y = `max(0\\, h*${customY / 100}-text_h/2)`;
  } else {
    const pos = POSITION_MAP[position] || POSITION_MAP.center;
    x = pos.x;
    y = pos.y;
  }

  // Resolve font
  const resolvedFont = fontFile || getFontPath();
  const fontPart = resolvedFont ? `fontfile='${escapePath(resolvedFont)}':` : '';
  const color = fontcolor.replace('#', '0x');

  let f = `${inputPad}drawtext=${fontPart}` +
    `textfile='${escapePath(textFilePath)}':` +
    `fontsize=${fontsize}:` +
    `fontcolor=${color}:` +
    `x=${x}:y=${y}`;

  if (shadow) f += ':shadowx=3:shadowy=3:shadowcolor=black@0.8';
  if (box)    f += `:box=1:boxcolor=black@${boxOpacity}:boxborderw=15`;

  return { filter: f + outputPad, textFilePath };
}

// ─── Step 1: Text overlay → ProRes 422 HQ intermediate ───────────────────────

async function addTextOverlay(inputPath, text, textParams, outputPath, onProgress) {
  const info = await probeVideo(inputPath);
  const { filter: filterStr, textFilePath } = buildDrawTextFilter(text, textParams);

  return new Promise((resolve, reject) => {
    const cleanup = () => { try { fs.unlinkSync(textFilePath); } catch (_) {} };

    const cmd = ffmpeg();
    cmd.input(inputPath);

    if (!info.hasAudio) {
      cmd.input('aevalsrc=0:channel_layout=stereo:sample_rate=44100');
      cmd.inputOptions(['-f lavfi']);
    }

    const audioMap = info.hasAudio ? '0:a' : '1:a';
    const outputOpts = [
      '-map [outv]',
      `-map ${audioMap}`,
      '-c:v prores_ks',
      '-profile:v 3',
      '-c:a pcm_s16le',
    ];
    if (!info.hasAudio) outputOpts.push('-shortest');

    currentCommand = cmd;
    cmd
      .complexFilter(filterStr)
      .outputOptions(outputOpts)
      .output(outputPath)
      .on('progress', (p) => {
        if (stopRequested) { cmd.kill('SIGKILL'); return; }
        if (onProgress) onProgress(Math.min(p.percent || 0, 100));
      })
      .on('end', () => {
        cleanup();
        currentCommand = null;
        if (stopRequested) return reject(new Error('__CANCELLED__'));
        resolve(outputPath);
      })
      .on('error', (err) => {
        cleanup();
        currentCommand = null;
        reject(stopRequested ? new Error('__CANCELLED__') : err);
      })
      .run();
  });
}

// ─── Step 2: Concatenate → final .mp4 ────────────────────────────────────────

async function concatenateVideos(hookPath, mainPath, outputPath, onProgress) {
  const mainInfo = await probeVideo(mainPath);
  const { width: W, height: H, hasAudio: mainHasAudio, bitrate } = mainInfo;
  const targetBitrate = Math.max(bitrate, 8000);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    cmd.input(hookPath);
    cmd.input(mainPath);

    if (!mainHasAudio) {
      cmd.input('aevalsrc=0:channel_layout=stereo:sample_rate=44100');
      cmd.inputOptions(['-f lavfi']);
    }

    const scalePad = (inp, out) =>
      `${inp}scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1${out}`;

    const filters = [
      scalePad('[0:v]', '[v0]'),
      scalePad('[1:v]', '[v1]'),
      '[0:a]aresample=44100,aformat=channel_layouts=stereo[a0]',
      mainHasAudio
        ? '[1:a]aresample=44100,aformat=channel_layouts=stereo[a1]'
        : '[2:a]aresample=44100,aformat=channel_layouts=stereo[a1]',
      '[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]',
    ];

    const outputOpts = [
      '-map [outv]',
      '-map [outa]',
      '-c:v', process.platform === 'darwin' ? 'h264_videotoolbox' : 'libx264',
      `-b:v ${targetBitrate}k`,
      '-c:a aac',
      '-b:a 320k',
    ];
    if (!mainHasAudio) outputOpts.push('-shortest');

    currentCommand = cmd;
    cmd
      .complexFilter(filters)
      .outputOptions(outputOpts)
      .output(outputPath)
      .on('progress', (p) => {
        if (stopRequested) { cmd.kill('SIGKILL'); return; }
        if (onProgress) onProgress(Math.min(p.percent || 0, 100));
      })
      .on('end', () => {
        currentCommand = null;
        if (stopRequested) return reject(new Error('__CANCELLED__'));
        resolve(outputPath);
      })
      .on('error', (err) => {
        currentCommand = null;
        reject(stopRequested ? new Error('__CANCELLED__') : err);
      })
      .run();
  });
}

// ─── Preview generation ───────────────────────────────────────────────────────

async function generatePreview(videoPath, text, params) {
  const info = await probeVideo(videoPath);
  const seekSec = Math.min(1, Math.max(0, info.duration - 0.1));
  const tmpOut = path.join(os.tmpdir(), `vidmix-prev-${Date.now()}.png`);
  const { filter: filterStr, textFilePath } = buildDrawTextFilter(text, params);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      try { fs.unlinkSync(textFilePath); } catch (_) {}
      try { fs.unlinkSync(tmpOut); } catch (_) {}
    };

    ffmpeg(videoPath)
      .seekInput(seekSec)
      .frames(1)
      .complexFilter(filterStr)
      .outputOptions(['-map [outv]'])
      .output(tmpOut)
      .on('end', () => {
        try {
          const b64 = fs.readFileSync(tmpOut).toString('base64');
          cleanup();
          resolve(`data:image/png;base64,${b64}`);
        } catch (e) {
          cleanup();
          reject(e);
        }
      })
      .on('error', (err) => {
        cleanup();
        reject(err);
      })
      .run();
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

async function processVideos(tasks, sendProgress) {
  stopRequested = false;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidmix-'));
  const results = [];

  try {
    for (let i = 0; i < tasks.length; i++) {
      if (stopRequested) throw new Error('__CANCELLED__');

      const task = tasks[i];
      const N = tasks.length;
      const taskBase   = (i / N) * 100;
      const taskWeight = 100 / N;

      const hookBasename   = task.hookVideo.replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '');
      const outputFilename = `${hookBasename}_mixed_${Date.now()}.mp4`;
      const outputPath     = path.join(task.outputDir, outputFilename);
      const tempHookPath   = path.join(tempDir, `hook_${i}.mov`);

      sendProgress({
        overall: taskBase, taskIndex: i, taskTotal: N,
        stage: 'processing_text',
        message: `Hook ${i + 1}/${N}: Adding text overlay…`,
      });

      await addTextOverlay(task.hookVideo, task.text, task.textParams, tempHookPath, (pct) => {
        sendProgress({
          overall: taskBase + (pct * 0.4 * taskWeight) / 100,
          taskIndex: i, taskTotal: N, stage: 'processing_text',
          message: `Hook ${i + 1}/${N}: Adding text overlay… ${Math.round(pct)}%`,
        });
      });

      if (stopRequested) throw new Error('__CANCELLED__');

      sendProgress({
        overall: taskBase + 0.4 * taskWeight, taskIndex: i, taskTotal: N,
        stage: 'concatenating',
        message: `Hook ${i + 1}/${N}: Concatenating with main video…`,
      });

      await concatenateVideos(tempHookPath, task.mainVideo, outputPath, (pct) => {
        sendProgress({
          overall: taskBase + 0.4 * taskWeight + (pct * 0.6 * taskWeight) / 100,
          taskIndex: i, taskTotal: N, stage: 'concatenating',
          message: `Hook ${i + 1}/${N}: Concatenating… ${Math.round(pct)}%`,
        });
      });

      results.push({ outputPath, taskIndex: i });
      try { fs.unlinkSync(tempHookPath); } catch (_) {}
    }
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }

  sendProgress({
    overall: 100, taskIndex: tasks.length, taskTotal: tasks.length,
    stage: 'done', message: 'All done!',
  });

  return results;
}

module.exports = { processVideos, stopProcessing, generatePreview, listFonts };
