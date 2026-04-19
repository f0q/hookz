import React from 'react';

export default function VideoSelector({ filePath, onSelect, placeholder, isDirectory }) {
  const displayName = filePath
    ? isDirectory
      ? filePath
      : filePath.split('/').pop()
    : null;

  return (
    <div className="video-selector" onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}>
      <div className="video-selector-content">
        {displayName ? (
          <>
            <span className="video-selector-name">{displayName}</span>
            {!isDirectory && (
              <span className="video-selector-path">{filePath}</span>
            )}
          </>
        ) : (
          <span className="video-selector-placeholder">{placeholder}</span>
        )}
      </div>
      <span className="video-selector-action">{filePath ? 'Change' : 'Browse'}</span>
    </div>
  );
}
