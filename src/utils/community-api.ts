import type { ForumReply, ForumTopic, NotificationItem } from '../types';
import { authHeaders } from './auth';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: authHeaders({ ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers as Record<string,string> }) });
  const json = await response.json() as { success?: boolean; data?: T; error?: string };
  if (!response.ok || !json.success) throw new Error(json.error || `Request gagal (HTTP ${response.status}).`);
  return json.data as T;
}

export const forumApi = {
  list: () => api<ForumTopic[]>('/api/forum/topics'),
  create: (topic: ForumTopic) => api<ForumTopic>('/api/forum/topics', { method: 'POST', body: JSON.stringify(topic) }),
  reply: (topicId: string, reply: ForumReply) => api<ForumReply>(`/api/forum/topics/${encodeURIComponent(topicId)}/replies`, { method: 'POST', body: JSON.stringify(reply) }),
  like: (topicId: string, liked: boolean) => api<void>(`/api/forum/topics/${encodeURIComponent(topicId)}/like`, { method: liked ? 'PUT' : 'DELETE' }),
  moderate: (topicId: string, changes: { isPinned?: boolean; isResolved?: boolean }) => api<void>(`/api/forum/topics/${encodeURIComponent(topicId)}/moderation`, { method: 'PATCH', body: JSON.stringify(changes) }),
};

export const notificationApi = {
  list: () => api<NotificationItem[]>('/api/notifications'),
  create: (item: NotificationItem) => api<NotificationItem>('/api/notifications', { method: 'POST', body: JSON.stringify(item) }),
  read: (id: string) => api<void>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' }),
  readAll: () => api<void>('/api/notifications/read-all', { method: 'PUT' }),
};
