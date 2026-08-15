/************************************************
 * SMK AT-THAHIRIN — Sinkronisasi Absensi (Harian & Mingguan)
 * Dijalankan sebagai Web App di Google Apps Script.
 * Dipanggil oleh Worker Cloudflare "smk-absensi-sync" via POST JSON:
 *   { action: 'daily'|'weekly', token, ... }
 *
 * CARA SETUP (sekali saja):
 *  1. Buka Google Spreadsheet baru, misal "Absensi SMK AT-THAHIRIN".
 *  2. Extensions > Apps Script > tempel seluruh kode ini.
 *  3. Ganti CONFIG.TOKEN dengan string rahasia (SAMA dengan SYNC_TOKEN di sync-worker).
 *  4. Deploy > New deployment > Web app:
 *        - Execute as : Me
 *        - Who has access : Anyone
 *  5. Salin URL Web app, kirim ke developer (untuk APPS_SCRIPT_URL di sync-worker).
 *
 * HASIL:
 *  - Tab "Harian"  : 1 baris per siswa per hari + link foto full (Drive) + link folder.
 *  - Tab "Rekap"   : ringkasan mingguan per siswa + link folder minggu itu.
 *  - Drive         : /Absensi SMK AT-THAHIRIN/<Tahun>/W<mm>/<Nama_NISN>/...foto...
 ************************************************/

const CONFIG = {
  TOKEN: 'GANTI_DENGAN_TOKEN_RAHASIA',           // wajib sama dengan SYNC_TOKEN di Worker
  ROOT_FOLDER_NAME: 'Absensi SMK AT-THAHIRIN',   // nama folder akar di Drive
  SET_PUBLIC_LINKS: false,                       // foto siswa wajib tetap privat
};

// ---------------------------------------------------------------- entry point
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body || body.token !== CONFIG.TOKEN) {
      return respond({ ok: false, error: 'invalid token' });
    }
    if (body.action === 'daily') return respond(handleDaily(body));
    if (body.action === 'weekly') return respond(handleWeekly(body));
    return respond({ ok: false, error: 'unknown action' });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- helpers
function getOrCreateFolder(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  const f = parent.createFolder(name);
  if (CONFIG.SET_PUBLIC_LINKS) f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f;
}

function getSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function safeSheetText(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// Nomor minggu ISO-8601 dari sebuah Date
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

// Folder Drive per siswa per minggu: /Absensi SMK AT-THAHIRIN/<Tahun>/W<mm>/<Nama_NISN>
function studentWeekFolder(siswaName, nisn, kelas, tanggalStr) {
  const t = new Date(tanggalStr + 'T00:00:00');
  const { year, week } = isoWeek(t);
  const root = getOrCreateFolder(DriveApp.getRootFolder(), CONFIG.ROOT_FOLDER_NAME);
  const yearFolder = getOrCreateFolder(root, String(year));
  const weekFolder = getOrCreateFolder(yearFolder, 'W' + String(week).padStart(2, '0'));
  return getOrCreateFolder(weekFolder, `${siswaName}_${nisn}`);
}

// ---------------------------------------------------------------- job harian
function handleDaily(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Harian', [
    'Tanggal', 'Kelas', 'NISN', 'Nama', 'Status', 'Keterangan', 'Waktu',
    'Link Foto', 'Link Folder',
  ]);
  const results = [];
  for (const e of body.entries || []) {
    let link = '';
    if (e.fotoBase64) {
      const folder = studentWeekFolder(e.siswaName, e.nisn, e.kelas, e.tanggal);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(e.fotoBase64),
        e.mime || 'image/jpeg',
        `${e.tanggal}_${e.nisn}_${Date.now()}.jpg`
      );
      const file = folder.createFile(blob);
      if (CONFIG.SET_PUBLIC_LINKS) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      link = file.getUrl();
      sheet.appendRow([e.tanggal, safeSheetText(e.kelas), safeSheetText(e.nisn), safeSheetText(e.siswaName), safeSheetText(e.status), safeSheetText(e.keterangan), e.waktu, link, folder.getUrl()]);
      results.push({ photoId: e.photoId, driveLink: link });
    }
  }
  return { ok: true, results };
}

// ---------------------------------------------------------------- job mingguan
function handleWeekly(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Rekap', [
    'Minggu', 'Kelas', 'NISN', 'Nama', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Link Folder',
  ]);

  // Idempoten: hapus baris minggu yang sama bila sudah ada
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === body.weekLabel) sheet.deleteRow(i + 1);
  }

  for (const e of body.entries || []) {
    const folder = studentWeekFolder(e.nama, e.nisn, e.kelas, body.weekEnd);
    sheet.appendRow([
      safeSheetText(body.weekLabel), safeSheetText(e.kelas), safeSheetText(e.nisn), safeSheetText(e.nama),
      e.hadir || 0, e.sakit || 0, e.izin || 0, e.alpa || 0,
      folder.getUrl(),
    ]);
  }
  return { ok: true };
}
