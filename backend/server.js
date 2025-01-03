import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import * as fsPromises from 'fs/promises';
import { createWriteStream } from 'fs';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readdir, stat } from 'fs/promises';

dotenv.config({ path: './.env' });

const app = express();
const PORT = 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Environment variables
const WORKSPACE_KEY = process.env.WORKSPACE_KEY;
const WORKSPACE_SECRET = process.env.WORKSPACE_SECRET;

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve downloaded files statically
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// File mapping utilities
const FILE_MAPPINGS_PATH = path.join(__dirname, 'downloads', 'file-mappings.json');

const loadFileMappings = async () => {
  try {
    const data = await fsPromises.readFile(FILE_MAPPINGS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const initialMappings = [];
      await fsPromises.writeFile(FILE_MAPPINGS_PATH, JSON.stringify(initialMappings, null, 2));
      return initialMappings;
    }
    throw error;
  }
};

const saveFileMappings = async (mappings) => {
  await fsPromises.writeFile(FILE_MAPPINGS_PATH, JSON.stringify(mappings, null, 2));
};

// Update the sanitizePath function to be more strict
const sanitizePath = (path) => {
  return path
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')  // Remove all other special characters
    .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens
};

// Endpoints
app.post('/api/generate-token', (req, res) => {
  const { customerId, customerName } = req.body;
  if (!customerId || !customerName) {
    return res.status(400).json({ error: 'Customer ID and name are required.' });
  }

  const tokenData = {
    id: customerId,
    name: customerName,
    fields: { userField: 'example field value' },
  };

  const options = {
    issuer: WORKSPACE_KEY,
    expiresIn: 7200,
    algorithm: 'HS512',
  };

  try {
    const token = jwt.sign(tokenData, WORKSPACE_SECRET, options);
    res.json({ token });
  } catch (error) {
    console.error('JWT Generation Error:', error.message);
    res.status(500).json({ error: 'Failed to generate token.' });
  }
});

/**
 * File Save Endpoint
 * Handles the secure downloading and storage of files from various integrations
 * 
 * Flow:
 * 1. Receives download URL and file info from frontend
 * 2. Downloads file using secure URL
 * 3. Saves file to customer's directory
 * 4. Maintains version history and file mappings
 * 5. Returns public access URL
 */
app.post('/api/save-file', async (req, res) => {
  try {
    const { downloadUri, fileName, sessionId, driveFileId } = req.body;

    // Sanitize the sessionId using the correct pattern
    const sanitizedSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '-');
    
    console.log('Session ID:', { 
      original: sessionId, 
      sanitized: sanitizedSessionId 
    });

    const customerDir = path.join(__dirname, 'downloads', sanitizedSessionId);

    // Create customer directory if it doesn't exist
    if (!fs.existsSync(customerDir)) {
      fs.mkdirSync(customerDir, { recursive: true });
    }

    // Sanitize the filename but preserve extension
    const fileExt = path.extname(fileName);
    const fileNameWithoutExt = path.basename(fileName, fileExt);
    const sanitizedFileName = `${fileNameWithoutExt.replace(/[^a-zA-Z0-9-]/g, '_')}${fileExt}`;
    
    const filePath = path.join(customerDir, sanitizedFileName);
    
    console.log('File paths:', {
      customerDir,
      filePath,
      sanitizedFileName
    });

    // Load and update file mappings for version tracking
    const mappings = await loadFileMappings();
    if (driveFileId) {
      const fileEntry = {
        driveFileId,
        originalName: fileName,
        sanitizedName: sanitizedFileName,
        customerName: sessionId,
        versions: [{
          version: '1.0',
          timestamp: new Date().toISOString(),
          downloadUri
        }],
        currentVersion: '1.0'
      };

      // Update or add new file entry
      const index = mappings.findIndex(f => f.driveFileId === driveFileId);
      if (index !== -1) {
        mappings.splice(index, 1);
      }
      mappings.push(fileEntry);
      await saveFileMappings(mappings);
    }

    // Download file from the secure URL
    const response = await axios({
      method: 'get',
      url: downloadUri,
      responseType: 'stream'
    });

    // Save file to disk using streams
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Generate public access URL using sanitized paths
    const publicPath = `/downloads/${sanitizedSessionId}/${sanitizedFileName}`;
    const fullUrl = `http://localhost:${PORT}${publicPath}`;

    console.log('File saved successfully:', {
      originalName: fileName,
      savedAs: sanitizedFileName,
      filePath,
      publicUrl: fullUrl,
      driveFileId
    });

    // Return response with sanitized paths
    res.json({
      success: true,
      filePath: `/downloads/${sanitizedSessionId}/${sanitizedFileName}`,
      fileUrl: `http://localhost:${PORT}/downloads/${sanitizedSessionId}/${sanitizedFileName}`,
      originalName: fileName,
      savedAs: sanitizedFileName,
      driveFileId
    });

  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ 
      error: 'Failed to save file',
      details: error.message 
    });
  }
});

app.get('/api/customer-files/:customerName', async (req, res) => {
  try {
    const sanitizedCustomerName = req.params.customerName.replace(/[^a-zA-Z0-9-]/g, '-');
    const customerDir = path.join(__dirname, 'downloads', sanitizedCustomerName);
    
    if (!fs.existsSync(customerDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(customerDir)
      .filter(file => fs.statSync(path.join(customerDir, file)).isFile())
      .map(file => {
        const filePath = path.join(customerDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: path.join(sanitizedCustomerName, file),
          size: stats.size,
          downloadDate: stats.mtime
        };
      });

    res.json({ files });
  } catch (error) {
    console.error('Error reading customer files:', error);
    res.status(500).json({ error: 'Failed to read customer files' });
  }
});

app.post('/api/webhook/file-updates', async (req, res) => {
  try {
    const { 
      event,
      source,
      id,
      record,
      iappDownloadId
    } = req.body;

    console.log('Received webhook payload:', {
      event,
      source,
      id,
      fileName: record?.name,
      downloadUrl: iappDownloadId?.downloadUri
    });

    const mappings = await loadFileMappings();
    const fileIndex = mappings.findIndex(f => f.driveFileId === id);

    // If file doesn't exist in our mappings, ignore the webhook
    if (fileIndex === -1) {
      console.log('File not found in mappings:', {
        receivedId: id,
        availableMappings: mappings.map(m => m.driveFileId)
      });
      return res.json({ success: true, message: 'File not tracked, ignoring update' });
    }

    const existingFile = mappings[fileIndex];

    if (event === 'delete') {
      console.log(`Marking file as deleted: ${record?.name}`);
      mappings[fileIndex].deleted = true;
      mappings[fileIndex].deletedAt = new Date().toISOString();
      await saveFileMappings(mappings);
      return res.json({ success: true, message: 'File marked as deleted' });
    }

    // Handle file update
    console.log(`Updating file: ${record?.name} to version ${record?.version}`);
    
    existingFile.versions.push({
      version: record?.version,
      timestamp: new Date().toISOString(),
      downloadUri: record?.downloadUri
    });
    existingFile.currentVersion = record?.version;

    // Update the file content
    const customerPath = path.join(__dirname, 'downloads', existingFile.customerName);
    const sanitizedFileName = existingFile.sanitizedName;
    const filePath = path.join(customerPath, sanitizedFileName);

    console.log('Downloading updated file content');
    const response = await axios({
      method: 'get',
      url: iappDownloadId.downloadUri,
      responseType: 'stream'
    });

    const writer = createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await saveFileMappings(mappings);
    console.log('File update completed successfully');

    res.json({
      success: true,
      message: 'File update processed',
      fileInfo: existingFile
    });

  } catch (error) {
    console.error('Error processing file update:', error);
    res.status(500).json({
      error: 'Failed to process file update',
      details: error.message
    });
  }
});

app.delete('/api/customer-files/:customerName/:fileName', async (req, res) => {
  try {
    const sanitizedCustomerName = sanitizePath(req.params.customerName);
    const sanitizedFileName = req.params.fileName; // fileName is already encoded in URL
    
    const filePath = path.join(__dirname, 'downloads', sanitizedCustomerName, sanitizedFileName);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
