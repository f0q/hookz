import React, { useState } from 'react';

export default function ProgressOverlay({ progress, onStop }) {
  const pct = Math.round(Math.min(progress.overall || 0, 100));
  const [stopping, setStopping] = useState(false);

  const handleStop = () => {
    setStopping(true);
    onStop();
  };

  return (
    <div className="progress-overlay">
      <div className="progress-card">
        <h2 className="progress-title">Processing Videos…</h2>
        <p className="progress-message">{progress.message}</p>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="progress-pct">{pct}%</div>

        {progress.taskTotal > 1 && (
          <div className="progress-tasks">
            Video {Math.min(progress.taskIndex + 1, progress.taskTotal)} of{' '}
            {progress.taskTotal}
          </div>
        )}

        <button
          className="btn-stop"
          onClick={handleStop}
          disabled={stopping}
        >
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>
  );
}
