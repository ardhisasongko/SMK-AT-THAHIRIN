import {
  Home,
  FileText,
  UserCheck,
  Users,
  BookOpen,
  MessageSquare,
  Bell,
  UserCog,
  MessageCircle,
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

  if (currentUser.role === 'siswa' || currentUser.role === 'ketua_kelas') {
    return [
      { id: 'landing', label: 'Beranda', icon: Home },
      { id: 'cbt', label: 'Ujian CBT', icon: FileText, highlight: true },
      { id: 'absensi', label: 'Absensi', icon: UserCheck },
      { id: 'forum', label: 'Forum', icon: MessageSquare },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
      { id: 'profil', label: 'Profil', icon: UserIcon },
    ];
  }

  const staffItems: NavItem[] = [
    { id: 'landing', label: 'Beranda', icon: Home },
    { id: 'cbt', label: 'Ujian CBT', icon: FileText, highlight: true },
    { id: 'absensi', label: 'Absensi', icon: UserCheck },
    { id: 'kelas', label: 'Kelas', icon: Users },
    { id: 'modul-ajar', label: 'Modul Ajar', icon: BookOpen, isAi: true },
    { id: 'forum', label: 'Forum', icon: MessageSquare },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
    { id: 'profil', label: 'Profil', icon: UserIcon },
  ];
  if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
    staffItems.splice(-1, 0,
      { id: 'pengguna', label: 'Pengguna', icon: UserCog },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    );
  }
  return staffItems;
}

export function canAccessTab(currentUser: User | null, tab: string): boolean {
  if (tab === 'landing') return true;
  if (!currentUser) return false;
  return getNavItems(currentUser).some(item => item.id === tab);
}
