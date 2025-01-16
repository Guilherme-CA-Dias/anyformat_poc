import { useState, useEffect } from 'react';
import axios from 'axios';

export const useFileManagement = (customerName: string) => {
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [customerFiles, setCustomerFiles] = useState<any[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState(false);

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

  const selectFileOrFolder = (file: any, selectedIntegration: any) => {
    setSelectedFiles((prev) => {
      if (prev.some(f => f.id === file.id)) {
        return prev.filter(f => f.id !== file.id);
      }
      return [...prev, { ...file, integrationKey: selectedIntegration.key }];
    });
  };

  const downloadFiles = async (selectedIntegration: any, integrationApp: any) => {
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

  return {
    selectedFiles,
    customerFiles,
    downloadProgress,
    isDownloading,
    selectFileOrFolder,
    downloadFiles,
    fetchCustomerFiles
  };
}; 