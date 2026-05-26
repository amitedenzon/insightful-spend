// Stream-style CLI for the scraper. Run with `npm run scrape`.
// Prints every progress event from israeli-bank-scrapers so you can watch the
// login/fetch happen in real time and verify the scrape actually ran.

import 'dotenv/config';
import { scrapeAll } from './scrapers/index.js';

const reset = '\x1b[0m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';

function ts() {
  return new Date().toLocaleTimeString('en-GB');
}

function onProgress(provider, eventType) {
  console.log(`${dim}[${ts()}]${reset} ${cyan}${provider.padEnd(18)}${reset} ${eventType}`);
}

const lookback = process.env.SCRAPER_LOOKBACK_DAYS || '90';

// Show env-var presence (length only — never values) so a misconfigured .env
// is obvious. INVALID_PASSWORD with all-zeros here means dotenv didn't load.
function show(name) {
  const v = process.env[name];
  const status = v ? `${green}set${reset} (${v.length} chars)` : `${red}MISSING${reset}`;
  console.log(`  ${name.padEnd(28)} ${status}`);
}
console.log(`\nEnv check:`);
['ISRACARD_CARD1_ID', 'ISRACARD_CARD1_PASSWORD', 'ISRACARD_CARD1_CARD6',
 'ISRACARD_CARD2_ID', 'ISRACARD_CARD2_PASSWORD', 'ISRACARD_CARD2_CARD6',
 'OTSAR_USERNAME', 'OTSAR_PASSWORD'].forEach(show);

console.log(`\nStarting scrape · lookback ${lookback} days · showBrowser=${process.env.SCRAPER_SHOW_BROWSER || 'false'} · verbose=${process.env.SCRAPER_VERBOSE || 'false'}\n`);

const start = Date.now();
try {
  const result = await scrapeAll({ onProgress });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${green}✓ done in ${elapsed}s${reset}`);
  if (result.providers.length) {
    console.log('\nPer-provider counts:');
    for (const p of result.providers) {
      console.log(`  ${p.provider.padEnd(18)} ${p.count} transactions`);
    }
  }
  if (result.errors.length) {
    console.log(`\n${yellow}Errors:${reset}`);
    for (const e of result.errors) console.log(`  ${e.message}`);
  }
  if (!result.providers.length && !result.errors.length) {
    console.log(`\n${yellow}No providers ran — check that .env has credentials.${reset}`);
  }
  console.log(`\nTotal: ${result.totalTransactions} transactions written to server/data/scraped/`);
} catch (err) {
  console.error(`\n${red}✗ scrape failed: ${err.message}${reset}`);
  process.exitCode = 1;
}
