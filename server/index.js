import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, dataDir)
  },
  filename: function (req, file, cb) {
    // Keep original filename, potentially overwrite if exists (desired behavior for "saving")
    cb(null, file.originalname)
  }
});

const upload = multer({ storage: storage });

// Routes

// Upload files
app.post('/api/upload', upload.array('files'), (req, res) => {
  res.json({ message: 'Files uploaded successfully', files: req.files });
});

// List files and their contents
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.csv'));
    const fileData = files.map(filename => {
       const content = fs.readFileSync(path.join(dataDir, filename), 'utf-8');
       // Calculate transaction count (lines - 1 for header)
       const lines = content.trim().split('\n');
       const transactionCount = Math.max(0, lines.length - 1); // Simple estimation

       return {
         name: filename,
         content: content,
         transactionCount: transactionCount,
         size: fs.statSync(path.join(dataDir, filename)).size,
         lastModified: fs.statSync(path.join(dataDir, filename)).mtime
       };
    });
    res.json(fileData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Download a specific file
app.get('/api/files/:filename/download', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(dataDir, filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Delete a specific file
app.delete('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(dataDir, filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});
// Serve static files from the React app (for production/docker)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Handle SPA routing - return index.html for all non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
