/************************************************
 * SMK AT-THAHIRIN - sinkronisasi absensi v2.
 *
 * Script Properties:
 *   SYNC_TOKEN       wajib, sama dengan secret Worker
 *   ROOT_FOLDER_NAME opsional, default "Absensi SMK AT-THAHIRIN"
 *   SET_PUBLIC_LINKS opsional, hanya "true" untuk mengaktifkan
 *
 * Sheet lama "Harian" dan "Rekap" tidak pernah dimodifikasi oleh v2.
 ************************************************/

const DAILY_SHEET = 'Harian Sync v2';
const WEEKLY_SHEET = 'Rekap Sync v2';
const MANIFEST_SHEET = '_SyncManifestV2';
const DAILY_HEADERS = [
  '_Sync Key', 'Tanggal', 'Kelas', 'NISN', 'Nama', 'Status', 'Keterangan', 'Waktu',
  'Link Foto', 'Link Folder',
];
const WEEKLY_HEADERS = [
  '_Sync Key', 'Minggu', 'Kelas', 'NISN', 'Nama', 'Hadir', 'Terlambat', 'Sakit', 'Izin', 'Alpa', 'Link Folder',
];
const MANIFEST_HEADERS = ['_Sync Key', 'Status', 'File ID', 'Link', 'Error', 'Updated At'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return respond({ ok: false, error: 'sync locked', results: [] });
  try {
    const body = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (!token || !body || !constantTimeEqual(String(body.token || ''), token)) {
      return respond({ ok: false, error: 'invalid token', results: [] });
    }
    if (body.action === 'daily') return respond(handleDaily(body));
    if (body.action === 'weekly') return respond(handleWeekly(body));
    return respond({ ok: false, error: 'unknown action', results: [] });
  } catch (err) {
    return respond({ ok: false, error: errorText(err), results: [] });
  } finally {
    lock.releaseLock();
  }
}

function handleDaily(body) {
  const entries = boundedEntries(body.entries);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getVersionedSheet(ss, DAILY_SHEET, DAILY_HEADERS, false);
  const manifest = getVersionedSheet(ss, MANIFEST_SHEET, MANIFEST_HEADERS, true);
  const results = [];

  entries.forEach(function(entry) {
    const entryId = String(entry.entryId || '');
    try {
      if (!entryId) throw new Error('entryId is required');
      const photo = ensureVerifiedPhoto(entry, manifest);
      const stableKey = 'daily:' + entryId;
      const row = [
        stableKey, safeSheetText(entry.tanggal), safeSheetText(entry.kelas), safeSheetText(entry.nisn),
        safeSheetText(entry.siswaName), safeSheetText(entry.status), safeSheetText(entry.keterangan),
        safeSheetText(entry.waktu), photo.link, photo.folderUrl,
      ];
      upsertByStableKey(sheet, stableKey, row);
      results.push({
        ok: true,
        entryId: entryId,
        photoId: entry.photoId || undefined,
        driveLink: photo.link || undefined,
        fileId: photo.fileId || undefined,
        status: entry.photoId ? 'verified' : 'synced',
      });
    } catch (err) {
      results.push({ ok: false, entryId: entryId || undefined, photoId: entry.photoId || undefined, error: errorText(err) });
    }
  });
  return resultEnvelope(results);
}

function handleWeekly(body) {
  const entries = boundedEntries(body.entries);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getVersionedSheet(ss, WEEKLY_SHEET, WEEKLY_HEADERS, false);
  const results = [];

  entries.forEach(function(entry) {
    const entryId = String(entry.entryId || '');
    const stableKey = 'weekly:' + String(body.weekStart || '') + ':' + entryId;
    try {
      if (!entryId || !body.weekStart || !body.weekEnd) throw new Error('weekly identity is incomplete');
      const folder = studentWeekFolder(entry.nama, entry.nisn, entry.kelas, body.weekEnd);
      const row = [
        stableKey, safeSheetText(body.weekLabel), safeSheetText(entry.kelas), safeSheetText(entry.nisn), safeSheetText(entry.nama),
        numberOrZero(entry.hadir), numberOrZero(entry.terlambat), numberOrZero(entry.sakit),
        numberOrZero(entry.izin), numberOrZero(entry.alpa), folder.getUrl(),
      ];
      upsertByStableKey(sheet, stableKey, row);
      results.push({ ok: true, entryId: entryId, status: 'synced' });
    } catch (err) {
      results.push({ ok: false, entryId: entryId || undefined, error: errorText(err) });
    }
  });
  return resultEnvelope(results);
}

function ensureVerifiedPhoto(entry, manifest) {
  if (!entry.photoId) return { link: '', fileId: '', folderUrl: '' };
  const photoId = String(entry.photoId);
  const manifestKey = 'photo:' + photoId;
  const folder = studentWeekFolder(entry.siswaName, entry.nisn, entry.kelas, entry.tanggal);
  const existing = findByStableKey(manifest, manifestKey);
  if (existing) {
    try {
      const existingFile = verifiedDriveFile(String(existing.values[2] || ''));
      return { link: existingFile.getUrl(), fileId: existingFile.getId(), folderUrl: folder.getUrl() };
    } catch (ignored) {
      // Manifest stale: recover from supplied link, deterministic filename, or payload.
    }
  }

  const suppliedId = extractDriveFileId(entry.driveLink);
  if (suppliedId) {
    try {
      const suppliedFile = verifiedDriveFile(suppliedId);
      recordPhotoManifest(manifest, manifestKey, suppliedFile, 'verified', '');
      return { link: suppliedFile.getUrl(), fileId: suppliedFile.getId(), folderUrl: folder.getUrl() };
    } catch (ignored) {
      // A stale/unreadable link is never considered verified.
    }
  }

  const fileName = safeDriveName(photoId) + mimeExtension(entry.mime);
  const matches = folder.getFilesByName(fileName);
  if (matches.hasNext()) {
    const matchedFile = verifiedDriveFile(matches.next().getId());
    recordPhotoManifest(manifest, manifestKey, matchedFile, 'verified', '');
    return { link: matchedFile.getUrl(), fileId: matchedFile.getId(), folderUrl: folder.getUrl() };
  }
  if (!entry.fotoBase64) throw new Error('photo payload is unavailable and no Drive file can be verified');

  const blob = Utilities.newBlob(Utilities.base64Decode(entry.fotoBase64), entry.mime || 'image/jpeg', fileName);
  const created = folder.createFile(blob);
  if (publicLinksEnabled()) created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const verified = verifiedDriveFile(created.getId());
  recordPhotoManifest(manifest, manifestKey, verified, 'verified', '');
  return { link: verified.getUrl(), fileId: verified.getId(), folderUrl: folder.getUrl() };
}

function verifiedDriveFile(fileId) {
  if (!fileId) throw new Error('Drive file ID is missing');
  const file = DriveApp.getFileById(fileId);
  if (file.getId() !== fileId || file.isTrashed()) throw new Error('Drive file verification failed');
  file.getName();
  return file;
}

function recordPhotoManifest(sheet, key, file, status, error) {
  upsertByStableKey(sheet, key, [key, status, file.getId(), file.getUrl(), safeSheetText(error || ''), new Date()]);
}

function upsertByStableKey(sheet, key, values) {
  if (!key) throw new Error('stable key is required');
  const existing = findByStableKey(sheet, key);
  const row = existing ? existing.row : sheet.getLastRow() + 1;
  ensureRowCapacity(sheet, row);
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
}

function findByStableKey(sheet, key) {
  if (sheet.getLastRow() < 2) return null;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(key)).matchEntireCell(true).findNext();
  if (!match) return null;
  const row = match.getRow();
  return { row: row, values: sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0] };
}

function getVersionedSheet(ss, name, headers, hidden) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
    if (actual.join('\u0000') !== headers.join('\u0000')) throw new Error(name + ' has incompatible headers');
  }
  ensureStableKeyProtection(sheet, hidden);
  return sheet;
}

function ensureStableKeyProtection(sheet, hidden) {
  if (!sheet.isColumnHiddenByUser(1)) sheet.hideColumns(1);
  const type = hidden ? SpreadsheetApp.ProtectionType.SHEET : SpreadsheetApp.ProtectionType.RANGE;
  const protections = sheet.getProtections(type);
  let managed = protections.find(function(protection) { return protection.getDescription() === 'Managed stable sync keys'; });
  if (!managed) {
    managed = hidden ? sheet.protect() : sheet.getRange('A:A').protect();
    managed.setDescription('Managed stable sync keys');
  }
  managed.setWarningOnly(false);
  const effectiveUser = Session.getEffectiveUser();
  managed.addEditor(effectiveUser);
  const effectiveEmail = effectiveUser.getEmail();
  managed.getEditors().forEach(function(editor) {
    if (editor.getEmail() !== effectiveEmail) managed.removeEditor(editor);
  });
  if (managed.canDomainEdit()) managed.setDomainEdit(false);
  if (hidden && !sheet.isSheetHidden()) sheet.hideSheet();
}

function ensureRowCapacity(sheet, row) {
  if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
}

function boundedEntries(entries) {
  if (!Array.isArray(entries)) return [];
  if (entries.length > 10) throw new Error('batch exceeds maximum of 10 entries');
  return entries;
}

function studentWeekFolder(siswaName, nisn, kelas, tanggalStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggalStr || ''))) throw new Error('invalid attendance date');
  const date = new Date(String(tanggalStr) + 'T00:00:00Z');
  const weekInfo = isoWeek(date);
  const rootName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'Absensi SMK AT-THAHIRIN';
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  const yearFolder = getOrCreateFolder(root, String(weekInfo.year));
  const weekFolder = getOrCreateFolder(yearFolder, 'W' + String(weekInfo.week).padStart(2, '0'));
  return getOrCreateFolder(weekFolder, safeDriveName(String(siswaName || 'Tanpa Nama') + '_' + String(nisn || kelas || 'unknown')));
}

function getOrCreateFolder(parent, name) {
  const safeName = safeDriveName(name);
  const folders = parent.getFoldersByName(safeName);
  if (folders.hasNext()) return folders.next();
  const folder = parent.createFolder(safeName);
  if (publicLinksEnabled()) folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function extractDriveFileId(link) {
  const match = String(link || '').match(/[-\w]{25,}/);
  return match ? match[0] : '';
}

function isoWeek(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return { year: value.getUTCFullYear(), week: Math.ceil((((value - yearStart) / 86400000) + 1) / 7) };
}

function safeSheetText(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function safeDriveName(value) {
  return String(value || 'unknown').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 120);
}

function mimeExtension(mime) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

function publicLinksEnabled() {
  return PropertiesService.getScriptProperties().getProperty('SET_PUBLIC_LINKS') === 'true';
}

function constantTimeEqual(left, right) {
  let different = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) different |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return different === 0;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function resultEnvelope(results) {
  const failed = results.filter(function(result) { return !result.ok; }).length;
  return { ok: failed === 0, processed: results.length, succeeded: results.length - failed, failed: failed, results: results };
}

function errorText(err) {
  return String(err && err.message ? err.message : err).slice(0, 500);
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
