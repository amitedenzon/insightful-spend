import { useState, useCallback, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import Upload from "@/pages/Upload";
import Monitor from "@/pages/Monitor";
import RecurringPaymentsPage from "@/pages/RecurringPayments";
import BudgetsPage from "@/pages/Budgets";
import DataManagement from "@/pages/DataManagement";
import NotFound from "./pages/NotFound";
import { Transaction } from '@/types/transaction';
import { parseMultipleCSVs } from '@/utils/csvParser';

const queryClient = new QueryClient();

const App = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use useEffect for side effects
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const res = await fetch('/api/files');
        if (!res.ok) return;
        const filesData: { name: string, content: string }[] = await res.json();
        
        // Convert to File objects to reuse parser
        const fileObjects = filesData.map(f => 
          new File([f.content], f.name, { type: 'text/csv' })
        );
        
        if (fileObjects.length > 0) {
           const parsed = await parseMultipleCSVs(fileObjects);
           setTransactions(prev => {
            const combined = [...parsed, ...prev];
            const seen = new Set<string>();
            const unique = combined.filter(t => {
              if (seen.has(t.id)) return false;
              seen.add(t.id);
              return true;
            });
            return applyCategoryOverrides(unique);
          });
        }
      } catch (error) {
        console.error('Failed to load persisted files:', error);
      }
    };
    loadFiles();
  }, []);



  // Helper to apply overrides from localStorage.
  // Merchant-level overrides take precedence (they reflect explicit user intent
  // that "every transaction from this merchant belongs to category X").
  // Per-id overrides remain as a fallback for any legacy data already saved.
  const applyCategoryOverrides = (txs: Transaction[]) => {
    try {
      const merchantSaved = localStorage.getItem('merchant_category_overrides');
      const merchantOverrides: Record<string, string> = merchantSaved ? JSON.parse(merchantSaved) : {};
      const idSaved = localStorage.getItem('category_overrides');
      const idOverrides: Record<string, string> = idSaved ? JSON.parse(idSaved) : {};
      return txs.map(t => {
        if (merchantOverrides[t.merchantName]) return { ...t, category: merchantOverrides[t.merchantName] };
        if (idOverrides[t.id]) return { ...t, category: idOverrides[t.id] };
        return t;
      });
    } catch (e) {
      console.error('Failed to load category overrides', e);
    }
    return txs;
  };

  const handleCategoryChange = useCallback((id: string, newCategory: string) => {
    setTransactions(prev => {
      const target = prev.find(t => t.id === id);
      const merchantName = target?.merchantName;

      // A manual change for a single row is treated as a merchant-wide rule:
      // every existing transaction from this merchant is recategorized, and
      // the rule is persisted so future uploads inherit it too.
      const updated = prev.map(t =>
        merchantName && t.merchantName === merchantName ? { ...t, category: newCategory } : t
      );

      try {
        if (merchantName) {
          const saved = localStorage.getItem('merchant_category_overrides');
          const overrides = saved ? JSON.parse(saved) : {};
          overrides[merchantName] = newCategory;
          localStorage.setItem('merchant_category_overrides', JSON.stringify(overrides));
        }
      } catch (e) {
        console.error('Failed to save merchant category override', e);
      }

      return updated;
    });
  }, []);

  const handleBatchCategoryChange = useCallback((merchantCategoryMap: Map<string, string>) => {
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (merchantCategoryMap.has(t.merchantName)) {
          return { ...t, category: merchantCategoryMap.get(t.merchantName)! };
        }
        return t;
      });

      // Persist merchant-level rules so they survive reloads and apply to future uploads.
      try {
        const saved = localStorage.getItem('merchant_category_overrides');
        const overrides = saved ? JSON.parse(saved) : {};
        merchantCategoryMap.forEach((category, merchant) => {
          overrides[merchant] = category;
        });
        localStorage.setItem('merchant_category_overrides', JSON.stringify(overrides));
      } catch (e) {
        console.error('Failed to save batch overrides', e);
      }

      return updated;
    });
  }, []);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsLoading(true);
    try {
      const parsed = await parseMultipleCSVs(files);
      setTransactions(prev => {
        const combined = [...parsed, ...prev];
        const seen = new Set<string>();
        const unique = combined.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        return applyCategoryOverrides(unique);
      });
    } catch (error) {
      console.error('Error parsing CSV files:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background flex" dir="rtl">
            <Sidebar />
            <main className="flex-1 overflow-auto h-screen w-full"> 
               {/* Wrapped in a container for max-width consistency if needed */}
               <div className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/upload" replace />} />
                  <Route 
                    path="/upload" 
                    element={
                      <Upload 
                        onFilesSelected={handleFilesSelected} 
                        isLoading={isLoading}
                        transactionCount={transactions.length}
                      />
                    } 
                  />
                  <Route
                    path="/monitor"
                    element={<Monitor transactions={transactions} onCategoryChange={handleCategoryChange} onBatchCategoryChange={handleBatchCategoryChange} />}
                  />
                  <Route
                    path="/recurring"
                    element={<RecurringPaymentsPage transactions={transactions} />}
                  />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/data" element={<DataManagement />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
               </div>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
