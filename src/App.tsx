import { useState, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import Upload from "@/pages/Upload";
import Monitor from "@/pages/Monitor";
import NotFound from "./pages/NotFound";
import { Transaction } from '@/types/transaction';
import { parseMultipleCSVs } from '@/utils/csvParser';

const queryClient = new QueryClient();

const App = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsLoading(true);
    try {
      const parsed = await parseMultipleCSVs(files);
      setTransactions(prev => {
        const combined = [...prev, ...parsed];
        const seen = new Set<string>();
        return combined.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
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
          <div className="min-h-screen bg-background" dir="rtl">
            <AppHeader transactionCount={transactions.length} />
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
                element={<Monitor transactions={transactions} />} 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
