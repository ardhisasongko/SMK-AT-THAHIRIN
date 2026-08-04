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
  Mail, 
  Plus, 
  X, 
  UserCheck, 
  Sparkles,
  Info
} from 'lucide-react';
import { NotificationItem, NotificationCategory, NotificationTargetRole, User } from '../types';

interface NotifikasiSectionProps {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  currentUser: User | null;
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
}

export const NotifikasiSection: React.FC<NotifikasiSectionProps> = ({
  notifications,
  setNotifications,
  currentUser,
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
  const [simulateEmail, setSimulateEmail] = useState<boolean>(true);

  // Email Sent Confirmation Modal Banner
  const [emailConfirmationData, setEmailConfirmationData] = useState<{
    recipientCount: number;
    targetRoleName: string;
    sampleEmail: string;
  } | null>(null);

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
  const handleMarkAsRead = (id: string) => {
    if (!currentUser) return;
    setNotifications(notifications.map(n => {
      if (n.id === id) {
        const isAlreadyRead = n.isReadBy.includes(currentUser.id);
        if (!isAlreadyRead) {
          return { ...n, isReadBy: [...n.isReadBy, currentUser.id] };
        }
      }
      return n;
    }));
  };

  // Mark all notifications as read for current user
  const handleMarkAllAsRead = () => {
    if (!currentUser) return;
    setNotifications(notifications.map(n => ({
      ...n,
      isReadBy: n.isReadBy.includes(currentUser.id) ? n.isReadBy : [...n.isReadBy, currentUser.id]
    })));
  };

  // Create Broadcast Notification
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    const newNotif: NotificationItem = {
      id: `n-${Date.now()}`,
      title: broadcastTitle,
      message: broadcastMessage,
      targetRole: broadcastTargetRole,
      targetClassId: broadcastClassId !== 'semua' ? broadcastClassId : undefined,
      category: broadcastCategory,
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      isReadBy: [currentUser.id],
      senderName: currentUser.name,
      senderRole: currentUser.role,
      isEmailSent: simulateEmail
    };

    setNotifications([newNotif, ...notifications]);

    if (simulateEmail) {
      const recipientCount = broadcastTargetRole === 'siswa' ? 32 : broadcastTargetRole === 'guru' ? 68 : 1250;
      const targetRoleName = broadcastTargetRole === 'siswa' ? 'Siswa & Orang Tua Murid' : broadcastTargetRole === 'guru' ? 'Dewan Guru' : 'Seluruh Pengguna Sekolah';
      setEmailConfirmationData({
        recipientCount,
        targetRoleName,
        sampleEmail: broadcastTargetRole === 'siswa' ? 'm.rizky@smksplusatthahirin.sch.id' : 'fauzi@smksplusatthahirin.sch.id'
      });
    }

    // Reset Form
    setBroadcastTitle('');
    setBroadcastMessage('');
    setShowBroadcastModal(false);
  };

  // Filtered Notifications
  const filteredNotifications = notifications.filter(n => {
    // Role relevance: Show if target is 'semua' OR matches current user's role OR if current user is admin viewing all
    if (currentUser && currentUser.role !== 'admin') {
      const isForMyRole = n.targetRole === 'semua' || n.targetRole === currentUser.role;
      if (!isForMyRole) return false;
    }

    // Target role tab filter
    if (selectedTargetRole !== 'semua' && n.targetRole !== selectedTargetRole) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'semua' && n.category !== selectedCategory) {
      return false;
    }

    // Unread filter
    if (onlyUnread && currentUser && n.isReadBy.includes(currentUser.id)) {
      return false;
    }

    return true;
  });

  const unreadCount = currentUser 
    ? notifications.filter(n => (n.targetRole === 'semua' || n.targetRole === currentUser.role) && !n.isReadBy.includes(currentUser.id)).length
    : 0;

  return (
    <div id="notifikasi-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-400/30">
              <Bell className="w-3.5 h-3.5" />
              <span>Sistem Notifikasi Terpusat & Multi-Channel</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Pusat Notifikasi Sekolah
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Pengumuman real-time untuk Guru (pengingat ujian & modul), Siswa (pengumuman tugas & absensi), serta Admin (laporan mingguan & keamanan sistem).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru') && (
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

      {/* Simulated Email Confirmation Alert Modal */}
      {emailConfirmationData && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 space-y-3 relative shadow-md animate-in slide-in-from-top duration-300">
          <button 
            onClick={() => setEmailConfirmationData(null)}
            className="absolute top-4 right-4 text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-emerald-900">
                Simulasi Salinan Email Berhasil Disampaikan!
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Notifikasi broadcast telah dipublikasikan ke sistem web dan salinan email pemberitahuan simulasi telah dikirimkan secara otomatis kepada <strong>{emailConfirmationData.recipientCount} penerima ({emailConfirmationData.targetRoleName})</strong>.
              </p>
              <div className="text-[11px] font-mono text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md inline-block mt-1">
                Contoh email sampel: {emailConfirmationData.sampleEmail}
              </div>
            </div>
          </div>
        </div>
      )}

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
            const isRead = currentUser ? notif.isReadBy.includes(currentUser.id) : false;

            return (
              <div
                key={notif.id}
                id={`notif-card-${notif.id}`}
                onClick={() => handleMarkAsRead(notif.id)}
                className={`bg-white rounded-xl border p-5 shadow-2xs transition-all hover:shadow-md cursor-pointer space-y-3 relative ${
                  !isRead 
                    ? 'border-indigo-200 bg-indigo-50/20' 
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                      {getCategoryIcon(notif.category)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">
                          {notif.title}
                        </span>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="Belum dibaca"></span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Dari: <strong>{notif.senderName || 'Sistem Sekolah'}</strong></span>
                        <span>•</span>
                        <span>{notif.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
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
                <p className="text-xs text-slate-700 leading-relaxed pl-12">
                  {notif.message}
                </p>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pl-12 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    {notif.isEmailSent && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <Mail className="w-3 h-3" />
                        <span>Salinan email dikirim</span>
                      </span>
                    )}
                  </div>

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

              {/* Email Simulation Checkbox */}
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 flex items-start gap-3">
                <input
                  id="broadcast-simulate-email-checkbox"
                  type="checkbox"
                  checked={simulateEmail}
                  onChange={(e) => setSimulateEmail(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs">
                  <label htmlFor="broadcast-simulate-email-checkbox" className="font-bold text-slate-800 cursor-pointer">
                    Simulasikan Kirim Salinan Notifikasi via Email
                  </label>
                  <p className="text-[11px] text-slate-600">
                    Sistem akan mensimulasikan pengiriman email otomatis ke alamat email pengguna yang ditargetkan.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
