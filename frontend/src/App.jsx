import React, { useState, useEffect } from 'react';
import { IntegrationAppProvider, useIntegrationApp } from '@integration-app/react';
import axios from 'axios';
import './App.css';

function App() {
  const customerId = '1234567';
  const customerName = 'Demo User';

  // Token fetching function
  const fetchToken = async () => {
    const response = await axios.post('http://localhost:5000/api/generate-token', {
      customerId,
      customerName,
    });
    return response.data.token;
  };

  return (
    <IntegrationAppProvider fetchToken={fetchToken}>
      <FileSyncApp customerId={customerId} />
    </IntegrationAppProvider>
  );
}

function FileSyncApp({ customerId }) {
  const integrationApp = useIntegrationApp();
  const [integrations, setIntegrations] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [syncFolders, setSyncFolders] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [integrationFiles, setIntegrationFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState(() => {
    const saved = localStorage.getItem('downloadHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch available integrations
  useEffect(() => {
    let interval;

    const fetchIntegrations = async () => {
      try {
        const { items: integrations } =
          await integrationApp.integrations.find();
        console.log("Fetched Integrations Payload", integrations); // Log payload for debugging
        setIntegrations(integrations);
      } catch (error) {
        console.error("Error fetching integrations:", error);
      }
    };

    fetchIntegrations();

    interval = setInterval(fetchIntegrations, 5000);

    // Clean up interval
    return () => clearInterval(interval);
  }, [integrationApp]);

   // Browse files for the selected integration
   const browseFiles = async () => {
    if (!selectedIntegration) {
      alert('Please select an integration first!');
      return;
    }

    try {
      const { output } = await integrationApp
        .connection(selectedIntegration.key)
        .action('get-drive-items')
        .run();

      setIntegrationFiles(output.records);
      console.log(`Files fetched from ${selectedIntegration.name}:`, output.records);
    } catch (error) {
      console.error(`Error browsing files for ${selectedIntegration.name}:`, error);
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

  // Handle folder sync
  const syncFolder = async (folder, integrationKey) => {
    try {
      setSyncFolders((prev) => [...prev, { folder, integrationKey }]);
      await integrationApp
        .connection(integrationKey)
        .flow('sync-files-and-folders', { instanceKey: folder.id }) // Replace with actual flow
        .patch({ parameters: { folderId: folder.id } });

      console.log('Sync started for folder:', folder);
    } catch (error) {
      console.error('Error syncing folder:', error);
    }
  };

  const saveToDownloadHistory = (downloadInfo) => {
    const newHistory = [...downloadHistory, downloadInfo];
    setDownloadHistory(newHistory);
    localStorage.setItem('downloadHistory', JSON.stringify(newHistory));
  };

  // Add this function before downloadFiles
  const saveToPublicFolder = async (downloadUri, fileName, sessionId) => {
    try {
      console.log('Attempting to save file:', {
        fileName,
        sessionId,
        downloadUri: downloadUri.substring(0, 50) + '...'
      });

      // Send the download URI to the backend to handle the download
      const saveResponse = await axios.post('http://localhost:5000/api/save-file', {
        downloadUri,
        fileName,
        sessionId
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

  // Update the downloadFiles function
  const downloadFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files to download');
      return;
    }

    setIsDownloading(true);
    try {
      const timestamp = new Date().toISOString();
      const sessionId = timestamp.replace(/[:.]/g, '-');

      for (const file of selectedFiles) {
        try {
          console.log(`Downloading file: ${file.name} with ID: ${file.id}`);
          
          const response = await integrationApp
            .connection(file.integrationKey)
            .action('download-file-by-id')
            .run({
              fileId: file.id
            });

          const downloadUri = response.output.downloadUri;
          
          try {
            // Save to public folder only
            const fullFileName = `${file.name}${file.fileExtension ? `.${file.fileExtension}` : ''}`;
            const saveResult = await saveToPublicFolder(downloadUri, fullFileName, sessionId);

            if (saveResult.success) {
              // Save download metadata
              const downloadInfo = {
                sessionId,
                originalUri: downloadUri,
                fileName: fullFileName,
                downloadDate: timestamp,
                fileId: file.id,
                integrationKey: file.integrationKey,
                integrationName: selectedIntegration.name,
                savedToPublic: saveResult,
                serverPath: saveResult.publicUrl // Store the server path for reference
              };

              // Save to download history
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

      setSelectedFiles([]);
      alert('Files have been saved to the server successfully!');
      
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

  return (
    <div className="file-sync-container">
      <h1>File Sync App</h1>
      <div>
        <h2>Available Integrations</h2>
        <div className="integrations-grid">
          {integrations.map((integration) => (
            <div key={integration.id} className="integration-item">
              <button
                onClick={() => {
                  try {
                    integrationApp.integration(integration.key).open();
                  } catch (error) {
                    console.error(`Failed to open integration modal for ${integration.key}`, error);
                    alert("Unable to open the integration modal. Please try again.");
                  }
                }}
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
      </div>

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

      <button onClick={browseFiles} className="browse-button">
        Browse Files
      </button>

      {integrationFiles.length > 0 && (
        <div className="files-container">
          <div className="files-header">
            <h3>Files from {selectedIntegration?.name}</h3>
            <div className="search-container">
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="files-section">
            <div className="files-list">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`file-item ${
                    selectedFiles.some(f => f.id === file.id) ? 'selected' : ''
                  }`}
                  onClick={() => selectFileOrFolder(file)}
                >
                  <div className="file-details">
                    <div className="file-name">
                      {file.name}{file.fileExtension ? `.${file.fileExtension}` : ''}
                    </div>
                    {file.type && (
                      <div className="file-type">
                        Type: {file.type}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
        </div>
      )}

      <h2>Sync Folders</h2>
      <ul>
        {syncFolders.map(({ folder }) => (
          <li key={folder.id}>{folder.name}</li>
        ))}
      </ul>

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
  );
}

export default App;
