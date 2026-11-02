// Komponen absensi QR Model A: pemindai kamera (keadaan fallback),
// Kartu QR Saya di Profil, dan lembar cetak kartu massal.
// Decoder jsQR tidak dijalankan di jsdom — yang diuji adalah keadaan
// izin ditolak / kamera tidak tersedia dan render QR dari payload server.

vi.mock('react-qr-code', () => ({
  default: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value} />,
}));
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QrScanner } from '../src/components/QrScanner';
import { QrCardSaya } from '../src/components/QrCardSaya';
import { QrCardPrintSheet } from '../src/components/QrCardPrintSheet';

const PAYLOAD = 'SMKQR1:0000000001:abcdefghijklmnopqrstuv';

const fetchMock = vi.fn();

function okJson(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Bersihkan stub mediaDevices antar test.
  Object.defineProperty(window.navigator, 'mediaDevices', { value: undefined, configurable: true });
});

describe('QrScanner — fallback kamera', () => {
  it('kamera tidak tersedia: pesan sopan + petunjuk input manual', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', { value: undefined, configurable: true });
    render(<QrScanner onPayload={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Aktifkan Kamera/ }));
    expect(await screen.findByText(/tidak menyediakan kamera/i)).toBeInTheDocument();
    expect(screen.getByText(/input NISN manual/i)).toBeInTheDocument();
  });

  it('izin kamera ditolak: pesan sopan + fallback manual tetap ditawarkan', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        }),
      },
      configurable: true,
    });
    render(<QrScanner onPayload={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Aktifkan Kamera/ }));
    expect(await screen.findByText(/Izin kamera ditolak/i)).toBeInTheDocument();
    expect(screen.getByText(/input NISN manual di bawah/i)).toBeInTheDocument();
  });

  it('keadaan dinonaktifkan: tombol kamera tidak dapat ditekan', () => {
    render(<QrScanner onPayload={() => undefined} disabled />);
    expect(screen.getByRole('button', { name: /Aktifkan Kamera/ })).toBeDisabled();
  });
});

describe('QrCardSaya — kartu QR milik siswa', () => {
  it('terkonfigurasi: QR berisi payload server + identitas siswa tampil', async () => {
    fetchMock.mockImplementation(async () => okJson({
      configured: true, payload: PAYLOAD, nisn: '0000000001', name: 'Siswa Satu', className: 'X MPLB 1',
    }));
    render(<QrCardSaya />);
    const qr = await screen.findByTestId('qr-code');
    expect(qr).toHaveAttribute('data-value', PAYLOAD);
    expect(screen.getByText('Siswa Satu')).toBeInTheDocument();
    expect(screen.getByText(/Tunjukkan kartu ini kepada guru/)).toBeInTheDocument();
  });

  it('belum terkonfigurasi: pemberitahuan sopan, tanpa QR rusak', async () => {
    fetchMock.mockImplementation(async () => okJson({
      configured: false, nisn: '0000000001', name: 'Siswa Satu', className: 'X MPLB 1',
    }));
    render(<QrCardSaya />);
    expect(await screen.findByText(/belum dikonfigurasi oleh administrator/i)).toBeInTheDocument();
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });
});

describe('QrCardPrintSheet — lembar cetak kartu massal', () => {
  it('merender grid kartu berisi nama, NISN, dan QR per siswa', () => {
    const cards = [
      { nisn: '0000000001', name: 'Siswa Satu', payload: PAYLOAD },
      { nisn: '0000000002', name: 'Siswa Dua', payload: 'SMKQR1:0000000002:abcdefghijklmnopqrstuv' },
    ];
    const { container } = render(<QrCardPrintSheet className="X MPLB 1" cards={cards} />);
    expect(screen.getByTestId('qr-card-print-sheet')).toBeInTheDocument();
    expect(container.querySelector('.qr-card-print-sheet')).not.toBeNull();
    expect(screen.getByText('Siswa Satu')).toBeInTheDocument();
    expect(screen.getByText('Siswa Dua')).toBeInTheDocument();
    expect(screen.getByText('0000000002')).toBeInTheDocument();
    const qrs = screen.getAllByTestId('qr-code');
    expect(qrs).toHaveLength(2);
    expect(qrs[0]).toHaveAttribute('data-value', PAYLOAD);
  });
});
