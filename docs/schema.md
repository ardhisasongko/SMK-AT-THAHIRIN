# Skema Basis Data — Sistem Informasi Sekolah (Template)

Database: **Cloudflare D1** (SQLite). Binding: `DB`. Migrasi: `migrations/0001_*.sql` s.d. `0024_*.sql`.

> Dokumen ini memuat versi **final** setiap tabel (perubahan dari migrasi berikutnya sudah digabung). Kolom yang ditambahkan belakangan ditandai `(+migrasi)`.

## Arsitektur Data: Dua Lapisan

1. **Lapisan relasional (sumber kebenaran)** — tabel domain (CBT, Forum, Notifikasi, WhatsApp sejak 0009–0010) dan proyeksi relasional data akademik (`school_classes`, `students`, `attendance_records`, `teaching_modules` sejak 0018). Sejak **0023**, semua penulisan data akademik ditangani aplikasi langsung ke proyeksi (bukan lewat `app_data`).
2. **Lapisan JSON legacy** — `app_data` menyimpan koleksi akademik (`kelas_v1`, `siswa_v1`, `presensi_v1`, `modulAjar_v1`) sebagai **mirror/arsip** (ditulis atomik bersama proyeksi lewat satu batch D1) agar pembaca legacy (`GET /api/data/:key`, WhatsApp contacts, forum, notifikasi, foto siswa, dll.) tetap berfungsi. Koleksi non-akademik (`users`, `cbt`, dll.) tetap hidup di `app_data` seperti biasa.

Relasi lintas lapisan banyak yang **logis tanpa FK fisik** (ciri legacy JSON + SQLite D1). Integritas dijaga di lapisan aplikasi.

## Tabel per Domain

### 1. Infrastruktur

#### `app_data` (0001) — penyimpanan JSON legacy
| Kolom | Tipe | Constraint |
|---|---|---|
| key | TEXT | PK — nama koleksi (`users`, `kelas_v1`, `siswa_v1`, `presensi_v1`, `modulAjar_v1`, …) |
| value | TEXT | NOT NULL — JSON blob seluruh array koleksi |
| updated_at | INTEGER | NOT NULL, DEFAULT `unixepoch()` |

#### `api_rate_limits` (0011, +0014)
| Kolom | Tipe | Constraint |
|---|---|---|
| key | TEXT | PK |
| window_started | INTEGER | NOT NULL |
| request_count | INTEGER | NOT NULL |
| window_expires (+0014) | INTEGER | NOT NULL, DEFAULT 0 |

#### `domain_migrations` (0012) — marker migrasi data domain
| Kolom | Tipe | Constraint |
|---|---|---|
| key | TEXT | PK |
| completed_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `academic_collection_revisions` (0018) — revisi proyeksi akademik
| Kolom | Tipe | Constraint |
|---|---|---|
| key | TEXT | PK |
| revision | INTEGER | NOT NULL, DEFAULT 0, CHECK (≥ 0) |
| initialized | INTEGER | NOT NULL, DEFAULT 0, CHECK (0/1) |
| updated_at | INTEGER | NOT NULL, DEFAULT `unixepoch()` |

### 2. Auth & Pengguna

#### `users` (0002, +0006, +0008)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| email | TEXT | UNIQUE, NOT NULL |
| nip_nisn | TEXT | UNIQUE |
| role | TEXT | NOT NULL, DEFAULT `'siswa'` — `super_admin \| admin \| guru \| ketua_kelas \| siswa` (tanpa CHECK; enforced di aplikasi) |
| class_id | TEXT | — (referensi logis ke `school_classes.id`) |
| password_hash | TEXT | NOT NULL (PBKDF2-SHA256, format `pbkdf2$100000$salt$hash`) |
| jabatan | TEXT | — |
| ketua_status | TEXT | NOT NULL, DEFAULT `'none'` (`none \| pending \| approved`) |
| approved_by / approved_at | TEXT | — |
| nik (+0006) | TEXT | — (guru; siswa memakai NISN di `nip_nisn`) |
| tanggal_lahir (+0006) | TEXT | — |
| status (+0008) | TEXT | NOT NULL, DEFAULT `'active'` (`active \| inactive \| archived`) |
| must_change_password (+0008) | INTEGER | NOT NULL, DEFAULT 0 |
| archived_at / archived_by (+0008) | TEXT | — |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `sessions` (0002)
| Kolom | Tipe | Constraint |
|---|---|---|
| token | TEXT | PK — disimpan **hash SHA-256** (`sha256:…`); TTL 7 hari |
| user_id | TEXT | NOT NULL, FK → users(id) (tanpa ON DELETE) |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |
| expires_at | TEXT | NOT NULL |

#### `user_audit_log` (0008)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| actor_id / actor_name / actor_role | TEXT | NOT NULL |
| action | TEXT | NOT NULL (CREATE_USER, UPDATE_USER, ARCHIVE_USER, DELETE_USER_PERMANENT, RESET_PASSWORD) |
| target_user_id / target_name | TEXT | — |
| before_value / after_value | TEXT | — (JSON) |
| reason | TEXT | — |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

### 3. Foto

#### `photos` (0003, +0004)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| data | TEXT | NOT NULL — base64 foto full |
| mime | TEXT | NOT NULL, DEFAULT `'image/jpeg'` |
| created_by | TEXT | — (referensi logis ke `users.id`) |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |
| thumb (+0004) | TEXT | — thumbnail permanen base64 |
| drive_link (+0004) | TEXT | — URL foto full di Google Drive |
| pushed (+0004) | INTEGER | NOT NULL, DEFAULT 0 (1 = sudah ter-sync ke Drive) |

> Catatan: `data` NOT NULL bertentangan dengan niat awal "kosongkan setelah di-push ke Drive" — aplikasi menyimpan placeholder atau tidak pernah mengosongkan.

### 4. Data Akademik (proyeksi relasional, 0018)

#### `school_classes`
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| position | INTEGER | NOT NULL |
| name | TEXT | NOT NULL |
| jurusan_code / tingkat / ruang / wali_kelas | TEXT | NOT NULL |
| jumlah_siswa | INTEGER | NOT NULL |
| fields | TEXT | NOT NULL |
| source_json | TEXT | NOT NULL, CHECK `json_valid(source_json)` |
| active | INTEGER | NOT NULL, DEFAULT 1, CHECK (0/1) |

#### `class_schedule_items` — PK (class_id, position)
| Kolom | Tipe | Constraint |
|---|---|---|
| class_id | TEXT | NOT NULL, FK → school_classes(id) |
| position | INTEGER | NOT NULL |
| hari / jam_ke / jam_rentan / mata_pelajaran / guru / ruangan | TEXT | NOT NULL |
| fields / source_json | TEXT | NOT NULL (source_json CHECK `json_valid`) |

#### `students`
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| position | INTEGER | NOT NULL |
| nisn | TEXT | NOT NULL — unik hanya saat `active = 1` (partial unique index) |
| class_id | TEXT | NOT NULL, FK → school_classes(id) |
| name / gender / foto | TEXT | NOT NULL |
| fields / source_json | TEXT | NOT NULL (source_json CHECK `json_valid`) |
| active | INTEGER | NOT NULL, DEFAULT 1, CHECK (0/1) |

#### `attendance_records` — PK (tanggal, student_id)
| Kolom | Tipe | Constraint |
|---|---|---|
| tanggal | TEXT | NOT NULL |
| student_id | TEXT | NOT NULL, FK → students(id) |
| id | TEXT | UNIQUE (id legacy, redundan vs PK — kompatibilitas JSON) |
| position | INTEGER | NOT NULL |
| class_id / student_name / nisn | TEXT | NOT NULL (snapshot denormalisasi) |
| status | TEXT | NOT NULL (tanpa CHECK — `Hadir \| Terlambat \| Sakit \| Izin \| Alpa` enforced di aplikasi) |
| keterangan / foto_url | TEXT | — |
| waktu_input | TEXT | NOT NULL |
| input_by_json / lokasi_json | TEXT | — (JSON) |
| fields / source_json | TEXT | NOT NULL (source_json CHECK `json_valid`) |

#### `teaching_modules`
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| position | INTEGER | NOT NULL |
| judul / mata_pelajaran / jurusan / fase_kelas / alokasi_waktu / tanggal_dibuat / pembuat | TEXT | NOT NULL |
| data_json | TEXT | NOT NULL, CHECK `json_valid` |
| fields / source_json | TEXT | NOT NULL (source_json CHECK `json_valid`) |
| active | INTEGER | NOT NULL, DEFAULT 1, CHECK (0/1) |

### 5. Presensi Audit Trail

#### `presensi_log` (0005)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| tanggal | TEXT | NOT NULL |
| siswa_id | TEXT | NOT NULL (referensi logis, bukan FK) |
| siswa_name | TEXT | NOT NULL |
| field_changed | TEXT | NOT NULL |
| old_value / new_value | TEXT | — |
| changed_by_name / changed_by_role | TEXT | NOT NULL |
| changed_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

### 6. WhatsApp

#### `guardian_contacts` (0009)
| Kolom | Tipe | Constraint |
|---|---|---|
| student_id | TEXT | PK (referensi logis ke siswa) |
| guardian_1_name / guardian_1_phone | TEXT | — |
| guardian_1_enabled | INTEGER | NOT NULL, DEFAULT 0 |
| guardian_2_name / guardian_2_phone | TEXT | — |
| guardian_2_enabled | INTEGER | NOT NULL, DEFAULT 0 |
| consent_at | TEXT | — |
| updated_by / updated_at | TEXT | NOT NULL DEFAULT `datetime('now')` |

#### `teacher_whatsapp_settings` (0009)
| Kolom | Tipe | Constraint |
|---|---|---|
| teacher_user_id | TEXT | PK (referensi logis ke `users.id`) |
| phone | TEXT | — |
| reminder_enabled | INTEGER | NOT NULL, DEFAULT 0 |
| reminder_time | TEXT | NOT NULL, DEFAULT `'05:30'` |
| updated_by / updated_at | TEXT | NOT NULL DEFAULT `datetime('now')` |

#### `whatsapp_settings` (0009) — singleton, CHECK (id = 1)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | INTEGER | PK, CHECK (id = 1) — hanya 1 baris |
| enabled | INTEGER | NOT NULL, DEFAULT 0 |
| absence_cutoff | TEXT | NOT NULL, DEFAULT `'09:00'` |
| active_start / active_end | TEXT | NOT NULL, DEFAULT `'05:00'` / `'17:00'` |
| max_batch | INTEGER | NOT NULL, DEFAULT 25 |
| retention_days | INTEGER | NOT NULL, DEFAULT 30 |
| updated_by / updated_at | TEXT | NOT NULL DEFAULT `datetime('now')` |

#### `whatsapp_outbox` (0009) — antrian pesan
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| dedupe_key | TEXT | UNIQUE, NOT NULL |
| recipient_phone | TEXT | NOT NULL |
| message_type | TEXT | NOT NULL |
| message_text | TEXT | NOT NULL |
| student_id / teacher_user_id / attendance_date | TEXT | — |
| status | TEXT | NOT NULL, DEFAULT `'pending'` (`pending \| processing \| sent \| sent_unknown \| failed \| skipped`) |
| attempt_count | INTEGER | NOT NULL, DEFAULT 0 |
| scheduled_at | TEXT | NOT NULL |
| claimed_at / claim_token / sent_at / last_error | TEXT | — |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `whatsapp_daily_stats` (0009)
| Kolom | Tipe | Constraint |
|---|---|---|
| stat_date | TEXT | PK |
| queued / sent / failed / skipped | INTEGER | NOT NULL, DEFAULT 0 |

#### `whatsapp_job_runs` (0009)
| Kolom | Tipe | Constraint |
|---|---|---|
| job_key | TEXT | PK |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `whatsapp_delivery_meta` (0017)
| Kolom | Tipe | Constraint |
|---|---|---|
| outbox_id | TEXT | PK, FK → whatsapp_outbox(id) ON DELETE CASCADE |
| delivery_state | TEXT | NOT NULL |
| provider_message_id | TEXT | — |
| send_started_at / provider_accepted_at | TEXT | — |
| updated_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `whatsapp_consent_events` (0017) — audit consent
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| student_id | TEXT | NOT NULL |
| action | TEXT | NOT NULL, CHECK (`granted` \| `revoked`) |
| provenance | TEXT | NOT NULL |
| recorded_by | TEXT | — |
| recorded_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `whatsapp_teacher_reminders` (0017) — PK (teacher_user_id, reminder_date)
| Kolom | Tipe | Constraint |
|---|---|---|
| teacher_user_id | TEXT | NOT NULL |
| reminder_date | TEXT | NOT NULL |
| outbox_id | TEXT | — |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `whatsapp_event_revisions` (0017) — fingerprint event (dedupe)
| Kolom | Tipe | Constraint |
|---|---|---|
| event_group | TEXT | PK |
| last_fingerprint | TEXT | NOT NULL (FNV-1a) |
| revision | INTEGER | NOT NULL, DEFAULT 1 |
| updated_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

#### `whatsapp_reconciliation_events` (0017)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| outbox_id | TEXT | NOT NULL, FK → whatsapp_outbox(id) ON DELETE CASCADE |
| resolution | TEXT | NOT NULL, CHECK (`sent` \| `failed`) |
| note | TEXT | NOT NULL |
| resolved_by | TEXT | NOT NULL |
| resolved_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

### 7. CBT (Computer Based Test)

#### `cbt_exams` (0010, +0013, +0019, +0022)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| title / subject | TEXT | NOT NULL |
| class_target | TEXT | NOT NULL |
| duration_minutes | INTEGER | NOT NULL, CHECK (1–300) |
| token_hash | TEXT | NOT NULL (SHA-256 uppercase) |
| teacher_user_id | TEXT | — (referensi logis ke `users.id`) |
| teacher_name | TEXT | NOT NULL |
| start_date / end_date | TEXT | NOT NULL |
| status | TEXT | NOT NULL, CHECK (`active` \| `upcoming` \| `completed`) |
| is_active (+0013) | INTEGER | NOT NULL, DEFAULT 1, CHECK (0/1) |
| open_time / close_time (+0019) | TEXT | — (jam buka/tutup harian WIB, HH:MM, nullable) |
| exam_type (+0022) | TEXT | NOT NULL, DEFAULT `'latihan'` (`latihan \| ujian`, enforced aplikasi) |
| min_submit_minutes (+0022) | INTEGER | — (nullable; default 80% durasi dihitung aplikasi) |
| created_at / updated_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

> Dua mekanisme aktivasi: `status` (upcoming/active/completed) dan `is_active` (0/1) + jam `open_time/close_time` — state ujian ditentukan gabungan ketiganya.

#### `cbt_questions` — PK (exam_id, id); di-rebuild total di 0021
| Kolom | Tipe | Constraint |
|---|---|---|
| exam_id | TEXT | NOT NULL, FK → cbt_exams(id) ON DELETE CASCADE |
| id | TEXT | NOT NULL |
| position | INTEGER | NOT NULL |
| question | TEXT | NOT NULL |
| question_type (+0020) | TEXT | NOT NULL, DEFAULT `'pg'` (`pg \| essai`, enforced aplikasi) |
| options_json | TEXT | NOT NULL |
| correct_answer | TEXT | NOT NULL — **CHECK A–E dilepas di 0021** agar bisa kunci jawaban teks essai |
| explanation | TEXT | — |

#### `cbt_attempts` (0010) — UNIQUE (exam_id, student_user_id): 1 attempt/siswa/ujian
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| exam_id | TEXT | NOT NULL, FK → cbt_exams(id) ON DELETE RESTRICT |
| student_user_id | TEXT | NOT NULL (referensi logis ke `users.id`) |
| student_name / nisn | TEXT | NOT NULL |
| status | TEXT | NOT NULL, CHECK (`in_progress` \| `submitted` \| `expired`) |
| started_at / expires_at | TEXT | NOT NULL |
| submitted_at | TEXT | — |
| answers_json / doubtful_json | TEXT | NOT NULL, DEFAULT `'{}'` (snapshot saat submit) |
| score / correct_count / wrong_count / time_spent_seconds | INTEGER | — |

#### `cbt_attempt_answers` (0019) — auto-save jawaban
| Kolom | Tipe | Constraint |
|---|---|---|
| attempt_id | TEXT | PK, FK → cbt_attempts(id) ON DELETE CASCADE |
| answers_json | TEXT | NOT NULL, DEFAULT `'{}'` |
| doubtful_json | TEXT | NOT NULL, DEFAULT `'{}'` |
| saved_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

> Dua sumber kebenaran jawaban: `cbt_attempts.answers_json` (snapshot submit) vs `cbt_attempt_answers` (auto-save per-request) — sinkronisasi eksplisit dilakukan aplikasi.

### 8. Forum

#### `forum_topics` (0010, +0015)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| title | TEXT | NOT NULL |
| category_type | TEXT | NOT NULL, CHECK (`mapel` \| `kelas`) |
| category_name | TEXT | NOT NULL |
| author_user_id / author_name / author_role | TEXT | NOT NULL |
| author_avatar | TEXT | NOT NULL, DEFAULT `''` |
| content | TEXT | NOT NULL |
| tags_json / attachments_json | TEXT | NOT NULL, DEFAULT `'[]'` |
| legacy_like_count | INTEGER | NOT NULL, DEFAULT 0, CHECK (≥ 0) |
| view_count | INTEGER | NOT NULL, DEFAULT 0, CHECK (≥ 0) |
| is_pinned / is_resolved | INTEGER | NOT NULL, DEFAULT 0, CHECK (0/1) |
| created_at / updated_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |
| deleted_at | TEXT | — (soft delete) |
| class_id (+0015) | TEXT | — (backfill dari `app_data.kelas_v1`) |

#### `forum_replies` (0010)
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| topic_id | TEXT | NOT NULL, FK → forum_topics(id) ON DELETE CASCADE |
| author_user_id / author_name / author_role | TEXT | NOT NULL |
| author_avatar | TEXT | NOT NULL, DEFAULT `''` |
| content | TEXT | NOT NULL |
| attachments_json | TEXT | NOT NULL, DEFAULT `'[]'` |
| legacy_like_count | INTEGER | NOT NULL, DEFAULT 0, CHECK (≥ 0) |
| created_at / updated_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |
| deleted_at | TEXT | — |

#### `forum_topic_likes` (0010) — PK (topic_id, user_id)
| Kolom | Tipe | Constraint |
|---|---|---|
| topic_id | TEXT | NOT NULL, FK → forum_topics(id) ON DELETE CASCADE |
| user_id | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

### 9. Notifikasi

#### `notifications` (0010) — UNIQUE (source_kind, source_id): dedup per sumber
| Kolom | Tipe | Constraint |
|---|---|---|
| id | TEXT | PK |
| title / message | TEXT | NOT NULL |
| target_role | TEXT | NOT NULL, CHECK (`semua` \| `guru` \| `siswa` \| `admin`) |
| target_class_id | TEXT | — |
| category | TEXT | NOT NULL, CHECK (`Ujian` \| `Tugas` \| `Absensi` \| `Forum` \| `Pengumuman` \| `Sistem`) |
| sender_user_id / sender_name / sender_role | TEXT | — |
| action_url | TEXT | — |
| source_kind / source_id | TEXT | — |
| created_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |
| deleted_at | TEXT | — |

> UNIQUE (source_kind, source_id) dengan kolom nullable: di SQLite NULL lolos UNIQUE, jadi notifikasi tanpa sumber tidak terdampak dedup.

#### `notification_reads` (0010) — PK (notification_id, user_id)
| Kolom | Tipe | Constraint |
|---|---|---|
| notification_id | TEXT | NOT NULL, FK → notifications(id) ON DELETE CASCADE |
| user_id | TEXT | NOT NULL |
| read_at | TEXT | NOT NULL, DEFAULT `datetime('now')` |

### 10. Integrasi Eksternal

#### `external_integrations` (0017)
| Kolom | Tipe | Constraint |
|---|---|---|
| integration_key | TEXT | PK |
| enabled | INTEGER | NOT NULL, DEFAULT 0 |
| emergency_pause | INTEGER | NOT NULL, DEFAULT 1 |
| rollout_mode | TEXT | NOT NULL, DEFAULT `'off'`, CHECK (`off` \| `canary` \| `all`) |
| allowlist_json | TEXT | NOT NULL, DEFAULT `'[]'` |
| last_heartbeat_at | TEXT | — |
| gateway_status | TEXT | NOT NULL, DEFAULT `'never_seen'` |
| gateway_version | TEXT | — |
| health_json | TEXT | — |
| updated_by / updated_at | TEXT | NOT NULL DEFAULT `datetime('now')` |

## Relasi Antar Tabel

```
users ───────┬─< sessions (FK user_id)
             ├─< user_audit_log               (logis: actor_id/target_user_id)
             ├─< photos.created_by            (logis)
             ├─< teacher_whatsapp_settings    (PK teacher_user_id, logis)
             ├─< cbt_exams.teacher_user_id    (logis)
             ├─< cbt_attempts.student_user_id (logis)
             ├─< forum_topics/replies.author  (logis)
             └─< notification_reads.user_id   (logis)

cbt_exams ──┬─< cbt_questions        (FK exam_id, ON DELETE CASCADE)
            ├─< cbt_attempts         (FK exam_id, ON DELETE RESTRICT)
            └─< cbt_attempts ──< cbt_attempt_answers (FK attempt_id, CASCADE)

forum_topics ─┬─< forum_replies      (FK topic_id, CASCADE)
              ├─< forum_topic_likes  (FK topic_id, CASCADE)
              └─< notifications      (logis: source_kind='forum', source_id=topik)

notifications ──< notification_reads (FK notification_id, CASCADE)

whatsapp_outbox ─┬─< whatsapp_delivery_meta        (FK outbox_id, CASCADE)
                 ├─< whatsapp_reconciliation_events (FK outbox_id, CASCADE)
                 └─(logis) student_id → siswa / teacher_user_id → users

app_data (JSON mirror akademik) ⇄──batch atomik (0023)──> school_classes / class_schedule_items /
                                                        students / attendance_records / teaching_modules
                                                        (+ academic_collection_revisions)

school_classes ──< class_schedule_items (FK class_id)
school_classes ──< students.class_id    (FK)
students ──< attendance_records.student_id (FK)
students.id ──(logis)──> guardian_contacts.student_id, presensi_log.siswa_id, forum_topics.class_id
```

FK fisik hanya pada: `sessions`, `cbt_questions`, `cbt_attempts`, `cbt_attempt_answers`, `forum_replies`, `forum_topic_likes`, `notification_reads`, `whatsapp_delivery_meta`, `whatsapp_reconciliation_events`, `class_schedule_items`, `students`, `attendance_records`. Selebihnya referensi logis.

## Trigger

1. **Proteksi soal CBT setelah ujian dimulai** (0015, dibuat ulang di 0021): `prevent_cbt_question_insert_after_attempt` / `_update_after_attempt` / `_delete_after_attempt` — begitu ada attempt untuk sebuah ujian, soal ujian itu tidak boleh diubah/disisipkan/dihapus (RAISE ABORT `CBT_EXAM_ALREADY_STARTED`).
2. ~~Sinkronisasi proyeksi relasional dari `app_data`~~ **(di-drop di 0023)** — trigger 0018 (`sync_kelas_projection_*`, `sync_siswa_projection_*`, `sync_presensi_projection_*`, `sync_modules_projection_*`) dihapus setelah re-sync akhir. Kini aplikasi menulis proyeksi + mirror `app_data` + revisi dalam satu batch D1 atomik (lihat `functions/_lib/relational-data.ts`, `functions/_lib/student-roster.ts`).

## Index Penting

| Index | Tabel | Kolom | Fungsi |
|---|---|---|---|
| idx_sessions_user / _expires | sessions | user_id / expires_at | lookup sesi & purge |
| idx_users_status | users | status | filter aktif/arsip |
| idx_wa_outbox_claim | whatsapp_outbox | status, scheduled_at | claim worker |
| idx_cbt_exams_dates | cbt_exams | status, start_date, end_date | cari ujian aktif |
| idx_cbt_attempts_student | cbt_attempts | student_user_id, submitted_at DESC | riwayat siswa |
| idx_forum_topics_created | forum_topics | is_pinned DESC, created_at DESC | urutan list |
| idx_forum_topics_class | forum_topics | category_type, class_id | visibilitas per kelas |
| idx_notifications_target | notifications | target_role, target_class_id, created_at DESC | target notif |
| idx_api_rate_limits_expiration | api_rate_limits | window_expires | cleanup (pengganti index window_started yang di-drop 0014) |
| idx_students_active_nisn_unique | students | nisn | **UNIQUE parsial `WHERE active = 1`** |
| idx_attendance_class_date | attendance_records | class_id, tanggal | rekap per kelas |
| idx_modules_subject | teaching_modules | mata_pelajaran, active | pencarian modul |
| idx_cbt_attempts_status_submitted | cbt_attempts | status, submitted_at DESC | 4 query hasil/analitik/ekspor (filter `status='submitted'` + urut) — 0024 |
| idx_cbt_attempts_nisn | cbt_attempts | nisn, status, submitted_at DESC | rapor per NISN (2 query) — 0024 |
| idx_attendance_nisn | attendance_records | nisn, status, tanggal | rekap presensi rapor per NISN — 0024 |
| idx_cbt_exams_teacher | cbt_exams | teacher_user_id | filter analitik guru + EXISTS hapus user — 0024 |
| idx_forum_topics_author | forum_topics | author_user_id | EXISTS hapus user — 0024 |
| idx_forum_replies_author | forum_replies | author_user_id | EXISTS hapus user — 0024 |
| idx_notifications_sender | notifications | sender_user_id, created_at DESC | branch sender di list notifikasi + hapus user — 0024 |
| idx_wa_outbox_teacher | whatsapp_outbox | teacher_user_id | EXISTS hapus user — 0024 |

Daftar lengkap ±45 index ada di migrasi; di atas hanya yang paling dipakai query.

## Daftar Migrasi

| # | Isi |
|---|---|
| 0001 | `app_data` — model JSON per-koleksi |
| 0002 | `users` + `sessions`, RBAC, seed admin (PBKDF2 100k iterasi) |
| 0003 | `photos` — base64 di D1 |
| 0004 | `photos`: +thumb, +drive_link, +pushed (strategi Drive) |
| 0005 | `presensi_log` — audit trail presensi |
| 0006 | `users`: +nik, +tanggal_lahir |
| 0007 | Data-fix nama kepala sekolah `Surantro` → `Suranto` |
| 0008 | `users`: +status/must_change_password/archived; `user_audit_log`; seed → super_admin |
| 0009 | 6 tabel WhatsApp (kontak, settings, outbox, stats, job runs) |
| 0010 | Pivot: CBT, Forum, Notifikasi relasional |
| 0011 | `api_rate_limits` |
| 0012 | `domain_migrations` (marker) |
| 0013 | `cbt_exams`: +is_active |
| 0014 | `api_rate_limits`: +window_expires; backfill expire semua counter |
| 0015 | `forum_topics`: +class_id; trigger proteksi soal CBT |
| 0016 | Keamanan: paksa ganti password admin seed, purge sesi expired |
| 0017 | `external_integrations` + 5 tabel audit/pengiriman WA |
| 0018 | Pivot kedua: proyeksi relasional akademik + 8 trigger sync |
| 0019 | `cbt_exams`: +open_time/close_time; `cbt_attempt_answers` |
| 0020 | `cbt_questions`: +question_type |
| 0021 | Rebuild `cbt_questions` tanpa CHECK correct_answer (mendukung essai) |
| 0022 | `cbt_exams`: +exam_type, +min_submit_minutes |
| 0023 | Tutup lapisan tulis `app_data` akademik: re-sync akhir proyeksi, drop 8 trigger sync 0018 |
| 0024 | Hardening D1: 8 index tambahan sesuai pola query produksi (hasil/analitik CBT, rapor NISN, hapus user) |

## Anomali & Catatan Penting (keputusan desain)

1. **CHECK correct_answer A–E dilepas (0021)** — dulu memblokir soal essai (`SQLITE_CONSTRAINT` → Worker 1101). `cbt_questions` di-rebuild penuh; index & trigger dibuat ulang.
2. **`users.role` tanpa CHECK** — konsistensi role bergantung aplikasi.
3. **`exam_type`, `question_type`, `attendance_records.status`, `whatsapp_outbox.status`** juga tidak di-CHECK DB — enforced di aplikasi.
4. **`cbt_exams` punya 2 mekanisme aktivasi** (status + is_active + jam buka/tutup) — potensi ambiguitas state; aplikasi menghitung `effectiveCbtStatus`.
5. **`min_submit_minutes` nullable** — "default 80% durasi" dihitung aplikasi (`resolveMinSubmitSeconds`).
6. **`attendance_records.id` UNIQUE redundan** — dipertahankan demi kompatibilitas JSON legacy.
7. **Sinkronisasi 0018 destruktif (historis)** — dulu update `presensi_v1` = DELETE semua `attendance_records` lalu insert ulang; `class_schedule_items` juga di-delete total. Di **0023** trigger dihapus; penulisan batch aplikasi menggunakan full-replace yang sama tapi dipegang aplikasi dengan FK pre-check (referensi siswa/kelas yang tidak ada ditolak, bukan di-skip).
8. **Unique NISN hanya siswa aktif** — NISN boleh duplikat antar siswa non-aktif.
9. **`sessions` FK tanpa ON DELETE CASCADE** — hapus user dengan sesi aktif harus bersihkan sesi dulu.
10. **0007 data-fix** — migrasi juga dipakai untuk perbaikan data, bukan hanya skema.
11. **Seeder admin tunggal** — guru/siswa diimpor via `scripts/import-data.mjs`; `users.class_id` tidak ber-FK.