import React, { useState } from 'react';
import { Key, Play } from 'lucide-react';
import { CbtExam } from '../../types';
import { Modal } from '../ui/Modal';

interface CbtTokenModalProps {
  exam: CbtExam;
  onClose: () => void;
  onStart: (token: string) => void | Promise<void>;
}

export function CbtTokenModal({ exam, onClose, onStart }: CbtTokenModalProps) {
  const [inputToken, setInputToken] = useState<string>('');
  const [tokenError, setTokenError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerifyTokenAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTokenError('');
    try {
      await onStart(inputToken.trim().toUpperCase());
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Token ujian tidak valid.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
          <Key className="w-5 h-5" />
          <span>Konfirmasi Token Ujian CBT</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-lg font-bold"
        >
          ✕
        </button>
      </div>

        <div>
          <h3 className="font-extrabold text-base text-slate-900">{exam.title}</h3>
          <p className="text-xs text-slate-500 mt-1">
            Masukkan Token Ujian yang diberikan oleh pengawas atau guru mata pelajaran untuk memulai timer.
          </p>
        </div>

        <form onSubmit={handleVerifyTokenAndStart} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">TOKEN UJIAN</label>
            <input
              type="text"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Masukkan 6 Digit Token"
              className="w-full p-3 uppercase font-mono font-extrabold text-lg tracking-widest text-center bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
            {tokenError && <p className="text-xs text-rose-600 font-semibold mt-1">{tokenError}</p>}
          </div>

          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">Ketentuan Ujian:</p>
            <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
              <li>Durasi: <strong>{exam.durationMinutes} Menit</strong></li>
              <li>Total: <strong>{exam.questionCount ?? exam.questions.length} Soal Pilihan Ganda</strong></li>
              <li>Timer berjalan saat Anda menekan tombol Mulai.</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{submitting ? 'Memverifikasi...' : 'Mulai Ujian Sekarang'}</span>
          </button>
        </form>
    </Modal>
  );
}
