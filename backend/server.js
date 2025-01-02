import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs/promises';
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
    const data = await fs.readFile(FILE_MAPPINGS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const initialMappings = [];
      await fs.writeFile(FILE_MAPPINGS_PATH, JSON.stringify(initialMappings, null, 2));
      return initialMappings;
    }
    throw error;
  }
};

const saveFileMappings = async (mappings) => {
  await fs.writeFile(FILE_MAPPINGS_PATH, JSON.stringify(mappings, null, 2));
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

app.post('/api/save-file', async (req, res) => {
  try {
    const { downloadUri, fileName, sessionId, driveFileId } = req.body;
    const sanitizedFileName = fileName
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\//g, '-')
      .replace(/\s+/g, '_')
      .trim();

    // Store file mapping if driveFileId exists
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

      const index = mappings.findIndex(f => f.driveFileId === driveFileId);
      if (index !== -1) {
        mappings.splice(index, 1);
      }
      mappings.push(fileEntry);
      await saveFileMappings(mappings);
    }

    // Save the actual file
    const downloadPath = path.join(__dirname, 'downloads', sessionId);
    await fs.mkdir(downloadPath, { recursive: true });
    
    const response = await axios({
      method: 'get',
      url: downloadUri,
      responseType: 'stream'
    });

    const filePath = path.join(downloadPath, sanitizedFileName);
    const writer = createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const publicPath = `/downloads/${sessionId}/${sanitizedFileName}`;
    const fullUrl = `http://localhost:${PORT}${publicPath}`;

    res.json({
      success: true,
      filePath: publicPath,
      fileUrl: fullUrl,
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
    const { customerName } = req.params;
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9-]/g, '-');
    const customerPath = path.join(__dirname, 'downloads', sanitizedCustomerName);
    
    try {
      const files = await readdir(customerPath);
      const fileDetails = await Promise.all(
        files.map(async (fileName) => {
          const filePath = path.join(customerPath, fileName);
          const stats = await stat(filePath);
          return {
            name: fileName,
            path: `/downloads/${sanitizedCustomerName}/${fileName}`,
            downloadDate: stats.birthtime,
            size: stats.size
          };
        })
      );
      
      fileDetails.sort((a, b) => b.downloadDate - a.downloadDate);
      res.json({ files: fileDetails });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({ files: [] });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error getting customer files:', error);
    res.status(500).json({ error: 'Failed to get customer files' });
  }
});

app.post('/api/webhook/file-updates', async (req, res) => {
  try {
    const { 
      customerName,
      fileId,
      driveFileId,
      fileName,
      downloadUri,
      version,
      action
    } = req.body;

    console.log('Received webhook payload:', {
      customerName,
      fileId,
      driveFileId,
      fileName,
      version,
      action
    });

    const mappings = await loadFileMappings();
    const actualFileId = driveFileId || fileId;
    const fileIndex = mappings.findIndex(f => f.driveFileId === actualFileId);

    // If file doesn't exist in our mappings, ignore the webhook
    if (fileIndex === -1) {
      console.log('File not found in mappings, ignoring webhook');
      return res.json({ success: true, message: 'File not tracked, ignoring update' });
    }

    const existingFile = mappings[fileIndex];

    if (action === 'delete') {
      console.log(`Marking file as deleted: ${fileName}`);
      mappings[fileIndex].deleted = true;
      mappings[fileIndex].deletedAt = new Date().toISOString();
      await saveFileMappings(mappings);
      return res.json({ success: true, message: 'File marked as deleted' });
    }

    // Handle file update
    console.log(`Updating file: ${fileName} to version ${version}`);
    
    existingFile.versions.push({
      version,
      timestamp: new Date().toISOString(),
      downloadUri
    });
    existingFile.currentVersion = version;

    // Update the file content
    const customerPath = path.join(__dirname, 'downloads', customerName.replace(/[^a-zA-Z0-9-]/g, '-'));
    const sanitizedFileName = existingFile.sanitizedName;
    const filePath = path.join(customerPath, sanitizedFileName);

    console.log('Downloading updated file content');
    const response = await axios({
      method: 'get',
      url: downloadUri,
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
    const { customerName, fileName } = req.params;
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9-]/g, '-');
    const filePath = path.join(__dirname, 'downloads', sanitizedCustomerName, fileName);

    // Delete the file
    await fs.unlink(filePath);

    // Update mappings if file is tracked
    const mappings = await loadFileMappings();
    const fileIndex = mappings.findIndex(f => f.sanitizedName === fileName);
    if (fileIndex !== -1) {
      mappings.splice(fileIndex, 1);
      await saveFileMappings(mappings);
    }

    console.log(`File deleted successfully: ${fileName}`);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
