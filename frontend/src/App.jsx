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

// Move FileSelectionModal outside of FileSyncApp
const FileSelectionModal = ({ isOpen, onClose, files, selectedFiles, onFileSelect, searchQuery, onSearchChange, folderPath, navigateToFolder }) => {
  if (!isOpen) return null;

  const getFileIcon = (file) => {
    return file.fields?.itemType === 'folder' ? '📁' : '📄';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
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
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <span 
                  className="breadcrumb-item"
                  onClick={() => navigateToFolder(folder.id)}
                >
                  {folder.name}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="files-list">
            {files.map((file) => (
              <div
                key={file.id}
                className={`file-item ${
                  selectedFiles.some(f => f.id === file.id) ? 'selected' : ''
                }`}
                onClick={() => onFileSelect(file)}
              >
                <div className="file-icon">
                  {getFileIcon(file)}
                </div>
                <div className="file-details">
                  <div className="file-name">
                    {file.name}{file.fileExtension ? `.${file.fileExtension}` : ''}
                  </div>
                  <div className="file-meta">
                    {file.fields?.itemType === 'folder' ? (
                      'Folder'
                    ) : (
                      <>
                        {formatFileSize(file.fields?.size)} • 
                        {file.fields?.mimeType || 'Unknown type'}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

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
  const [syncStatus, setSyncStatus] = useState({});

  // Fetch and monitor available integrations from integration.app
  useEffect(() => {
    let interval;

    const fetchIntegrations = async () => {
      try {
        const { items: integrations } = await integrationApp.integrations.find();
        setIntegrations(integrations);
      } catch (error) {
        console.error("Error fetching integrations:", error);
      }
    };

    fetchIntegrations();
    interval = setInterval(fetchIntegrations, 5000);
    return () => clearInterval(interval);
  }, [integrationApp]);

  // Function to browse files from selected integration
  const browseFiles = async () => {
    if (!selectedIntegration) {
      alert('Please select an integration first!');
      return;
    }

    setIsBrowsing(true);
    try {
      // Call integration.app to get files from the selected integration (e.g., Google Drive)
      const { output } = await integrationApp
        .connection(selectedIntegration.key)
        .action('get-drive-items') // Action to list files/folders
        .run();

      setIntegrationFiles(output.records);
      setIsModalOpen(true);
      console.log(`Files fetched from ${selectedIntegration.name}:`, output.records);
    } catch (error) {
      console.error(`Error browsing files for ${selectedIntegration.name}:`, error);
      alert('Failed to load files. Please try again.');
    } finally {
      setIsBrowsing(false);
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
      const response = await axios.get(`http://localhost:5000/api/customer-files/${customerName}`);
      setCustomerFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching customer files:', error);
    }
  };

  // Function to handle downloading selected files
  const downloadFiles = async () => {
    // Validate if there are files selected
    if (selectedFiles.length === 0) {
      alert('Please select files to download');
      return;
    }

    // Show downloading state in UI
    setIsDownloading(true);
    try {
      // Create a safe folder name from customer name (remove special characters)
      const sessionId = customerName.replace(/[^a-zA-Z0-9-]/g, '-');

      // Process each selected file
      for (const file of selectedFiles) {
        try {
          console.log(`Downloading file: ${file.name} with ID: ${file.id}`);
          
          // Step 1: Get secure download URL from integration.app
          // This ensures we have proper authorization to access the file
          // file.integrationKey could be 'google-drive', 'dropbox', etc.
          const response = await integrationApp
            .connection(file.integrationKey)
            .action('download-file-by-id')
            .run({
              fileId: file.id
            });

          // Extract the temporary download URL from the response
          const downloadUri = response.output.downloadUri;
          
          try {
            // Step 2: Construct the full filename with extension
            const fullFileName = `${file.name}${file.fileExtension ? `.${file.fileExtension}` : ''}`;

            // Step 3: Send the download URL to our backend to save the file
            // This keeps sensitive URLs secure and handles file storage properly
            const saveResult = await saveToPublicFolder(downloadUri, fullFileName, sessionId, file.id);

            if (saveResult.success) {
              // Step 4: Record the download in history for tracking
              const downloadInfo = {
                sessionId,
                originalUri: downloadUri,
                fileName: fullFileName,
                downloadDate: new Date().toISOString(),
                fileId: file.id,
                integrationKey: file.integrationKey,
                integrationName: selectedIntegration.name,
                savedToPublic: saveResult,
                serverPath: saveResult.publicUrl,
                customerName
              };

              saveToDownloadHistory(downloadInfo);
              console.log(`File saved to server: ${fullFileName}`);
            } else {
              console.error(`Failed to save file ${fullFileName} to server:`, saveResult.error);
            }
          } catch (saveError) {
            console.error(`Error saving file ${file.name}:`, saveError);
          }
        } catch (error) {
          console.error(`Error getting download URL for ${file.name}:`, error);
        }
      }

      // Step 5: Clean up and update UI
      setSelectedFiles([]);
      alert('Files have been saved to the server successfully!');
      fetchCustomerFiles(); // Refresh the files list
      
    } catch (error) {
      console.error('Error in download process:', error);
      alert('Some files failed to save. Check console for details.');
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredFiles = integrationFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Add function to toggle sync
  const toggleSync = async (integration) => {
    try {
      if (syncStatus[integration.key]) {
        // Stop sync
        await integrationApp
          .connection(integration.key)
          .flow('receive-drive-item-events')
          .delete();
        
        setSyncStatus(prev => ({
          ...prev,
          [integration.key]: false
        }));
        console.log(`Sync stopped for ${integration.name}`);
      } else {
        // Start sync
        await integrationApp
          .connection(integration.key)
          .flow('receive-drive-item-events')
          .create();
        
        setSyncStatus(prev => ({
          ...prev,
          [integration.key]: true
        }));
        console.log(`Sync started for ${integration.name}`);
      }
    } catch (error) {
      console.error(`Error toggling sync for ${integration.name}:`, error);
      alert(`Failed to ${syncStatus[integration.key] ? 'stop' : 'start'} sync. Please try again.`);
    }
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
          
          <div className="sync-settings">
            <h2>Sync Settings</h2>
            <div className="sync-options">
              {integrations.map((integration) => (
                integration.connection?.disconnected === false && (
                  <div key={integration.key} className="sync-option">
                    <span className="sync-integration-name">{integration.name}</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={syncStatus[integration.key] || false}
                        onChange={() => toggleSync(integration)}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="sync-status">
                      {syncStatus[integration.key] ? 'Sync On' : 'Sync Off'}
                    </span>
                  </div>
                )
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
                {isDownloading ? 'Downloading...' : 'Download Selected Files'}
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
