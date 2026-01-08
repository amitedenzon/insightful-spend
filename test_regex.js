
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function extractStatementDate(line) {
    for (let i = 0; i < HEBREW_MONTHS.length; i++) {
        const monthName = HEBREW_MONTHS[i];
        
        // Strict regex from code
        const regexStrict = new RegExp(`${monthName}\\s+(\\d{4})`);
        
        // Looser regex allowing garbage between
        const regexLoose = new RegExp(`${monthName}.*?(\\d{4})`);
        
        if (line.match(regexStrict)) {
            console.log(`Matched Strict: ${monthName} ${RegExp.$1}`);
            return true;
        }
        if (line.match(regexLoose)) {
             console.log(`Matched Loose: ${monthName} -> ${line.match(regexLoose)[1]}`);
             return true;
        }
    }
    return false;
}

const testStrings = [
    'פברואר 2026',
    '"פברואר 2026"',
    'A,B,"פברואר 2026",C',
    'A,B,"פברואר",C,"2026"',
    'תאריך: פברואר 2026',
    'פברואר 02/2026'
];

testStrings.forEach(s => {
    console.log(`Testing "${s}":`);
    if (!extractStatementDate(s)) console.log("FAILED");
    console.log('---');
});
