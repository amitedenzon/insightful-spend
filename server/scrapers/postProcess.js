// Post-processing for scraped transactions, mirroring the parsing the CSV
// pipeline does (src/utils/csvParser.ts). Applied at READ time so:
//   - Existing on-disk JSON benefits without re-scrape.
//   - The scraper stays a thin API wrapper; semantic decisions live here.
//
// What this does, per row:
//   1. For installments, shift purchaseDate by (current - 1) months so each
//      installment lands in its actual billing month (CSV-parser parity).
//   2. statementDate := first-of-month of the (possibly shifted) purchaseDate.
//   3. Detect standing orders by substring on description/info (the API's
//      `directDebit` flag isn't always set; the substring catches the rest).
//   4. Strip "הוראת קבע" from additionalInfo (keep info clean).
//   5. Assign a default category via rule-based merchant matching.
//      Per-merchant/per-id overrides from localStorage layer on top client-side.
//   6. Merchant fallback "לא ידוע" matches CSV parser behavior.

const CATEGORIES = {
  HOUSING: 'מגורים וחשבונות',
  FOOD: 'מזון וצריכה שוטפת',
  TRANSPORT: 'תחבורה ורכב',
  LEISURE: 'פנאי ובילויים',
  SHOPPING: 'קניות, ביגוד והנעלה',
  HEALTH: 'בריאות וביטוחים',
  FAMILY: 'חינוך ומשפחה',
  FINANCE: 'פיננסים וחיסכון',
  OTHER: 'אחר',
};

// Mirrors src/utils/categories.ts KEYWORDS. Keep in sync — or refactor later
// to load both from one shared JSON file.
const KEYWORDS = {
  [CATEGORIES.HOUSING]: [
    'חשמל', 'מים', 'ארנונה', 'ועד בית', 'שכירות', 'משכנתא', 'גז',
    'פרטנר', 'סלקום', 'פלאפון', 'הוט', 'בזק', 'יס', 'תקשורת',
  ],
  [CATEGORIES.FOOD]: [
    'שופרסל', 'רמי לוי', 'ויקטורי', 'מגה', 'טיב טעם', 'מכולת', 'סופר', 'מרקט', 'יוחננוף',
    'חצי חינם', 'אושר עד', 'סופר-פארם', 'סופר פארם', 'Be Pharm', 'ניקוי', 'מזון',
  ],
  [CATEGORIES.TRANSPORT]: [
    'דלק', 'פז', 'סונול', 'דור אלון', 'תחנת דלק', 'מוסך', 'ביטוח', 'בטוח',
    'חניה', 'פנגו', 'סלו', 'moovit', 'רב קו', 'רכבת', 'אגד', 'מטרופולין', 'טסט',
    'BOLT', 'UBER', 'GETT', 'TAXI', 'מונית', 'RYANAIR', 'EL AL', 'אל על',
  ],
  [CATEGORIES.LEISURE]: [
    'מסעדה', 'קפה', 'ארומה', 'ארקפה', 'לנדוור', 'גרג', 'סינמה', 'קולנוע', 'wolt', 'תן ביס',
    'משלוח', 'פיצה', 'בורגר', 'סושי', 'הופעה', 'זאפה', 'כרטיסים', 'מוזיאון',
    'HOTEL', 'AIRBNB', 'BOOKING', 'נופש', 'מלון', 'צימר',
  ],
  [CATEGORIES.SHOPPING]: [
    'זארה', 'zara', 'h&m', 'אמזון', 'amazon', 'אלי אקספרס', 'aliexpress', 'asos', 'shein',
    'KSP', 'ivory', 'בגדים', 'נעליים', 'אופנה', 'קניון', 'טרמינל', 'goat',
    'LIDL', 'PINGO DOCE', 'DECATHLON', 'דקטלון',
  ],
  [CATEGORIES.FINANCE]: [
    'הלוואה', 'עמלה', 'בנק', 'העברה', 'משיכה', 'חיסכון', 'קופת גמל', 'קרן',
    'BIT', 'ביט', 'PAYBOX', 'פייבוקס', 'PAYPAL',
  ],
};

function categorizeMerchant(merchantName, description = '') {
  const normalizedText = `${merchantName} ${description}`.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(k => normalizedText.includes(k.toLowerCase()))) return category;
  }
  return CATEGORIES.OTHER;
}

function shiftMonths(iso, months) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function firstOfMonthIso(iso) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export function postProcessTransaction(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  // 1. Installment date shift — match csvParser.ts (purchaseDate + N-1 months).
  let purchaseDate = raw.purchaseDate;
  const ins = raw.installments;
  if (ins && typeof ins.current === 'number' && ins.current > 1) {
    purchaseDate = shiftMonths(purchaseDate, ins.current - 1);
  }

  // 2. Standing order: trust either the API flag or the substring marker.
  const haystack = `${raw.merchantName || ''} ${raw.additionalInfo || ''}`;
  const isStandingOrder = Boolean(raw.isStandingOrder) || haystack.includes('הוראת קבע');

  // 3. Strip the marker from displayed info so it doesn't double-up with the
  //    badge the UI renders for standing orders. Also strip transaction-type
  //    tags ("עסקאות רגילות" / "עסקאות בתשלומים") that older Isracard scrapes
  //    persisted into additionalInfo — they hurt categorization (the substring
  //    `מים` matches the HOUSING "water" keyword).
  let additionalInfo = (raw.additionalInfo || '').trim();
  if (isStandingOrder) additionalInfo = additionalInfo.replace(/הוראת קבע/g, '').trim();
  additionalInfo = additionalInfo
    .replace(/עסקאות בתשלומים/g, '')
    .replace(/עסקאות רגילות/g, '')
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/^\s*·\s*|\s*·\s*$/g, '')
    .trim();

  const merchantName = (raw.merchantName || '').trim() || 'לא ידוע';

  return {
    ...raw,
    purchaseDate,
    statementDate: firstOfMonthIso(purchaseDate),
    merchantName,
    additionalInfo,
    isStandingOrder,
    category: raw.category || categorizeMerchant(merchantName, additionalInfo),
  };
}
