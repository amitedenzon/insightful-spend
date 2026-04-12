import { Transaction } from '@/types/transaction';
import { CATEGORIES } from './categories';

// Batch size to prevent timeouts and context limits
const BATCH_SIZE = 50;

export async function categorizeTransactionsWithAI(
  transactions: Transaction[], 
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, string>> {
  // 1. Identify merchants that need categorization (mostly "Other" or unknown)
  // We will process ALL unique merchants to ensure accurate recategorization if the user wants purely AI
  // or maybe just those that match 'other' or have no manual override?
  // User asked "pick one of the categories for each payment based on the name".
  // Let's filter for unique merchant names to save tokens.
  
  const uniqueMerchants = Array.from(new Set(transactions.map(t => t.merchantName)));
  const merchantCategoryMap = new Map<string, string>();
  const total = uniqueMerchants.length;
  
  let processed = 0;
  const categoriesList = Object.values(CATEGORIES).join(', ');

  // Process in batches
  for (let i = 0; i < uniqueMerchants.length; i += BATCH_SIZE) {
    const batch = uniqueMerchants.slice(i, i + BATCH_SIZE);
    
    try {
      const prompt = `
Classify merchants into these categories: ${categoriesList}
Rules:
1. Output JSON: { "Merchant Name": "Category" }
2. Use exact merchant names as keys.
3. Use "אחר" if unsure.

Merchants:
${JSON.stringify(batch)}
      `;

      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          stream: false,
          format: 'json', // Enforce JSON mode
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) throw new Error('AI API failed');
      
      const data = await response.json();
      // Parse the 'message.content' which should be JSON string
      const jsonContent = data.message?.content;
      if (!jsonContent) continue;

      const result = JSON.parse(jsonContent);
      
      // Update map
      Object.entries(result).forEach(([merchant, category]) => {
        if (Object.values(CATEGORIES).includes(category as any)) {
           merchantCategoryMap.set(merchant, category as string);
        }
      });

    } catch (err) {
      console.error('Batch failed:', err);
      // Continue to next batch
    }

    processed += batch.length;
    onProgress?.(Math.min(processed, total), total);
  }

  return merchantCategoryMap;
}
