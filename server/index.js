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
// payload (no raw transactions). The endpoint streams Server-Sent Events: a
// `headline` event first, then one `insight` event per object as it completes
// inside the model's JSON array, then `done`. The page renders each as it
// arrives so users see useful text in ~1s instead of waiting for the full JSON.
const INSIGHTS_SYSTEM_INSTRUCTION = `אתה יועץ פיננסי אישי שמנתח נתוני אשראי של משתמש ישראלי. אתה מקבל סיכום מובנה של החודש הנוכחי בהשוואה לחודשים קודמים, וצריך להפיק 4-6 תובנות קצרות, חדות ושימושיות בעברית.

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

// headline first in property order so Gemini emits it before the (longer) insights
// array — lets us render the headline within the first ~200ms of streaming.
const INSIGHTS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
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
  },
  required: ['headline', 'insights'],
};

// Walks the accumulating model text and yields complete JSON values from
// it. Designed for the shape `{"headline": "...", "insights": [ {...}, {...} ]}`.
// Tracks string state and brace depth so a `}` inside a quoted string doesn't
// close an object. Each call to `feed(chunk)` appends and emits any newly
// completed pieces via the supplied callback.
function makeInsightsExtractor(onEvent) {
  let buffer = '';
  let cursor = 0;
  let headlineEmitted = false;
  let arrayEntered = false;
  let arrayClosed = false;

  function tryEmitHeadline() {
    if (headlineEmitted) return;
    const m = buffer.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!m) return;
    try {
      const value = JSON.parse(`"${m[1]}"`);
      onEvent({ type: 'headline', value });
      headlineEmitted = true;
    } catch {
      /* incomplete escape — wait for more */
    }
  }

  function tryEnterArray() {
    if (arrayEntered) return;
    const idx = buffer.indexOf('"insights"', cursor);
    if (idx === -1) return;
    const bracket = buffer.indexOf('[', idx);
    if (bracket === -1) return;
    cursor = bracket + 1;
    arrayEntered = true;
  }

  function tryEmitInsights() {
    if (!arrayEntered || arrayClosed) return;
    let depth = 0;
    let inString = false;
    let escape = false;
    let objStart = -1;
    let i = cursor;
    for (; i < buffer.length; i++) {
      const c = buffer[i];
      if (inString) {
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') inString = false;
        continue;
      }
      if (c === '"') { inString = true; continue; }
      if (c === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && objStart !== -1) {
          const objText = buffer.slice(objStart, i + 1);
          try {
            const parsed = JSON.parse(objText);
            onEvent({ type: 'insight', value: parsed });
          } catch {
            /* malformed object — drop silently */
          }
          objStart = -1;
          cursor = i + 1;
        }
      } else if (c === ']' && depth === 0) {
        arrayClosed = true;
        cursor = i + 1;
        return;
      }
    }
  }

  return function feed(chunk) {
    buffer += chunk;
    tryEmitHeadline();
    tryEnterArray();
    tryEmitInsights();
    if (!headlineEmitted) tryEmitHeadline(); // schema may emit headline after array
  };
}

// Soft circuit breaker for Gemini 429s. Once we know we're rate-limited we
// short-circuit subsequent calls with a structured `quota` SSE event instead of
// burning RPM trying again. State is per-process; restarting the server clears it.
const QUOTA_STATE = {
  exhaustedUntil: null, // epoch ms
  kind: null, // 'daily' | 'minute' | null
};

function checkQuota() {
  if (!QUOTA_STATE.exhaustedUntil) return null;
  if (Date.now() < QUOTA_STATE.exhaustedUntil) {
    return {
      kind: QUOTA_STATE.kind,
      retryAfterSec: Math.max(
        1,
        Math.ceil((QUOTA_STATE.exhaustedUntil - Date.now()) / 1000)
      ),
    };
  }
  QUOTA_STATE.exhaustedUntil = null;
  QUOTA_STATE.kind = null;
  return null;
}

// Pull the meaningful pieces out of Gemini's 429 — kind (daily vs per-minute)
// and the suggested retry delay. Gemini nests an extra JSON payload inside the
// error message string, so we treat both wrappers as text.
function parseQuotaError(error) {
  const text = String(error?.message ?? error ?? '');
  const status = Number(error?.status);
  const looks429 =
    status === 429 ||
    /RESOURCE_EXHAUSTED|429|quota|rate.?limit/i.test(text);
  if (!looks429) return null;

  const isDaily = /PerDay|FreeTier.*Day|GenerateRequestsPerDay/i.test(text);
  const kind = isDaily ? 'daily' : 'minute';

  let retrySec = isDaily ? 3600 : 30;
  const m =
    text.match(/retry in ([\d.]+)s/i) ||
    text.match(/retryDelay"\s*:\s*"([\d.]+)s"/i);
  if (m) retrySec = Math.max(retrySec, Math.ceil(parseFloat(m[1])));
  // Daily quota resets at the project's UTC midnight; hold for at least an hour
  // before retrying so we don't slam the API for nothing.
  if (isDaily) retrySec = Math.max(retrySec, 3600);

  return { kind, retrySec };
}

app.post('/api/insights', async (req, res) => {
  if (!genai) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }
  const summary = req.body?.summary;
  if (!summary || typeof summary !== 'object') {
    return res.status(400).json({ error: 'summary object required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Trip the breaker before calling Gemini if we already know we're out.
  const tripped = checkQuota();
  if (tripped) {
    send('quota', tripped);
    send('done', {});
    res.end();
    return;
  }

  const extractor = makeInsightsExtractor(evt => {
    if (evt.type === 'headline') send('headline', { value: evt.value });
    else if (evt.type === 'insight') send('insight', evt.value);
  });

  try {
    const stream = await genai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: `נתח את הסיכום הבא והפק 4-6 תובנות בעברית:\n\n${JSON.stringify(summary, null, 2)}`,
      config: {
        systemInstruction: INSIGHTS_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: INSIGHTS_RESPONSE_SCHEMA,
      },
    });

    for await (const chunk of stream) {
      const text = chunk?.text;
      if (text) extractor(text);
    }
    send('done', {});
    res.end();
  } catch (error) {
    const quota = parseQuotaError(error);
    if (quota) {
      QUOTA_STATE.exhaustedUntil = Date.now() + quota.retrySec * 1000;
      QUOTA_STATE.kind = quota.kind;
      console.warn(
        `Gemini quota hit (${quota.kind}); cooling off for ${quota.retrySec}s`
      );
      send('quota', { kind: quota.kind, retryAfterSec: quota.retrySec });
    } else {
      console.error('Insights stream error:', error);
      send('error', { message: error.message || 'Failed to generate insights' });
    }
    send('done', {});
    res.end();
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
