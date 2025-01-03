# File Sync App

A file synchronization application built with integration.app that allows users to sync and manage files from multiple cloud storage providers including Google Drive, OneDrive, and SharePoint.

## Prerequisites

- Node.js >= 18.0.0
- npm (comes with Node.js)
- An integration.app workspace and credentials

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/IntegrationApp
   cd IntegrationApp/POCs/anyformat
   ```

2. Install dependencies for all parts of the application:
   ```bash
   npm run install-all
   ```

3. Configure environment variables:
   ```bash
   # In the backend directory
   cp .env-example .env
   ```
   Edit the `.env` file with your integration.app credentials:
   ```env
   WORKSPACE_KEY=your_workspace_key
   WORKSPACE_SECRET=your_workspace_secret
   ```

## Running the Application

Start both frontend and backend:
```bash
npm start
```

Or run them separately:
```bash
npm run start-backend    # Start the backend server
npm run start-frontend   # Start the frontend development server
```

Access the application at:
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend:  [http://localhost:5000](http://localhost:5000)

## Project Structure

```plaintext
anyformat/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── App.jsx       # Main application component
│   │   └── App.css       # Styles
│   └── package.json
├── backend/              # Express backend server
│   ├── server.js         # Main server file
│   ├── downloads/        # Downloaded files storage
│   └── package.json
└── package.json          # Root package.json for project-wide scripts
```

## Features

- Multi-provider file sync support (Google Drive, OneDrive, SharePoint)
- Real-time file updates via webhooks
- File version tracking
- Download history
- File browser with search functionality
- Secure file storage with version control

## Development Stack

- **Frontend:** React with Vite
- **Backend:** Express.js
- **File Storage:** Local filesystem with mapping
- **Authentication:** JWT with integration.app

## Webhook Setup

To receive file updates, configure your integration.app webhook endpoint to:
```
https://your-domain/api/webhook/file-updates
```

## Troubleshooting

1. **Node Version Error**
   
   To check your Node.js version:
   ```bash
   node --version
   ```
   (Should be 18.0.0 or higher)

2. **Installation Issues**
   
   If you encounter problems:
   ```bash
   npm cache clean --force
   npm run install-all
   ```

3. **Backend Connection Error**
   - Ensure the `.env` file is properly configured
   - Check if port 5000 is available
   - Verify integration.app credentials
