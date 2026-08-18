import type { Berita, Jurusan, User } from '../types';

export const SCHOOL_INFO = {
  name: 'SMK NEGERI TEKNOLOGI JAKARTA',
  tagline: 'Unggul Teknologi, Berprestasi Nasional',
  npsn: '20123456',
  akreditasi: 'A (Unggul)',
  alamat: 'JL. TEKNOLOGI NO. 10, Kec. Menteng, Jakarta Pusat 10310',
  telepon: '(021) 3456789',
  whatsapp: '+62 856-1234-5678',
  email: 'info@smkn-teknologi-jkt.sch.id',
  website: 'https://smkn-teknologi-jkt.sch.id',
  kepalaSekolah: 'Dra. Siti Nurhaliza, M.Pd.',
  address: {
    streetAddress: 'Jl. Teknologi No. 10, Menteng',
    locality: 'Jakarta Pusat',
    region: 'DKI Jakarta',
    postalCode: '10310',
    country: 'ID'
  },
  sambutan: 'Selamat datang di SMK NEGERI TEKNOLOGI JAKARTA. Sebagai sekolah menengah kejuruan negeri terakreditasi A, kami berkomitmen menghasilkan lulusan yang menguasai teknologi informasi dan siap bersaing di era digital global.',
  stats: {
    siswa: 720,
    guru: 48,
    jurusan: 3,
    mitraIndustri: 36,
    persenKerja: '96.2%'
  }
};

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Dra. Siti Nurhaliza, M.Pd.',
    email: 'admin@smkn-teknologi-jkt.sch.id',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    nipNisn: '19680515 199203 2 005',
    jabatan: 'Kepala Sekolah SMK NEGERI TEKNOLOGI JAKARTA'
  },
  {
    id: 'u2',
    name: 'Bpk. Drs. Hendra Wijaya, M.T.',
    email: 'guru@smkn-teknologi-jkt.sch.id',
    role: 'guru',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    nipNisn: '19850310 201201 1 008',
    jabatan: 'Guru Produktif Pemrograman Web & Mobile'
  },
  {
    id: 'u3',
    name: 'Andi Prasetyo',
    email: 'siswa@smkn-teknologi-jkt.sch.id',
    role: 'siswa',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    nipNisn: '0075123490',
    classId: 'k1',
    jabatan: 'Ketua Kelas X RPL 1'
  }
];

export const JURUSAN_LIST: Jurusan[] = [
  {
    id: 'j1',
    code: 'RPL',
    name: 'Rekayasa Perangkat Lunak',
    iconName: 'Code',
    description: 'Konsentrasi keahlian pengembangan perangkat lunak: pemrograman web, mobile, database, dan sistem informasi.',
    kepalaJurusan: 'Drs. Budi Santoso, M.T.',
    prospekKerja: ['Web Developer', 'Mobile Developer', 'Software Engineer', 'Database Administrator', 'IT Consultant', 'Freelance Developer'],
    fasilitas: ['Lab Komputer 40 Unit', 'Lab Server & Cloud', 'Studio Desain UI/UX', 'Akses GitHub Education'],
    color: 'from-blue-600 to-indigo-700'
  },
  {
    id: 'j2',
    code: 'TKJ',
    name: 'Teknik Komputer & Jaringan',
    iconName: 'Network',
    description: 'Konsentrasi keahlian jaringan komputer, administrasi server, keamanan siber, dan infrastruktur TI.',
    kepalaJurusan: 'Ir. Dwi Raharjo, M.Kom.',
    prospekKerja: ['Network Engineer', 'System Administrator', 'Cloud Engineer', 'Security Analyst', 'IT Support Specialist', 'Data Center Technician'],
    fasilitas: ['Lab Jaringan & Server', 'Lab MikroTik & Cisco', 'Rack Server Real-time', 'Sertifikasi Cisco Networking Academy'],
    color: 'from-cyan-600 to-teal-700'
  }
];

export const BERITA_LIST: Berita[] = [
  {
    id: 'b1',
    judul: 'Siswa RPL SMK Negeri Teknologi Jakarta Juara 1 Kompetisi Hackathon Nasional',
    tanggal: '10 Agustus 2026',
    kategori: 'Prestasi',
    ringkasan: 'Tim developer siswa RPL berhasil meraih juara 1 pada Hackathon Nasional 2026 dengan aplikasi inovatif berbasis AI.',
    konten: 'Tim tiga orang siswa kelas XII RPL dari SMK Negeri Teknologi Jakarta menorehkan prestasi gemilang dalam Hackathon Nasional 2026 yang diselenggarakan di Jakarta. Mereka mengembangkan aplikasi edutech berbasis kecerdasan buatan yang memenangkan penilaian juri.',
    gambar: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
    penulis: 'Humas SMK Negeri Teknologi Jakarta'
  },
  {
    id: 'b2',
    judul: 'MoU Kerjasama dengan Startup Teknologi untuk Program Magang Siswa',
    tanggal: '28 Juli 2026',
    kategori: 'Mitra Industri',
    ringkasan: 'Penandatanganan kerjasama magang dengan 12 perusahaan teknologi terkemuka di Jakarta.',
    konten: 'Kepala SMK Negeri Teknologi Jakarta secara resmi menandatangani nota kesepahaman dengan 12 perusahaan teknologi untuk program magang siswa. Program ini akan memberikan pengalaman kerja nyata di bidang pengembangan perangkat lunak, jaringan, dan cloud computing.',
    gambar: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop&q=80',
    penulis: 'Tim BKK'
  },
  {
    id: 'b3',
    judul: 'Lab Cloud Computing Baru Siap Digunakan untuk Pembelajaran',
    tanggal: '15 Juli 2026',
    kategori: 'Pengumuman',
    ringkasan: 'Fasilitas terbaru berupa lab cloud computing dengan 40 workstation dan akses ke platform cloud internasional.',
    konten: 'SMK Negeri Teknologi Jakarta resmi membuka Lab Cloud Computing baru yang dilengkapi dengan 40 workstation, akses ke AWS Academy dan Google Cloud, serta simulator infrastruktur jaringan enterprise. Lab ini akan mendukung pembelajaran praktis siswa TKJ dan RPL.',
    gambar: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    penulis: 'Tim IT'
  }
];

export const SCHOOL_BRAND = {
  themeColor: '#1e40af',
  domain: 'smkn-teknologi-jkt.pages.dev',
  ogImage: 'og-smkn-teknologi-jkt.png',
  manifestName: 'SMK Negeri Teknologi Jakarta',
  manifestShortName: 'SMK Tekno'
};

export const SCHOOL_FEATURES = {
  cbt: true,
  whatsapp: true,
  gemini: true,
  googleSync: false
};
