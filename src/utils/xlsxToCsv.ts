import * as XLSX from 'xlsx';

export async function xlsxFileToCsvFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);

  const newName = file.name.replace(/\.xlsx?$/i, '.csv');
  return new File([csv], newName, { type: 'text/csv' });
}

export async function normalizeUploadedFiles(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (f) => {
      if (/\.xlsx?$/i.test(f.name)) {
        return xlsxFileToCsvFile(f);
      }
      return f;
    })
  );
}
