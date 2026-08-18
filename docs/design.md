# Desain UI/UX — Sistem Informasi Sekolah (Template)

## 1. Prinsip Desain

- **Mobile-first**: aplikasi utama dipakai siswa/guru lewat HP. Semua layout diuji 320–1366 px tanpa overflow horizontal.
- **Satu halaman (tab)**: tidak ada router — navigasi via state `activeTab` di `App.tsx`. Setiap fitur adalah "section" terpisah.
- **Bahasa Indonesia** di seluruh UI dan pesan error.
- **Tema**: Tailwind 4, palet `emerald` (aksen utama, seleksi teks) di atas `slate-50` (latar), teks slate gelap. Ikon `lucide-react`.

## 2. Struktur Halaman

```
┌─────────────────────────────────────┐
│ Navbar (atas, hanya saat login)     │  logo + menu desktop + avatar
├─────────────────────────────────────┤
│                                     │
│         Konten (per tab)            │  Landing / CBT / Absensi / Kelas /
│                                     │  Modul Ajar / Forum / Notifikasi /
│                                     │  Profil / Pengguna / WhatsApp
│                                     │
├─────────────────────────────────────┤
│ Footer                              │
├─────────────────────────────────────┤
│ BottomDock (mobile, hanya login)    │  menu + badge unread notifikasi
└─────────────────────────────────────┘
```

- **Belum login**: hanya landing page — tanpa Navbar dan BottomDock. Hero dengan CTA utama "Masuk Portal".
- **Sudah login**: Navbar atas + BottomDock muncul di semua halaman; footer diberi ruang ekstra agar tidak tertutup dock.
- **Print styles** (`src/index.css`): saat mencetak, nav/footer disembunyikan, konten full-width.

## 3. Navigasi per Role (`src/navItems.ts`)

| Menu | Siswa/Ketua | Guru | Admin/Super |
|---|---|---|---|
| Beranda (landing) | ✔ | ✔ | ✔ |
| Ujian CBT (highlight) | ✔ | ✔ | ✔ |
| Absensi | ✔ | ✔ | ✔ |
| Kelas | — | ✔ | ✔ |
| Modul Ajar (badge AI) | — | ✔ | ✔ |
| Forum | ✔ | ✔ | ✔ |
| Notifikasi (badge unread) | ✔ | ✔ | ✔ |
| Profil | ✔ | ✔ | ✔ |
| Pengguna | — | — | ✔ |
| WhatsApp | — | — | ✔ |

- Item menu difilter oleh `canAccessTab`; tab ilegal → redirect ke Profil.
- `unreadCount` badge di item Notifikasi (hitung dari state notifikasi yang belum dibaca).
- Ujian CBT diberi `highlight` (menonjol) — fitur andalan.

## 4. Komponen & Section

### 4.1 Landing (publik) — `LandingPage.tsx`
- Hero dengan nama sekolah + CTA "Masuk Portal" (tombol login full-width di mobile; CBT/Absensi dua kolom di bawahnya).
- Info: profil sekolah, jurusan (X MPLB 1–3 dll), berita/prestasi (data statis), statistik.
- Setelah login, hero menampilkan CTA masuk fitur sesuai role.

### 4.2 Login & Sesi — `LoginForm`, `LoginGate`, `ChangePasswordModal`
- Modal login: identifier (email/NIP/NISN) + password; error generik (anti enumerasi).
- `LoginGate`: layar "login dulu" untuk tab terproteksi.
- `ChangePasswordModal`: muncul otomatis bila `mustChangePassword`; setelah ganti → reload.

### 4.3 CBT — `CbtSection` + `cbt/*`
**Guru/staff** (`CbtCreateExamModal`, `CbtResultsTable`, `CbtResultReviewModal`):
- Daftar ujian sebagai kartu: badge jenis (`Ujian Resmi · min. kirim X mnt` / `Latihan`), status, jadwal, jumlah soal, aksi (edit/hapus/rotasi token).
- Form buat/ubah ujian: judul, mapel, kelas target, durasi, tanggal + jam buka/tutup, jenis ujian + waktu minimal kirim (otomatis 80% saat pilih "ujian resmi"), token, editor soal (PG: 5 opsi + kunci; essai: textarea + kunci teks).
- Tabel hasil per ujian (skor, benar/salah, waktu) + modal review jawaban siswa.

**Siswa** (`CbtTokenModal`, `CbtTestRunner`, `CbtMyResults`):
- Tab **Hari Ini** (ujian aktif hari itu, chip tanggal, kartu jadwal + jam) dan **Semua**.
- Mulai ujian → modal token (hash server-side, rate limited); tombol "Kerjakan Ujian" disabled di luar jam buka dengan label jam.
- **Runner**: header padat (320px aman) — nama ujian, countdown, progres soal; navigasi soal; opsi PG (A–E) / textarea essai; checkbox "Ragu"; status simpan (Tersimpan/Menyimpan/Gagal); kartu soal terakhir + tombol kirim (terkunci + countdown "Kirim dibuka dalam MM:SS" untuk ujian resmi sebelum min-submit); submit diblokir server 409 sampai minimal waktu.
- Tab **Nilai Saya**: tabel riwayat (ujian, skor, benar/salah, tanggal) + modal detail jawaban.

### 4.4 Absensi — `AbsensiSection.tsx`, `StudentAbsensiCard.tsx`
- Pilih kelas → daftar siswa per hari; status via badge dropdown (Hadir/Terlambat/Sakit/Izin/Alpa), keterangan, foto, lokasi (geo).
- Kartu rekap per siswa (kehadiran bulan ini); input siswa mandiri sebelum 08:00 WIB.
- Konfirmasi server via `presensiActions.save` (UI tidak klaim sukses prematur).

### 4.5 Kelas — `KelasSection.tsx`
- Kartu kelas (nama, wali, jumlah siswa, jurusan) → detail jadwal mingguan (tabel desktop / kartu mobile).

### 4.6 Modul Ajar — `ModulAjarSection.tsx`
- Form multi-bagian (identitas, profil pelajar Pancasila, komponen inti, asesmen, lampiran) satu kolom di mobile; tombol "Generate dengan AI" (Gemini) dengan validasi schema hasil.

### 4.7 Forum — `ForumSection.tsx`
- List topik (pin di atas, kategori mapel/kelas, tag), modal buat topik, thread + balasan + like, moderasi (pin/resolved) untuk guru+, lampiran.

### 4.8 Notifikasi — `NotifikasiSection.tsx`
- List notifikasi per role/kelas, kategori berwarna, filter, tandai semua dibaca, klik → action URL.

### 4.9 Profil — `ProfilSection.tsx`
- Info akun (nama, email, NIP/NISN/NIK, tanggal lahir, kelas, jabatan), foto avatar, ringkasan data terkait per role, ganti password.

### 4.10 Manajemen User — `UserManagementSection.tsx`
- Tabel user + filter status/role; modal tambah/ubah (akun, role, kelas, jabatan), reset password, penetapan ketua kelas, arsip; tab audit log (300 terakhir).

### 4.11 WhatsApp Admin — `WhatsAppAdminSection.tsx`
- Status gateway (heartbeat), kontak wali + consent, pengaturan (rollout, jam aktif, batch, retention), riwayat pengiriman, statistik 14 hari. Setting gateway khusus super admin.

## 5. Pola UX Umum

- **Modal** (`ui/Modal.tsx`) untuk form & detail; **badge** untuk status; **kartu** untuk entitas; **tabel scroll lokal** untuk data lebar.
- **Optimistic + rollback**: simpan ke server dulu, baru UI sukses (`usePersistedCollection`); konflik revisi (409) → auto-refresh data server; kegagalan → event `persist:error` + rollback.
- **Mobile**: tombol aksi sekunder disembunyikan labelnya; tabel → kartu; email panjang wrap; filter/pagination wrap.
- **Feedback waktu nyata**: indikator simpan CBT, countdown, label jam buka.

## 6. PWA

- `index.html` → `public/site.webmanifest` (`display: standalone`), ikon 192/512, theme-color, apple-touch-icon.
- Install: Android Chrome (notifikasi install / titik tiga → Install aplikasi); iOS Safari (Bagikan → Tambahkan ke Layar Utama).
- Belum ada service worker — butuh internet.

## 7. Referensi File

- Struktur & navigasi: `src/App.tsx`, `src/navItems.ts`
- Tema: `src/index.css` (Tailwind 4 + print styles), kelas utilitas inline
- Komponen: `src/components/**`, UI dasar `src/components/ui/Modal.tsx`
- Tipe domain: `src/types.ts`; data awal: `src/data/initialData.ts`