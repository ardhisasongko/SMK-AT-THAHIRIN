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
}

export interface AuthSession {
  token: string;
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
  isReadBy: string[]; // List of user IDs who read it
  actionUrl?: string;
  senderName?: string;
  senderRole?: string;
  isEmailSent?: boolean;
}

// CBT (Computer Based Test) Types
export interface CbtOption {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
}

export interface CbtQuestion {
  id: string;
  question: string;
  options: CbtOption[];
  correctAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
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
  status: 'active' | 'upcoming' | 'completed';
  questions: CbtQuestion[];
  questionCount?: number;
}

export interface CbtSubmission {
  id: string;
  examId: string;
  siswaId: string;
  siswaName: string;
  nisn: string;
  answers: { [questionId: string]: 'A' | 'B' | 'C' | 'D' | 'E' };
  doubtful?: { [questionId: string]: boolean };
  score: number;
  correctCount: number;
  wrongCount: number;
  submittedAt: string;
  timeSpentSeconds: number;
}
