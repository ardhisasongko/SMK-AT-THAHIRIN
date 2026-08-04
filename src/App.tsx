import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { BottomDock } from './components/BottomDock';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { LoginForm } from './components/LoginForm';
import { AbsensiSection } from './components/AbsensiSection';
import { KelasSection } from './components/KelasSection';
import { ModulAjarSection } from './components/ModulAjarSection';
import { ForumSection } from './components/ForumSection';
import { NotifikasiSection } from './components/NotifikasiSection';
import { ProfilSection } from './components/ProfilSection';
import { CbtSection } from './components/CbtSection';
import { 
  INITIAL_USERS, 
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

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USERS[1]); // Default to Guru Ahmad Fauzi for immediate feature usability
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // App persistent states
  const [kelasList, setKelasList] = useState<Kelas[]>(INITIAL_KELAS);
  const [siswaList, setSiswaList] = useState<Siswa[]>(INITIAL_SISWA);
  const [presensiList, setPresensiList] = useState<PresensiRecord[]>(INITIAL_PRESENSI);
  const [modulList, setModulList] = useState<ModulAjar[]>(INITIAL_MODUL_AJAR);
  const [topics, setTopics] = useState<ForumTopic[]>(INITIAL_FORUM_TOPICS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [cbtExams, setCbtExams] = useState<CbtExam[]>(INITIAL_CBT_EXAMS);
  const [cbtSubmissions, setCbtSubmissions] = useState<CbtSubmission[]>(INITIAL_CBT_SUBMISSIONS);

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

  // Quick Demo User Switcher
  const handleSelectDemoUser = (role: 'admin' | 'guru' | 'siswa') => {
    const user = INITIAL_USERS.find(u => u.role === role);
    if (user) {
      setCurrentUser(user);
    }
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
        onLogoutClick={() => setCurrentUser(null)}
        onSelectDemoUser={handleSelectDemoUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20">
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
