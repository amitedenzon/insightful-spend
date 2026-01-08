export const CATEGORIES = {
  HOUSING: 'מגורים וחשבונות',
  FOOD: 'מזון וצריכה שוטפת',
  TRANSPORT: 'תחבורה ורכב',
  LEISURE: 'פנאי ובילויים',
  SHOPPING: 'קניות, ביגוד והנעלה',
  HEALTH: 'בריאות וביטוחים',
  FAMILY: 'חינוך ומשפחה',
  FINANCE: 'פיננסים וחיסכון',
  OTHER: 'אחר',
} as const;

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
  [CATEGORIES.FINANCE]: [
    'הלוואה', 'עמלה', 'בנק', 'העברה', 'משיכה', 'חיסכון', 'קופת גמל', 'קרן',
    'BIT', 'ביט', 'PAYBOX', 'פייבוקס', 'PAYPAL'
  ],
};

export function categorizeMerchant(merchantName: string, description: string = ''): string {
  const normalizedText = `${merchantName} ${description}`.toLowerCase();
  // console.log('Categorizing:', { merchantName, description, normalizedText });

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()))) {
      // console.log('Matched:', category, 'Keyword:', keywords.find(k => normalizedText.includes(k.toLowerCase())));
      return category;
    }
  }

  // console.log('No match found, defaulting to OTHER');
  return CATEGORIES.OTHER;
}
