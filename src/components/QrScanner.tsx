import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Pemindai QR sungguhan memakai kamera perangkat (getUserMedia) + decoder
 * jsQR yang DIMUAT DINAMIS hanya saat kamera mulai diaktifkan — bundle awal
 * tidak membengkak dan tab lain tidak membayar biaya decoder.
 *
 * Setelah satu payload terbaca, kamera berhenti dan `onPayload` dipanggil
 * sekali — jeda alami ini mencegah pencatatan dobel dari kartu yang sama.
 * Izin ditolak / kamera tidak ada → keadaan sopan dengan petunjuk memakai
 * input NISN manual (yang selalu tersedia di sebelah komponen ini).
 */

interface QrScannerProps {
  onPayload: (payload: string) => void;
  disabled?: boolean;
}

type ScannerState = 'idle' | 'starting' | 'scanning' | 'found' | 'denied' | 'unavailable' | 'error';

export const QrScanner: React.FC<QrScannerProps> = ({ onPayload, disabled }) => {
  const [state, setState] = useState<ScannerState>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    if (disabled || state === 'starting' || state === 'scanning') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (error) {
      setState(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'error');
      return;
    }
    streamRef.current = stream;

    const jsQR = (await import('jsqr')).default;
    const video = videoRef.current;
    if (!video) {
      stopCamera();
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      stopCamera();
      setState('error');
      return;
    }
    setState('scanning');

    const tick = () => {
      const canvas = canvasRef.current;
      const currentVideo = videoRef.current;
      if (!canvas || !currentVideo) return;
      if (currentVideo.readyState === currentVideo.HAVE_ENOUGH_DATA) {
        canvas.width = currentVideo.videoWidth;
        canvas.height = currentVideo.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data) {
            stopCamera();
            setState('found');
            onPayloadRef.current(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const scanning = state === 'starting' || state === 'scanning';

  return (
    <div className="space-y-3" data-testid="qr-scanner">
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        <video
          ref={videoRef}
          className={`block w-full ${scanning ? 'aspect-[4/3]' : 'hidden'}`}
          muted
          playsInline
        />
        {!scanning && (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-6 text-center">
            {state === 'found'
              ? <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              : <CameraOff className="h-10 w-10 text-slate-500" />}
            <p className="text-xs font-semibold text-slate-300">
              {state === 'found'
                ? 'Kode QR terbaca. Kamera berhenti — aktifkan lagi untuk memindai kartu berikutnya.'
                : 'Kamera belum aktif.'}
            </p>
          </div>
        )}
        {scanning && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-900/70 px-3 py-2 text-center text-[11px] font-bold text-white">
            Arahkan kartu QR siswa ke kamera…
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        onClick={() => void startCamera()}
        disabled={disabled || scanning}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'starting'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Camera className="h-4 w-4" />}
        <span>{state === 'found' ? 'Aktifkan Kamera Lagi' : 'Aktifkan Kamera'}</span>
      </button>

      {state === 'denied' && (
        <p className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-700">
          Izin kamera ditolak. Izinkan akses kamera pada pengaturan peramban untuk perangkat ini,
          atau gunakan input NISN manual di bawah — presensi tetap dapat dicatat.
        </p>
      )}
      {state === 'unavailable' && (
        <p className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
          Perangkat ini tidak menyediakan kamera yang dapat diakses peramban. Gunakan input NISN
          manual di bawah atau alat pemindai USB (hasil pindainya diketik otomatis ke kolom NISN).
        </p>
      )}
      {state === 'error' && (
        <p className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-700">
          Kamera tidak dapat dijalankan di perangkat ini. Gunakan input NISN manual di bawah —
          presensi tetap dapat dicatat.
        </p>
      )}
    </div>
  );
};
