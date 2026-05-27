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

// AI-generated insights for the Statistics page. The client sends a pre-summarized
// payload (no raw transactions). Gemini returns 4–6 short Hebrew insights with
// severity + icon hint that the page renders as badge cards.
app.post('/api/insights', async (req, res) => {
  try {
    if (!genai) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    const summary = req.body?.summary;
    if (!summary || typeof summary !== 'object') {
      return res.status(400).json({ error: 'summary object required' });
    }

    const systemInstruction = `אתה יועץ פיננסי אישי שמנתח נתוני אשראי של משתמש ישראלי. אתה מקבל סיכום מובנה של החודש הנוכחי בהשוואה לחודשים קודמים, וצריך להפיק 4-6 תובנות קצרות, חדות ושימושיות בעברית.

הנחיות חשובות:
1. כל התובנות חייבות להיות בעברית טבעית, לא מתורגמת.
2. תובנה טובה מסבירה למה המספר משמעותי, לא רק חוזרת עליו.
3. תעדיף תובנות שמשלבות כמה נקודות מידע (למשל, "אכלת בחוץ פי 3 יותר וזה הקטגוריה הכי גדלה החודש").
4. אם יש משהו חיובי - ציין אותו. אל תהיה רק שלילי.
5. הימנע מקלישאות כמו "חשוב לעקוב אחרי ההוצאות".
6. כל תובנה צריכה להיות 1-2 משפטים בלבד, ברורה ומדויקת.
7. הימנע מהמלצות גנריות. אם אתה ממליץ, שתהיה המלצה ספציפית הקשורה לנתון.
8. בכותרת השתמש ב-3-5 מילים בלבד, חד וממוקד.
9. תן עדיפות לתובנות שמראות שינוי משמעותי (גידול/קיטון מעל 25%), דפוסים חדשים (בית עסק חדש, מנוי שהתחיל), או ערכים חריגים (z-score גבוה, חודש שיא לקטגוריה).
10. אם אין מספיק נתונים (למשל אין חודש קודם), צור תובנות תיאוריות על החודש הנוכחי בלבד.
11. severity:
   - "positive" — חיסכון, הקטנת הוצאה, התנהגות טובה
   - "neutral" — תצפית מעניינת בלי טון שיפוטי
   - "warning" — עלייה משמעותית או דפוס שצריך תשומת לב
   - "alert" — חריגה חמורה (פי 2 מהממוצע, מנוי חדש יקר, עסקה ענקית)
12. iconHint - בחר אחד מ: "trending-up", "trending-down", "alert-triangle", "sparkles", "flame", "coffee", "utensils", "shopping-bag", "calendar", "repeat", "wallet", "piggy-bank", "info"
13. headline - משפט אחד קצר (עד 10 מילים) שמסכם את החודש בעברית.`;

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `נתח את הסיכום הבא והפק 4-6 תובנות בעברית:\n\n${JSON.stringify(summary, null, 2)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  body: { type: Type.STRING },
                  severity: {
                    type: Type.STRING,
                    enum: ['positive', 'neutral', 'warning', 'alert'],
                  },
                  iconHint: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ['title', 'body', 'severity', 'iconHint'],
              },
            },
            headline: { type: Type.STRING },
          },
          required: ['insights', 'headline'],
        },
      },
    });

    const parsed = JSON.parse(response.text);
    res.json({ ...parsed, usage: response.usageMetadata });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate insights' });
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

// --- Scraper credentials editor -------------------------------------------
// The scraper reads from .env at server startup. The credentials are only
// useful to a malicious caller who already has access to localhost, which is
// the same threat model as the rest of the app. We bind the server to
// 0.0.0.0 in dev for LAN access, but writes are restricted to the keys we
// know about so a misconfigured client can't blow away unrelated env state.
const envPath = path.join(__dirname, '..', '.env');
const ENV_SCHEMA = [
  { key: 'ISRACARD_CARD1_ID',       label: 'ישראכרט #1 · ת״ז',         secret: false },
  { key: 'ISRACARD_CARD1_PASSWORD', label: 'ישראכרט #1 · סיסמה',       secret: true  },
  { key: 'ISRACARD_CARD1_CARD6',    label: 'ישראכרט #1 · 6 ספרות',     secret: false },
  { key: 'ISRACARD_CARD2_ID',       label: 'ישראכרט #2 · ת״ז',         secret: false },
  { key: 'ISRACARD_CARD2_PASSWORD', label: 'ישראכרט #2 · סיסמה',       secret: true  },
  { key: 'ISRACARD_CARD2_CARD6',    label: 'ישראכרט #2 · 6 ספרות',     secret: false },
  { key: 'OTSAR_USERNAME',          label: 'אוצר החייל · משתמש',        secret: false },
  { key: 'OTSAR_PASSWORD',          label: 'אוצר החייל · סיסמה',        secret: true  },
  { key: 'SCRAPER_LOOKBACK_DAYS',   label: 'היסטוריה (ימים)',           secret: false },
  { key: 'SCRAPER_SHOW_BROWSER',    label: 'הצג חלון Chromium',         secret: false },
];

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

app.get('/api/env', (req, res) => {
  try {
    const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const parsed = parseEnvFile(raw);
    const fields = ENV_SCHEMA.map(({ key, label, secret }) => ({
      key,
      label,
      secret,
      value: parsed[key] ?? '',
    }));
    res.json({ fields });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to read .env' });
  }
});

app.post('/api/env', (req, res) => {
  try {
    const updates = req.body?.fields || {};
    if (typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'fields must be an object of key→value' });
    }

    const allowed = new Set(ENV_SCHEMA.map(f => f.key));
    const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const lines = raw.split(/\r?\n/);
    const seen = new Set();

    const next = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return line;
      const key = trimmed.slice(0, eq).trim();
      if (!allowed.has(key)) return line;
      if (!(key in updates)) return line;
      seen.add(key);
      const value = String(updates[key] ?? '');
      // Live process.env so the next scrape picks up the new value without a restart.
      process.env[key] = value;
      return `${key}=${value}`;
    });

    // Append any allowed keys that weren't in the file.
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key) || seen.has(key)) continue;
      next.push(`${key}=${value}`);
      process.env[key] = String(value);
    }

    fs.writeFileSync(envPath, next.join('\n'), 'utf-8');
    res.json({ ok: true });
  } catch (error) {
    console.error('Save .env failed:', error);
    res.status(500).json({ error: error.message || 'Failed to write .env' });
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
