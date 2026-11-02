import { authHeaders } from './auth';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Pola awalan formula spreadsheet — pasangan neutralizeCsvFormula di download.ts. */
const FORMULA_START = /^[ \t]*[=+\-@]/;

function saveBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

/**
 * Bangun berkas .xlsx dari baris data (baris pertama = header). Library
 * `xlsx` dimuat DINAMIS (import()) agar masuk chunk terpisah dan hanya
 * diunduh browser saat pengguna benar-benar menekan tombol ekspor Excel.
 *
 * Sel teks berawalan =, +, -, @ dipaksa menjadi sel string murni (tanpa
 * elemen formula) — pasangan sanitizeXlsxSheet di functions/_lib/xlsx.ts.
 * Lebar kolom dihitung dari teks terpanjang (dibatasi 10–42). SheetJS
 * Community Edition tidak menulis gaya font/freeze pane; jangan berpura-pura.
 */
export async function buildXlsxBytes(sheetName: string, rows: Array<Array<unknown>>): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      if (typeof value !== 'string' || !FORMULA_START.test(value)) return;
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[address] as import('xlsx').CellObject | undefined;
      if (!cell) return;
      cell.t = 's';
      cell.v = value;
      delete cell.f;
    });
  });
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const widths: import('xlsx').ColInfo[] = [];
  for (let c = 0; c < columnCount; c++) {
    let longest = 10;
    for (const row of rows) {
      const value = row[c];
      if (value == null) continue;
      longest = Math.max(longest, String(value).length + 2);
    }
    widths.push({ wch: Math.min(42, longest) });
  }
  worksheet['!cols'] = widths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(output);
}

/** Unduh .xlsx yang dibangun di klien dari baris data yang sudah ada di memori. */
export async function downloadXlsx(sheetName: string, rows: Array<Array<unknown>>, filename: string): Promise<void> {
  const bytes = await buildXlsxBytes(sheetName, rows);
  saveBlob(new Blob([bytes.buffer as ArrayBuffer], { type: XLSX_MIME }), filename);
}

/** Unduh .xlsx dari endpoint server (pasangan downloadCsv di download.ts). */
export async function downloadXlsxFromUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    let message = 'Gagal mengunduh.';
    try {
      const json = await response.json() as { error?: string };
      if (json.error) message = json.error;
    } catch { /* body bukan JSON */ }
    throw new Error(message);
  }
  saveBlob(await response.blob(), filename);
}
