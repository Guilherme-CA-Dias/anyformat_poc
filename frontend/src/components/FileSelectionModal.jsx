import React from 'react';
import { formatFileSize } from '../utils/fileUtils';

const FileSelectionModal = ({ 
  isOpen, 
  onClose, 
  files, 
  selectedFiles, 
  onFileSelect, 
  searchQuery, 
  onSearchChange,
  folderStack,
  setFolderStack,
  browseFiles,
  isFolderLoading,
  isLoadingBackground
}) => {
  if (!isOpen) return null;

  const handleItemClick = (item) => {
    if (item.fields?.itemType === 'folder') {
      setFolderStack(prev => [...prev, { id: item.id, name: item.name }]);
      browseFiles(item.id);
    } else {
      onFileSelect(item);
    }
  };

  const handleBackClick = () => {
    if (folderStack.length > 1) {
      const newStack = folderStack.slice(0, -1);
      setFolderStack(newStack);
      const parentFolder = newStack[newStack.length - 1];
      browseFiles(parentFolder.id);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Select Files</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-search">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
            autoFocus
          />
        </div>

        <div className="modal-body">
          <div className="folder-breadcrumbs">
            {folderStack.map((folder, index) => (
              <React.Fragment key={folder.id}>
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <span 
                  className="breadcrumb-item"
                  onClick={() => {
                    const newStack = folderStack.slice(0, index + 1);
                    setFolderStack(newStack);
                    browseFiles(folder.id);
                  }}
                >
                  {folder.name}
                </span>
              </React.Fragment>
            ))}
          </div>

          {folderStack.length > 1 && (
            <div className="folder-navigation">
              <button onClick={handleBackClick} className="back-button">
                ← Back to {folderStack[folderStack.length - 2].name}
              </button>
            </div>
          )}

          <div className="files-list">
            {isFolderLoading ? (
              <div className="loading-indicator">Loading folder contents...</div>
            ) : files.length === 0 ? (
              <div className="empty-folder">This folder is empty</div>
            ) : (
              <>
                {files.map((item) => (
                  <div
                    key={item.id}
                    className={`file-item ${
                      selectedFiles.some(f => f.id === item.id) ? 'selected' : ''
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="file-icon">
                      {item.fields?.itemType === 'folder' ? '📁' : '📄'}
                    </div>
                    <div className="file-details">
                      <div className="file-name" title={`${item.name}${item.fileExtension ? `.${item.fileExtension}` : ''}`}>
                        {item.name}{item.fileExtension ? `.${item.fileExtension}` : ''}
                      </div>
                      <div className="file-meta">
                        {item.fields?.itemType === 'folder' ? (
                          'Folder'
                        ) : (
                          <>
                            {formatFileSize(item.fields?.size)} • 
                            {item.fields?.mimeType || 'Unknown type'}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoadingBackground && (
                  <div className="background-loading">
                    Loading more files...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default FileSelectionModal; 