export const CATEGORIES = {
  HOUSING: 'מגורים וחשבונות',
  FOOD: 'מזון וצריכה שוטפת',
  TRANSPORT: 'תחבורה ורכב',
  LEISURE: 'פנאי ובילויים',
  SHOPPING: 'קניות, ביגוד והנעלה',
  HEALTH: 'בריאות וביטוחים',
  FAMILY: 'חינוך ומשפחה',
  FINANCE: 'פיננסים והעברות',
  INVESTMENT: 'השקעות',
  OTHER: 'אחר',
} as const;

// Categories explicitly excluded from the monthly budget (e.g. investments are
// "moving money", not "spending money"). Treat investing as a separate axis so
// it doesn't dilute the rent/food/etc allocation or skew progress bars.
export const NON_BUDGET_CATEGORIES: ReadonlySet<string> = new Set([
  'השקעות',
]);

export function isBudgetableCategory(category: string | undefined | null): boolean {
  if (!category) return true;
  return !NON_BUDGET_CATEGORIES.has(category);
}

// Keywords mapping. Order matters (specific before general if needed).
// This is a basic starting list based on common Israeli merchants + specific requests.
const KEYWORDS: Record<string, string[]> = {
  [CATEGORIES.HOUSING]: [
    'חשמל', 'מים', 'ארנונה', 'ועד בית', 'שכירות', 'משכנתא', 'גז', 
    'פרטנר', 'סלקום', 'פלאפון', 'הוט', 'בזק', 'יס', 'תקשורת'
  ],
  [CATEGORIES.FOOD]: [
    'שופרסל', 'רמי לוי', 'ויקטורי', 'מגה', 'טיב טעם', 'מכולת', 'סופר', 'מרקט', 'יוחננוף',
    'חצי חינם', 'אושר עד', 'סופר-פארם', 'סופר פארם', 'Be Pharm', 'ניקוי', 'מזון'
  ],
  [CATEGORIES.TRANSPORT]: [
    'דלק', 'פז', 'סונול', 'דור אלון', 'תחנת דלק', 'מוסך', 'ביטוח', 'בטוח',
    'חניה', 'פנגו', 'סלו', 'moovit', 'רב קו', 'רכבת', 'אגד', 'מטרופולין', 'טסט',
    'BOLT', 'UBER', 'GETT', 'TAXI', 'מונית', 'RYANAIR', 'EL AL', 'אל על'
  ],
  [CATEGORIES.LEISURE]: [
    'מסעדה', 'קפה', 'ארומה', 'ארקפה', 'לנדוור', 'גרג', 'סינמה', 'קולנוע', 'wolt', 'תן ביס',
    'משלוח', 'פיצה', 'בורגר', 'סושי', 'הופעה', 'זאפה', 'כרטיסים', 'מוזיאון',
    'HOTEL', 'AIRBNB', 'BOOKING', 'נופש', 'מלון', 'צימר'
  ],
  [CATEGORIES.SHOPPING]: [
    'זארה', 'zara', 'h&m', 'אמזון', 'amazon', 'אלי אקספרס', 'aliexpress', 'asos', 'shein',
    'KSP', 'ivory', 'בגדים', 'נעליים', 'אופנה', 'קניון', 'טרמינל', 'goat',
    'LIDL', 'PINGO DOCE', 'DECATHLON', 'דקטלון'
  ],
  // Order matters: investment keywords are checked before FINANCE so generic
  // "בנק"/"העברה" don't swallow trades. Covers Israeli brokers, ETF providers,
  // crypto, retirement vehicles, and the common English brokerage names.
  [CATEGORIES.INVESTMENT]: [
    'השקעה', 'השקעות', 'מניות', 'מניה', 'אג"ח', 'אגח', 'תיק השקעות', 'נייר ערך',
    'ניירות ערך', 'קרן השתלמות', 'קרן נאמנות', 'קרן סל', 'גמל להשקעה',
    'פנסיה', 'פסגות', 'מיטב', 'מיטב דש', 'אלטשולר', 'ילין לפידות', 'הראל פיננסים',
    'פעילים שוקי הון', 'IBI', 'אקסלנס', 'אקסלנס נשואה', 'מגדל שוקי הון',
    'הראל סל', 'תכלית', 'קסם', 'BLACKROCK', 'VANGUARD',
    'INTERACTIVE BROKERS', 'IBKR', 'ETORO', 'איטורו', 'PLUS500', 'פלוס500',
    'AVATRADE',
    'COINBASE', 'BINANCE', 'KRAKEN', 'BITCOIN', 'CRYPTO', 'קריפטו', 'ביטקוין'
  ],
  [CATEGORIES.FINANCE]: [
    'הלוואה', 'עמלה', 'בנק', 'העברה', 'משיכה', 'חיסכון', 'קופת גמל',
    'BIT', 'ביט', 'PAYBOX', 'פייבוקס', 'PAYPAL'
  ],
};

export function categorizeMerchant(merchantName: string, description: string = ''): string {
  const normalizedText = `${merchantName} ${description}`.toLowerCase();

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()))) {
      return category;
    }
  }

  return CATEGORIES.OTHER;
}
