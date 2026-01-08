import { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
}

export function FileUpload({ onFilesSelected, isLoading }: FileUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(
        f => f.name.endsWith('.csv')
      );
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(
        f => f.name.endsWith('.csv')
      );
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300",
        "border-border hover:border-primary/50 hover:bg-primary/5",
        "group cursor-pointer"
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300",
          "bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110"
        )}>
          {isLoading ? (
            <FileSpreadsheet className="w-10 h-10 text-primary animate-pulse-soft" />
          ) : (
            <Upload className="w-10 h-10 text-primary" />
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            {isLoading ? 'מעבד קבצים...' : 'העלה דפי חשבון'}
          </h3>
          <p className="text-muted-foreground">
            גרור קבצי CSV או לחץ לבחירה
          </p>
        </div>

        <Button variant="outline" className="mt-2" disabled={isLoading}>
          <FileSpreadsheet className="ml-2 h-4 w-4" />
          בחר קבצים
        </Button>
      </div>
    </div>
  );
}
