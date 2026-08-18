import { getUserFromRequest, type AuthEnv } from '../../_lib/auth';
import { csvResponse, toCsv } from '../../_lib/csv';

interface Env extends AuthEnv {
  SCHOOL_NAME?: string;
}

const ATTENDANCE_STATUS = ['Hadir', 'Terlambat', 'Sakit', 'Izin', 'Alpa'];

// Rapor per siswa: identitas, rekap presensi, rekap nilai CBT per mapel + riwayat ujian.
//   GET /api/rapor/:nisn           -> JSON
//   GET /api/rapor/:nisn?format=csv -> CSV unduhan
export const onRequestGet: PagesFunction<Env, any, Record<string, unknown> & { user: any }> = async ({ env, request, params }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) return Response.json({ success: false, error: 'Tidak terautentikasi.' }, { status: 401 });

  const nisn = String(params.nisn || '');
  if (!/^\d{4,20}$/.test(nisn)) return Response.json({ success: false, error: 'NISN tidak valid.' }, { status: 400 });

  const isStaff = user.role === 'guru' || user.role === 'admin' || user.role === 'super_admin';
  const isSelf = (user.role === 'siswa' || user.role === 'ketua_kelas') && user.nipNisn === nisn;
  const isOwnClass = user.role === 'ketua_kelas' && user.ketuaStatus === 'approved' && !!user.classId;
  if (!isStaff && !isSelf && !isOwnClass) return Response.json({ success: false, error: 'Tidak berwenang.' }, { status: 403 });

  const student = await env.DB.prepare('SELECT nisn, name, class_id FROM students WHERE nisn = ? AND active = 1').bind(nisn).first<any>();
  if (!student) return Response.json({ success: false, error: 'Siswa tidak ditemukan.' }, { status: 404 });

  if (!isStaff && !isSelf && isOwnClass && student.class_id !== user.classId) {
    return Response.json({ success: false, error: 'Siswa di luar kelas Anda.' }, { status: 403 });
  }

  const [classRow, attendanceRows, subjectRows, examRows] = await Promise.all([
    env.DB.prepare('SELECT name FROM school_classes WHERE id = ?').bind(student.class_id).first<any>(),
    env.DB.prepare('SELECT status, COUNT(*) AS jumlah FROM attendance_records WHERE nisn = ? GROUP BY status').bind(nisn).all<any>(),
    env.DB.prepare(`
      SELECT e.subject, COUNT(*) AS exam_count, ROUND(AVG(a.score)) AS avg_score, MAX(a.score) AS best_score
      FROM cbt_attempts a JOIN cbt_exams e ON e.id = a.exam_id
      WHERE a.nisn = ? AND a.status = 'submitted'
      GROUP BY e.subject ORDER BY e.subject ASC
    `).bind(nisn).all<any>(),
    env.DB.prepare(`
      SELECT e.title, e.subject, e.exam_type, a.score, a.submitted_at
      FROM cbt_attempts a JOIN cbt_exams e ON e.id = a.exam_id
      WHERE a.nisn = ? AND a.status = 'submitted'
      ORDER BY a.submitted_at DESC LIMIT 50
    `).bind(nisn).all<any>(),
  ]);

  const attendance = ATTENDANCE_STATUS.map(status => ({ status, jumlah: Number((attendanceRows.results || []).find(r => r.status === status)?.jumlah || 0) }));
  const totalPresensi = attendance.reduce((sum, item) => sum + item.jumlah, 0);
  const hadir = attendance.filter(a => a.status === 'Hadir' || a.status === 'Terlambat').reduce((sum, a) => sum + a.jumlah, 0);
  const subjects = (subjectRows.results || []).map(row => ({
    subject: String(row.subject),
    examCount: Number(row.exam_count),
    avgScore: Number(row.avg_score || 0),
    bestScore: Number(row.best_score || 0),
  }));
  const exams = (examRows.results || []).map(row => ({
    title: String(row.title),
    subject: String(row.subject),
    examType: String(row.exam_type || 'latihan'),
    score: Number(row.score || 0),
    submittedAt: String(row.submitted_at || ''),
  }));

  const report = {
    siswa: { nisn, name: String(student.name), classId: String(student.class_id), className: classRow?.name ? String(classRow.name) : String(student.class_id) },
    presensi: { rincian: attendance, total: totalPresensi, hadirPersen: totalPresensi > 0 ? Math.round((hadir / totalPresensi) * 100) : 0 },
    cbt: { perMapel: subjects, totalUjian: subjects.reduce((sum, s) => sum + s.examCount, 0), rataRata: subjects.length ? Math.round(subjects.reduce((sum, s) => sum + s.avgScore * s.examCount, 0) / subjects.reduce((sum, s) => sum + s.examCount, 0)) : 0 },
    ujian: exams,
  };

  if (new URL(request.url).searchParams.get('format') === 'csv') {
    const rows: Array<Array<unknown>> = [
      ['RAPOR', env.SCHOOL_NAME || 'SMK PLUS AT-THAHIRIN'],
      ['NISN', report.siswa.nisn],
      ['Nama', report.siswa.name],
      ['Kelas', report.siswa.className],
      [],
      ['PRESENSI', ...ATTENDANCE_STATUS],
      ['Jumlah', ...attendance.map(a => a.jumlah)],
      ['Kehadiran (%)', report.presensi.hadirPersen],
      [],
      ['NILAI CBT', 'Tanggal', 'Mapel', 'Ujian', 'Jenis', 'Skor'],
      ...exams.map(e => ['', e.submittedAt, e.subject, e.title, e.examType, e.score]),
      [],
      ['RATA-RATA NILAI', report.cbt.rataRata],
    ];
    return csvResponse(toCsv(rows), `rapor-${nisn}.csv`);
  }

  return Response.json({ success: true, data: report });
};