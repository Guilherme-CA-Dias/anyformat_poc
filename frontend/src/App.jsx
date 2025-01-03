import React, { useState, useEffect } from 'react';
import { IntegrationAppProvider, useIntegrationApp } from '@integration-app/react';
import axios from 'axios';
import './App.css';

function App() {
  const customerId = '1234567';
  const customerName = 'Demo User';

  // Token fetching function for integration.app authentication
  const fetchToken = async () => {
    try {
      // Get JWT token from our backend for integration.app authentication
      const response = await axios.post('http://localhost:5000/api/generate-token', {
        customerId,
        customerName,
      });
      return response.data.token;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
  };

  return (
    <IntegrationAppProvider fetchToken={fetchToken}>
      <FileSyncApp customerId={customerId} customerName={customerName} />
    </IntegrationAppProvider>
  );
}

function FileSyncApp({ customerId, customerName }) {
  const integrationApp = useIntegrationApp();
  const [integrations, setIntegrations] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [integrationFiles, setIntegrationFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState(() => {
    const saved = localStorage.getItem('downloadHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [customerFiles, setCustomerFiles] = useState([]);
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'Root' }]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderStack, setFolderStack] = useState([{ id: 'root', name: 'My Drive' }]);
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Fetch and monitor available integrations from integration.app
  useEffect(() => {
    let interval;

    const fetchIntegrations = async () => {
      try {
        const { items: integrations } = await integrationApp.integrations.find();
        setIntegrations(prev => {
          // Only update if there are actual changes to prevent unnecessary re-renders
          if (JSON.stringify(prev) !== JSON.stringify(integrations)) {
            return integrations;
          }
          return prev;
        });
      } catch (error) {
        console.error("Error fetching integrations:", error);
      }
    };

    fetchIntegrations();
    interval = setInterval(fetchIntegrations, 5000);
    return () => clearInterval(interval);
  }, [integrationApp]);

  // Add scroll position preservation
  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // After any state update that might cause a re-render
  useEffect(() => {
    window.scrollTo(0, scrollPosition);
  }, [integrations]); // Add other dependencies if needed

  // Function to browse files from selected integration
  const browseFiles = async (folderId = 'root', cursor = null) => {
    if (!selectedIntegration) {
      alert('Please select an integration first!');
      return;
    }

    const isInitialLoad = !cursor;
    if (isInitialLoad) {
      setIsBrowsing(true);
      setIsFolderLoading(true);
      setIntegrationFiles([]); // Clear existing files on new folder
    } else {
      setIsLoadingBackground(true);
    }

    try {
      const cleanFolderId = typeof folderId === 'string' ? folderId : 'root';

      // Create action parameters object
      const actionParams = {
        includeFields: true,
        pageSize: 100,
        cursor: cursor
      };

      // Only add folderId if it's not 'root'
      if (cleanFolderId !== 'root') {
        actionParams.folderId = cleanFolderId;
      }

      const { output } = await integrationApp
        .connection(selectedIntegration.key)
        .action('get-drive-items')
        .run(actionParams);

      // Update files list
      setIntegrationFiles(prev => 
        cursor ? [...prev, ...output.records] : output.records
      );

      // If there are more files, automatically fetch them
      if (output.cursor) {
        setTimeout(() => {
          browseFiles(cleanFolderId, output.cursor);
        }, 100);
      }

      if (isInitialLoad) {
        setCurrentFolderId(cleanFolderId);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error(`Error browsing files for ${selectedIntegration.name}:`, {
        message: error.message,
        name: error.name
      });
      if (!cursor) {
        alert('Failed to load files. Please try again.');
      }
    } finally {
      if (isInitialLoad) {
        setIsBrowsing(false);
        setIsFolderLoading(false);
      } else {
        setIsLoadingBackground(false);
      }
    }
  };

  // Handle file/folder selection
  const selectFileOrFolder = (file) => {
    setSelectedFiles((prev) => {
      // If file is already selected, remove it
      if (prev.some(f => f.id === file.id)) {
        return prev.filter(f => f.id !== file.id);
      }
      // If file is not selected, add it
      return [...prev, { ...file, integrationKey: selectedIntegration.key }];
    });
  };

  const saveToDownloadHistory = (downloadInfo) => {
    const newHistory = [...downloadHistory, downloadInfo];
    setDownloadHistory(newHistory);
    localStorage.setItem('downloadHistory', JSON.stringify(newHistory));
  };

  // Add this function before downloadFiles
  const saveToPublicFolder = async (downloadUri, fileName, sessionId, driveFileId) => {
    try {
      console.log('Attempting to save file:', {
        fileName,
        sessionId,
        driveFileId,
        downloadUri: downloadUri.substring(0, 50) + '...'
      });

      const saveResponse = await axios.post('http://localhost:5000/api/save-file', {
        downloadUri,
        fileName,
        sessionId,
        driveFileId
      });

      console.log('Save response:', saveResponse.data);
      return {
        success: true,
        publicUrl: saveResponse.data.fileUrl
      };
    } catch (error) {
      console.error('Error saving file to public folder:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
      }
      return {
        success: false,
        error: error.message
      };
    }
  };

  // Add useEffect to fetch customer files on mount and after downloads
  useEffect(() => {
    fetchCustomerFiles();
  }, [customerName]); // Re-fetch when customer changes

  // Add function to fetch customer files
  const fetchCustomerFiles = async () => {
    try {
      const sanitizedName = customerName.replace(/[^a-zA-Z0-9-]/g, '-');
      const response = await axios.get(`http://localhost:5000/api/customer-files/${sanitizedName}`);
      setCustomerFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching customer files:', error);
    }
  };

  // Function to handle downloading selected files
  const downloadFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files to download');
      return;
    }

    setIsDownloading(true);
    try {
      // Get all file IDs from selected files
      const fileIds = selectedFiles.map(file => file.id);

      // Start the download flow
      await integrationApp
        .connection(selectedIntegration.key)
        .flow('download-files')
        .run({
          input: {
            fileIds
          }
        });

      // Show success message
      alert('Your files will be downloaded shortly. You can continue using the app.');
      
      // Clear selected files
      setSelectedFiles([]);
      
      // Add a small delay before fetching files to allow for download completion
      setTimeout(() => {
        fetchCustomerFiles();
      }, 2000);
      
    } catch (error) {
      console.error('Error starting download flow:', error);
      alert('Failed to start download process. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredFiles = React.useMemo(() => {
    return integrationFiles.filter(file => {
      if (!searchQuery) {
        return file.fields?.folderId === currentFolderId || 
          (currentFolderId === 'root' && !file.fields?.folderId);
      }
      
      const query = searchQuery.toLowerCase();
      return (
        file.name.toLowerCase().includes(query) ||
        file.fields?.mimeType?.toLowerCase().includes(query) ||
        file.fileExtension?.toLowerCase().includes(query)
      );
    });
  }, [integrationFiles, searchQuery, currentFolderId]);

  // Add new function to handle file deletion
  const deleteCustomerFile = async (file) => {
    if (window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
      try {
        const response = await axios.delete(`http://localhost:5000/api/customer-files/${customerName}/${encodeURIComponent(file.name)}`);
        if (response.data.success) {
          // Refresh the files list
          fetchCustomerFiles();
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file. Please try again.');
      }
    }
  };

  // Handle opening integration configuration modal
  const openIntegrationModal = (integration) => {
    try {
      // Open integration.app's configuration modal for connecting/managing integration
      integrationApp.integration(integration.key).open();
    } catch (error) {
      console.error(`Failed to open integration modal for ${integration.key}`, error);
      alert("Unable to open the integration modal. Please try again.");
    }
  };

  const navigateToFolder = (folderId) => {
    // Implement folder navigation logic here
  };

  // Add formatFileSize utility function
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Move FileSelectionModal inside FileSyncApp
  const FileSelectionModal = ({ isOpen, onClose, files, selectedFiles, onFileSelect, searchQuery, onSearchChange }) => {
    if (!isOpen) return null;

    const handleItemClick = (item) => {
      if (item.fields?.itemType === 'folder') {
        // If it's a folder, update the folder stack and browse its contents
        setFolderStack(prev => [...prev, { id: item.id, name: item.name }]);
        // Pass only the folder ID
        browseFiles(item.id);
      } else {
        // If it's a file, handle selection
        onFileSelect(item);
      }
    };

    const handleBackClick = () => {
      if (folderStack.length > 1) {
        // Remove current folder from stack
        const newStack = folderStack.slice(0, -1);
        setFolderStack(newStack);
        // Navigate to parent folder - pass only the ID
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
            {/* Folder navigation breadcrumbs */}
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

            {/* Back button */}
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

  return (
    <div className="file-sync-container">
      <h1>File Sync App</h1>
      <div className="integrations-section">
        <h2>Available Integrations</h2>
        {integrations.length === 0 ? (
          <div className="no-integrations">No integrations available</div>
        ) : (
          <div className="integrations-grid">
            {integrations.map((integration) => (
              <div key={integration.id} className="integration-item">
                <button
                  onClick={() => openIntegrationModal(integration)}
                  className="integration-button"
                  aria-label={`Open integration modal for ${integration.name}`}
                >
                  <img
                    src={integration.logoUri}
                    alt={integration.name || "Integration Logo"}
                    className="integration-logo"
                  />
                </button>

                {integration.connection?.disconnected === false && (
                  <div className="connection-status">
                    Connected
                  </div>
                )}

                <div className="integration-name">
                  {integration.name || "Unknown Integration"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="app-divider"></div>

      <div className="main-content">
        <div className="drive-section">
          <div className="drive-selection">
            <h2>Select a Drive</h2>
            <div className="integration-selection">
              {integrations.map((integration) => (
                <button
                  key={integration.key}
                  onClick={() => setSelectedIntegration(integration)}
                  className={`integration-select-button ${
                    selectedIntegration?.key === integration.key ? 'selected' : 'unselected'
                  }`}
                >
                  {integration.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={browseFiles} 
          className={`browse-button ${isBrowsing ? 'loading' : ''}`}
          disabled={isBrowsing}
        >
          {isBrowsing ? 'Loading Files...' : 'Browse Files'}
        </button>

        {selectedFiles.length > 0 && (
          <div className="selected-files-panel">
            <div className="selected-files-content">
              <h3>Selected Files ({selectedFiles.length})</h3>
              <div className="selected-files-list">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="selected-file-item">
                    <div className="file-info">
                      {file.name}
                      {downloadProgress[file.id] !== undefined && (
                        <div className="progress-bar">
                          <div 
                            className="progress" 
                            style={{width: `${downloadProgress[file.id]}%`}}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="action-panel">
              <button 
                onClick={downloadFiles} 
                className={`download-button ${isDownloading ? 'downloading' : ''}`}
                disabled={isDownloading || selectedFiles.length === 0}
              >
                {isDownloading ? 'Starting Download...' : 'Download Selected Files'}
              </button>
            </div>
          </div>
        )}

        <FileSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          files={filteredFiles}
          selectedFiles={selectedFiles}
          onFileSelect={selectFileOrFolder}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          folderPath={folderPath}
          navigateToFolder={navigateToFolder}
        />

        {/* Sync Folders feature - to be implemented
        <h2>Sync Folders</h2>
        <ul>
          {syncFolders.map(({ folder }) => (
            <li key={folder.id}>{folder.name}</li>
          ))}
        </ul>
        */}

        {customerFiles.length > 0 && (
          <div className="customer-files">
            <h2>Files for {customerName}</h2>
            <div className="files-grid">
              {customerFiles.map((file) => (
                <div key={file.path} className="customer-file-item">
                  <div className="file-icon">📄</div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      Downloaded: {new Date(file.downloadDate).toLocaleString()}
                    </div>
                    <div className="file-path">
                      Location: {file.path}
                    </div>
                  </div>
                  <button 
                    className="delete-file-button"
                    onClick={() => deleteCustomerFile(file)}
                    title="Delete file"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {downloadHistory.length > 0 && (
          <div className="download-history">
            <h2>Download History</h2>
            <div className="history-list">
              {downloadHistory.map((download, index) => (
                <div key={index} className="history-item">
                  <div className="history-details">
                    <strong>{download.fileName}</strong>
                    <div className="history-meta">
                      From: {download.integrationName} • 
                      Downloaded: {new Date(download.downloadDate).toLocaleString()}
                    </div>
                    {download.serverPath && (
                      <div className="server-path">
                        Server location: {download.serverPath}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
