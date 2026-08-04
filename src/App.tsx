import React, { useState, useEffect } from 'react';
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
import { 
  INITIAL_KELAS, 
  INITIAL_SISWA, 
  INITIAL_PRESENSI, 
  INITIAL_MODUL_AJAR,
  INITIAL_FORUM_TOPICS,
  INITIAL_NOTIFICATIONS,
  INITIAL_CBT_EXAMS,
  INITIAL_CBT_SUBMISSIONS
} from './data/initialData';
import { User, Kelas, Siswa, PresensiRecord, ModulAjar, ForumTopic, NotificationItem, CbtExam, CbtSubmission } from './types';
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './utils/storage';
import { usePersistedCollection } from './hooks/usePersistedCollection';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('landing');
  
  // Load current user from localStorage or null (harus login dulu)
  const [currentUser, setCurrentUser] = useState<User | null>(() => 
    loadFromStorage(STORAGE_KEYS.CURRENT_USER, null)
  );
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // App persistent states - disimpan ke Cloudflare D1 via API
  const [kelasList, setKelasList] = usePersistedCollection<Kelas[]>('kelas_v1', INITIAL_KELAS);
  const [siswaList, setSiswaList] = usePersistedCollection<Siswa[]>('siswa_v1', INITIAL_SISWA);
  const [presensiList, setPresensiList] = usePersistedCollection<PresensiRecord[]>('presensi_v1', INITIAL_PRESENSI);
  const [modulList, setModulList] = usePersistedCollection<ModulAjar[]>('modulAjar_v1', INITIAL_MODUL_AJAR);
  const [topics, setTopics] = usePersistedCollection<ForumTopic[]>('forumTopics_v1', INITIAL_FORUM_TOPICS);
  const [notifications, setNotifications] = usePersistedCollection<NotificationItem[]>('notifications_v1', INITIAL_NOTIFICATIONS);
  const [cbtExams, setCbtExams] = usePersistedCollection<CbtExam[]>('cbtExams_v1', INITIAL_CBT_EXAMS);
  const [cbtSubmissions, setCbtSubmissions] = usePersistedCollection<CbtSubmission[]>('cbtSubmissions_v1', INITIAL_CBT_SUBMISSIONS);

  // Auto-save to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
  }, [currentUser]);

  // Calculate unread notifications count for current user
  const unreadCount = currentUser 
    ? notifications.filter(n => (n.targetRole === 'semua' || n.targetRole === currentUser.role) && !n.isReadBy.includes(currentUser.id)).length
    : 0;

  // Handler when a user creates a new topic -> generates a notification automatically
  const handleNewTopicNotification = (topicTitle: string, categoryName: string) => {
    if (!currentUser) return;
    const newNotif: NotificationItem = {
      id: `n-${Date.now()}`,
      title: `Diskusi Baru: ${topicTitle.slice(0, 35)}...`,
      message: `${currentUser.name} mempublikasikan topik diskusi baru di kategori ${categoryName}.`,
      targetRole: 'semua',
      category: 'Forum',
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      isReadBy: [currentUser.id],
      actionUrl: 'forum',
      senderName: currentUser.name,
      senderRole: currentUser.role,
      isEmailSent: true
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Halaman publik (tidak butuh login) vs terproteksi
  const PUBLIC_TABS = ['landing'];
  const isProtectedTab = !PUBLIC_TABS.includes(activeTab);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('landing');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900">
      
      {/* Navigation Header */}
      <Navbar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        unreadCount={unreadCount}
        onLoginClick={() => setShowLoginModal(true)}
        onLogoutClick={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20">
        {!currentUser && isProtectedTab ? (
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
          />
        )}

        {activeTab === 'cbt' && (
          <CbtSection 
            currentUser={currentUser}
            cbtExams={cbtExams}
            setCbtExams={setCbtExams}
            cbtSubmissions={cbtSubmissions}
            setCbtSubmissions={setCbtSubmissions}
            onOpenLogin={() => setShowLoginModal(true)}
          />
        )}

        {activeTab === 'absensi' && (
          <AbsensiSection 
            presensiList={presensiList}
            setPresensiList={setPresensiList}
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
            setSiswaList={setSiswaList}
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
            onNewTopicNotification={handleNewTopicNotification}
            onOpenLogin={() => setShowLoginModal(true)}
          />
        )}

        {activeTab === 'notifikasi' && (
          <NotifikasiSection 
            notifications={notifications}
            setNotifications={setNotifications}
            currentUser={currentUser}
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
          />
        )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} />

      {/* Floating Bottom App Dock Navigation */}
      <BottomDock 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        unreadCount={unreadCount}
      />

      {/* Login Modal */}
      {showLoginModal && (
        <LoginForm 
          onLoginSuccess={(user) => setCurrentUser(user)}
          onClose={() => setShowLoginModal(false)}
        />
      )}

    </div>
  );
}
