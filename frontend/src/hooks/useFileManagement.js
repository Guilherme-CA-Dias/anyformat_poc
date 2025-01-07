import { useState, useEffect } from 'react';
import axios from 'axios';

export const useFileManagement = (customerName) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [customerFiles, setCustomerFiles] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch customer files on mount and when customer changes
  useEffect(() => {
    fetchCustomerFiles();
  }, [customerName]);

  const fetchCustomerFiles = async () => {
    try {
      const sanitizedName = customerName.replace(/[^a-zA-Z0-9-]/g, '-');
      const response = await axios.get(`http://localhost:5000/api/customer-files/${sanitizedName}`);
      setCustomerFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching customer files:', error);
    }
  };

  const selectFileOrFolder = (file, selectedIntegration) => {
    setSelectedFiles((prev) => {
      // If file is already selected, remove it
      if (prev.some(f => f.id === file.id)) {
        return prev.filter(f => f.id !== file.id);
      }
      // If file is not selected, add it
      return [...prev, { ...file, integrationKey: selectedIntegration.key }];
    });
  };

  const downloadFiles = async (selectedIntegration, integrationApp) => {
    if (selectedFiles.length === 0) {
      alert('Please select files to download');
      return;
    }

    setIsDownloading(true);
    try {
      const fileIds = selectedFiles.map(file => file.id);

      await integrationApp
        .connection(selectedIntegration.key)
        .flow('download-files')
        .run({
          input: {
            fileIds
          }
        });

      alert('Your files will be downloaded shortly. You can continue using the app.');
      setSelectedFiles([]);
      
      setTimeout(() => {
        fetchCustomerFiles();
      }, 3000);
      
    } catch (error) {
      console.error('Error starting download flow:', error);
      alert('Failed to start download process. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteCustomerFile = async (file) => {
    if (window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
      try {
        const response = await axios.delete(
          `http://localhost:5000/api/customer-files/${customerName}/${encodeURIComponent(file.name)}`
        );
        if (response.data.success) {
          fetchCustomerFiles();
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file. Please try again.');
      }
    }
  };

  return {
    selectedFiles,
    customerFiles,
    downloadProgress,
    isDownloading,
    selectFileOrFolder,
    downloadFiles,
    deleteCustomerFile,
    fetchCustomerFiles
  };
}; 