import { jsonResponse } from '../../_lib/response';

// Kredensial demo 1-klik (identik dengan seed users di migrations/0002_auth.sql)
const DEMO_CREDENTIALS = [
  { key: 'admin', role: 'Admin', identifier: 'admin@smksplusatthahirin.sch.id', password: 'admin123' },
  { key: 'guru', role: 'Guru', identifier: 'guru@smksplusatthahirin.sch.id', password: 'guru123' },
  { key: 'ketua', role: 'Ketua Kelas', identifier: 'ketua@smksplusatthahirin.sch.id', password: 'ketua123' },
  { key: 'siswa', role: 'Siswa', identifier: 'siswa@smksplusatthahirin.sch.id', password: 'siswa123' },
];

export const onRequestGet = () => jsonResponse({ success: true, data: DEMO_CREDENTIALS });
