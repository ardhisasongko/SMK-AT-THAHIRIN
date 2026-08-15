import React, { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Send, 
  Filter, 
  Calendar, 
  FileText, 
  CheckCircle, 
  MessageSquare, 
  Megaphone, 
  ShieldAlert, 
  X, 
} from 'lucide-react';
import { Kelas, NotificationItem, NotificationCategory, NotificationTargetRole, User } from '../types';
import { notificationApi } from '../utils/community-api';

interface NotifikasiSectionProps {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  currentUser: User | null;
  kelasList: Kelas[];
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
}

export const NotifikasiSection: React.FC<NotifikasiSectionProps> = ({
  notifications,
  setNotifications,
  currentUser,
  kelasList,
  setActiveTab,
  onOpenLogin
}) => {
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('semua');
  const [selectedTargetRole, setSelectedTargetRole] = useState<string>('semua');
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);

  // Send Broadcast Notification Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastCategory, setBroadcastCategory] = useState<NotificationCategory>('Pengumuman');
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<NotificationTargetRole>('siswa');
  const [broadcastClassId, setBroadcastClassId] = useState<string>('semua');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');

  // Icon mapping for notification categories
  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'Ujian': return <Calendar className="w-5 h-5 text-amber-600" />;
      case 'Tugas': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'Absensi': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'Forum': return <MessageSquare className="w-5 h-5 text-indigo-600" />;
      case 'Sistem': return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      default: return <Megaphone className="w-5 h-5 text-purple-600" />;
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (id: string) => {
    if (!currentUser) return;
    try { await notificationApi.read(id); } catch { return; }
    setNotifications(notifications.map(n => {
      if (n.id === id) {
        return { ...n, isRead: true };
      }
      return n;
    }));
  };

  // Mark all notifications as read for current user
  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    try { await notificationApi.readAll(); } catch { return; }
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  // Create Broadcast Notification
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    const newNotif: NotificationItem = {
      id: `n-${Date.now()}`,
      title: broadcastTitle,
      message: broadcastMessage,
      targetRole: broadcastTargetRole,
      targetClassId: broadcastTargetRole === 'siswa' && broadcastClassId !== 'semua' ? broadcastClassId : undefined,
      category: broadcastCategory,
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      isRead: true,
      senderName: currentUser.name,
      senderRole: currentUser.role,
    };

    try {
      const saved = await notificationApi.create(newNotif);
      setNotifications([saved, ...notifications]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Notifikasi gagal dikirim.');
      return;
    }

    // Reset Form
    setBroadcastTitle('');
    setBroadcastMessage('');
    setShowBroadcastModal(false);
  };

  // Filtered Notifications
  const filteredNotifications = notifications.filter(n => {
    // Target role tab filter
    if (selectedTargetRole !== 'semua' && n.targetRole !== selectedTargetRole) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'semua' && n.category !== selectedCategory) {
      return false;
    }

    // Unread filter
    if (onlyUnread && n.isRead) {
      return false;
    }

    return true;
  });

  const unreadCount = currentUser ? notifications.filter(n => !n.isRead).length : 0;

  return (
    <div id="notifikasi-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-400/30">
              <Bell className="w-3.5 h-3.5" />
              <span>Sistem Notifikasi Terpusat dalam Aplikasi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Pusat Notifikasi Sekolah
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Pengumuman real-time untuk Guru (pengingat ujian & modul), Siswa (pengumuman tugas & absensi), serta Admin (laporan mingguan & keamanan sistem).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'guru') && (
              <button
                id="open-broadcast-modal-btn"
                onClick={() => setShowBroadcastModal(true)}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all cursor-pointer text-xs"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Broadcast Notifikasi</span>
              </button>
            )}

            {currentUser && (
              <button
                id="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-xs"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        
        {/* Role Target Filter & Category Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Role Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 hidden sm:inline">
              Target Role:
            </span>
            {[
              { id: 'semua', label: 'Semua Role' },
              { id: 'guru', label: 'Khusus Guru' },
              { id: 'siswa', label: 'Khusus Siswa' },
              { id: 'admin', label: 'Khusus Admin' }
            ].map(tab => (
              <button
                key={tab.id}
                id={`target-role-tab-${tab.id}`}
                onClick={() => setSelectedTargetRole(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedTargetRole === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Unread Toggle */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              id="toggle-unread-filter"
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                onlyUnread
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Hanya Belum Dibaca ({unreadCount})</span>
            </button>
          </div>

        </div>

        {/* Category Filter Pills */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-400 uppercase text-[10px] mr-1">Kategori:</span>
          {['semua', 'Ujian', 'Tugas', 'Absensi', 'Forum', 'Pengumuman', 'Sistem'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat === 'semua' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>

      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Tidak ada notifikasi</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Saat ini tidak ada notifikasi yang sesuai dengan filter yang dipilih.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isRead = notif.isRead;

            return (
              <div
                key={notif.id}
                id={`notif-card-${notif.id}`}
                onClick={() => handleMarkAsRead(notif.id)}
                className={`relative space-y-3 overflow-hidden rounded-xl border bg-white p-4 shadow-2xs transition-all hover:shadow-md cursor-pointer sm:p-5 ${
                  !isRead 
                    ? 'border-indigo-200 bg-indigo-50/20' 
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                      {getCategoryIcon(notif.category)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <span className="break-words text-xs font-extrabold text-slate-900">
                          {notif.title}
                        </span>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="Belum dibaca"></span>
                        )}
                      </div>
                      <div className="mt-1 grid gap-0.5 text-[11px] text-slate-500 sm:flex sm:items-center sm:gap-2">
                        <span className="break-words">Dari: <strong>{notif.senderName || 'Sistem Sekolah'}</strong></span>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{notif.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
                    <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase border border-slate-200">
                      {notif.category}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] capitalize ${
                      notif.targetRole === 'guru' ? 'bg-blue-100 text-blue-800' :
                      notif.targetRole === 'siswa' ? 'bg-emerald-100 text-emerald-800' :
                      notif.targetRole === 'admin' ? 'bg-purple-100 text-purple-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      Target: {notif.targetRole}
                    </span>
                  </div>
                </div>

                {/* Message Content */}
                <p className="break-words text-xs leading-relaxed text-slate-700 sm:pl-12">
                  {notif.message}
                </p>

                {/* Footer Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs sm:pl-12">
                  <div />

                  {notif.actionUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(notif.actionUrl || 'landing');
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Buka Halaman Terkait</span> →
                    </button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* BROADCAST NOTIFICATION MODAL FOR TEACHERS & ADMIN */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base sm:text-lg">
                <Send className="w-5 h-5 text-indigo-600" />
                <span>Kirim Broadcast Notifikasi Baru</span>
              </div>
              <button 
                onClick={() => setShowBroadcastModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Broadcast *</label>
                <input
                  id="broadcast-title-input"
                  type="text"
                  required
                  placeholder="Contoh: Pengingat Jadwal Ujian Susulan / Pengumuman Libur..."
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Notifikasi</label>
                  <select
                    id="broadcast-category-select"
                    value={broadcastCategory}
                    onChange={(e) => setBroadcastCategory(e.target.value as NotificationCategory)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Ujian">Ujian & Evaluasi</option>
                    <option value="Tugas">Tugas Akademik</option>
                    <option value="Absensi">Laporan Absensi</option>
                    <option value="Forum">Diskusi Forum</option>
                    <option value="Pengumuman">Pengumuman Umum</option>
                    <option value="Sistem">Sistem Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Peran (Role)</label>
                  <select
                    id="broadcast-target-role-select"
                    value={broadcastTargetRole}
                    onChange={(e) => setBroadcastTargetRole(e.target.value as NotificationTargetRole)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="siswa">Siswa & Wali Murid</option>
                    <option value="guru">Dewan Guru</option>
                    <option value="admin">Administrator</option>
                    <option value="semua">Seluruh Civitas Akademika</option>
                  </select>
                </div>
              </div>

              {broadcastTargetRole === 'siswa' && (
                <div>
                  <label htmlFor="broadcast-target-class-select" className="block font-bold text-slate-700 mb-1">Target Kelas</label>
                  <select
                    id="broadcast-target-class-select"
                    value={broadcastClassId}
                    onChange={(e) => setBroadcastClassId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="semua">Semua Kelas</option>
                    {kelasList.map(kelas => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pesan Notifikasi Lengkap *</label>
                <textarea
                  id="broadcast-message-input"
                  required
                  rows={4}
                  placeholder="Tuliskan isi pesan pengumuman atau pengingat secara rinci..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed text-xs"
                ></textarea>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-900">
                Broadcast dipublikasikan di aplikasi web. Pengiriman email belum tersedia.
              </div>

              <div className="flex flex-col-reverse items-stretch gap-2 pt-3 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="submit-broadcast-btn"
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Publikasikan Broadcast
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
