import * as XLSX from 'xlsx';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Sel teks yang diawali (setelah spasi/tab opsional) dengan =, +, -, atau @
 * berisiko ditafsirkan ulang sebagai formula saat berkas xlsx dibuka/diimpor
 * ulang. Pola yang sama dengan netralisasi CSV di functions/_lib/csv.ts.
 */
const FORMULA_START = /^[ \t]*[=+\-@]/;

/**
 * Paksa sel teks berawalan formula menjadi sel STRING murni: tipe 's',
 * nilai teks persis seperti data asal, tanpa elemen formula (f). Dengan
 * begitu Excel/LibreOffice menampilkannya sebagai teks — bukan menghitungnya.
 * Nilai non-string (angka/boolean) tidak disentuh.
 */
export function sanitizeXlsxSheet(worksheet: XLSX.WorkSheet, rows: Array<Array<unknown>>): void {
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      if (typeof value !== 'string' || !FORMULA_START.test(value)) return;
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[address] as XLSX.CellObject | undefined;
      if (!cell) return;
      cell.t = 's';
      cell.v = value;
      delete cell.f;
    });
  });
}

/** Lebar kolom wajar per kolom: panjang teks terpanjang + margin, dibatasi 10–42. */
export function xlsxColumnWidths(rows: Array<Array<unknown>>): XLSX.ColInfo[] {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const widths: XLSX.ColInfo[] = [];
  for (let c = 0; c < columnCount; c++) {
    let longest = 10;
    for (const row of rows) {
      const value = row[c];
      if (value == null) continue;
      longest = Math.max(longest, String(value).length + 2);
    }
    widths.push({ wch: Math.min(42, longest) });
  }
  return widths;
}

/**
 * Bangun berkas .xlsx (satu sheet) dari baris data yang sama dengan ekspor
 * CSV. Catatan kemampuan SheetJS Community Edition: lebar kolom dan nama
 * sheet ditulis apa adanya, tetapi gaya font (header tebal) dan freeze pane
 * TIDAK didukung penulis CE — jangan tambahkan styling semu di sini.
 */
export function buildXlsx(sheetName: string, rows: Array<Array<unknown>>): Uint8Array {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  sanitizeXlsxSheet(worksheet, rows);
  worksheet['!cols'] = xlsxColumnWidths(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(output);
}

export function xlsxResponse(data: Uint8Array, filename: string): Response {
  return new Response(data, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
