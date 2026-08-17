import React, { useState } from 'react';
import { AlertTriangle, BarChart3, Clock3, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import type { CbtAnalytics, CbtAnalyticsExam } from '../../types';

interface CbtAnalyticsProps {
  analytics: CbtAnalytics | null;
  loading: boolean;
}

function formatMinutes(seconds: number): string {
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes} mnt ${rest} dtk` : `${minutes} mnt`;
}

function ExamAnalyticsCard({ exam, fastRatio, suspiciousScore, key }: { key: string; exam: CbtAnalyticsExam; fastRatio: number; suspiciousScore: number }) {
  const [showFlags, setShowFlags] = useState(false);
  const maxBucket = Math.max(1, ...exam.buckets.map(bucket => bucket.count));
  const hasFlags = exam.fastAttempts.length > 0;
  const suspiciousCount = exam.fastAttempts.filter(flag => flag.suspicious).length;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
              {exam.subject}
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${exam.examType === 'ujian' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
              {exam.examType === 'ujian' ? 'Ujian Resmi' : 'Latihan'}
            </span>
            <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Users className="w-3 h-3" />
              {exam.studentCount} siswa
            </span>
          </div>
          <h3 className="font-extrabold text-base text-slate-900 leading-snug break-words">{exam.title}</h3>
        </div>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
          Durasi {exam.durationMinutes} mnt
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> Rata-rata
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{exam.studentCount ? exam.avgScore : '–'}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 uppercase">
            <TrendingUp className="w-3 h-3" /> Terbaik
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">{exam.bestScore ?? '–'}</div>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-600 uppercase">
            <TrendingDown className="w-3 h-3" /> Terendah
          </div>
          <div className="text-xl font-extrabold text-rose-600 mt-1">{exam.worstScore ?? '–'}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 uppercase">Distribusi Nilai</div>
        <div className="flex items-end gap-2 h-24">
          {exam.buckets.map(bucket => (
            <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1" title={`${bucket.label}: ${bucket.count} siswa`}>
              <span className="text-[10px] font-bold text-slate-600">{bucket.count}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-emerald-700 to-emerald-400 min-h-[4px]"
                style={{ height: `${Math.max(4, Math.round((bucket.count / maxBucket) * 72))}px` }}
              />
              <span className="text-[9px] font-bold text-slate-400">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>

      {hasFlags && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowFlags(!showFlags)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {exam.fastAttempts.length} pengerjaan cepat (≤{Math.round(fastRatio * 100)}% durasi)
            </span>
            <span className="flex items-center gap-1.5">
              {suspiciousCount > 0 && (
                <span className="flex items-center gap-1 rounded-lg bg-rose-100 text-rose-700 px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3" /> {suspiciousCount} mencurigakan
                </span>
              )}
              <span>{showFlags ? 'Tutup' : 'Lihat'}</span>
            </span>
          </button>

          {showFlags && (
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Siswa</th>
                    <th className="py-2.5 px-3">NISN</th>
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Nilai</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {exam.fastAttempts.map(flag => (
                    <tr key={flag.attemptId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{flag.studentName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{flag.nisn}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock3 className="w-3 h-3 text-slate-400" />
                          {formatMinutes(flag.timeSpentSeconds)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold">{flag.score}</td>
                      <td className="py-2.5 px-3">
                        {flag.suspicious ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-700">
                            <AlertTriangle className="w-3 h-3" />
                            Cepat & nilai ≥ {suspiciousScore}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700">Cepat</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CbtAnalytics({ analytics, loading }: CbtAnalyticsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-sm text-center text-sm text-slate-500">
        Memuat analitik…
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-sm text-center text-sm text-slate-500">
        Belum ada data hasil ujian untuk dianalisis.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <span>Analitik Hasil Ujian</span>
        </h3>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
          Deteksi: pengerjaan ≤{Math.round(analytics.fastRatio * 100)}% durasi; mencurigakan bila nilai ≥ {analytics.suspiciousScore}
        </span>
      </div>

      {analytics.exams.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-sm text-center text-sm text-slate-500">
          Belum ada ujian dengan attempt yang dikumpulkan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {analytics.exams.map(exam => (
            <ExamAnalyticsCard key={exam.examId} exam={exam} fastRatio={analytics.fastRatio} suspiciousScore={analytics.suspiciousScore} />
          ))}
        </div>
      )}
    </div>
  );
}