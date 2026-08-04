import {
  Home,
  FileText,
  UserCheck,
  Users,
  BookOpen,
  MessageSquare,
  Bell,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import type { User } from './types';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  highlight?: boolean;
  isAi?: boolean;
}

const GUEST_ITEMS: NavItem[] = [{ id: 'landing', label: 'Beranda', icon: Home }];

export function getNavItems(currentUser: User | null, unreadCount = 0): NavItem[] {
  if (!currentUser) return GUEST_ITEMS;

  const items: NavItem[] = [
    { id: 'landing', label: 'Beranda', icon: Home },
    { id: 'cbt', label: 'Ujian CBT', icon: FileText, highlight: true },
    { id: 'absensi', label: 'Absensi', icon: UserCheck },
    { id: 'kelas', label: 'Kelas', icon: Users },
  ];

  if (currentUser.role === 'admin' || currentUser.role === 'guru') {
    items.push({ id: 'modul-ajar', label: 'Modul Ajar', icon: BookOpen, isAi: true });
  }

  items.push(
    { id: 'forum', label: 'Forum', icon: MessageSquare },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
    { id: 'profil', label: 'Profil', icon: UserIcon }
  );

  return items;
}
