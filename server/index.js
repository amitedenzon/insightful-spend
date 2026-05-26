import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { scrapeAll, readAllScraped, readScrapedMeta } from './scrapers/index.js';
import { getState, submitOtp, isBusy } from './scrapers/state.js';

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
// Gemini classification endpoint
const geminiKeyPath = path.join(__dirname, '..', 'GEMINI_API_KEY.txt');
const geminiApiKey = fs.existsSync(geminiKeyPath)
  ? fs.readFileSync(geminiKeyPath, 'utf-8').trim()
  : process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY not found in GEMINI_API_KEY.txt or env — /api/classify will fail');
}

const genai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

app.post('/api/classify', async (req, res) => {
  try {
    if (!genai) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    const { merchants, categories } = req.body;
    if (!Array.isArray(merchants) || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'merchants and categories must be arrays' });
    }

    const systemInstruction = `You classify Hebrew/English merchant names from Israeli credit-card statements into one of these spending categories:

${categories.map(c => `- ${c}`).join('\n')}

Rules:
1. Pick exactly one category from the list above for each merchant.
2. Use the category "אחר" only when no other category clearly applies.
3. Output a JSON array of {merchant, category} objects, one per input merchant. The merchant value must be copied EXACTLY from the input (including any quotes or punctuation).`;

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Classify these merchants:\n${JSON.stringify(merchants)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.STRING },
              category: { type: Type.STRING, enum: categories },
            },
            required: ['merchant', 'category'],
          },
        },
      },
    });

    const pairs = JSON.parse(response.text);
    const mapping = {};
    if (Array.isArray(pairs)) {
      for (const p of pairs) {
        if (p && typeof p.merchant === 'string' && typeof p.category === 'string') {
          mapping[p.merchant] = p.category;
        }
      }
    }
    res.json({ mapping, usage: response.usageMetadata });
  } catch (error) {
    console.error('Classify error:', error);
    res.status(500).json({ error: error.message || 'Failed to classify merchants' });
  }
});

// Start a scrape in the background; HTTP response returns immediately so the
// client can poll /api/scrape/status. Required because Isracard's OTP pause
// can hold the scrape open for as long as the user takes to type a code.
app.post('/api/scrape', async (req, res) => {
  if (isBusy()) {
    return res.status(409).json({ error: 'Scrape already in progress' });
  }
  // Fire and forget — errors are surfaced via /api/scrape/status.
  scrapeAll().catch(err => console.error('Background scrape error:', err));
  res.json({ started: true });
});

// Poll current job status. Returns {status, message, provider, result?}.
// status: idle | running | awaiting_otp | done | failed.
app.get('/api/scrape/status', (req, res) => {
  res.json(getState());
});

// Submit OTP code when status is awaiting_otp.
app.post('/api/scrape/otp', (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const accepted = submitOtp(code);
  if (!accepted) return res.status(409).json({ error: 'Scraper is not waiting for an OTP right now' });
  res.json({ accepted: true });
});

// Return all previously-scraped transactions (already in Transaction shape).
app.get('/api/scraped', (req, res) => {
  try {
    res.json({ transactions: readAllScraped(), meta: readScrapedMeta() });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to read scraped data' });
  }
});

// Serve static files from the React app (for production/docker)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Handle SPA routing - return index.html for all non-API routes.
  // Express 5 / path-to-regexp v8 reject the bare `'*'` string, so use a regex.
  app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
