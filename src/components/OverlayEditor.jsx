import React, { useState, useEffect, useRef } from 'react';

const POSITIONS = [
  ['top-left',    '↖'], ['top',    '↑'], ['top-right',    '↗'],
  ['left',        '←'], ['center', '·'], ['right',        '→'],
  ['bottom-left', '↙'], ['bottom', '↓'], ['bottom-right', '↘'],
];

export default function OverlayEditor({ hook, onUpdateParams, onApplyParamsToAll }) {
  const { textParams } = hook;

  const [previewUrl,    setPreviewUrl]    = useState(null);
  const [previewing,    setPreviewing]    = useState(false);
  const [previewError,  setPreviewError]  = useState(null);
  const [fonts,         setFonts]         = useState([]);
  const [presets,       setPresets]       = useState([]);
  const [savingPreset,  setSavingPreset]  = useState(false);
  const [presetName,    setPresetName]    = useState('');
  const saveInputRef = useRef(null);

  // Load fonts and presets once on mount
  useEffect(() => {
    window.electronAPI.listFonts().then(setFonts).catch(() => {});
    window.electronAPI.listPresets().then(setPresets).catch(() => {});
  }, []);

  // Focus the save-name input whenever it appears
  useEffect(() => {
    if (savingPreset && saveInputRef.current) saveInputRef.current.focus();
  }, [savingPreset]);

  // Regenerate preview whenever text or params change (debounced)
  const effectKey = `${hook.videoPath}||${hook.text}||${JSON.stringify(textParams)}`;
  useEffect(() => {
    if (!hook.videoPath || !hook.text.trim()) return;

    setPreviewing(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.generatePreview(
          hook.videoPath, hook.text, textParams
        );
        if (result.success) {
          setPreviewUrl(result.dataUrl);
          setPreviewError(null);
        } else {
          setPreviewError(result.error || 'Preview failed');
        }
      } catch (e) {
        setPreviewError(e.message || 'Preview failed');
      } finally {
        setPreviewing(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectKey]);

  const set = (key, value) => onUpdateParams({ [key]: value });

  // ── Preset actions ──────────────────────────────────────────────────────

  const handleLoadPreset = (e) => {
    const name = e.target.value;
    if (!name) return;
    const preset = presets.find((p) => p.name === name);
    if (preset) onUpdateParams(preset.params); // replace all params at once
    e.target.value = ''; // reset dropdown
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    const updated = await window.electronAPI.savePreset(name, textParams);
    setPresets(updated);
    setPresetName('');
    setSavingPreset(false);
  };

  const handleDeletePreset = async (name) => {
    const updated = await window.electronAPI.deletePreset(name);
    setPresets(updated);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="overlay-editor">

      {/* ── Preset bar ───────────────────────────────────────────────── */}
      <div className="preset-bar">
        <span className="preset-bar-label">Preset</span>

        {/* Load dropdown */}
        <select className="ctrl-select preset-select" onChange={handleLoadPreset}
          defaultValue="">
          <option value="" disabled>Load preset…</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>

        {/* Delete buttons for each saved preset */}
        {presets.map((p) => (
          <button key={p.name} className="preset-delete-btn"
            title={`Delete "${p.name}"`}
            onClick={() => handleDeletePreset(p.name)}>
            {p.name} ×
          </button>
        ))}

        <div className="preset-bar-spacer" />

        {/* Save flow */}
        {savingPreset ? (
          <div className="preset-save-row">
            <input
              ref={saveInputRef}
              className="preset-name-input"
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
                if (e.key === 'Escape') { setSavingPreset(false); setPresetName(''); }
              }}
              maxLength={40}
            />
            <button className="btn-preset-confirm" onClick={handleSavePreset}
              disabled={!presetName.trim()}>Save</button>
            <button className="btn-preset-cancel"
              onClick={() => { setSavingPreset(false); setPresetName(''); }}>✕</button>
          </div>
        ) : (
          <button className="btn-preset-save" onClick={() => setSavingPreset(true)}>
            + Save as Preset
          </button>
        )}

        {/* Apply to all hooks */}
        <button className="btn-apply-all" title="Apply this style to all hooks"
          onClick={() => onApplyParamsToAll(textParams)}>
          Apply to All
        </button>
      </div>

      <div className="overlay-editor-title">Overlay Settings</div>

      <div className="overlay-editor-body">

        {/* ── Preview ─────────────────────────────────────────────────── */}
        <div className="overlay-preview-wrap">
          {!previewUrl && !previewError && (
            <div className="overlay-preview-placeholder">
              {previewing ? 'Generating preview…' : 'Preview will appear here'}
            </div>
          )}
          {previewError && !previewing && (
            <div className="overlay-preview-placeholder overlay-preview-error">
              Preview error:<br />{previewError}
            </div>
          )}
          {previewUrl && (
            <div className="overlay-preview-img-wrap">
              {previewing && <div className="overlay-preview-spinner" />}
              <img className="overlay-preview-img" src={previewUrl} alt="Overlay preview" />
            </div>
          )}
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="overlay-controls">

          {/* Font */}
          <div className="ctrl-row">
            <label className="ctrl-label">Font</label>
            <select className="ctrl-select" value={textParams.fontFile || ''}
              onChange={(e) => set('fontFile', e.target.value)}>
              <option value="">System Default</option>
              {fonts.map((f) => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Font size */}
          <div className="ctrl-row">
            <label className="ctrl-label">Size</label>
            <div className="ctrl-slider-wrap">
              <input type="range" min={16} max={200}
                value={textParams.fontsize}
                onChange={(e) => set('fontsize', Number(e.target.value))}
                className="ctrl-slider" />
              <span className="ctrl-value">{textParams.fontsize}px</span>
            </div>
          </div>

          {/* Font color */}
          <div className="ctrl-row">
            <label className="ctrl-label">Color</label>
            <div className="ctrl-color-wrap">
              <input type="color" value={textParams.fontcolor}
                onChange={(e) => set('fontcolor', e.target.value)}
                className="ctrl-color" />
              <span className="ctrl-value">{textParams.fontcolor}</span>
            </div>
          </div>

          {/* Position */}
          <div className="ctrl-row ctrl-row-top">
            <label className="ctrl-label">Position</label>
            <div>
              <div className="position-grid">
                {POSITIONS.map(([pos, icon]) => (
                  <button key={pos}
                    className={`pos-btn ${textParams.position === pos ? 'pos-btn-active' : ''}`}
                    onClick={() => set('position', pos)} title={pos}>
                    {icon}
                  </button>
                ))}
                <button
                  className={`pos-btn pos-btn-custom ${textParams.position === 'custom' ? 'pos-btn-active' : ''}`}
                  onClick={() => set('position', 'custom')} title="Custom X/Y">
                  XY
                </button>
              </div>

              {textParams.position === 'custom' && (
                <div className="custom-pos">
                  <div className="ctrl-row">
                    <label className="ctrl-label ctrl-label-sm">X</label>
                    <div className="ctrl-slider-wrap">
                      <input type="range" min={0} max={100}
                        value={textParams.customX}
                        onChange={(e) => set('customX', Number(e.target.value))}
                        className="ctrl-slider" />
                      <span className="ctrl-value">{textParams.customX}%</span>
                    </div>
                  </div>
                  <div className="ctrl-row">
                    <label className="ctrl-label ctrl-label-sm">Y</label>
                    <div className="ctrl-slider-wrap">
                      <input type="range" min={0} max={100}
                        value={textParams.customY}
                        onChange={(e) => set('customY', Number(e.target.value))}
                        className="ctrl-slider" />
                      <span className="ctrl-value">{textParams.customY}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Effects */}
          <div className="ctrl-row">
            <label className="ctrl-label">Effects</label>
            <div className="ctrl-toggles">
              <label className="toggle-label">
                <input type="checkbox" checked={textParams.shadow}
                  onChange={(e) => set('shadow', e.target.checked)} />
                Shadow
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={textParams.box}
                  onChange={(e) => set('box', e.target.checked)} />
                Box
              </label>
            </div>
          </div>

          {textParams.box && (
            <div className="ctrl-row">
              <label className="ctrl-label">Box Alpha</label>
              <div className="ctrl-slider-wrap">
                <input type="range" min={0} max={1} step={0.05}
                  value={textParams.boxOpacity}
                  onChange={(e) => set('boxOpacity', Number(e.target.value))}
                  className="ctrl-slider" />
                <span className="ctrl-value">{Math.round(textParams.boxOpacity * 100)}%</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
