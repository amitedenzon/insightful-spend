import { useState, useCallback, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import Upload from "@/pages/Upload";
import Monitor from "@/pages/Monitor";
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



  // Helper to apply overrides from localStorage
  const applyCategoryOverrides = (txs: Transaction[]) => {
    try {
      const saved = localStorage.getItem('category_overrides');
      if (saved) {
        const overrides = JSON.parse(saved);
        return txs.map(t => overrides[t.id] ? { ...t, category: overrides[t.id] } : t);
      }
    } catch (e) {
      console.error('Failed to load category overrides', e);
    }
    return txs;
  };

  const handleCategoryChange = useCallback((id: string, newCategory: string) => {
    setTransactions(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, category: newCategory } : t);
      
      // Save to localStorage
      try {
        const saved = localStorage.getItem('category_overrides');
        const overrides = saved ? JSON.parse(saved) : {};
        overrides[id] = newCategory;
        localStorage.setItem('category_overrides', JSON.stringify(overrides));
      } catch (e) {
        console.error('Failed to save category override', e);
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
                    element={<Monitor transactions={transactions} onCategoryChange={handleCategoryChange} />} 
                  />
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
