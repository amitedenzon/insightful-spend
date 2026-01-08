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

  for (let i = startIndex; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);
    if (columns.length < 4) continue;

    const [dateStr, merchantName, , , chargeAmountStr, currency, , , additionalInfo] = columns;

    // Skip if no valid date
    if (!dateStr || !dateStr.match(/\d{2}\.\d{2}\.\d{2}/)) continue;

    const purchaseDate = parseHebrewDate(dateStr);
    const chargeAmount = parseNumber(chargeAmountStr);
    
    if (isNaN(purchaseDate.getTime()) || isNaN(chargeAmount)) continue;

    const transaction: Transaction = {
      id: `${dateStr}-${merchantName}-${chargeAmount}-${i}`,
      purchaseDate,
      merchantName: merchantName?.trim() || 'לא ידוע',
      chargeAmount,
      currency: currency?.trim() || '₪',
      additionalInfo: additionalInfo?.trim() || '',
      isStandingOrder: (additionalInfo || '').includes('הוראת קבע'),
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
