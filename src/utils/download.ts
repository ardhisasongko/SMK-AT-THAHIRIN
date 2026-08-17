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