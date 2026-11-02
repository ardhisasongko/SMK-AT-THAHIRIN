vi.mock('../src/components/ui/toast', () => ({ showToast: vi.fn() }));
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { showToast } from '../src/components/ui/toast';
import { CbtTestRunner } from '../src/components/cbt/CbtTestRunner';
import type { CbtExam, User } from '../src/types';

const fetchMock = vi.fn();
let noticesData: Record<string, unknown> = {};

function okJson(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.mocked(showToast).mockClear();
  noticesData = { attemptId: 'a1', status: 'in_progress', submittedBy: 'student', expiresAt: '', submittedAt: null, score: null, announcements: [], serverTime: '' };
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/notices')) return okJson(noticesData);
    return okJson({ attemptId: 'a1', savedAt: 'x', accepted: 0 });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const exam: CbtExam = {
  id: 'c1',
  title: 'Ujian Kearsipan',
  subject: 'Kearsipan Digital',
  classTarget: 'X MPLB 1',
  durationMinutes: 30,
  token: 'XXXXXX',
  teacherName: 'Bpk. Guru',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
  questions: [
    { id: 'q1', question: 'Pertanyaan pertama?', options: [{ key: 'A', text: 'Pilihan A' }, { key: 'B', text: 'Pilihan B' }], correctAnswer: 'A', explanation: 'Karena A.' },
    { id: 'q2', question: 'Pertanyaan kedua?', options: [{ key: 'A', text: 'Pilihan A2' }, { key: 'B', text: 'Pilihan B2' }], correctAnswer: 'B', explanation: 'Karena B.' },
  ],
};

const user: User = {
  id: 'u3', name: 'Siswa', email: 'siswa@test.id', role: 'siswa',
} as User;

const baseExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

function renderRunner(onFinish = vi.fn(async () => undefined)) {
  return render(
    <CbtTestRunner exam={exam} currentUser={user} attemptId="a1" onFinish={onFinish} expiresAt={baseExpiresAt} />,
  );
}

async function advance(ms: number) {
  await act(async () => { vi.advanceTimersByTime(ms); });
}

describe('CbtTestRunner — kanal kendali pengawas (notices)', () => {
  it('menampilkan pengumuman pengawas sebagai banner dan bisa ditutup siswa', async () => {
    noticesData = { ...noticesData, expiresAt: baseExpiresAt, announcements: [{ id: 'ann1', authorName: 'Pak Guru', message: 'Sisa waktu 10 menit!', createdAt: '2026-11-01 08:00:00' }] };
    renderRunner();
    expect(screen.queryByText(/Sisa waktu 10 menit/)).toBeNull();
    await advance(90_000);
    expect(screen.getByText(/Sisa waktu 10 menit/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Tutup pengumuman'));
    expect(screen.queryByText(/Sisa waktu 10 menit/)).toBeNull();
  });

  it('menyesuaikan timer saat pengawas menambah waktu + pemberitahuan sopan', async () => {
    // Kadens polling kini 90 detik: tenggat baru dibuat +41 menit agar sisa
    // waktu yang tampil sesudah polling pertama (di detik ke-90) adalah 39:xx.
    const extended = new Date(Date.now() + 41 * 60_000).toISOString();
    noticesData = { ...noticesData, expiresAt: extended };
    renderRunner();
    await advance(90_000);
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(expect.stringContaining('Waktu ditambah pengawas'), 'success');
    // Timer kini mendekati 40 menit (39:xx setelah tick), bukan 29:xx.
    expect(screen.getByText(/^39:/)).toBeTruthy();
  });

  it('paksa kumpul pengawas → layar selesai yang pantas + onFinish dipanggil', async () => {
    const onFinish = vi.fn(async () => undefined);
    noticesData = { ...noticesData, status: 'submitted', submittedBy: 'proctor', score: 80, expiresAt: baseExpiresAt };
    renderRunner(onFinish);
    await advance(90_000);
    expect(screen.getByText(/Ujian Telah Dikumpulkan oleh Pengawas/)).toBeTruthy();
    expect(onFinish).toHaveBeenCalled();
  });

  it('polling notices pertama baru terjadi pada detik ke-90, bukan ke-30', async () => {
    noticesData = { ...noticesData, expiresAt: baseExpiresAt, announcements: [{ id: 'ann1', authorName: 'Pak Guru', message: 'Sisa waktu 10 menit!', createdAt: '2026-11-01 08:00:00' }] };
    renderRunner();
    const noticesCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/notices')).length;
    await advance(30_000);
    expect(noticesCalls()).toBe(0);
    expect(screen.queryByText(/Sisa waktu 10 menit/)).toBeNull();
    await advance(59_999);
    expect(noticesCalls()).toBe(0);
    await advance(1);
    expect(noticesCalls()).toBe(1);
    expect(screen.getByText(/Sisa waktu 10 menit/)).toBeTruthy();
  });
});
