import { Transaction } from '@/types/transaction';
import { CATEGORIES } from './categories';

const BATCH_SIZE = 50;

export async function categorizeTransactionsWithAI(
  transactions: Transaction[],
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, string>> {
  const uniqueMerchants = Array.from(new Set(transactions.map(t => t.merchantName)));
  const merchantCategoryMap = new Map<string, string>();
  const total = uniqueMerchants.length;
  const categories = Object.values(CATEGORIES);
  const validCategories = new Set<string>(categories);

  let processed = 0;

  for (let i = 0; i < uniqueMerchants.length; i += BATCH_SIZE) {
    const batch = uniqueMerchants.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchants: batch, categories }),
      });

      if (!response.ok) throw new Error(`Classify API failed: ${response.status}`);

      const { mapping } = await response.json();
      if (mapping && typeof mapping === 'object') {
        Object.entries(mapping).forEach(([merchant, category]) => {
          if (typeof category === 'string' && validCategories.has(category)) {
            merchantCategoryMap.set(merchant, category);
          }
        });
      }
    } catch (err) {
      console.error('Batch failed:', err);
    }

    processed += batch.length;
    onProgress?.(Math.min(processed, total), total);
  }

  return merchantCategoryMap;
}
