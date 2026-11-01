import { authHeaders } from './auth';

export async function downloadCsv(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    let message = 'Gagal mengunduh.';
    try {
      const json = await response.json() as { error?: string };
      if (json.error) message = json.error;
    } catch { /* body bukan JSON */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
/**
 * Netralkan formula injection CSV: sel TEKS yang diawali (setelah spasi/tab
 * opsional) dengan =, +, -, atau @ ditafsirkan spreadsheet sebagai formula.
 * Awali apostrof agar dibaca sebagai teks. Nilai non-string tidak disentuh.
 */
export function neutralizeCsvFormula(text: string): string {
  return /^[ \t]*[=+\-@]/.test(text) ? `'${text}` : text;
}

/** Escape satu sel CSV (netralisasi formula + kutip RFC 4180 dasar). */
export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const text = typeof value === 'string' ? neutralizeCsvFormula(raw) : raw;
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Bangun string CSV dengan escaping kutip/koma/baris baru (RFC 4180 dasar). */
export function buildCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(header => escapeCsvCell(row[header])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

/** Unduh teks sebagai file (default CSV dengan BOM agar Excel ramah). */
export function downloadTextFile(content: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
