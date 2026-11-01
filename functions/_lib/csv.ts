/**
 * Netralkan formula injection CSV: sel TEKS yang diawali (setelah spasi/tab
 * opsional) dengan =, +, -, atau @ akan ditafsirkan spreadsheet sebagai
 * formula. Awali dengan apostrof agar selalu dibaca sebagai teks.
 * Nilai non-string (angka) tidak disentuh — spreadsheet tidak menafsirkan
 * sel numerik sebagai formula.
 */
export function neutralizeCsvFormula(text: string): string {
  return /^[ \t]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const text = typeof value === 'string' ? neutralizeCsvFormula(raw) : raw;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}