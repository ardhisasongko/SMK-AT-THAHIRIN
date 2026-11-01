export type UserRole = 'guest' | 'super_admin' | 'admin' | 'guru' | 'ketua_kelas' | 'siswa';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  nipNisn?: string;
  nik?: string;
  tanggalLahir?: string;
  classId?: string;
  jabatan?: string;
  ketuaStatus?: 'none' | 'pending' | 'approved';
  status?: 'active' | 'inactive' | 'archived';
  mustChangePassword?: boolean;
  /** Kelas yang ditugaskan ke guru (migrasi 0026). Kosong/undefined = belum dikonfigurasi = semua kelas. */
  classAssignments?: string[];
}

export interface AuthSession {
  token?: string;
  user: User;
}

export interface InputBy {
  id: string;
  name: string;
  role: string;
}

export interface PresensiLokasi {
  lat: number;
  lng: number;
  label?: string;
}

export interface Jurusan {
  id: string;
  code: string;
  name: string;
  iconName: string;
  description: string;
  kepalaJurusan: string;
  prospekKerja: string[];
  fasilitas: string[];
  color: string;
}

export interface ScheduleItem {
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';
  jamKe: string;
  jamRentan: string;
  mataPelajaran: string;
  guru: string;
  ruangan: string;
}

export interface Siswa {
  id: string;
  nisn: string;
  name: string;
  classId: string;
  gender: 'L' | 'P';
  foto: string;
  nik?: string;
  tanggalLahir?: string; // YYYY-MM-DD
  noHpOrangTua?: string;
}

export interface Kelas {
  id: string;
  name: string;
  jurusanCode: string;
  tingkat: 'X' | 'XI' | 'XII';
  ruang: string;
  waliKelas: string;
  jumlahSiswa: number;
  jadwal: ScheduleItem[];
}

export type PresensiStatus = 'Hadir' | 'Terlambat' | 'Sakit' | 'Izin' | 'Alpa';

export interface PresensiRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  classId: string;
  siswaId: string;
  siswaName: string;
  nisn: string;
  status: PresensiStatus;
  keterangan?: string;
  waktuInput: string; // HH:mm:ss
  inputBy?: InputBy; // audit: siapa yang menginput/mengubah
  fotoUrl?: string; // foto presensi (URL ke R2)
  lokasi?: PresensiLokasi; // tap location
}

export interface ModulAjarIdentitas {
  sekolah: string;
  mataPelajaran: string;
  jurusan: string;
  faseKelas: string;
  alokasiWaktu: string;
  tahunAjaran: string;
}

export interface ModulAjarData {
  judul: string;
  identitas: ModulAjarIdentitas;
  profilPelajarPancasila: string[];
  saranaPrasarana: string[];
  targetPesertaDidik: string;
  modelPembelajaran: string;
  komponenInti: {
    tujuanPembelajaran: string[];
    pemahamanBermakna: string;
    pertanyaanPemantik: string[];
    kegiatanPembelajaran: {
      pendahuluan: string[];
      inti: string[];
      penutup: string[];
    };
    asesmen: {
      diagnostik: string;
      formatif: string;
      sumatif: string;
    };
    pengayaanDanRemidial: string;
  };
  lampiran?: {
    lembarKerjaSiswa?: string;
    bahanBacaanGuruSiswa?: string;
    glosarium?: string[];
  };
}

export interface ModulAjar {
  id: string;
  judul: string;
  mataPelajaran: string;
  jurusan: string;
  faseKelas: string;
  alokasiWaktu: string;
  tanggalDibuat: string;
  pembuat: string;
  data: ModulAjarData;
}

export interface Berita {
  id: string;
  judul: string;
  tanggal: string;
  kategori: 'Prestasi' | 'Kegiatan' | 'Pengumuman' | 'Mitra Industri';
  ringkasan: string;
  konten: string;
  gambar: string;
  penulis: string;
}

// Forum Types
export interface ForumAttachment {
  id: string;
  name: string;
  url: string;
  size: string;
  type: string; // 'image' | 'pdf' | 'doc'
}

export interface ForumReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar: string;
  createdAt: string;
  content: string;
  attachments?: ForumAttachment[];
  likes: number;
  likedBy?: string[];
}

export interface ForumTopic {
  id: string;
  title: string;
  categoryType: 'mapel' | 'kelas';
  categoryName: string; // e.g. "Pemrograman Web" or "X RPL 1"
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar: string;
  createdAt: string;
  content: string;
  attachments?: ForumAttachment[];
  tags: string[];
  likes: number;
  likedBy?: string[];
  views: number;
  replies: ForumReply[];
  isPinned?: boolean;
  isResolved?: boolean;
}

// Notification Types
export type NotificationTargetRole = 'semua' | 'guru' | 'siswa' | 'admin';
export type NotificationCategory = 'Ujian' | 'Tugas' | 'Absensi' | 'Forum' | 'Pengumuman' | 'Sistem';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  targetRole: NotificationTargetRole;
  targetClassId?: string;
  category: NotificationCategory;
  createdAt: string;
  isRead: boolean;
  actionUrl?: string;
  senderName?: string;
  senderRole?: string;
}

// CBT (Computer Based Test) Types
export interface CbtOption {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  // Kunci asal sebelum opsi diacak per attempt; jawaban siswa selalu memakai
  // originalKey agar penilaian server konsisten. key = huruf tampilan.
  originalKey?: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface CbtQuestion {
  id: string;
  question: string;
  type?: 'pg' | 'essai';
  options: CbtOption[];
  correctAnswer?: string;
  explanation?: string;
}

export interface CbtExam {
  id: string;
  title: string;
  subject: string;
  classTarget: string; // e.g. "X MPLB 1" or "Semua Kelas MPLB"
  durationMinutes: number;
  token: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  openTime?: string;
  closeTime?: string;
  status: 'active' | 'upcoming' | 'inactive' | 'completed';
  examType?: 'latihan' | 'ujian';
  minSubmitMinutes?: number;
  questions: CbtQuestion[];
  questionCount?: number;
}

export interface CbtProctorSummary {
  tabSwitch: number;
  windowBlur: number;
  fullscreenExit: number;
}

export interface CbtSubmission {
  id: string;
  examId: string;
  siswaId: string;
  siswaName: string;
  nisn: string;
  answers: { [questionId: string]: string };
  doubtful?: { [questionId: string]: boolean };
  score: number;
  correctCount: number;
  wrongCount: number;
  submittedAt: string;
  timeSpentSeconds: number;
  // Penilaian esai manual: 'pending_grading' = skor masih sementara (PG saja),
  // 'graded' = final. pgScore = poin dari soal PG.
  gradingStatus?: 'pending_grading' | 'graded';
  pgScore?: number;
  essayScores?: { [questionId: string]: number };
  essayNotes?: { [questionId: string]: string };
  proctor?: CbtProctorSummary;
  // 'proctor' bila attempt dikumpulkan paksa oleh pengawas dari ruang kontrol.
  submittedBy?: 'student' | 'proctor';
}

// --- Ruang Kontrol Ujian (proctoring live) ---
export interface CbtMonitorAnnouncement {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface CbtMonitorStudent {
  studentId: string;
  name: string;
  nisn: string;
  className: string;
  attemptId: string | null;
  status: 'not_started' | 'in_progress' | 'submitted' | 'expired';
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  remainingSeconds: number | null;
  lastActivityAt: string | null;
  provisionalScore: number | null;
  finalScore: number | null;
  gradingStatus: 'pending_grading' | 'graded' | null;
  hasEssayPending: boolean;
  submittedBy: 'student' | 'proctor' | null;
  proctor: CbtProctorSummary;
  flagged: boolean;
}

export interface CbtMonitorData {
  exam: {
    id: string;
    title: string;
    subject: string;
    classTarget: string;
    durationMinutes: number;
    totalQuestions: number;
    essayCount: number;
    startDate: string;
    endDate: string;
    openTime: string | null;
    closeTime: string | null;
    status: string;
    examType: string;
  };
  summary: {
    totalStudents: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    expired: number;
    flagged: number;
    averageProvisionalScore: number | null;
    averageFinalScore: number | null;
  };
  students: CbtMonitorStudent[];
  announcements: CbtMonitorAnnouncement[];
  serverTime: string;
}

export interface CbtAttemptNotices {
  attemptId: string;
  status: string;
  submittedBy: 'student' | 'proctor';
  expiresAt: string;
  submittedAt: string | null;
  score: number | null;
  announcements: CbtMonitorAnnouncement[];
  serverTime: string;
}

export interface CbtBankItem {
  id: string;
  subject: string;
  topic?: string;
  type?: 'pg' | 'essai';
  question: string;
  options: CbtOption[];
  correctAnswer?: string;
  explanation?: string;
  ownerUserId?: string;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CbtGradingQueueItem {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  siswaName: string;
  nisn: string;
  submittedAt: string;
  pgScore: number;
  essayCount: number;
}

export interface CbtGradingEssay {
  questionId: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation?: string;
  maxScore: number;
  // Petunjuk kata kunci untuk guru — BUKAN nilai resmi.
  hint: { matched: number; total: number; complete: boolean; autoMatch: boolean };
  score: number | null;
  note: string;
}

export interface CbtGradingDetail {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  siswaId: string;
  siswaName: string;
  nisn: string;
  submittedAt: string;
  gradingStatus: 'pending_grading' | 'graded';
  pgScore: number;
  score: number;
  pointPerQuestion: number;
  essays: CbtGradingEssay[];
}

export interface CbtAttemptReview {
  exam?: CbtExam;
  submission: CbtSubmission;
  // Terisi 'waiting_all_students' selama pembahasan masih terkunci karena
  // belum semua peserta menyelesaikan ujian (exam tidak dikirim server).
  reviewLocked?: string;
}

export interface CbtAttempt {
  attemptId: string;
  startedAt: string;
  expiresAt: string;
  savedAnswers: { [questionId: string]: string };
  savedDoubtful: { [questionId: string]: boolean };
  exam: CbtExam;
}

export interface CbtSummary {
  siswaId: string;
  siswaName: string;
  nisn: string;
  examCount: number;
  avgScore: number;
  bestScore: number;
  worstScore: number;
  pendingCount?: number;
}

export interface CbtAnalyticsFlag {
  attemptId: string;
  studentName: string;
  nisn: string;
  score: number;
  timeSpentSeconds: number;
  submittedAt: string | null;
  suspicious: boolean;
  tabSwitchCount?: number;
  windowBlurCount?: number;
  fullscreenExitCount?: number;
  manySwitches?: boolean;
}

export interface CbtAnalyticsExam {
  examId: string;
  title: string;
  subject: string;
  classTarget: string;
  examType: string;
  durationMinutes: number;
  studentCount: number;
  avgScore: number;
  bestScore: number | null;
  worstScore: number | null;
  buckets: { label: string; count: number }[];
  fastAttempts: CbtAnalyticsFlag[];
  proctorFlags?: CbtAnalyticsFlag[];
  pendingGradingCount?: number;
}

export interface CbtAnalytics {
  exams: CbtAnalyticsExam[];
  fastRatio: number;
  suspiciousScore: number;
  manySwitches?: number;
}

export interface CbtBulkSubject {
  name: string;
  teacher: string;
}

export interface CbtBulkPayload {
  title: string;
  startDate: string;
  subjects: CbtBulkSubject[];
  classTarget: string;
  durationMinutes: number;
  openTime: string;
  sessionGapMinutes: number;
}

export interface CbtBulkExamResult {
  id: string;
  date: string;
  day: string;
  subject: string;
  openTime: string;
  closeTime: string;
  token: string;
  startDate: string;
}

export interface CbtBulkResult {
  title: string;
  exams: CbtBulkExamResult[];
}

export interface RaporPresensiItem {
  status: string;
  jumlah: number;
}

export interface RaporCbtMapel {
  subject: string;
  examCount: number;
  avgScore: number;
  bestScore: number;
}

export interface RaporUjian {
  title: string;
  subject: string;
  examType: string;
  score: number;
  submittedAt: string;
}

export interface RaporReport {
  siswa: { nisn: string; name: string; classId: string; className: string };
  presensi: { rincian: RaporPresensiItem[]; total: number; hadirPersen: number };
  cbt: { perMapel: RaporCbtMapel[]; totalUjian: number; rataRata: number };
  ujian: RaporUjian[];
}
