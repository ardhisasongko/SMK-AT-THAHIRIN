import type { CbtAnalytics, CbtAttempt, CbtBulkPayload, CbtBulkResult, CbtExam, CbtQuestion, CbtSubmission, CbtSummary } from '../types';
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
  updateExam: (exam: CbtExam) => api<CbtExam>('/api/cbt/exams', { method: 'PATCH', body: JSON.stringify(exam) }),
  setExamStatus: (examId: string, status: 'active' | 'inactive' | 'completed') => api<{ id: string; status: CbtExam['status'] }>('/api/cbt/exams', { method: 'PATCH', body: JSON.stringify({ id: examId, status }) }),
  deleteExam: (examId: string) => api<{ id: string }>('/api/cbt/exams', { method: 'DELETE', body: JSON.stringify({ id: examId }) }),
  generateQuestions: (subject: string, count = 5) => api<CbtQuestion[]>('/api/cbt/generate', { method: 'POST', body: JSON.stringify({ subject, count }) }),
  startAttempt: (examId: string, token: string) => api<CbtAttempt>(`/api/cbt/exams/${encodeURIComponent(examId)}/attempts`, { method: 'POST', body: JSON.stringify({ token }) }),
  saveAttempt: (attemptId: string, answers: CbtSubmission['answers'], doubtful: CbtSubmission['doubtful']) => api<{ attemptId: string; savedAt: string }>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/save`, { method: 'POST', body: JSON.stringify({ answers, doubtful }) }),
  submitAttempt: (attemptId: string, submission: CbtSubmission) => api<CbtSubmission>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: JSON.stringify({ answers: submission.answers, doubtful: submission.doubtful }) }),
  summary: () => api<CbtSummary[]>('/api/cbt/summary'),
  analytics: () => api<CbtAnalytics>('/api/cbt/analytics'),
  createBulkExams: (payload: CbtBulkPayload) => api<CbtBulkResult>('/api/cbt/exams/bulk', { method: 'POST', body: JSON.stringify(payload) }),
  rotateToken: (examId: string) => api<{ token: string }>(`/api/cbt/exams/${encodeURIComponent(examId)}/token`, { method: 'POST' }),
};
