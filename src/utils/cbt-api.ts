import type { CbtExam, CbtSubmission } from '../types';
import { authHeaders } from './auth';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: authHeaders({ ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers as Record<string, string> }) });
  const json = await response.json() as { success?: boolean; data?: T; error?: string };
  if (!response.ok || !json.success || json.data === undefined) throw new Error(json.error || `Request gagal (HTTP ${response.status}).`);
  return json.data;
}

export const cbtApi = {
  exams: () => api<CbtExam[]>('/api/cbt/exams'),
  results: () => api<CbtSubmission[]>('/api/cbt/results'),
  createExam: (exam: CbtExam) => api<CbtExam>('/api/cbt/exams', { method: 'POST', body: JSON.stringify(exam) }),
  startAttempt: (examId: string, token: string) => api<{ attemptId: string; expiresAt: string; exam: CbtExam }>(`/api/cbt/exams/${encodeURIComponent(examId)}/attempts`, { method: 'POST', body: JSON.stringify({ token }) }),
  submitAttempt: (attemptId: string, submission: CbtSubmission) => api<CbtSubmission>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: JSON.stringify({ answers: submission.answers, doubtful: submission.doubtful }) }),
  rotateToken: (examId: string) => api<{ token: string }>(`/api/cbt/exams/${encodeURIComponent(examId)}/token`, { method: 'POST' }),
};
