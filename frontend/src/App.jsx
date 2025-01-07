import React, { useState, useEffect } from 'react';
import { IntegrationAppProvider, useIntegrationApp } from '@integration-app/react';
import axios from 'axios';
import './App.css';
import FileSelectionModal from './components/FileSelectionModal';
import IntegrationsSection from './components/IntegrationsSection';
import { useFileManagement } from './hooks/useFileManagement';
import { formatFileSize } from './utils/fileUtils';

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
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [integrationFiles, setIntegrationFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadHistory, setDownloadHistory] = useState(() => {
    const saved = localStorage.getItem('downloadHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'Root' }]);
  const [fileErrors, setFileErrors] = useState({});
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderStack, setFolderStack] = useState([{ id: 'root', name: 'My Drive' }]);
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  const {
    selectedFiles,
    customerFiles,
    downloadProgress,
    isDownloading,
    selectFileOrFolder: baseSelectFileOrFolder,
    downloadFiles: baseDownloadFiles,
    deleteCustomerFile,
    fetchCustomerFiles
  } = useFileManagement(customerName);

  // Wrapper function to provide selectedIntegration
  const handleFileSelect = (file) => {
    baseSelectFileOrFolder(file, selectedIntegration);
  };

  // Wrapper function to provide integrationApp
  const handleDownload = () => {
    baseDownloadFiles(selectedIntegration, integrationApp);
  };

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

  return (
    <div className="file-sync-container">
      <h1>File Sync App</h1>
      <IntegrationsSection 
        integrations={integrations}
        openIntegrationModal={openIntegrationModal}
      />
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
                onClick={handleDownload}
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
          onFileSelect={handleFileSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          folderStack={folderStack}
          setFolderStack={setFolderStack}
          browseFiles={browseFiles}
          isFolderLoading={isFolderLoading}
          isLoadingBackground={isLoadingBackground}
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
