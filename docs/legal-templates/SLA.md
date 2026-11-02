> # ⚠️ TEMPLAT — wajib ditinjau penasihat hukum sebelum digunakan; bukan nasihat hukum.
>
> Dokumen ini adalah templat awal yang disediakan bersama platform. Angka,
> jam layanan, dan isi di dalam kurung siku `[...]` wajib dilengkapi dan
> disesuaikan dengan kemampuan nyata penyedia layanan, lalu ditinjau
> penasihat hukum sebelum ditandatangani. Vendor tidak memberikan
> nasihat hukum melalui templat ini.

# PERJANJIAN TINGKAT LAYANAN (SLA) — Ringkas
## Platform Sistem Informasi Sekolah

Antara **[Nama Vendor]** ("Penyedia") dan **[Nama Sekolah/Yayasan]**
("Sekolah"), sebagai lampiran Perjanjian Layanan tertanggal [tanggal].

## 1. Ruang Lingkup

SLA ini mencakup ketersediaan dan dukungan untuk deployment Platform
milik Sekolah: aplikasi web (Cloudflare Pages), basis data (Cloudflare
D1), dan fitur yang diaktifkan dalam Perjanjian Layanan. Tidak termasuk:
jaringan internet Sekolah/pengguna, perangkat pengguna, layanan pihak
ketiga di luar kendali Penyedia (tercantum pada Bagian 5), dan fitur
yang dinyatakan beta/opsional (termasuk gateway WhatsApp jalur tidak
resmi, yang diberikan "sebagaimana adanya" tanpa jaminan ketersediaan).

## 2. Ketersediaan Layanan

- Target ketersediaan bulanan: **[99,0]%**, diukur dari keberhasilan
  pemeriksaan `GET /api/health` oleh pemantau pihak ketiga (atau
  pemantau Penyedia) per interval 5 menit.
- Jendela pemeliharaan terencana (migrasi basis data, rilis besar)
  diumumkan ≥ [3] hari sebelumnya, dilakukan di luar jam sekolah
  ([19.00–05.00 WIB]), dan dikecualikan dari perhitungan maksimum
  [4] jam/bulan.
- Gangguan darurat keamanan dapat dilakukan tanpa pemberitahuan awal
  demi keamanan data, dengan pemberitahuan susulan ≤ 24 jam.

## 3. Dukungan dan Waktu Respons

Kanal dukungan: [email/WhatsApp resmi Penyedia], jam layanan
[hari/jam, mis. Senin–Jumat 07.00–17.00 WIB].

| Prioritas | Definisi | Respons awal | Target penanganan |
|---|---|---|---|
| P1 — Kritis | Platform tidak dapat diakses / dugaan insiden data | ≤ [1] jam pada jam layanan | Penahanan ≤ [4] jam; pemulihan secepatnya |
| P2 — Tinggi | Fitur utama terganggu (login, ujian, presensi) | ≤ [4] jam layanan | ≤ [2] hari kerja |
| P3 — Biasa | Gangguan sebagian / pertanyaan penggunaan | ≤ [1] hari kerja | ≤ [5] hari kerja |

Untuk insiden data pribadi, para pihak mengikuti SOP respons insiden
dan kewajiban notifikasi UU PDP (maksimal 72 jam) sebagaimana diatur
dalam Perjanjian Pemrosesan Data.

## 4. Backup dan Pemulihan

- Backup basis data dilakukan sebelum setiap perubahan produksi dan
  secara rutin [mingguan]; retensi [4 backup mingguan + 90 hari untuk
  backup pra-rilis].
- Uji pemulihan (restore drill) dilakukan berkala [triwulanan].
- Target titik pemulihan (RPO): ≤ [7 hari] dari backup rutin, atau
  backup pra-rilis terakhir bila lebih baru. Target waktu pemulihan
  (RTO): ≤ [1] hari kerja sejak keputusan restore.

## 5. Pengecualian

Ketersediaan tidak dijamin untuk gangguan yang disebabkan oleh:
penyedia infrastruktur (Cloudflare/Google) di luar kendali Penyedia;
keadaan kahar; tindakan/pengaturan Sekolah (termasuk penghapusan data
oleh pengguna berwenang); pemblokiran layanan pihak ketiga atas nomor
WhatsApp gateway tidak resmi; serta penggunaan di luar ketentuan
Perjanjian Layanan.

## 6. Kompensasi Layanan (Service Credit)

Bila ketersediaan bulanan di bawah target, Sekolah berhak atas kredit
layanan terhadap biaya bulan berikutnya:

| Ketersediaan tercapai | Kredit |
|---|---|
| 98,0% – < 99,0% | [5]% biaya bulanan |
| 95,0% – < 98,0% | [10]% biaya bulanan |
| < 95,0% | [25]% biaya bulanan |

Kredit diajukan tertulis ≤ [30] hari setelah akhir bulan terkait dan
merupakan kompensasi maksimal atas ketidaktersediaan pada bulan itu.

## 7. Peninjauan

SLA ditinjau [tiap semester/tahun] atau setelah insiden P1, dan dapat
diubah hanya secara tertulis oleh kedua pihak.

| Sekolah | Penyedia |
|---|---|
| Nama: [nama] | Nama: [nama] |
| Jabatan: [jabatan] | Jabatan: [jabatan] |
| Tanda tangan & stempel: | Tanda tangan: |
| Tanggal: | Tanggal: |
