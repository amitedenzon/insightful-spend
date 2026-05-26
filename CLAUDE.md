# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"בזבזני" — a Hebrew/RTL personal-spending dashboard that ingests Israeli credit-card statement CSVs and produces analytics (totals, breakdowns, standing orders, installments, recurring payments, category pies). Originally scaffolded by Lovable.dev (the `lovable-tagger` plugin runs in dev mode).

## Commands

- `npm run dev` — runs the Express API (`server/index.js`, port 3001) and the Vite client (port 5173) concurrently. The Vite config proxies `/api/*` to the API, so always go through `http://localhost:5173`.
- `npm run server` — API only.
- `npm run build` / `npm run build:dev` — production / development-mode Vite build into `dist/`. The Express server serves `dist/` as static SPA when present (Docker prod mode).
- `npm run lint` — ESLint (flat config, TypeScript + React Hooks rules). Note: `@typescript-eslint/no-unused-vars` is intentionally **off**.
- `./launch_app.sh` — builds & runs the Dockerfile (`spender` container), mounting `src/`, `public/`, `server/`, `index.html`, `vite.config.ts` for live reload; exposes both 3001 and 5173 and opens the browser.

There is no test runner. The `parser_test.js`, `test_categories.js`, `test_regex.js` files at the repo root are ad-hoc Node scripts (`node parser_test.js`), not a wired-up suite.

## Architecture

### Two processes, one product
- **Client** (`src/`, Vite + React 18 + TS + shadcn/ui + Tailwind + Recharts). Path alias `@/` → `src/`. Wrapped in `BrowserRouter`, `QueryClientProvider`, `TooltipProvider`, and forced RTL (`dir="rtl"` on the layout root). Routes: `/upload`, `/monitor` (dashboard), `/data` (file management); `/` redirects to `/upload`.
- **Server** (`server/index.js`, Express 5 + multer). Persists uploaded CSVs in `server/data/` keyed by original filename (re-uploading overwrites). Endpoints: `POST /api/upload`, `GET /api/files` (returns filename + raw content + size/mtime + line-count estimate), `GET /api/files/:filename/download`, `DELETE /api/files/:filename`, and `POST /api/ollama` (proxy → `http://localhost:11434/api/chat`).

### Transaction lifecycle
1. `src/App.tsx` is the single source of truth for the in-memory `Transaction[]`. On mount it fetches `/api/files`, wraps each `content` string back into a `File`, and feeds them through `parseMultipleCSVs`.
2. New uploads from `<FileUpload>` POST to `/api/upload`, then are parsed client-side via the same path and merged into state. Dedup is by `Transaction.id` (composed of `ISO purchaseDate + merchantName + chargeAmount + row index` in `csvParser.ts`) — changing that composition will break dedup across re-uploads.
3. Category overrides are persisted in `localStorage` under the key `category_overrides` as `{ [transactionId]: category }`, reapplied on every load via `applyCategoryOverrides` in `App.tsx`. `handleCategoryChange` writes one; `handleBatchCategoryChange` writes many (keyed by merchant, but stored per-transaction).

### CSV parsing (`src/utils/csvParser.ts`)
Specifically targets Hebrew Isracard/credit-card statements. Key behaviors that are easy to break:
- `parseWholeCSV` is a hand-rolled state-machine parser — needed because cells legitimately contain `\n` inside quotes.
- Column indices are looked up by Hebrew header names (`תאריך רכישה`, `שם בית עסק`, `סכום חיוב`, `מטבע חיוב`, `פירוט נוסף`); fallbacks to fixed indices are a last resort.
- Standing-order detection scans **every** column for `הוראת קבע` (the substring can appear inside other text like `אתר חו"ל הוראת קבע`).
- Installments are matched against three Hebrew regex patterns (`תשלום N מתוך M`, `N מתוך M`, `תשלום N/M`). When an installment is detected, the transaction's date is overridden to the **statement month** (parsed from a Hebrew-month header in the top 10 lines via `extractStatementDate`), falling back to `purchaseDate + (current-1)` months.
- Hebrew dates are `DD.MM.YY`; the 2-digit year flips to `1900s` for `> 50`, else `2000s`.

### Categorization (`src/utils/categories.ts`, `src/utils/ai.ts`)
- Rule-based: `categorizeMerchant` does case-insensitive substring matching against a Hebrew/English keyword map. Order of the `KEYWORDS` map matters when keywords overlap. Default bucket is `אחר` (Other).
- AI-based (optional): `categorizeTransactionsWithAI` batches unique merchants (50 at a time) to a local Ollama `llama3` via the server's `/api/ollama` proxy with `format: 'json'`. Requires Ollama running locally; on any failure the batch is skipped and processing continues. Results flow back through `onBatchCategoryChange` so they hit the same localStorage override path.

### Dashboard (`src/components/Dashboard.tsx`, `src/utils/analytics.ts`)
All analytics are pure functions over `Transaction[]` (no caching beyond `useMemo` in the component). The dashboard has two filter axes: time (year + optional month via `ViewMode 'month' | 'year'`) and category. `findRecurrentPayments` only flags merchants that appear in ≥3 distinct months with monthly totals within ±20% of the mean — tweak both thresholds together if behavior changes.

### UI conventions
- shadcn/ui components live under `src/components/ui/` (configured in `components.json` with base color `slate`). Reuse them rather than introducing new primitives.
- The app is RTL-first. When laying out flex/grid, remember `justify-end` etc. behave mirrored; many components already work around this manually (see `AlertDialogFooter` in `DataManagement.tsx`).
- User-facing strings are in Hebrew. Keep it that way unless explicitly asked.
