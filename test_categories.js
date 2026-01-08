
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

const KEYWORDS = {
  [CATEGORIES.HOUSING]: [
    'חשמל', 'מים', 'ארנונה', 'ועד בית', 'שכירות', 'משכנתא', 'גז', 
    'פרטנר', 'סלקום', 'פלאפון', 'הוט', 'בזק', 'yes', 'יס', 'תקשורת'
  ],
  [CATEGORIES.FOOD]: [
    'שופרסל', 'רמי לוי', 'ויקטורי', 'מגה', 'טיב טעם', 'מכולת', 'סופר', 'מרקט', 'יוחננוף',
    'חצי חינם', 'אושר עד', 'סופר-פארם', 'סופר פארם', 'BE', 'ניקוי', 'מזון'
  ],
  [CATEGORIES.TRANSPORT]: [
    'דלק', 'פז', 'סונול', 'דור אלון', 'תחנת דלק', 'מוסך', 'ביטוח רכב', 
    'חניה', 'פנגו', 'סלו', 'moovit', 'רב קו', 'רכבת', 'אגד', 'דן', 'מטרופולין', 'טסט'
  ],
  [CATEGORIES.LEISURE]: [
    'מסעדה', 'קפה', 'ארומה', 'ארקפה', 'לנדוור', 'גרג', 'סינמה', 'קולנוע', 'wolt', 'תן ביס',
    'משלוח', 'פיצה', 'בורגר', 'סושי', 'הופעה', 'זאפה', 'כרטיסים', 'מוזיאון', 'בר'
  ],
  [CATEGORIES.SHOPPING]: [
    'זארה', 'zara', 'h&m', 'אמזון', 'amazon', 'אלי אקספרס', 'aliexpress', 'asos', 'shein',
    'KSP', 'ivory', 'בגדים', 'נעליים', 'אופנה', 'קניון', 'טרמינל'
  ],
  [CATEGORIES.HEALTH]: [
    'קופת חולים', 'מכבי', 'כללית', 'מאוחדת', 'לאומית', 'אסותא', 'ביטוח בריאות', 'הראל', 
    'מגדל', 'פניקס', 'מנורה', 'רופא', 'שיניים', 'בית מרקחת'
  ],
  [CATEGORIES.FAMILY]: [
    'גן', 'מעון', 'צהרון', 'ביה"ס', 'בית ספר', 'שכר לימוד', 'חוג', 'מתנה', 'צעצועים', 
    'TOYS', 'טויס', 'שילב', 'מוצצים'
  ],
  [CATEGORIES.FINANCE]: [
    'הלוואה', 'עמלה', 'בנק', 'העברה', 'משיכה', 'חיסכון', 'קופת גמל', 'קרן'
  ],
};

function categorizeMerchant(merchantName, description = '') {
  const normalizedText = `${merchantName} ${description}`.toLowerCase();

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()))) {
      return category;
    }
  }

  return CATEGORIES.OTHER;
}

const samples = [
    { name: 'דלק פז', desc: '' },
    { name: 'שופרסל שלי', desc: '' },
    { name: 'חשבונית ירוקה', desc: 'עבור שירותי תקשורת' },
    { name: 'AMAZON MEMBER', desc: '' },
    { name: 'הוט מובייל', desc: 'הוראת קבע' },
];

samples.forEach(s => {
    console.log(`Input: "${s.name}" + "${s.desc}" -> Result: ${categorizeMerchant(s.name, s.desc)}`);
});
