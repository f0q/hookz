import React, { useState } from 'react';
import VideoSelector from './components/VideoSelector';
import HookList from './components/HookList';
import ProgressOverlay from './components/ProgressOverlay';

let hookIdCounter = 1;

const DEFAULT_TEXT_PARAMS = {
  fontsize:   72,
  fontcolor:  '#ffffff',
  fontFile:   '',         // empty = platform default font
  position:   'center',
  customX:    50,         // % used when position === 'custom'
  customY:    50,
  shadow:     true,
  box:        true,
  boxOpacity: 0.4,
};

function createHook(videoPath = null) {
  return {
    id: hookIdCounter++,
    videoPath,
    text: '',
    textParams: { ...DEFAULT_TEXT_PARAMS },
  };
}

export default function App() {
  const [mainVideo, setMainVideo]   = useState(null);
  const [hooks, setHooks]           = useState([]);
  const [outputDir, setOutputDir]   = useState(null);
  const [phase, setPhase]           = useState('idle'); // idle | processing | done | error
  const [progress, setProgress]     = useState(null);
  const [results, setResults]       = useState([]);
  const [error, setError]           = useState(null);

  // ── File / dir pickers ───────────────────────────────────────────────────

  const selectMainVideo = async () => {
    const filePath = await window.electronAPI.selectFile({
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    });
    if (filePath) setMainVideo(filePath);
  };

  const selectOutputDir = async () => {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) setOutputDir(dir);
  };

  // ── Hook management ──────────────────────────────────────────────────────

  const addMultipleHooks = (paths) => {
    setHooks((prev) => [...prev, ...paths.map((p) => createHook(p))]);
  };

  const removeHook = (id) => setHooks((prev) => prev.filter((h) => h.id !== id));

  const updateHook = (id, changes) =>
    setHooks((prev) => prev.map((h) => (h.id === id ? { ...h, ...changes } : h)));

  const updateHookParams = (id, paramChanges) =>
    setHooks((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, textParams: { ...h.textParams, ...paramChanges } } : h
      )
    );

  // Apply a full params object to every hook (used by "Apply to all" in OverlayEditor)
  const applyParamsToAll = (params) =>
    setHooks((prev) => prev.map((h) => ({ ...h, textParams: { ...params } })));

  // ── Validation ───────────────────────────────────────────────────────────

  const isValid =
    mainVideo &&
    hooks.length > 0 &&
    hooks.every((h) => h.videoPath && h.text.trim()) &&
    outputDir;

  // ── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!isValid) return;

    setPhase('processing');
    setProgress({ overall: 0, message: 'Starting…', taskIndex: 0, taskTotal: hooks.length });
    setError(null);

    window.electronAPI.onProgress((data) => setProgress(data));

    const tasks = hooks.map((h) => ({
      hookVideo:  h.videoPath,
      mainVideo,
      text:       h.text,
      textParams: h.textParams,
      outputDir,
    }));

    const result = await window.electronAPI.processVideos(tasks);
    window.electronAPI.removeProgressListener();

    if (result.cancelled) {
      setPhase('idle');
    } else if (result.success) {
      setResults(result.results);
      setPhase('done');
    } else {
      setError(result.error);
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setProgress(null);
    setResults([]);
    setError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <header className="app-header">
        <h1>Video Mixer</h1>
        <p className="app-subtitle">
          Add text overlays to hook videos and concatenate with your main video
        </p>
      </header>

      <main className="app-main">
        <section className="card">
          <h2 className="section-title">Main Video</h2>
          <VideoSelector
            filePath={mainVideo}
            onSelect={selectMainVideo}
            placeholder="Select main video…"
          />
        </section>

        <section className="card">
          <HookList
            hooks={hooks}
            onAddMultiple={addMultipleHooks}
            onRemove={removeHook}
            onUpdate={updateHook}
            onUpdateParams={updateHookParams}
            onApplyParamsToAll={applyParamsToAll}
          />
        </section>

        <section className="card">
          <h2 className="section-title">Output Directory</h2>
          <VideoSelector
            filePath={outputDir}
            onSelect={selectOutputDir}
            placeholder="Select output folder…"
            isDirectory
          />
        </section>

        <button
          className="btn-generate"
          onClick={handleGenerate}
          disabled={!isValid || phase === 'processing'}
        >
          Generate {hooks.length} Video{hooks.length !== 1 ? 's' : ''}
        </button>

        {phase === 'error' && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
            <button className="btn-link" onClick={handleReset}>Try again</button>
          </div>
        )}

        {phase === 'done' && (
          <div className="results-panel card">
            <h2 className="section-title">
              Done — {results.length} file{results.length !== 1 ? 's' : ''} saved
            </h2>
            {results.map((r) => (
              <div key={r.taskIndex} className="result-item">
                <span className="result-path">{r.outputPath.split('/').pop()}</span>
                <button
                  className="btn-secondary"
                  onClick={() => window.electronAPI.showInFolder(r.outputPath)}
                >
                  Show in Finder
                </button>
              </div>
            ))}
            <button className="btn-secondary" onClick={handleReset}>Process More</button>
          </div>
        )}
      </main>

      {phase === 'processing' && progress && (
        <ProgressOverlay
          progress={progress}
          onStop={() => window.electronAPI.stopProcessing()}
        />
      )}
    </div>
  );
}
