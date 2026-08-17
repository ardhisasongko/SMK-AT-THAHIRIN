import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { BottomDock } from './components/BottomDock';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { LoginForm } from './components/LoginForm';
import { LoginGate } from './components/LoginGate';
import { AbsensiSection } from './components/AbsensiSection';
import { KelasSection } from './components/KelasSection';
import { ModulAjarSection } from './components/ModulAjarSection';
import { ForumSection } from './components/ForumSection';
import { NotifikasiSection } from './components/NotifikasiSection';
import { ProfilSection } from './components/ProfilSection';
import { CbtSection } from './components/CbtSection';
import { UserManagementSection } from './components/UserManagementSection';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { WhatsAppAdminSection } from './components/WhatsAppAdminSection';
import { 
  INITIAL_KELAS, 
  INITIAL_SISWA, 
  INITIAL_PRESENSI, 
  INITIAL_MODUL_AJAR
} from './data/initialData';
import { User, Kelas, Siswa, PresensiRecord, ModulAjar, ForumTopic, NotificationItem, AuthSession } from './types';
import { usePersistedCollection } from './hooks/usePersistedCollection';
import { authHeaders, loadAuthSession, saveAuthSession, clearAuthSession, logoutRequest } from './utils/auth';
import { canAccessTab } from './navItems';
import { forumApi, notificationApi } from './utils/community-api';

const AVATAR_BY_ROLE: Record<string, string> = {
  super_admin: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  admin: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  guru: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  ketua_kelas: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  siswa: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('landing');

  // Load sesi (token + user) dari localStorage; user dibawa dari server
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadAuthSession());
  const currentUser: User | null = authSession?.user ?? null;
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // App persistent states - disimpan ke Cloudflare D1 via API
  const [kelasList, setKelasList] = usePersistedCollection<Kelas[]>('kelas_v1', INITIAL_KELAS);
  const [siswaList, setSiswaList, , siswaActions] = usePersistedCollection<Siswa[]>('siswa_v1', INITIAL_SISWA);
  const [presensiList, setPresensiList, presensiReady, presensiActions] = usePersistedCollection<PresensiRecord[]>('presensi_v1', INITIAL_PRESENSI);
  const [modulList, setModulList] = usePersistedCollection<ModulAjar[]>('modulAjar_v1', INITIAL_MODUL_AJAR);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Auto-save auth session to localStorage whenever it changes
  useEffect(() => {
    if (authSession) {
      saveAuthSession(authSession);
    } else {
      clearAuthSession();
    }
  }, [authSession]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store', headers: authHeaders() })
      .then(async response => ({ response, json: await response.json().catch(() => ({})) as { user?: User } }))
      .then(({ response, json }) => {
        if (cancelled) return;
        if (!response.ok || !json.user) {
          setAuthSession(null);
          return;
        }
        const next = { user: { ...json.user!, avatar: authSession?.user.avatar || AVATAR_BY_ROLE[json.user!.role] || AVATAR_BY_ROLE.siswa } };
        saveAuthSession(next);
        setAuthSession(next);
      })
      .catch(() => { if (!cancelled) setAuthSession(null); });
    return () => { cancelled = true; };
  }, []); // Validasi cookie sekali saat aplikasi dimuat.

  useEffect(() => {
    if (currentUser && !canAccessTab(currentUser, activeTab)) {
      setActiveTab('profil');
    }
  }, [activeTab, currentUser]);

  // Calculate unread notifications count for current user
  const unreadCount = currentUser 
    ? notifications.filter(n => !n.isRead).length
    : 0;

  useEffect(() => {
    if (!currentUser) { setTopics([]); setNotifications([]); return; }
    let cancelled = false;
    Promise.all([forumApi.list(), notificationApi.list()]).then(([nextTopics, nextNotifications]) => {
      if (!cancelled) { setTopics(nextTopics); setNotifications(nextNotifications); }
    }).catch(error => console.error('Gagal memuat forum/notifikasi:', error));
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Halaman publik (tidak butuh login) vs terproteksi
  const PUBLIC_TABS = ['landing'];
  const isProtectedTab = !PUBLIC_TABS.includes(activeTab);
  const isAllowedTab = canAccessTab(currentUser, activeTab);

  const handleLoginSuccess = (session: AuthSession) => {
    const withAvatar = {
      ...session,
      user: {
        ...session.user,
        avatar: session.user.avatar || AVATAR_BY_ROLE[session.user.role] || AVATAR_BY_ROLE.siswa,
      },
    };
    saveAuthSession(withAvatar);
    setAuthSession(withAvatar);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    if (authSession) {
      logoutRequest(authSession.token || null);
    }
    setAuthSession(null);
    setActiveTab('landing');
  };

  const handlePasswordChanged = () => {
    if (!authSession) return;
    const next = { ...authSession, user: { ...authSession.user, mustChangePassword: false } };
    saveAuthSession(next);
    setAuthSession(next);
    window.location.reload();
  };

  const handleProfileUpdated = (user: User) => {
    if (!authSession) return;
    const next = { ...authSession, user: { ...user, avatar: authSession.user.avatar } };
    saveAuthSession(next);
    setAuthSession(next);
  };

return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {isOffline && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white text-xs font-bold px-4 py-2 text-center flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Anda sedang offline — halaman terbuka dari cache, data terbaru tidak tersedia.</span>
        </div>
      )}
      {currentUser && (
        <Navbar
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          onLogoutClick={handleLogout}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {(!currentUser && isProtectedTab) || (currentUser && !isAllowedTab) ? (
          <LoginGate 
            onLoginClick={() => setShowLoginModal(true)}
            onGoHome={() => setActiveTab('landing')}
          />
        ) : (
          <>
        {activeTab === 'landing' && (
          <LandingPage 
            setActiveTab={setActiveTab}
            onOpenLogin={() => setShowLoginModal(true)}
            isAuthenticated={Boolean(currentUser)}
          />
        )}

        {activeTab === 'cbt' && (
          <CbtSection 
             currentUser={currentUser}
             kelasList={kelasList}
             onOpenLogin={() => setShowLoginModal(true)}
          />
        )}

        {activeTab === 'absensi' && (
          <AbsensiSection 
             presensiList={presensiList}
             setPresensiList={setPresensiList}
             savePresensi={presensiActions.save}
             refreshPresensi={presensiActions.refresh}
             presensiReady={presensiReady}
             kelasList={kelasList}
            siswaList={siswaList}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'kelas' && (
          <KelasSection 
            kelasList={kelasList}
            setKelasList={setKelasList}
            siswaList={siswaList}
            refreshSiswa={siswaActions.refresh}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'modul-ajar' && (
          <ModulAjarSection 
            modulList={modulList}
            setModulList={setModulList}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'forum' && (
          <ForumSection 
            topics={topics}
            setTopics={setTopics}
            currentUser={currentUser}
            kelasList={kelasList}
            onNewTopicNotification={() => { void notificationApi.list().then(setNotifications); }}
             onOpenLogin={() => setShowLoginModal(true)}
          />
        )}

        {activeTab === 'notifikasi' && (
          <NotifikasiSection 
            notifications={notifications}
            setNotifications={setNotifications}
            currentUser={currentUser}
            kelasList={kelasList}
            setActiveTab={setActiveTab}
            onOpenLogin={() => setShowLoginModal(true)}
          />
        )}

        {activeTab === 'profil' && (
          <ProfilSection 
            currentUser={currentUser}
            kelasList={kelasList}
            siswaList={siswaList}
            presensiList={presensiList}
            modulList={modulList}
            setActiveTab={setActiveTab}
            onOpenLogin={() => setShowLoginModal(true)}
            onProfileUpdated={handleProfileUpdated}
          />
        )}

        {activeTab === 'pengguna' && currentUser && (
          <UserManagementSection currentUser={currentUser} onStudentsChanged={siswaActions.refresh} />
        )}
        {activeTab === 'whatsapp' && currentUser && (
          <WhatsAppAdminSection currentUser={currentUser} />
        )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} currentUser={currentUser} />

      {currentUser && (
        <BottomDock
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          unreadCount={unreadCount}
        />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {authSession?.user.mustChangePassword && (
        <ChangePasswordModal onChanged={handlePasswordChanged} onLogout={handleLogout} />
      )}

    </div>
  );
}
