import React from 'react';
import VideoSelector from './VideoSelector';
import OverlayEditor from './OverlayEditor';

export default function HookItem({ hook, index, canRemove, onRemove, onUpdate, onUpdateParams, onApplyParamsToAll }) {
  const handleSelectVideo = async () => {
    const filePath = await window.electronAPI.selectFile({
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'] }],
    });
    if (filePath) onUpdate({ videoPath: filePath });
  };

  return (
    <div className="hook-item">
      <div className="hook-item-header">
        <span className="hook-item-label">Hook {index + 1}</span>
        {canRemove && (
          <button className="btn-remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <VideoSelector
        filePath={hook.videoPath}
        onSelect={handleSelectVideo}
        placeholder="Select hook video…"
      />

      <div className="text-input-group">
        <label className="text-input-label">Text Overlay (Shift+Enter for new line)</label>
        <textarea
          className="text-input text-input-area"
          placeholder="Enter text to display on this video…"
          value={hook.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={3}
          maxLength={500}
          onKeyDown={(e) => {
            // Plain Enter does nothing special in textarea; Shift+Enter is native newline
            // Block accidental form submit if ever wrapped in form
            if (e.key === 'Enter' && !e.shiftKey) e.stopPropagation();
          }}
        />
      </div>

      {hook.videoPath && hook.text.trim() && (
        <OverlayEditor
          hook={hook}
          onUpdateParams={onUpdateParams}
          onApplyParamsToAll={onApplyParamsToAll}
        />
      )}
    </div>
  );
}
