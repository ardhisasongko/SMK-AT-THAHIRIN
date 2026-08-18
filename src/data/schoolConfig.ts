import type { Berita, Jurusan, User } from '../types';

export const SCHOOL_INFO = {
  name: 'SMK PLUS AT-THAHIRIN',
  tagline: 'Unggul, Berkarakter & Ahli Manajemen Perkantoran dan Layanan Bisnis',
  npsn: '20232426',
  akreditasi: 'B (Baik)',
  alamat: 'JL. SIRNAGALIH NO.09 RT 06/RW 02, Desa Cipayung Girang, Kec. Megamendung, Kab. Bogor, Jawa Barat 16770',
  telepon: '(0251) 8254123',
  whatsapp: '+62 812-3456-7890',
  email: 'info@smksplusatthahirin.sch.id',
  website: 'https://smksplusatthahirin.sch.id',
  kepalaSekolah: 'Ir. Suranto',
  address: {
    streetAddress: 'Jl. Sirnagalih No. 09 RT 06/RW 02, Cipayung Girang',
    locality: 'Megamendung',
    region: 'Jawa Barat',
    postalCode: '16770',
    country: 'ID'
  },
  sambutan: 'Selamat datang di SMK PLUS AT-THAHIRIN Megamendung. Sebagai lembaga pendidikan kejuruan swasta terakreditasi B yang berfokus penuh pada keahlian Manajemen Perkantoran dan Layanan Bisnis (MPLB), kami berkomitmen membentuk lulusan yang mahir dalam tata kelola administrasi digital, kearsipan elektronik, komunikasi bisnis, serta berakhlak mulia dan siap kerja di era industri modern.',
  stats: {
    siswa: 380,
    guru: 26,
    jurusan: 1,
    mitraIndustri: 24,
    persenKerja: '93.5%'
  }
};

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Ir. Suranto',
    email: 'admin@smksplusatthahirin.sch.id',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    nipNisn: '19700512 199803 1 002',
    jabatan: 'Kepala Sekolah SMK PLUS AT-THAHIRIN'
  },
  {
    id: 'u2',
    name: 'Bpk. Ahmad Fauzi, S.Pd.',
    email: 'guru@smksplusatthahirin.sch.id',
    role: 'guru',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    nipNisn: '19890215 201502 1 003',
    jabatan: 'Guru Produktif Manajemen Perkantoran dan Layanan Bisnis & Wali Kelas X MPLB 1'
  },
  {
    id: 'u3',
    name: 'Muhammad Rizky Pratama',
    email: 'siswa@smksplusatthahirin.sch.id',
    role: 'siswa',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    nipNisn: '0068123491',
    classId: 'k1',
    jabatan: 'Ketua Kelas X MPLB 1'
  }
];

export const JURUSAN_LIST: Jurusan[] = [
  {
    id: 'j1',
    code: 'MPLB',
    name: 'Manajemen Perkantoran dan Layanan Bisnis',
    iconName: 'Briefcase',
    description: 'Konsentrasi keahlian Kurikulum Merdeka yang mencakup tata kelola administrasi dan manajemen perkantoran digital, otomatisasi perkantoran, manajemen kearsipan elektronik, korespondensi bisnis, serta layanan bisnis dan pelayanan publik modern yang terintegrasi teknologi.',
    kepalaJurusan: 'Dra. Hj. Sri Wahyuni, M.Pd.',
    prospekKerja: ['Staf Administrasi & Administrasi Digital', 'Sekretaris / Asisten Manajemen', 'Customer Service / Front Office / Public Relations', 'Staf Kearsipan Digital', 'Staf Keuangan & SDM (Entry Level)', 'Wirausaha Layanan Bisnis'],
    fasilitas: ['Lab Simulator Kantor Modern', 'Komputer Administrasi & Software Kearsipan', 'Perangkat Telekonferensi HD', 'Mesin Otomatisasi Perkantoran & Scanner Digital'],
    color: 'from-emerald-600 to-teal-700'
  }
];

export const BERITA_LIST: Berita[] = [
  {
    id: 'b1',
    judul: 'Siswa Manajemen Perkantoran SMK PLUS AT-THAHIRIN Meraih Juara 1 LKS Kejuruan Perkantoran',
    tanggal: '01 Agustus 2026',
    kategori: 'Prestasi',
    ringkasan: 'Selamat kepada ananda Muhammad Rizky Pratama dari X MPLB 1 yang berhasil meraih gelar juara pada bidang perlombaan Otomatisasi Perkantoran.',
    konten: 'Prestasi membanggakan diukir oleh civitas akademika SMK PLUS AT-THAHIRIN Megamendung Bogor. Dalam ajang Lomba Kompetensi Siswa (LKS) Kejuruan bidang Manajemen Perkantoran dan Layanan Bisnis / Otomatisasi Perkantoran, perwakilan sekolah berhasil meraih juara pertama di bawah bimbingan Bpk. Ir. Surantro dan tim pengajar.',
    gambar: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
    penulis: 'Humas SMK PLUS AT-THAHIRIN'
  },
  {
    id: 'b2',
    judul: 'Penandatanganan MoU Kerjasama Industri Perkantoran & Magang Kerja dengan Perusahaan Terkemuka',
    tanggal: '25 Juli 2026',
    kategori: 'Mitra Industri',
    ringkasan: 'Memperkuat link and match jurusan Manajemen Perkantoran dan Layanan Bisnis dengan dunia usaha dan industri.',
    konten: 'Kepala SMK PLUS AT-THAHIRIN, Bpk. Ir. Surantro, secara resmi menandatangani nota kesepahaman (MoU) dengan berbagai instansi dan perusahaan swasta untuk program Praktik Kerja Lapangan (PKL) serta rekrutmen lulusan Manajemen Perkantoran dan Layanan Bisnis.',
    gambar: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&auto=format&fit=crop&q=80',
    penulis: 'Tim Bursa Kerja Khusus (BKK)'
  },
  {
    id: 'b3',
    judul: 'Peluncuran Sistem Absensi QR Code & Generator Modul Ajar AI Kurikulum Merdeka',
    tanggal: '15 Juli 2026',
    kategori: 'Pengumuman',
    ringkasan: 'Digitalisasi layanan sekolah terpadu bagi seluruh guru dan siswa Manajemen Perkantoran dan Layanan Bisnis.',
    konten: 'Memasuki Tahun Ajaran 2026/2027, SMK PLUS AT-THAHIRIN meluncurkan portal web terpadu yang memuat presensi QR Code, jadwal kelas, serta pembuatan Modul Ajar AI Kurikulum Merdeka berbasis Gemini.',
    gambar: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80',
    penulis: 'Tim IT SMK PLUS AT-THAHIRIN'
  }
];

export const SCHOOL_BRAND = {
  themeColor: '#047857',
  domain: 'smk-at-tahirin.pages.dev',
  ogImage: 'og-smk-at-thahirin.png',
  manifestName: 'SMK Plus At-Thahirin',
  manifestShortName: 'At-Thahirin'
};

export const SCHOOL_FEATURES = {
  cbt: true,
  whatsapp: true,
  gemini: true,
  googleSync: false
};
