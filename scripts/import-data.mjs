#!/usr/bin/env node
/**
 * Import massal data siswa & guru dari file Excel (.xlsx) ke SMKS PLUS AT THAHIRIN.
 *
 * Format file (4 sheet):
 *   - 3 sheet siswa (X, XI, XII) — kolom: NO, NAMA SISWA, JK, NISN, TANGGAL LAHIR
 *   - 1 sheet guru              — kolom: NO, NAMA GURU, JK, NIK, TANGGAL LAHIR
 *
 * Output ke folder imported/ (ter-ignore git karena berisi data pribadi):
 *   - siswa.json : array lengkap siswa_v1 (untuk app_data D1)
 *   - akun.sql   : INSERT/upsert akun login ke tabel users (PBKDF2-SHA256)
 *   - siswa.sql  : upsert koleksi siswa_v1 ke app_data
 *   - kelas.sql  : (opsional) update jumlahSiswa di kelas_v1
 *
 * Pemakaian:
 *   node scripts/import-data.mjs <file.xlsx>
 *
 * Aturan akun:
 *   - Login memakai NISN/NIK dengan password awal acak yang wajib diganti.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'imported');
const DEFAULT_FOTO =
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80';
const EMAIL_DOMAIN = 'smksplusatthahirin.sch.id';
const PASSWORD_ITERATIONS = 100_000;

// ---- Kelas yang dikenal (id + tingkat) --------------------------------
const KELAS_BY_TINGKAT = {
  X: { id: 'k1', name: 'X MPLB 1' },
  XI: { id: 'k2', name: 'XI MPLB 1' },
  XII: { id: 'k3', name: 'XII MPLB 1' },
};

// ---- Utilitas ----------------------------------------------------------
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s_]/g, '');

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function toIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const IDN_MONTHS = {
  januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, agt: 8, september: 9, okt: 10, oktober: 10, november: 11,
  nopember: 11, november: 11, november: 11, desember: 12, des: 12,
  // alias bahasa lain yang kadang muncul di sumber data
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8,
  october: 10, december: 12, mai: 5,
};

export function normalizeDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toIso(v);
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    // Excel serial date (hari sejak 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return toIso(d);
  }
  const s = String(v).trim();
  if (!s) return null;
  // "Bogor, 01 November 2008" -> ambil bagian tanggal setelah koma
  const datePart = s.includes(',') ? s.slice(s.lastIndexOf(',') + 1).trim() : s;
  let m = datePart.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const day = +m[1], mon = +m[2], yr = +m[3];
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  // Teks Indonesia: "12 Mei 2008", "5 Maret 2008"
  m = datePart.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const mon = IDN_MONTHS[String(m[2]).toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  }
  // "12-May-08" (format Excel default bila regional non-Indonesia)
  m = datePart.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const shortMonths = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const mon = shortMonths[String(m[2]).toLowerCase()];
    let yr = +m[3]; if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    if (mon) return `${yr}-${String(mon).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  }
  return null;
}

export function mapGender(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'l' || s === 'm' || s === 'pria' || s.startsWith('laki')) return 'L';
  if (s === 'p' || s === 'f' || s === 'wanita' || s.startsWith('peremp')) return 'P';
  return null;
}

function toPlainString(v) {
  if (v instanceof Date) return toIso(v);
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

// ---- Deteksi kolom dari header sheet ----------------------------------
export function detectColumns(headers) {
  const map = { no: null, name: null, gender: null, nisn: null, nik: null, ttl: null };
  headers.forEach((h, idx) => {
    const n = norm(h);
    if (n === 'no' || n === 'nomor') map.no = idx;
    else if (n.includes('nama')) map.name = idx;
    else if (n === 'jk' || n.includes('jenis') || n.includes('kelamin')) map.gender = idx;
    else if (n.includes('nisn')) map.nisn = idx;
    else if (n === 'nik') map.nik = idx;
    else if (n.includes('tanggal') || n.includes('lahir') || n === 'ttl' || n === 'tgl') map.ttl = idx;
  });
  return map;
}

// ---- Baca sheet ---------------------------------------------------------
// Struktur file riil: baris judul/TA/"KELAS : X", lalu baris header kolom.
// Baris header dicari otomatis (baris yang mengandung NAMA + NISN/NIK).
export function readSheet(ws) {
  const allRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true, header: 1 });
  if (!allRows.length) return { map: {}, rows: [], tingkat: null };

  // Cari baris "KELAS : X/XI/XII" pada 6 baris awal
  let tingkat = null;
  for (let i = 0; i < Math.min(allRows.length, 6); i++) {
    const cell = String(allRows[i]?.[0] ?? allRows[i]?.[1] ?? '');
    const m = cell.match(/KELAS\s*:\s*(X|XI|XII)\b/i);
    if (m) { tingkat = m[1].toUpperCase(); break; }
  }

  // Cari baris header (mengandung "nama" dan salah satu dari "nisn"/"nik")
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i].map((c) => toPlainString(c));
    const hasNama = row.some((h) => norm(h).includes('nama'));
    const hasIdCol = row.some((h) => norm(h).includes('nisn')) || row.some((h) => norm(h) === 'nik');
    if (hasNama && hasIdCol) { headerIdx = i; headers = row; break; }
  }
  if (headerIdx < 0) return { map: {}, rows: [], tingkat };

  const map = detectColumns(headers);
  const rows = allRows
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => toPlainString(c) !== ''));
  return { map, rows, tingkat };
}

export function mapSheetToTingkat(sheetName, detectedTingkat) {
  if (detectedTingkat) return detectedTingkat;
  const byName = { '10': 'X', '11': 'XI', '12': 'XII' };
  if (byName[String(sheetName).trim()]) return byName[String(sheetName).trim()];
  const n = norm(sheetName);
  if (n.includes('xii')) return 'XII';
  if (n.includes('xi')) return 'XI';
  if (n.includes('x')) return 'X';
  return null;
}

function pick(row, map, key) {
  return map[key] != null ? row[map[key]] : undefined;
}

// ---- Proses workbook (pure, bisa di-unit-test) ---------------------------
export function processWorkbook(wb, { padNisn = false, placeholderNisn = false, hash = hashPassword, passwordFactory = () => randomBytes(12).toString('base64url') } = {}) {
  const siswaOut = [];
  const guruRows = [];
  const warnings = [];
  const seenNisn = new Set();
  const seenNik = new Set();
  let countByTingkat = { X: 0, XI: 0, XII: 0 };
  let placeholderCounter = 0;

  for (const sheetName of wb.SheetNames) {
    const { map, rows, tingkat } = readSheet(wb.Sheets[sheetName]);
    if (!rows.length) continue;

    const isGuruSheet = map.nik != null && map.nisn == null;

    if (isGuruSheet) {
      rows.forEach((row, i) => {
        const name = toPlainString(pick(row, map, 'name'));
        const nik = toPlainString(pick(row, map, 'nik')).replace(/\D/g, '');
        const gender = mapGender(pick(row, map, 'gender'));
        const ttl = normalizeDate(pick(row, map, 'ttl'));
        if (!name || !nik) {
          warnings.push(`[Guru:${sheetName}] baris ${i + 1} dilewati (nama/NIK kosong)`);
          return;
        }
        if (nik.length !== 16) warnings.push(`[Guru:${sheetName}] baris ${i + 1}: NIK "${nik}" tidak 16 digit`);
        if (seenNik.has(nik)) warnings.push(`[Guru:${sheetName}] NIK duplikat "${nik}" (${name})`);
        seenNik.add(nik);
        guruRows.push({ name, nik, gender, ttl });
      });
      continue;
    }

    const kelasTingkat = mapSheetToTingkat(sheetName, tingkat);
    if (!kelasTingkat) {
      warnings.push(`[Siswa:${sheetName}] kelas tidak dikenali (X/XI/XII) — dilewati`);
      continue;
    }
    const kelas = KELAS_BY_TINGKAT[kelasTingkat];

    rows.forEach((row, i) => {
      const name = toPlainString(pick(row, map, 'name'));
      let nisn = toPlainString(pick(row, map, 'nisn')).replace(/\D/g, '');
      const nik = toPlainString(pick(row, map, 'nik')).replace(/\D/g, '');
      const gender = mapGender(pick(row, map, 'gender'));
      const ttl = normalizeDate(pick(row, map, 'ttl'));
      if (!name) {
        warnings.push(`[${kelas.name}] baris ${i + 1}: tanpa nama — dilewati`);
        return;
      }
      if (!nisn) {
        if (!placeholderNisn) {
          warnings.push(`[${kelas.name}] baris ${i + 1}: ${name} tanpa NISN — dilewati`);
          return;
        }
        placeholderCounter++;
        nisn = `12345678${String(placeholderCounter).padStart(2, '0')}`;
        warnings.push(`[${kelas.name}] baris ${i + 1}: ${name} tanpa NISN → placeholder "${nisn}" (dapat disunting admin)`);
      } else if (padNisn && nisn.length < 10 && /^\d+$/.test(nisn)) {
        const padded = nisn.padStart(10, '0');
        warnings.push(`[${kelas.name}] baris ${i + 1}: NISN "${nisn}" (${name}) dipad nol di depan → "${padded}"`);
        nisn = padded;
      }
      if (nisn.length !== 10) warnings.push(`[${kelas.name}] baris ${i + 1}: NISN "${nisn}" tidak 10 digit`);
      if (nik && nik.length !== 16) warnings.push(`[${kelas.name}] baris ${i + 1}: NIK "${nik}" tidak 16 digit`);
      if (seenNisn.has(nisn)) warnings.push(`[${kelas.name}] NISN duplikat "${nisn}" (${name})`);
      seenNisn.add(nisn);
      if (!gender) warnings.push(`[${kelas.name}] baris ${i + 1}: JK "${pick(row, map, 'gender')}" tidak dikenal (${name})`);

      countByTingkat[kelasTingkat]++;
      siswaOut.push({
        id: `s-${nisn}`,
        nisn,
        name,
        classId: kelas.id,
        gender: gender || 'L',
        foto: DEFAULT_FOTO,
        nik: nik || undefined,
        tanggalLahir: ttl || undefined,
        noHpOrangTua: '',
      });
    });
  }

  // ---- Bangun SQL akun (siswa + guru) ------------------------------------
  let akunSql = '-- Akun login hasil import Excel (PBKDF2-SHA256). Password awal = NISN/NIK.\n';
  const credentials = [];
  const upsert = (id, name, email, identifier, role, classId, nik, ttl) => {
    const password = passwordFactory();
    credentials.push({ name, identifier, password });
    const passwordHash = hash(password);
    const cols = ['id', 'name', 'email', 'nip_nisn', 'role', 'class_id', 'password_hash', 'nik', 'tanggal_lahir', 'jabatan', 'ketua_status', 'must_change_password'];
    const esc = (s) => String(s).replace(/'/g, "''");
    const vals = [
      `'${esc(id)}'`, `'${esc(name)}'`, `'${esc(email)}'`, `'${esc(identifier)}'`, `'${role}'`,
      classId ? `'${esc(classId)}'` : 'NULL', `'${esc(passwordHash)}'`,
      nik ? `'${esc(nik)}'` : 'NULL', ttl ? `'${esc(ttl)}'` : 'NULL', 'NULL', `'none'`, '1',
    ];
    return `INSERT INTO users (${cols.join(', ')})\n  VALUES (${vals.join(', ')})\n  ON CONFLICT(email) DO UPDATE SET\n    name = excluded.name,\n    nip_nisn = excluded.nip_nisn,\n    role = excluded.role,\n    class_id = excluded.class_id,\n    password_hash = excluded.password_hash,\n    nik = excluded.nik,\n    tanggal_lahir = excluded.tanggal_lahir,\n    ketua_status = 'none',\n    must_change_password = 1;\n`;
  };

  for (const s of siswaOut) {
    akunSql += upsert(`u-s${s.nisn}`, s.name, `s${s.nisn}@${EMAIL_DOMAIN}`, s.nisn, 'siswa', s.classId, s.nik, s.tanggalLahir);
  }
  for (const g of guruRows) {
    akunSql += upsert(`u-g${g.nik}`, g.name, `g${g.nik}@${EMAIL_DOMAIN}`, g.nik, 'guru', null, g.nik, g.ttl);
  }

  // ---- SQL koleksi siswa_v1 ------------------------------------------------
  const siswaJson = JSON.stringify(siswaOut);
  const siswaSql = `INSERT INTO app_data (key, value, updated_at)\n  VALUES ('siswa_v1', '${siswaJson.replace(/'/g, "''")}', unixepoch())\n  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;\n`;

  return { siswaOut, guruRows, warnings, countByTingkat, akunSql, siswaSql, credentials };
}

// ---- Main (CLI) --------------------------------------------------------------
function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Gunakan: node scripts/import-data.mjs <file.xlsx>');
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`File tidak ditemukan: ${file}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(file, { cellDates: true });
  const { siswaOut, guruRows, warnings, countByTingkat, akunSql, siswaSql, credentials } = processWorkbook(wb, {
    padNisn: process.argv.includes('--pad-nisn'),
    placeholderNisn: process.argv.includes('--placeholder-nisn'),
  });

  // ---- Patch jumlahSiswa di kelas_v1 (opsional, ambil data remote) ----------
  let kelasSql = '';
  try {
    const out = execSync(
      `npx wrangler d1 execute smk-at-tahirin-db --remote --json --command "SELECT value FROM app_data WHERE key = 'kelas_v1'"`,
      { cwd: ROOT, env: { ...process.env, NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] }
    ).toString();
    const parsed = JSON.parse(out);
    const valueStr = parsed?.[0]?.results?.[0]?.results?.[0]?.value;
    if (valueStr) {
      const kelas = JSON.parse(valueStr);
      for (const k of kelas) {
        const t = k.tingkat;
        const total = siswaOut.filter((s) => s.classId === k.id).length;
        if (total) k.jumlahSiswa = total;
      }
      kelasSql = `INSERT INTO app_data (key, value, updated_at)\n  VALUES ('kelas_v1', '${JSON.stringify(kelas).replace(/'/g, "''")}', unixepoch())\n  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;\n`;
    }
  } catch (e) {
    warnings.push('Gagal mengambil kelas_v1 dari D1 remote untuk patch jumlahSiswa (dilewati).');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'siswa.json'), JSON.stringify(siswaOut, null, 2));
  writeFileSync(join(OUT_DIR, 'akun.sql'), akunSql);
  writeFileSync(join(OUT_DIR, 'siswa.sql'), siswaSql);
  writeFileSync(join(OUT_DIR, 'kredensial-akun.txt'), credentials.map(item => `${item.name}\t${item.identifier}\t${item.password}`).join('\n') + '\n', { mode: 0o600 });
  if (kelasSql) writeFileSync(join(OUT_DIR, 'kelas.sql'), kelasSql);

  // ---- Ringkasan -------------------------------------------------------------
  console.log('=== HASIL IMPORT ===');
  console.log(`Siswa X  : ${countByTingkat.X}`);
  console.log(`Siswa XI : ${countByTingkat.XI}`);
  console.log(`Siswa XII: ${countByTingkat.XII}`);
  console.log(`Total    : ${siswaOut.length} siswa`);
  console.log(`Guru     : ${guruRows.length}`);
  console.log(`Akun SQL : ${siswaOut.length} siswa + ${guruRows.length} guru`);
  if (warnings.length) {
    console.log('\n=== PERINGATAN ===');
    warnings.slice(0, 30).forEach((w) => console.log(' - ' + w));
    if (warnings.length > 30) console.log(`... dan ${warnings.length - 30} peringatan lainnya`);
  } else {
    console.log('\nTidak ada peringatan.');
  }
  console.log('\nOutput: imported/siswa.json, imported/akun.sql, imported/siswa.sql, imported/kredensial-akun.txt' + (kelasSql ? ', imported/kelas.sql' : ''));
  console.log('\nLangkah berikutnya:');
  console.log('  source .env.cloudflare');
  console.log('  npx wrangler d1 migrations apply smk-at-tahirin-db --remote');
  console.log('  npx wrangler d1 execute smk-at-tahirin-db --remote --file=imported/akun.sql');
  console.log('  npx wrangler d1 execute smk-at-tahirin-db --remote --file=imported/siswa.sql');
  if (kelasSql) console.log('  npx wrangler d1 execute smk-at-tahirin-db --remote --file=imported/kelas.sql');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
