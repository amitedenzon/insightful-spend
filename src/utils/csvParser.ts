import { Transaction } from '@/types/transaction';

const HEADER_ROWS_TO_SKIP = 9;

export function parseCSV(csvContent: string): Transaction[] {
  const lines = csvContent.split('\n');
  const transactions: Transaction[] = [];

  // Skip header metadata rows
  const dataLines = lines.slice(HEADER_ROWS_TO_SKIP);

  // Find the header row
  const headerRowIndex = dataLines.findIndex(line => 
    line.includes('תאריך רכישה') || line.includes('שם בית עסק')
  );

  if (headerRowIndex === -1) {
    console.warn('Header row not found, attempting to parse from first data row');
  }

  const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

  // Determine statement date from header if possible
  const statementDate = extractStatementDate(lines);

  for (let i = startIndex; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);
    if (columns.length < 4) continue;

    const [dateStr, merchantName, , , chargeAmountStr, currency, , , additionalInfo] = columns;

    // Check for "Standing Order" (הוראת קבע) in ANY column to be safe
    const isStandingOrder = columns.some(col => col && col.includes('הוראת קבע'));

    // Skip if no valid date
    if (!dateStr || !dateStr.match(/\d{2}\.\d{2}\.\d{2}/)) continue;

    let purchaseDate = parseHebrewDate(dateStr);
    const chargeAmount = parseNumber(chargeAmountStr);
    
    if (isNaN(purchaseDate.getTime()) || isNaN(chargeAmount)) continue;

    const installments = parseInstallments(columns);

    // If it's an installment transaction
    if (installments) {
        if (statementDate) {
            // Priority 1: Use Statement Date from Header
            purchaseDate = statementDate;
        } else {
            // Priority 2: Fallback to Calculation
            // If we couldn't find the date in the header, calculate the likely payment date
            // based on the installment number.
            // e.g. Purchase Date: Jan 1st
            // Payment 3 of 12 -> Jan + 2 months = March
            const d = new Date(purchaseDate);
            d.setMonth(d.getMonth() + installments.current - 1);
            purchaseDate = d;
        }
    }

    const transaction: Transaction = {
      id: `${purchaseDate.toISOString()}-${merchantName}-${chargeAmount}-${i}`, // Update ID to reflect new date
      purchaseDate,
      merchantName: merchantName?.trim() || 'לא ידוע',
      chargeAmount,
      currency: currency?.trim() || '₪',
      additionalInfo: additionalInfo?.trim() || '',
      isStandingOrder: isStandingOrder,
      installments,
    };

    transactions.push(transaction);
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseHebrewDate(dateStr: string): Date {
  // Format: DD.MM.YY
  const parts = dateStr.split('.');
  if (parts.length !== 3) return new Date(NaN);

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  let year = parseInt(parts[2], 10);
  
  // Handle 2-digit year
  if (year < 100) {
    year += year > 50 ? 1900 : 2000;
  }

  return new Date(year, month, day);
}

function parseNumber(str: string): number {
  if (!str) return 0;
  // Remove commas and any non-numeric characters except minus and decimal
  const cleaned = str.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseInstallments(columns: string[]): { current: number; total: number } | undefined {
  // Regex patterns to match:
  // "תשלום 4 מתוך 12"
  // "4 מתוך 12"
  // "תשלום 4/12"
  const patterns = [
    /תשלום\s+(\d+)\s+מתוך\s+(\d+)/,
    /(\d+)\s+מתוך\s+(\d+)/,
    /תשלום\s+(\d+)\/(\d+)/
  ];

  for (const col of columns) {
    if (!col) continue;
    for (const pattern of patterns) {
      const match = col.match(pattern);
      if (match) {
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (!isNaN(current) && !isNaN(total) && total > 0) {
          return { current, total };
        }
      }
    }
  }
  return undefined;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function extractStatementDate(lines: string[]): Date | null {
  // Look in the first 10 lines for patterns like "פברואר 2026"
  const linesToSearch = lines.slice(0, 10);
  
  for (const line of linesToSearch) {
    for (let i = 0; i < HEBREW_MONTHS.length; i++) {
        const monthName = HEBREW_MONTHS[i];
        // Match "Month ... YYYY" allowing for CSV characters (quotes, commas, spaces) in between
        // e.g. "פברואר",,"2026"
        const regex = new RegExp(`${monthName}.{0,30}(\\d{4})`);
        const match = line.match(regex);
        
        if (match) {
            const year = parseInt(match[1], 10);
            // Return the 1st of that month to ensure it falls correctly in the period
            return new Date(year, i, 1);
        }
    }
  }
  return null;
}

export function parseMultipleCSVs(files: File[]): Promise<Transaction[]> {
  return Promise.all(
    files.map(file => 
      new Promise<Transaction[]>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve(parseCSV(content));
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file, 'UTF-8');
      })
    )
  ).then(results => {
    // Flatten and deduplicate by id
    const allTransactions = results.flat();
    const seen = new Set<string>();
    return allTransactions.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  });
}
