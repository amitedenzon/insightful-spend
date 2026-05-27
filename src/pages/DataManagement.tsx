import { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Download, FileText, Database } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface FileData {
  name: string;
  transactionCount: number;
  size: number;
  lastModified: string;
}

export default function DataManagement() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        // Backend now returns transactionCount and size
        setFiles(data);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
      toast.error('שגיאה בטעינת קבצים');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDownload = (filename: string) => {
    // Trigger download
    const link = document.createElement('a');
    link.href = `/api/files/${filename}/download`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      const res = await fetch(`/api/files/${fileToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('קובץ נמחק בהצלחה');
        fetchFiles(); // Refresh list
      } else {
        toast.error('שגיאה במחיקת הקובץ');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('שגיאה במחיקת הקובץ');
    } finally {
      setFileToDelete(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ניהול נתונים</h1>
          <p className="text-sm text-muted-foreground">
            {files.length} קבצים · {files.reduce((sum, f) => sum + (f.transactionCount || 0), 0).toLocaleString('he-IL')} עסקאות
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40%] text-right">שם הקובץ</TableHead>
              <TableHead className="text-right">תאריך העלאה</TableHead>
              <TableHead className="text-right">גודל</TableHead>
              <TableHead className="text-center">עסקאות</TableHead>
              <TableHead className="text-center w-[120px]">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  לא נמצאו קבצים במערכת
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow key={file.name} className="group hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {file.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {file.lastModified ? format(new Date(file.lastModified), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">{formatSize(file.size || 0)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="tabular-nums">
                      {file.transactionCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(file.name)}
                        title="הורד קובץ"
                        className="h-8 w-8 hover:text-primary"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFileToDelete(file.name)}
                        title="מחק קובץ"
                        className="h-8 w-8 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את הקובץ <span className="font-bold text-foreground">{fileToDelete}</span> לצמיתות מהמערכת.
              הנתונים יוסרו גם מתצוגת העסקאות לאחר רענון.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
             {/* Right-aligned for RTL usually needs reverse order or specific justification */}
             <div className="flex gap-2 justify-end w-full"> 
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  מחק
                </AlertDialogAction>
             </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
