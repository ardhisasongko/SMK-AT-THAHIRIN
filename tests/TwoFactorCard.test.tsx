vi.mock('react-qr-code', () => ({
  default: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value} />,
}));
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TwoFactorCard } from '../src/components/TwoFactorCard';

const OTP_AUTH_URL = 'otpauth://totp/SMK%20PLUS%20AT-THAHIRIN:guru1?secret=JBSWY3DPEHPK3PXP&issuer=SMK';
const SECRET = 'JBSWY3DPEHPK3PXP';

const fetchMock = vi.fn();
let statusData: Record<string, unknown> = {};

function okJson(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  statusData = { applicable: true, configured: true, enabled: false, recoveryCodesRemaining: 0 };
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/api/auth/2fa/status')) return okJson(statusData);
    if (String(url).includes('/api/auth/2fa/setup') && init?.method === 'POST') {
      return okJson({ secret: SECRET, otpAuthUrl: OTP_AUTH_URL });
    }
    return okJson({});
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TwoFactorCard — kode QR aktivasi 2FA', () => {
  it('tidak menampilkan QR sebelum penyiapan dimulai', async () => {
    render(<TwoFactorCard />);
    expect(await screen.findByRole('button', { name: /Siapkan Verifikasi Dua Langkah/ })).toBeInTheDocument();
    expect(screen.queryByTestId('qr-code')).toBeNull();
    expect(screen.queryByTestId('two-factor-qr')).toBeNull();
  });

  it('menampilkan QR berisi otpauth URL yang benar saat penyiapan berjalan', async () => {
    render(<TwoFactorCard />);
    fireEvent.click(await screen.findByRole('button', { name: /Siapkan Verifikasi Dua Langkah/ }));

    const qr = await screen.findByTestId('qr-code');
    expect(qr).toBeInTheDocument();
    expect(qr).toHaveAttribute('data-value', OTP_AUTH_URL);
    expect(screen.getByTestId('two-factor-qr')).toBeInTheDocument();
    // Kunci rahasia manual tetap tampil sebagai cadangan di bawah QR.
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(screen.getByText(/Pindai kode QR berikut/)).toBeInTheDocument();
  });

  it('tidak menampilkan QR saat 2FA sudah aktif', async () => {
    statusData = { applicable: true, configured: true, enabled: true, recoveryCodesRemaining: 7 };
    render(<TwoFactorCard />);
    expect(await screen.findByText(/Verifikasi dua langkah aktif/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('qr-code')).toBeNull());
    expect(screen.queryByTestId('two-factor-qr')).toBeNull();
  });
});
