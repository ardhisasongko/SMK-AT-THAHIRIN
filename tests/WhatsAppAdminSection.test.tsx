import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppAdminSection } from '../src/components/WhatsAppAdminSection';

describe('WhatsAppAdminSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows an API error instead of silently rendering empty data', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/history')) return new Response(JSON.stringify({ success: false, error: 'Riwayat tidak dapat dimuat.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, data: [], stats: [] }), { headers: { 'Content-Type': 'application/json' } });
    }));

    render(<WhatsAppAdminSection currentUser={{ id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'admin', avatar: '' }} />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Riwayat tidak dapat dimuat.'));
    expect(screen.queryByText('Kontak wali berhasil disimpan.')).not.toBeInTheDocument();
  }, 30_000);
});
