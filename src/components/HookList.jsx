import React from 'react';
import HookItem from './HookItem';

export default function HookList({ hooks, onAddMultiple, onImportTexts, onRemove, onUpdate, onUpdateParams, onApplyParamsToAll }) {
  const handleAdd = async () => {
    const filePaths = await window.electronAPI.selectFiles({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    });
    if (filePaths && filePaths.length > 0) {
      onAddMultiple(filePaths);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Hook Videos</h2>
        <div className="section-header-actions">
          <button
            className="btn-secondary btn-import"
            onClick={onImportTexts}
            title="Import hook texts from a .json export file"
          >
            📥 Import Texts
          </button>
          <button className="btn-add" onClick={handleAdd}>
            + Add Hooks
          </button>
        </div>
      </div>

      <div className="hook-list">
        {hooks.map((hook, index) => (
          <HookItem
            key={hook.id}
            hook={hook}
            index={index}
            canRemove={true}
            onRemove={() => onRemove(hook.id)}
            onUpdate={(changes) => onUpdate(hook.id, changes)}
            onUpdateParams={(changes) => onUpdateParams(hook.id, changes)}
            onApplyParamsToAll={onApplyParamsToAll}
          />
        ))}
      </div>
    </div>
  );
}
