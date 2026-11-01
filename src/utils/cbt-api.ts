import type { CbtAnalytics, CbtAttempt, CbtAttemptNotices, CbtAttemptReview, CbtBankItem, CbtBulkPayload, CbtBulkResult, CbtExam, CbtGradingDetail, CbtGradingQueueItem, CbtMonitorData, CbtQuestion, CbtSubmission, CbtSummary } from '../types';
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
  attemptReview: (attemptId: string) => api<CbtAttemptReview>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/review`),
  proctorEvents: (attemptId: string, events: { type: string; at: string }[]) => api<{ attemptId: string; accepted: number }>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/proctor`, { method: 'POST', body: JSON.stringify({ events }), keepalive: true }),
  gradingQueue: () => api<CbtGradingQueueItem[]>('/api/cbt/grading'),
  gradingDetail: (attemptId: string) => api<CbtGradingDetail>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/grade`),
  saveGrades: (attemptId: string, scores: { [questionId: string]: number }, notes: { [questionId: string]: string }) => api<{ attemptId: string; gradingStatus: 'pending_grading' | 'graded'; pgScore: number; essayScores: { [questionId: string]: number }; essayNotes: { [questionId: string]: string }; score: number }>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/grade`, { method: 'POST', body: JSON.stringify({ scores, notes }) }),
  bankList: (subject?: string, q?: string) => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (q) params.set('q', q);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return api<CbtBankItem[]>(`/api/cbt/bank${suffix}`);
  },
  bankCreate: (item: { subject: string; topic?: string; question: CbtQuestion }) => api<CbtBankItem>('/api/cbt/bank', { method: 'POST', body: JSON.stringify(item) }),
  bankUpdate: (id: string, item: { subject: string; topic?: string; question: CbtQuestion }) => api<CbtBankItem>('/api/cbt/bank', { method: 'PATCH', body: JSON.stringify({ id, ...item }) }),
  bankDelete: (id: string) => api<{ id: string }>('/api/cbt/bank', { method: 'DELETE', body: JSON.stringify({ id }) }),
  createBulkExams: (payload: CbtBulkPayload) => api<CbtBulkResult>('/api/cbt/exams/bulk', { method: 'POST', body: JSON.stringify(payload) }),
  rotateToken: (examId: string) => api<{ token: string }>(`/api/cbt/exams/${encodeURIComponent(examId)}/token`, { method: 'POST' }),
  monitor: (examId: string) => api<CbtMonitorData>(`/api/cbt/exams/${encodeURIComponent(examId)}/monitor`),
  monitorAnnouncement: (examId: string, message: string) => api<{ id: string; message: string; createdAt: string }>(`/api/cbt/exams/${encodeURIComponent(examId)}/monitor/actions`, { method: 'POST', body: JSON.stringify({ action: 'announcement', message }) }),
  monitorExtendTime: (examId: string, minutes: 5 | 10 | 15, attemptId?: string) => api<{ extended: { attemptId: string; studentName: string; expiresAt: string }[] }>(`/api/cbt/exams/${encodeURIComponent(examId)}/monitor/actions`, { method: 'POST', body: JSON.stringify({ action: 'extend_time', minutes, ...(attemptId ? { attemptId } : {}) }) }),
  monitorForceSubmit: (examId: string, attemptId: string) => api<{ attemptId: string; studentName: string; score: number; pgScore: number; gradingStatus: 'pending_grading' | 'graded'; submittedBy: 'proctor'; submittedAt: string }>(`/api/cbt/exams/${encodeURIComponent(examId)}/monitor/actions`, { method: 'POST', body: JSON.stringify({ action: 'force_submit', attemptId }) }),
  attemptNotices: (attemptId: string) => api<CbtAttemptNotices>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/notices`),
};
