import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config({ path: './.env' });

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import axios from 'axios';

console.log('WORKSPACE_KEY:', process.env.WORKSPACE_KEY);
console.log('WORKSPACE_SECRET:', process.env.WORKSPACE_SECRET);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const WORKSPACE_KEY = process.env.WORKSPACE_KEY;
const WORKSPACE_SECRET = process.env.WORKSPACE_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * File Upload Configuration
 * Configure multer for handling file uploads with custom storage settings
 */
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      // Log incoming file details
      console.log('Multer destination function called:', {
        sessionId: req.body.sessionId,
        fileName: file.originalname,
        mimeType: file.mimetype
      });

      // Set up download path for the session
      const downloadPath = path.join(__dirname, 'downloads', req.body.sessionId);
      console.log('Target download path:', downloadPath);
      
      try {
        // Create base downloads directory if it doesn't exist
        const baseDir = path.join(__dirname, 'downloads');
        await fs.mkdir(baseDir, { recursive: true });
        console.log('Base downloads directory created/verified:', baseDir);

        // Create session-specific directory
        await fs.mkdir(downloadPath, { recursive: true });
        console.log('Session directory created:', downloadPath);

        cb(null, downloadPath);
      } catch (error) {
        console.error('Error creating directories:', error);
        cb(error);
      }
    } catch (error) {
      console.error('Error in destination function:', error);
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    console.log('Setting filename:', file.originalname);
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Serve downloaded files statically
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

/**
 * Authentication Endpoint
 * Generates a JWT token for user authentication
 * Required body params: customerId, customerName
 */
app.post('/api/generate-token', (req, res) => {
    const { customerId, customerName } = req.body;
  
    // Validate required fields
    if (!customerId || !customerName) {
      return res.status(400).json({ error: 'Customer ID and name are required.' });
    }
  
    // Prepare token data
    const tokenData = {
      id: customerId,
      name: customerName,
      fields: {
        userField: 'example field value',
      },
    };
  
    // JWT signing options
    const options = {
      issuer: WORKSPACE_KEY,
      expiresIn: 7200, // 2 hours
      algorithm: 'HS512',
    };
  
    // Debug token generation
    console.log('Token Data:', tokenData);
    console.log('Options:', options);

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
 * Downloads a file from a provided URI and saves it to the server
 * Required body params: downloadUri, fileName, sessionId
 */
app.post('/api/save-file', async (req, res) => {
  try {
    const { downloadUri, fileName, sessionId } = req.body;

    // Log incoming request details
    console.log('Received file save request:', {
      fileName,
      sessionId,
      downloadUri: downloadUri.substring(0, 50) + '...' // Truncate URI for logging
    });

    // Create session directory for files
    const downloadPath = path.join(__dirname, 'downloads', sessionId);
    await fs.mkdir(downloadPath, { recursive: true });
    
    // Download file from provided URI
    const response = await axios({
      method: 'get',
      url: downloadUri,
      responseType: 'stream'
    });

    // Set up file writing
    const filePath = path.join(downloadPath, fileName);
    const writer = createWriteStream(filePath);

    // Stream file data to disk
    response.data.pipe(writer);

    // Wait for file writing to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Generate public access URL
    const publicPath = `/downloads/${sessionId}/${fileName}`;
    const fullUrl = `http://localhost:${PORT}${publicPath}`;

    // Log success and file details
    console.log('File saved successfully:', {
      filePath,
      publicUrl: fullUrl
    });

    // Send success response
    res.json({
      success: true,
      filePath: publicPath,
      fileUrl: fullUrl
    });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ 
      error: 'Failed to save file',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
