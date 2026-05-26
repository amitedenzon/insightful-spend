// Custom Isracard transaction fetcher for the new web.isracard.co.il API.
// The `israeli-bank-scrapers` library is hardcoded against the retired
// digital.isracard.co.il/services endpoints and can't fetch anymore.
//
// Strategy: replay the same JSON calls the SPA itself makes from inside the
// authenticated Puppeteer page (so cookies ride along).

import { setMessage } from './state.js';

// Pad a date to "DD/MM/YYYY" — Isracard's billingMonth format. We always use
// day "01" since billingMonth is month-scoped on the API.
function formatBillingMonth(year, monthIndex) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  return `01/${mm}/${year}`;
}

// "DD/MM/YYYY" → JS Date at local-noon (avoids DST off-by-one rounding).
function parseHebDate(s) {
  if (!s || typeof s !== 'string') return null;
  const [d, m, y] = s.split('/').map(n => parseInt(n, 10));
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Subtract `n` months from `(year, monthIndex)` and return the new pair.
function minusMonths(year, monthIndex, n) {
  let y = year;
  let m = monthIndex - n;
  while (m < 0) { m += 12; y -= 1; }
  return [y, m];
}

async function pageFetchJson(page, path, method, body) {
  return await page.evaluate(async ({ path, method, body }) => {
    try {
      const res = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* keep raw */ }
      return { ok: res.ok, status: res.status, json: parsed, raw: parsed ? null : text };
    } catch (e) {
      return { ok: false, status: 0, error: String(e?.message || e) };
    }
  }, { path, method, body });
}

// Returns the full list of cards from the user's Isracard account.
export async function fetchCardList(page) {
  const res = await pageFetchJson(
    page,
    '/ocp/transactions/DigitalV3.Transactions/GetCardList',
    'POST',
    { companyCode: '99', cardSuffixLength: 4 }
  );
  if (!res.ok || !res.json) {
    throw new Error(`GetCardList failed (status ${res.status}): ${res.error || res.raw || 'no body'}`);
  }
  return res.json.data?.cardsList || [];
}

// Single (card × billingMonth) call. Returns both approved (current/pending)
// transactions and vouchers (settled past-month transactions), all unioned
// into one array tagged by source for the normalizer.
async function fetchOneMonth(page, card, year, monthIndex, isNextBillingDate) {
  const body = {
    card4Number: card.cardSuffix,
    isNextBillingDate,
    cardStatus: 0,
    billingMonth: formatBillingMonth(year, monthIndex),
    companyCode: parseInt(card.companyCode, 10),
    isPartner: !!card.isPartner,
  };
  const res = await pageFetchJson(
    page,
    '/ocp/transactions/DigitalV3.Transactions/GetTransactionsList',
    'POST',
    body
  );
  if (!res.ok || !res.json) {
    return { ok: false, error: res.error || res.raw || `status ${res.status}`, txns: [] };
  }
  const approvals = res.json.data?.approvals?.approvedTransactions || [];
  const vouchers = res.json.data?.israelAbroadVouchers?.vouchers?.israelAbroadVouchersList || [];
  return {
    ok: true,
    txns: [
      ...approvals.map(t => ({ raw: t, source: 'approved' })),
      ...vouchers.map(t => ({ raw: t, source: 'voucher' })),
    ],
  };
}

// Convert one raw Isracard transaction to our Transaction shape. The two
// sources (approved vs voucher) use slightly different field names — `raw`
// is the original row, `source` tells us which schema to read from.
export function normalizeIsracardRow(raw, source, indexCounter) {
  const purchaseDate = parseHebDate(raw.purchaseDate);
  if (!purchaseDate) return null;
  const merchantName = String(raw.businessName || '').trim();

  // Pick the most reliable ILS amount we can find. Approvals report
  // `ilsBillingAmount`; vouchers report `ilsAmount` / `billingAmount`.
  const chargeAmount = Number(
    raw.ilsBillingAmount ?? raw.ilsAmount ?? raw.billingAmount ?? raw.originalAmount ?? 0
  );

  const currency = raw.currencyIso || raw.originalCurrencyIso || 'ILS';

  // Installments live only on vouchers. numberOfInstallment > 1 means it's a
  // multi-payment purchase; currentInstallmentNum tells us which one this row.
  const totalIns = raw.numberOfInstallment;
  const installments = (totalIns && totalIns > 1)
    ? { current: raw.currentInstallmentNum, total: totalIns }
    : undefined;

  const isStandingOrder = Boolean(
    raw.directDebit === 1 || raw.isdirectDebit === true || raw.isdirectDebit === 1
  );

  // City + branch category make a useful display string AND help the keyword
  // categorizer. We deliberately skip `transactionDescription` ("עסקאות רגילות"
  // / "עסקאות בתשלומים") — it's a transaction-type tag, not descriptive, and
  // it false-positives the categorizer (e.g. `בתשלומים` contains `מים` →
  // matches the HOUSING "water" keyword).
  const additionalInfo = [raw.cityDescription, raw.branchCodeDescription]
    .filter(Boolean)
    .join(' · ');

  // Match csvParser.ts id composition: `${ISO date}-${merchant}-${amount}-${idx}`.
  const iso = purchaseDate.toISOString();
  const key = `${iso}|${merchantName}|${chargeAmount}`;
  const idx = indexCounter.get(key) ?? 0;
  indexCounter.set(key, idx + 1);

  return {
    id: `${iso}-${merchantName}-${chargeAmount}-${idx}`,
    purchaseDate: iso,
    statementDate: iso,
    merchantName,
    chargeAmount,
    currency,
    additionalInfo,
    isStandingOrder,
    installments,
    cardSuffix: raw.cardSuffix || null,
  };
}

// Walks billing months backward from `today` and fetches transactions for the
// given card. Stops after `maxMonths` or after 3 consecutive empty months
// (Isracard's history is finite — past some cutoff every month returns []).
export async function fetchCardHistory(page, card, opts = {}) {
  const { maxMonths = 60, label = card.cardSuffix } = opts;
  const all = [];
  const errors = [];

  const now = new Date();
  // The current/next billing month is month +1 of "now" — i.e. May purchases
  // bill on Jun 2. Start there with isNextBillingDate=true.
  let [year, month] = [now.getFullYear(), now.getMonth() + 1];
  let consecutiveEmpty = 0;

  for (let i = 0; i < maxMonths; i++) {
    setMessage(`isracard ${label}: ${formatBillingMonth(year, month)} (${i + 1}/${maxMonths})`);
    const isNext = i === 0;
    const result = await fetchOneMonth(page, card, year, month, isNext);
    if (!result.ok) {
      errors.push({ month: formatBillingMonth(year, month), error: result.error });
      // One failed month isn't fatal — just keep going, maybe a transient blip.
    } else {
      all.push(...result.txns);
      if (result.txns.length === 0) {
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= 3 && i >= 5) break; // past the active history
      } else {
        consecutiveEmpty = 0;
      }
    }
    [year, month] = minusMonths(year, month, 1);
  }

  return { all, errors };
}

// Page-side helper: navigate the authenticated page to the transactions URL.
// Sometimes the SPA hasn't initialized the right cookies/state until we visit
// /transactions specifically, so we always do this before calling the API.
export async function warmUpTransactionsPage(page) {
  await page.goto('https://web.isracard.co.il/transactions', {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  }).catch(() => { /* navigation can be redirected — that's fine */ });
}
