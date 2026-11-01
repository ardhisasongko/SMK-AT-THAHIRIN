> # ⚠️ TEMPLAT — wajib ditinjau penasihat hukum sebelum digunakan; bukan nasihat hukum.
>
> Dokumen ini adalah templat awal yang disediakan bersama platform. Isi di
> dalam kurung siku `[...]` wajib dilengkapi, dan seluruh isi wajib
> ditinjau serta disesuaikan oleh penasihat hukum para pihak sebelum
> ditandatangani. Vendor tidak memberikan nasihat hukum melalui templat
> ini.

# PERJANJIAN PEMROSESAN DATA PRIBADI
## (Data Processing Agreement)

Perjanjian ini dibuat pada tanggal [tanggal], oleh dan antara:

1. **[Nama Sekolah/Yayasan]**, berkedudukan di [alamat lengkap],
   diwakili oleh [nama, jabatan] — selanjutnya disebut **"Sekolah"**,
   bertindak sebagai **Pengendali Data Pribadi**; dan

2. **[Nama Vendor/Perorangan]**, berkedudukan di [alamat lengkap],
   diwakili oleh [nama, jabatan] — selanjutnya disebut **"Vendor"**,
   bertindak sebagai **Prosesor Data Pribadi**.

Sekolah dan Vendor sepakat mengikatkan diri pada perjanjian pemrosesan
data pribadi berikut, sebagai bagian tidak terpisahkan dari perjanjian
layanan platform sistem informasi sekolah antara para pihak
("Perjanjian Layanan").

### Pasal 1 — Definisi

Istilah "Data Pribadi", "Pengendali Data Pribadi", "Prosesor Data
Pribadi", "Subjek Data", dan "Pemrosesan" mengikuti definisi UU No. 27
Tahun 2022 tentang Pelindungan Data Pribadi ("UU PDP").

### Pasal 2 — Ruang Lingkup Pemrosesan

1. Vendor memproses Data Pribadi **hanya atas perintah terdokumentasi
   dari Sekolah** dan hanya untuk menyediakan, memelihara, dan
   mengamankan platform: pengelolaan akun pengguna, presensi, penilaian
   dan ujian daring (CBT), rapor, komunikasi sekolah, serta dukungan
   teknis.
2. Kategori Subjek Data: peserta didik (termasuk anak di bawah umur),
   orang tua/wali, guru, dan staf sekolah.
3. Kategori Data Pribadi: identitas (nama, NISN/NIP, NIK, tanggal lahir),
   data akademik (kelas, nilai, presensi termasuk foto presensi dan
   titik lokasi saat presensi mandiri), data kontak (nomor telepon
   wali), kredensial akun (tersimpan ter-hash), dan log penggunaan.
   Para pihak mengakui data anak merupakan **data pribadi yang bersifat
   spesifik** menurut UU PDP dan wajib dilindungi dengan tingkat
   keamanan tertinggi.
4. Vendor tidak menggunakan Data Pribadi untuk kepentingan iklan,
   profil komersial, pelatihan model kecerdasan buatan pihak ketiga,
   atau tujuan lain di luar ayat (1).

### Pasal 3 — Kewajiban Vendor

1. Menjaga kerahasiaan Data Pribadi; memastikan setiap orang yang
   diberi akses terikat kewajiban kerahasiaan.
2. Menerapkan langkah keamanan teknis dan organisasional sebagaimana
   dirinci pada Lampiran (antara lain: enkripsi transport TLS, hashing
   password PBKDF2, verifikasi dua langkah untuk akun staf, pembatasan
   akses berbasis peran, pencatatan audit, backup berkala, dan proses
   pembaruan keamanan) — ringkasan publik tersedia pada dokumen
   `SECURITY.md` platform.
3. **Memberitahukan Sekolah paling lambat 24 jam** sejak mengetahui
   adanya dugaan kegagalan pelindungan Data Pribadi (insiden), agar
   Sekolah dapat memenuhi kewajiban notifikasi 72 jam menurut Pasal 46
   UU PDP; serta memberikan bantuan yang wajar untuk penilaian dampak
   dan pemulihan.
4. Membantu Sekolah memenuhi hak Subjek Data (akses, perbaikan,
   penghapusan, penarikan persetujuan) dalam jangka waktu yang wajar,
   paling lambat [14] hari kerja sejak permintaan diteruskan Sekolah.
5. Tidak menunjuk sub-prosesor baru tanpa persetujuan tertulis Sekolah
   (daftar awal: Lampiran).
6. Atas pilihan Sekolah pada akhir layanan: menghapus atau
   mengembalikan seluruh Data Pribadi, dan menghapus salinannya
   (termasuk backup, dalam siklus retensi backup yang wajar), lalu
   memberikan pernyataan tertulis atas penghapusan itu.
7. Menyediakan informasi yang diperlukan Sekolah untuk membuktikan
   kepatuhan terhadap perjanjian ini dan UU PDP, termasuk hasil audit
   keamanan internal — dengan pemberitahuan tertulis [14] hari
   sebelumnya dan tanpa mengganggu layanan sekolah lain.

### Pasal 4 — Kewajiban Sekolah

1. Memastikan dasar hukum pemrosesan, termasuk persetujuan orang
   tua/wali untuk data peserta didik sebagaimana dipersyaratkan UU PDP,
   dan keakuratan data yang diserahkan kepada Vendor.
2. Menetapkan pengguna yang berhak mengakses platform dan menjaga
   keamanan kredensial akun di lingkungan Sekolah.
3. Menjadi titik kontak bagi Subjek Data dan otoritas terkait
   pemrosesan yang dikendalikan Sekolah.

### Pasal 5 — Sub-Prosesor dan Transfer Data

1. Sub-prosesor awal (Lampiran): penyedia infrastruktur awan
   (Cloudflare, Inc. — hosting, basis data D1, WAF), Google LLC (layanan
   AI Gemini untuk pembuatan soal/modul atas perintah guru, dan
   sinkronisasi spreadsheet/drive bila diaktifkan), Meta Platforms
   (WhatsApp — hanya bila fitur notifikasi diaktifkan tertulis oleh
   Sekolah melalui jalur gateway yang dijelaskan terpisah).
2. Sebagian sub-prosesor memproses data di luar Indonesia; para pihak
   tunduk pada ketentuan transfer data lintas negara Pasal 56 UU PDP.
3. Data yang dikirim ke layanan AI terbatas pada parameter pembuatan
   konten (mata pelajaran, jumlah soal, dan sejenisnya) dan **tidak**
   mencakup identitas peserta didik.

### Pasal 6 — Keamanan dan Insiden

Tata cara respons insiden para pihak mengikuti SOP respons insiden
Vendor (dokumen operasi platform), termasuk penahanan, penilaian,
eradiksi, pemulihan, dan dukungan notifikasi 72 jam. Sekolah
bertanggung jawab atas keputusan akhir dan penerbitan notifikasi formal
kepada Subjek Data dan lembaga yang berwenang dalam kapasitasnya
sebagai Pengendali.

### Pasal 7 — Jangka Waktu dan Pengakhiran

Perjanjian ini berlaku selama Perjanjian Layanan berlangsung. Kewajiban
kerahasiaan dan penghapusan/pengembalian data tetap berlaku setelah
pengakhiran sampai dipenuhi seluruhnya.

### Pasal 8 — Ketentuan Penutup

Perjanjian ini tunduk pada hukum Republik Indonesia. Perselisihan
diselesaikan secara musyawarah, dan bila tidak tercapai, melalui
[mekanisme/lembaga yang disepakati]. Apabila terdapat pertentangan,
ketentuan yang memberi pelindungan lebih tinggi kepada Subjek Data yang
berlaku.

| Sekolah (Pengendali) | Vendor (Prosesor) |
|---|---|
| Nama: [nama] | Nama: [nama] |
| Jabatan: [jabatan] | Jabatan: [jabatan] |
| Tanda tangan & stempel: | Tanda tangan: |
| Tanggal: | Tanggal: |

### Lampiran — Sub-Prosesor Awal & Langkah Keamanan

[Dilengkapi para pihak: daftar sub-prosesor + wilayah pemrosesan +
ringkasan langkah keamanan teknis yang berlaku saat penandatanganan.]
