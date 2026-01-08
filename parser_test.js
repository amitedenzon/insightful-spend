
// Mock of the parser logic from csvParser.ts
function parseWholeCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

const csv = `Line 1,Val1
Line 2,"Val 
2"
Line 3,Val3`;

const parsed = parseWholeCSV(csv);
console.log('Parsed Rows:', parsed.length);
console.log(JSON.stringify(parsed, null, 2));

if (parsed.length !== 3) {
    console.error("FAIL: Expected 3 rows");
} else {
    console.log("PASS: Row count correct");
}
