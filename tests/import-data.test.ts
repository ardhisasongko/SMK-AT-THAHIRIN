import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import {
  normalizeDate,
  mapGender,
  detectColumns,
  mapSheetToTingkat,
  readSheet,
  processWorkbook,
} from '../scripts/import-data.mjs';

const FAST_HASH = () => 'pbkdf2$100000$test$test';

function makeWorkbook(sheets: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return wb;
}

const SISWA_HEADER = ['No', 'NAMA SISWA', 'JK', 'NIK', 'NISN', 'TANGGAL LAHIR'];
const GURU_HEADER = ['No', 'NAMA GURU', 'JK', 'NIK', 'TANGGAL LAHIR'];

function siswaSheet(rows: unknown[][], tingkat = 'X') {
  return [
    ['SMK PLUS AT-THAHIRIN'],
    ['TA. 2026/2027'],
    [`KELAS : ${tingkat}`],
    [],
    SISWA_HEADER,
    ...rows,
  ];
}

describe('normalizeDate', () => {
  it('parse "Kota, Hari Bulan Tahun" Indonesia', () => {
    expect(normalizeDate('Bogor, 01 November 2008')).toBe('2008-11-01');
  });
  it('mengenali alias bulan asing (mai, february)', () => {
    expect(normalizeDate('Bogor, 15 mai 2008')).toBe('2008-05-15');
    expect(normalizeDate('Bogor, 28 February 2011')).toBe('2011-02-28');
  });
  it('mendukung tanggal angka & ISO', () => {
    expect(normalizeDate('12/03/2008')).toBe('2008-03-12');
    expect(normalizeDate('2008-11-01')).toBe('2008-11-01');
  });
  it('mendukung "12-May-08" (format Excel)', () => {
    expect(normalizeDate('12-May-08')).toBe('2008-05-12');
  });
  it('mengembalikan null untuk kosong / tidak dikenal', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('gak jelas')).toBeNull();
  });
});

describe('mapGender', () => {
  it.each([
    ['L', 'L'], ['laki-laki', 'L'], ['Pria', 'L'], ['M', 'L'],
    ['P', 'P'], ['perempuan', 'P'], ['Wanita', 'P'], ['F', 'P'],
  ])('%s -> %s', (input, expected) => {
    expect(mapGender(input)).toBe(expected);
  });
  it('null untuk nilai tak dikenal', () => {
    expect(mapGender('x')).toBeNull();
  });
});

describe('detectColumns', () => {
  it('memetakan kolom siswa', () => {
    const map = detectColumns(SISWA_HEADER);
    expect(map.no).toBe(0);
    expect(map.name).toBe(1);
    expect(map.gender).toBe(2);
    expect(map.nik).toBe(3);
    expect(map.nisn).toBe(4);
    expect(map.ttl).toBe(5);
  });
});

describe('mapSheetToTingkat', () => {
  it('mengutamakan tingkat hasil deteksi dari isi sheet', () => {
    expect(mapSheetToTingkat('10', 'XI')).toBe('XI');
  });
  it('fallback ke nama sheet 10/11/12', () => {
    expect(mapSheetToTingkat('10', null)).toBe('X');
    expect(mapSheetToTingkat('11', null)).toBe('XI');
    expect(mapSheetToTingkat('12', null)).toBe('XII');
  });
  it('null bila tidak dikenali', () => {
    expect(mapSheetToTingkat('foo', null)).toBeNull();
  });
});

describe('readSheet', () => {
  it('mendeteksi header otomatis di bawah baris judul', () => {
    const ws = XLSX.utils.aoa_to_sheet(siswaSheet([['1', 'GHINA NAILA', 'P', '3201264111080001', '0082219950', 'Bogor, 01 November 2008']]));
    const { map, rows, tingkat } = readSheet(ws);
    expect(tingkat).toBe('X');
    expect(map.nisn).toBe(4);
    expect(rows).toHaveLength(1);
  });
  it('kembali kosong untuk sheet tanpa header', () => {
    const ws = XLSX.utils.aoa_to_sheet([['a'], ['b']]);
    const { map, rows } = readSheet(ws);
    expect(map.nisn).toBeUndefined();
    expect(rows).toHaveLength(0);
  });
});

describe('processWorkbook', () => {
  it('membaca siswa & guru, strip * pada NIK', () => {
    const wb = makeWorkbook({
      '10': siswaSheet([['1', 'GHINA NAILA', 'P', '3201264111080001', '0082219950', 'Bogor, 01 November 2008']]),
      GURU: [
        ['SMK PLUS AT-THAHIRIN'],
        ['TA. 2026/2027'],
        [],
        GURU_HEADER,
        ['1', 'Ir. SURANTO', 'L', '*3201263005640000', '01 Januari 1965'],
      ],
    });
    const { siswaOut, guruRows, countByTingkat, akunSql } = processWorkbook(wb, { hash: FAST_HASH });

    expect(siswaOut).toHaveLength(1);
    expect(siswaOut[0]).toMatchObject({ nisn: '0082219950', classId: 'k1', gender: 'P' });
    expect(siswaOut[0].tanggalLahir).toBe('2008-11-01');
    expect(countByTingkat.X).toBe(1);
    expect(guruRows[0]).toMatchObject({ name: 'Ir. SURANTO', nik: '3201263005640000' });
    expect(akunSql).toContain('g3201263005640000@smksplusatthahirin.sch.id');
    expect(akunSql).toContain("'siswa'");
  });

  it('--pad-nisn: NISN pendek dipad nol di depan + warning', () => {
    const wb = makeWorkbook({
      '10': siswaSheet([['1', 'RIAN IKHSAAN', 'L', '', '192007044', 'Bogor, 15 mai 2008']]),
    });
    const { siswaOut, warnings } = processWorkbook(wb, { padNisn: true, hash: FAST_HASH });
    expect(siswaOut[0].nisn).toBe('0192007044');
    expect(warnings.some((w) => w.includes('dipad nol'))).toBe(true);
  });

  it('--placeholder-nisn: siswa tanpa NISN dapat placeholder unik', () => {
    const wb = makeWorkbook({
      '10': siswaSheet([
        ['1', 'SAINA ALYATUL ULYA KADIR', 'P', '', '', '01 Januari 2008'],
        ['2', 'SATRIA', 'L', '', '', '02 Januari 2008'],
      ]),
    });
    const { siswaOut, warnings } = processWorkbook(wb, { placeholderNisn: true, hash: FAST_HASH });
    expect(siswaOut.map((s) => s.nisn)).toEqual(['1234567801', '1234567802']);
    expect(warnings.some((w) => w.includes('placeholder'))).toBe(true);
  });

  it('tanpa flag, siswa tanpa NISN dilewati', () => {
    const wb = makeWorkbook({
      '10': siswaSheet([['1', 'SAINA ALYATUL ULYA KADIR', 'P', '', '', '01 Januari 2008']]),
    });
    const { siswaOut, warnings } = processWorkbook(wb, { hash: FAST_HASH });
    expect(siswaOut).toHaveLength(0);
    expect(warnings.some((w) => w.includes('dilewati'))).toBe(true);
  });

  it('memberi peringatan NISN duplikat', () => {
    const wb = makeWorkbook({
      '10': siswaSheet([
        ['1', 'A', 'L', '', '0082219950', '01 Januari 2008'],
        ['2', 'B', 'L', '', '0082219950', '02 Januari 2008'],
      ]),
    });
    const { siswaOut, warnings } = processWorkbook(wb, { hash: FAST_HASH });
    expect(siswaOut).toHaveLength(2);
    expect(warnings.some((w) => w.includes('NISN duplikat'))).toBe(true);
  });

  it('menghasilkan SQL siswa_v1', () => {
    const wb = makeWorkbook({
      '10': siswaSheet([['1', 'GHINA NAILA', 'P', '3201264111080001', '0082219950', 'Bogor, 01 November 2008']]),
    });
    const { siswaSql } = processWorkbook(wb, { hash: FAST_HASH });
    expect(siswaSql).toContain("'siswa_v1'");
    expect(siswaSql).toContain('"nisn":"0082219950"');
  });
});
