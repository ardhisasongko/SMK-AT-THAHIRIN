import { Kelas, Siswa, PresensiRecord, ModulAjar, ForumTopic, NotificationItem, CbtExam, CbtSubmission } from '../types';

export { SCHOOL_INFO, INITIAL_USERS, JURUSAN_LIST, BERITA_LIST } from './schoolConfig';

export const INITIAL_KELAS: Kelas[] = [
  {
    id: 'k1',
    name: 'X MPLB 1',
    jurusanCode: 'MPLB',
    tingkat: 'X',
    ruang: 'Gedung A - R.101',
    waliKelas: 'Ibu Nurul Faizah Ulfah',
    jumlahSiswa: 32,
    jadwal: [
      { hari: 'Senin', jamKe: '1 - 3', jamRentan: '07.00 - 09.15', mataPelajaran: 'Otomatisasi Tata Kelola Kearsipan Digital', guru: 'Ahmad Fauzi, S.Pd.', ruangan: 'Lab MPLB 1' },
      { hari: 'Senin', jamKe: '4 - 6', jamRentan: '09.30 - 11.45', mataPelajaran: 'Pendidikan Agama Islam', guru: 'Drs. Usman Hidayat', ruangan: 'R.101' },
      { hari: 'Selasa', jamKe: '1 - 4', jamRentan: '07.00 - 10.00', mataPelajaran: 'Teknologi Perkantoran & Aplikasi Perkantoran', guru: 'Dra. Hj. Sri Wahyuni, M.Pd.', ruangan: 'Lab Komputer' },
      { hari: 'Selasa', jamKe: '5 - 7', jamRentan: '10.15 - 12.30', mataPelajaran: 'Bahasa Indonesia & Korespondensi Bisnis', guru: 'Nurbaiti, M.Pd.', ruangan: 'R.101' },
      { hari: 'Rabu', jamKe: '1 - 4', jamRentan: '07.00 - 10.00', mataPelajaran: 'Komunikasi Humas & Keprotokolan', guru: 'Ahmad Fauzi, S.Pd.', ruangan: 'R.101' },
      { hari: 'Kamis', jamKe: '1 - 3', jamRentan: '07.00 - 09.15', mataPelajaran: 'Bahasa Inggris Perkantoran', guru: 'Sarah Wijaya, S.Pd.', ruangan: 'R.101' },
      { hari: 'Jumat', jamKe: '1 - 3', jamRentan: '07.00 - 09.15', mataPelajaran: 'Otomatisasi Tata Kelola Keuangan', guru: 'Hardi, M.H.', ruangan: 'R.101' }
    ]
  },
  {
    id: 'k2',
    name: 'XI MPLB 1',
    jurusanCode: 'MPLB',
    tingkat: 'XI',
    ruang: 'Gedung B - R.201',
    waliKelas: 'Bpk Fahri Sujana',
    jumlahSiswa: 30,
    jadwal: [
      { hari: 'Senin', jamKe: '1 - 4', jamRentan: '07.00 - 10.00', mataPelajaran: 'Otomatisasi Tata Kelola Kepegawaian', guru: 'Sri Wahyuni, M.Pd.', ruangan: 'Lab MPLB 2' },
      { hari: 'Selasa', jamKe: '1 - 3', jamRentan: '07.00 - 09.15', mataPelajaran: 'Manajemen Kearsipan Elektronik', guru: 'Ahmad Fauzi, S.Pd.', ruangan: 'Lab MPLB 1' }
    ]
  },
  {
    id: 'k3',
    name: 'XII MPLB 1',
    jurusanCode: 'MPLB',
    tingkat: 'XII',
    ruang: 'Gedung C - R.301',
    waliKelas: 'Bpk Rudiyatno',
    jumlahSiswa: 28,
    jadwal: [
      { hari: 'Senin', jamKe: '1 - 6', jamRentan: '07.00 - 11.45', mataPelajaran: 'Praktik Simulasi Perkantoran & Public Relations', guru: 'Ir. Surantro', ruangan: 'Lab Simulator Perkantoran' }
    ]
  }
];

export const INITIAL_SISWA: Siswa[] = [
  { id: 's1', nisn: '0068123491', name: 'Muhammad Rizky Pratama', classId: 'k1', gender: 'L', foto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887711' },
  { id: 's2', nisn: '0068123492', name: 'Adinda Putri Maharani', classId: 'k1', gender: 'P', foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887722' },
  { id: 's3', nisn: '0068123493', name: 'Bagas Aditya Nugroho', classId: 'k1', gender: 'L', foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887733' },
  { id: 's4', nisn: '0068123494', name: 'Cantika Aulia Zahra', classId: 'k1', gender: 'P', foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887744' },
  { id: 's5', nisn: '0068123495', name: 'Daffa Ahmad Raihan', classId: 'k1', gender: 'L', foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887755' },
  { id: 's6', nisn: '0068123496', name: 'Elsa Febriani', classId: 'k1', gender: 'P', foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887766' },
  { id: 's7', nisn: '0068123497', name: 'Fikri Haikal', classId: 'k1', gender: 'L', foto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887777' },
  { id: 's8', nisn: '0068123498', name: 'Gita Nabila Syifa', classId: 'k1', gender: 'P', foto: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887788' },
  { id: 's9', nisn: '0068123501', name: 'Siti Nurhaliza', classId: 'k2', gender: 'P', foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', noHpOrangTua: '081299887799' }
];

export const INITIAL_PRESENSI: PresensiRecord[] = [
  { id: 'p1', tanggal: '2026-08-03', classId: 'k1', siswaId: 's1', siswaName: 'Muhammad Rizky Pratama', nisn: '0068123491', status: 'Hadir', waktuInput: '06:55:12' },
  { id: 'p2', tanggal: '2026-08-03', classId: 'k1', siswaId: 's2', siswaName: 'Adinda Putri Maharani', nisn: '0068123492', status: 'Hadir', waktuInput: '07:01:05' },
  { id: 'p3', tanggal: '2026-08-03', classId: 'k1', siswaId: 's3', siswaName: 'Bagas Aditya Nugroho', nisn: '0068123493', status: 'Sakit', keterangan: 'Demam tinggi (Surat dokter terlampir)', waktuInput: '07:15:00' },
  { id: 'p4', tanggal: '2026-08-03', classId: 'k1', siswaId: 's4', siswaName: 'Cantika Aulia Zahra', nisn: '0068123494', status: 'Hadir', waktuInput: '06:48:30' },
  { id: 'p5', tanggal: '2026-08-03', classId: 'k1', siswaId: 's5', siswaName: 'Daffa Ahmad Raihan', nisn: '0068123495', status: 'Izin', keterangan: 'Mendampingi lomba Pramuka tingkat Kabupaten', waktuInput: '07:00:00' },
  { id: 'p6', tanggal: '2026-08-03', classId: 'k1', siswaId: 's6', siswaName: 'Elsa Febriani', nisn: '0068123496', status: 'Hadir', waktuInput: '06:58:19' },
  { id: 'p7', tanggal: '2026-08-03', classId: 'k1', siswaId: 's7', siswaName: 'Fikri Haikal', nisn: '0068123497', status: 'Alpa', keterangan: 'Tanpa keterangan', waktuInput: '07:30:00' },
  { id: 'p8', tanggal: '2026-08-03', classId: 'k1', siswaId: 's8', siswaName: 'Gita Nabila Syifa', nisn: '0068123498', status: 'Hadir', waktuInput: '06:52:44' }
];

export const INITIAL_MODUL_AJAR: ModulAjar[] = [
  {
    id: 'm1',
    judul: 'Modul Ajar Digitalisasi & Otomatisasi Kearsipan Perkantoran',
    mataPelajaran: 'Otomatisasi Tata Kelola Kearsipan Digital',
    jurusan: 'Manajemen Perkantoran dan Layanan Bisnis (MPLB)',
    faseKelas: 'Fase F (Kelas XI)',
    alokasiWaktu: '4 x 45 Menit (2 Pertemuan)',
    tanggalDibuat: '2026-07-28',
    pembuat: 'Ahmad Fauzi, S.Pd.',
    data: {
      judul: 'Modul Ajar Digitalisasi & Otomatisasi Kearsipan Perkantoran',
      identitas: {
        sekolah: 'SMKS PLUS AT THAHIRIN',
        mataPelajaran: 'Otomatisasi Tata Kelola Kearsipan Digital',
        jurusan: 'Manajemen Perkantoran dan Layanan Bisnis (MPLB)',
        faseKelas: 'Fase F (Kelas XI)',
        alokasiWaktu: '4 x 45 Menit (2 Pertemuan)',
        tahunAjaran: '2026/2027'
      },
      profilPelajarPancasila: [
        'Bernalar Kritis: Menganalisis klasifikasi dan Indeks arsip dokumen fisik dan digital',
        'Kreatif: Merancang struktur kearsipan elektronik yang terorganisir',
        'Mandiri: Melakukan pemindaian, pengindeksan, dan penyimpanan dokumen digital'
      ],
      saranaPrasarana: [
        'Laboratorium Manajemen Perkantoran dan Layanan Bisnis',
        'Komputer, Scanner Komersial & Cloud Drive',
        'LCD Projector & Modul Kearsipan Digital'
      ],
      targetPesertaDidik: 'Peserta didik konsentrasi keahlian Manajemen Perkantoran dan Layanan Bisnis (MPLB)',
      modelPembelajaran: 'Project Based Learning (PjBL) terintegrasi Industri Perkantoran',
      komponenInti: {
        tujuanPembelajaran: [
          'Peserta didik mampu memahami konsep pengelolaan dokumen dan kearsipan elektronik.',
          'Peserta didik dapat mengoperasikan perangkat pemindai (scanner) dan membuat indeks penamaan arsip digital.',
          'Peserta didik mampu mensimulasikan penataan arsip berbasis cloud storage secara rapi dan aman.'
        ],
        pemahamanBermakna: 'Kearsipan digital yang rapi dan terstruktur mempercepat temu balik informasi di instansi serta menjaga keamanan dokumen penting perkantoran.',
        pertanyaanPemantik: [
          'Bagaimana cara sebuah perusahaan besar menemukan dokumen kontrak 5 tahun lalu hanya dalam 10 detik?',
          'Apa perbedaan utama kearsipan berbasis kertas konvensional dengan kearsipan digital?'
        ],
        kegiatanPembelajaran: {
          pendahuluan: [
            'Guru membuka pembelajaran dengan salam, berdoa, dan memeriksa kehadiran siswa. (10 Menit)',
            'Apersepsi: Guru memperlihatkan simulasi tumpukan berkas fisik vs pencarian berkas digital di komputer proyektor. (10 Menit)',
            'Guru menyampaikan tujuan pembelajaran serta pembagian kelompok praktikum kearsipan. (10 Menit)'
          ],
          inti: [
            'Fase 1 (Pertanyaan Mendasar): Diskusi kelompok tentang permasalahan kearsipan di kantor modern. (20 Menit)',
            'Fase 2 (Mendesain Proyek): Siswa membuat skema kode klasifikasi arsip perkantoran. (30 Menit)',
            'Fase 3 (Menyusun Jadwal): Siswa menyusun alur pengerjaan pemindaian dan pengindeksan file. (15 Menit)',
            'Fase 4 (Praktik Kearsipan): Siswa memindai dokumen fisik, memberi nama file sesuai standar indeks, dan mengunggah ke sistem cloud. (60 Menit)',
            'Fase 5 (Pengujian): Guru melakukan uji simpul temu balik dokumen secara acak. (25 Menit)'
          ],
          penutup: [
            'Fase 6 (Evaluasi & Refleksi): Setiap kelompok mempresentasikan hasil penataan kearsipan digitalnya. (20 Menit)',
            'Umpan balik dan penguatan konsep dari guru. (10 Menit)',
            'Pembersihan lab AP, doa penutup, dan salam. (10 Menit)'
          ]
        },
        asesmen: {
          diagnostik: 'Kuis diagnostik mengenai dasar-dasar surat-menyurat dan kearsipan.',
          formatif: 'Observasi keaktifan praktikum pemindaian scanner dan akurasi indeks nama file.',
          sumatif: 'Penilaian produk akhir portofolio arsip digital dan uji kecepatan temu balik berkas.'
        },
        pengayaanDanRemidial: 'Pengayaan: Konfigurasi enkripsi berkas sensitif perkantoran. Remedial: Bimbingan ulang klasifikasi indeks alfabetis.'
      },
      lampiran: {
        lembarKerjaSiswa: 'Lakukan pemindaian 5 surat dinas masuk, tentukan indeks subjeknya, dan simpan pada direktori drive sesuai kode klasifikasi.',
        bahanBacaanGuruSiswa: 'Buku Ajar Manajemen Perkantoran dan Layanan Bisnis & Panduan E-Arsip Kementerian.',
        glosarium: [
          'E-Arsip: Sistem manajemen kearsipan elektronik berbasis sistem informasi.',
          'Indeks: Tanda pengenal berkas untuk memudahkan pementaan dan pencarian kembali.',
          'Pemindaian (Scanning): Proses pengubahan dokumen kertas menjadi berkas digital.'
        ]
      }
    }
  }
];

export const INITIAL_FORUM_TOPICS: ForumTopic[] = [
  {
    id: 'ft1',
    title: 'Diskusi Praktik Otomatisasi Tata Kelola Kearsipan Digital',
    categoryType: 'mapel',
    categoryName: 'Otomatisasi Tata Kelola Kearsipan Digital',
    authorId: 'u2',
    authorName: 'Bpk. Ahmad Fauzi, S.Pd.',
    authorRole: 'guru',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-08-02 09:30',
    content: 'Halo siswa-siswi kelas X & XI Manajemen Perkantoran dan Layanan Bisnis! Untuk tugas kearsipan digital pekan ini, pastikan penamaan berkas hasil scan mengikuti format [KODE_ARSIP]_[TANGGAL]_[NAMA_INSTANSI].pdf. Panduan lengkap dapat diunduh pada lampiran berikut.',
    tags: ['Kearsipan', 'MPLB', 'TugasMPLB', 'DigitalArsip'],
    likes: 12,
    likedBy: ['u1', 'u3'],
    views: 145,
    isPinned: true,
    isResolved: false,
    attachments: [
      {
        id: 'fa1',
        name: 'Panduan_Standar_Indeks_Arsip_Digital.pdf',
        url: '#',
        size: '1.2 MB',
        type: 'pdf'
      }
    ],
    replies: [
      {
        id: 'fr1',
        authorId: 'u3',
        authorName: 'Muhammad Rizky Pratama',
        authorRole: 'siswa',
        authorAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        createdAt: '2026-08-02 10:15',
        content: 'Terima kasih Pak Fauzi! Untuk file surat masuk dinas luar daerah tetap dimasukkan ke folder Klasifikasi Umum ya Pak?',
        likes: 5,
        likedBy: ['u2']
      }
    ]
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Pengarahan Kepala Sekolah Ir. Surantro',
    message: 'Bapak/Ibu Guru Manajemen Perkantoran dan Layanan Bisnis dimohon menghadiri rapat dinas sekolah mengenai persiapan akreditasi dan Kurikulum Merdeka.',
    targetRole: 'guru',
    category: 'Pengumuman',
    createdAt: '2026-08-03 08:00',
    isRead: false,
    senderName: 'Ir. Surantro (Kepala Sekolah)',
    senderRole: 'admin'
  },
  {
    id: 'n2',
    title: 'Tugas Baru: Praktikum Kearsipan Digital',
    message: 'Tugas praktikum Otomatisasi Kearsipan Digital telah diperbarui. Silakan cek detail di Forum Diskusi.',
    targetRole: 'siswa',
    targetClassId: 'k1',
    category: 'Tugas',
    createdAt: '2026-08-02 09:35',
    isRead: true,
    actionUrl: 'forum',
    senderName: 'Bpk. Ahmad Fauzi, S.Pd.',
    senderRole: 'guru'
  }
];

export const INITIAL_CBT_EXAMS: CbtExam[] = [
  {
    id: 'cbt-1',
    title: 'Penilaian Tengah Semester (PTS) - Kearsipan Digital',
    subject: 'Otomatisasi Tata Kelola Kearsipan Digital',
    classTarget: 'X MPLB 1',
    durationMinutes: 30,
    token: 'MPLB2026',
    teacherName: 'Bpk. Ahmad Fauzi, S.Pd.',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    status: 'active',
    questions: [
      {
        id: 'q1',
        question: 'Dalam sistem kearsipan elektronik, proses pengubahan dokumen fisik berupa surat kertas menjadi format file digital menggunakan alat scanner dinamakan ...',
        options: [
          { key: 'A', text: 'Indexing (Pengindeksan)' },
          { key: 'B', text: 'Digitizing / Scanning (Pemindaian)' },
          { key: 'C', text: 'Encrypting (Enkripsi Data)' },
          { key: 'D', text: 'Archiving (Pengarsipan Manual)' },
          { key: 'E', text: 'Duplicating (Penggandaan File)' }
        ],
        correctAnswer: 'B',
        explanation: 'Pemindaian (Scanning / Digitizing) adalah alur utama mengonversi fisik dokumen menjadi bit data digital dalam bentuk file PDF atau JPEG.'
      },
      {
        id: 'q2',
        question: 'Format penamaan file arsip digital yang disepakati sesuai standar Manajemen Perkantoran dan Layanan Bisnis SMKS PLUS AT THAHIRIN adalah ...',
        options: [
          { key: 'A', text: 'Surat1.pdf' },
          { key: 'B', text: '[KODE_ARSIP]_[TANGGAL]_[NAMA_INSTANSI].pdf' },
          { key: 'C', text: 'Tugas_Kearsipan_Siswa.docx' },
          { key: 'D', text: 'Scan_Dokumen_Terbaru.jpg' },
          { key: 'E', text: 'ARSIP_BEBAS.pdf' }
        ],
        correctAnswer: 'B',
        explanation: 'Format baku memuat Kode Klasifikasi, Tanggal Dokumen, dan Nama Instansi pengirim/penerima untuk memudahkan pencarian (temu balik).'
      },
      {
        id: 'q3',
        question: 'Sistem penyimpanan berkas berdasarkan abjad nama individu, perusahaan, atau organisasi dinamakan sistem kearsipan ...',
        options: [
          { key: 'A', text: 'Sistem Geografis' },
          { key: 'B', text: 'Sistem Kronologis (Tanggal)' },
          { key: 'C', text: 'Sistem Alfabetis (Abjad)' },
          { key: 'D', text: 'Sistem Subjek (Pokok Masalah)' },
          { key: 'E', text: 'Sistem Nomor (Desimal)' }
        ],
        correctAnswer: 'C',
        explanation: 'Sistem Alfabetis mengurutkan arsip dari A sampai Z berdasarkan nama pengirim atau instansi.'
      },
      {
        id: 'q4',
        question: 'Manakah di bawah ini yang merupakan keunggulan utama pengelolaan e-Arsip dibanding arsip konvensional fisik?',
        options: [
          { key: 'A', text: 'Membutuhkan gudang penyimpanan kertas yang luas' },
          { key: 'B', text: 'Kecepatan temu balik dokumen (retrieval time) hitungan detik' },
          { key: 'C', text: 'Rentan terhadap rayap dan kelembapan udara' },
          { key: 'D', text: 'Sulit dibagikan antar divisi secara bersamaan' },
          { key: 'E', text: 'Memerlukan biaya penggandaan Kertas tinggi' }
        ],
        correctAnswer: 'B',
        explanation: 'Kecepatan temu balik dokumen digital sangat tinggi karena didukung oleh fitur pencarian kata kunci dan indeks terstruktur.'
      },
      {
        id: 'q5',
        question: 'Tahap menentukan tanda pengenal surat atau kata tangkap (caption) untuk menyimpan dokumen disebut ...',
        options: [
          { key: 'A', text: 'Mengindeks' },
          { key: 'B', text: 'Menyortir' },
          { key: 'C', text: 'Mengkaji' },
          { key: 'D', text: 'Memverifikasi' },
          { key: 'E', text: 'Menyimpan' }
        ],
        correctAnswer: 'A',
        explanation: 'Mengindeks adalah menentukan judul/kata kunci penataan arsip sebelum dimasukkan ke dalam folder klasifikasi.'
      }
    ]
  },
  {
    id: 'cbt-2',
    title: 'Kuis Harian - Korespondensi Bisnis & Aplikasi Perkantoran',
    subject: 'Teknologi Perkantoran & Korespondensi Bisnis',
    classTarget: 'Semua Kelas MPLB',
    durationMinutes: 15,
    token: 'KORESP26',
    teacherName: 'Ibu Dra. Hj. Sri Wahyuni, M.Pd.',
    startDate: '2026-08-02',
    endDate: '2026-08-15',
    status: 'active',
    questions: [
      {
        id: 'q21',
        question: 'Surat resmi yang dikirimkan oleh sebuah perusahaan kepada instansi atau mitra usaha lain disebut ...',
        options: [
          { key: 'A', text: 'Surat Pribadi' },
          { key: 'B', text: 'Surat Dinas / Bisnis' },
          { key: 'C', text: 'Surat Kaleng' },
          { key: 'D', text: 'Surat Rahasia Pribadi' },
          { key: 'E', text: 'Surat Pembaca' }
        ],
        correctAnswer: 'B',
        explanation: 'Surat dinas/bisnis digunakan untuk kepentingan korespondensi antar instansi atau perusahaan.'
      },
      {
        id: 'q22',
        question: 'Bagian surat yang berisi alamat tujuan pengiriman dan nama penerima disebut ...',
        options: [
          { key: 'A', text: 'Kop Surat' },
          { key: 'B', text: 'Tanggal Surat' },
          { key: 'C', text: 'Alamat Dalam (Inside Address)' },
          { key: 'D', text: 'Salam Pembuka' },
          { key: 'E', text: 'Lampiran' }
        ],
        correctAnswer: 'C',
        explanation: 'Alamat dalam mencantumkan penerima spesifik beserta jabatan dan nama instansinya.'
      }
    ]
  }
];

export const INITIAL_CBT_SUBMISSIONS: CbtSubmission[] = [
  {
    id: 'sub-1',
    examId: 'cbt-1',
    siswaId: 's1',
    siswaName: 'Muhammad Rizky Pratama',
    nisn: '0068123491',
    answers: {
      'q1': 'B',
      'q2': 'B',
      'q3': 'C',
      'q4': 'B',
      'q5': 'A'
    },
    doubtful: {},
    score: 100,
    correctCount: 5,
    wrongCount: 0,
    submittedAt: '2026-08-03 09:12',
    timeSpentSeconds: 420
  }
];
