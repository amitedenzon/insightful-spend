import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Calendar, Store, CreditCard, Repeat, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from '@/utils/categories';

interface TransactionTableProps {
  transactions: Transaction[];
  onCategoryChange: (id: string, newCategory: string) => void;
}

type SortField = 'date' | 'merchant' | 'amount';
type SortDirection = 'asc' | 'desc';

export function TransactionTable({ transactions, onCategoryChange }: TransactionTableProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filteredAndSorted = useMemo(() => {
    let filtered = transactions;

    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.merchantName.toLowerCase().includes(query) ||
        t.additionalInfo.toLowerCase().includes(query)
      );
    }

    if (filterCategory && filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }

    return [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'date':
          return (a.purchaseDate.getTime() - b.purchaseDate.getTime()) * direction;
        case 'merchant':
          return a.merchantName.localeCompare(b.merchantName, 'he') * direction;
        case 'amount':
          return (a.chargeAmount - b.chargeAmount) * direction;
        default:
          return 0;
      }
    });
  }, [transactions, search, filterCategory, sortField, sortDirection]);

  const filteredTotal = useMemo(() => {
    return filteredAndSorted.reduce((sum, t) => sum + t.chargeAmount, 0);
  }, [filteredAndSorted]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '400ms' }}>
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם בית עסק..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 bg-background"
            />
          </div>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="סינון לפי סוג" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל העסקאות</SelectItem>
              {Object.values(CATEGORIES).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="whitespace-nowrap flex gap-2 h-10 px-4 items-center justify-center min-w-[140px]">
            <span>{filteredAndSorted.length}</span>
            {search.trim() || filterCategory !== 'all' ? (
              <>
                <span className="opacity-50">|</span>
                <span className="text-primary font-bold">
                  {filteredTotal.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
                </span>
              </>
            ) : (
                <span>עסקאות</span>
            )}
          </Badge>
        </div>
      </div>

      <div className="overflow-auto max-h-[400px]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  תאריך
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort('merchant')}
              >
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  בית עסק
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  סכום
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right">פירוט</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  לא נמצאו עסקאות
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium tabular-nums">
                    {formatDate(t.purchaseDate)}
                  </TableCell>
                  <TableCell>{t.merchantName}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="outline-none">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground whitespace-nowrap hover:bg-secondary/80 cursor-pointer transition-colors">
                          {t.category || 'אחר'}
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-[300px] overflow-auto">
                        {Object.values(CATEGORIES).map((cat) => (
                          <DropdownMenuItem 
                            key={cat}
                            onClick={() => onCategoryChange(t.id, cat)}
                            className={cn(
                              "cursor-pointer text-right justify-end",
                              t.category === cat && "bg-muted font-medium"
                            )}
                          >
                            {cat}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className={cn(
                    "font-bold tabular-nums",
                    t.chargeAmount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {t.chargeAmount.toLocaleString('he-IL', { 
                      style: 'currency', 
                      currency: 'ILS' 
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={t.additionalInfo}>
                    {t.additionalInfo}
                    {t.isStandingOrder && (
                      <Badge variant="outline" className="mr-2 gap-1 inline-flex">
                        <Repeat className="h-3 w-3" />
                        הוראת קבע
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
