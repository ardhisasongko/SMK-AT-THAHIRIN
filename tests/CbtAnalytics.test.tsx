import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CbtAnalytics } from '../src/components/cbt/CbtAnalytics';
import type { CbtAnalytics as CbtAnalyticsType } from '../src/types';

const analytics: CbtAnalyticsType = {
  fastRatio: 0.25,
  suspiciousScore: 75,
  exams: [
    {
      examId: 'e1',
      title: 'UAS Kearsipan',
      subject: 'Kearsipan',
      classTarget: 'X MPLB 1',
      examType: 'ujian',
      durationMinutes: 60,
      studentCount: 2,
      avgScore: 80,
      bestScore: 100,
      worstScore: 60,
      buckets: [
        { label: '0–49', count: 0 },
        { label: '50–59', count: 0 },
        { label: '60–69', count: 1 },
        { label: '70–79', count: 0 },
        { label: '80–89', count: 0 },
        { label: '90–100', count: 1 },
      ],
      fastAttempts: [
        { attemptId: 'a1', studentName: 'Siti', nisn: '001', score: 100, timeSpentSeconds: 300, submittedAt: null, suspicious: true },
      ],
    },
  ],
};

describe('CbtAnalytics', () => {
  it('menampilkan kartu statistik per ujian', () => {
    render(<CbtAnalytics analytics={analytics} loading={false} />);
    expect(screen.getByText('Analitik Hasil Ujian')).toBeInTheDocument();
    expect(screen.getByText('UAS Kearsipan')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('Distribusi Nilai')).toBeInTheDocument();
  });

  it('menampilkan deteksi pengerjaan cepat dan ekspansi detail', () => {
    render(<CbtAnalytics analytics={analytics} loading={false} />);
    expect(screen.getByText(/1 pengerjaan cepat/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1 pengerjaan cepat/ }));
    expect(screen.getByText('Siti')).toBeInTheDocument();
    expect(screen.getByText('5 mnt')).toBeInTheDocument();
    expect(screen.getByText('Cepat & nilai ≥ 75')).toBeInTheDocument();
  });

  it('menampilkan empty state tanpa data', () => {
    render(<CbtAnalytics analytics={null} loading={false} />);
    expect(screen.getByText('Belum ada data hasil ujian untuk dianalisis.')).toBeInTheDocument();
  });

  it('menampilkan indikator loading', () => {
    render(<CbtAnalytics analytics={null} loading={true} />);
    expect(screen.getByText('Memuat analitik…')).toBeInTheDocument();
  });
});