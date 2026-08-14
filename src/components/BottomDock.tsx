import React, { useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { User } from '../types';
import { getNavItems } from '../navItems';

interface BottomDockProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  unreadCount?: number;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  unreadCount = 0
}) => {
  type DockItem = {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    isAi?: boolean;
    badge?: number;
  };

  const navItems = getNavItems(currentUser, unreadCount) as DockItem[];
  const [showMore, setShowMore] = useState(false);
  const primaryIds = currentUser?.role === 'siswa' || currentUser?.role === 'ketua_kelas'
    ? ['landing', 'cbt', 'absensi', 'forum', 'profil']
    : ['landing', 'absensi', 'forum', 'profil'];
  const primaryItems = navItems.filter(item => primaryIds.includes(item.id));
  const moreItems = navItems.filter(item => !primaryIds.includes(item.id));

  const renderItem = (item: DockItem, closeMore = false) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        id={`dock-nav-${item.id}`}
        onClick={() => { setActiveTab(item.id); if (closeMore) setShowMore(false); }}
        className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-bold transition-all cursor-pointer sm:min-w-0 sm:flex-none sm:px-3.5 sm:py-2 sm:text-xs ${
          isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
        }`}
      >
        <div className="relative"><Icon className={`h-4 w-4 ${isActive ? 'text-white' : item.isAi ? 'text-emerald-400' : 'text-slate-400'}`} />{item.badge && item.badge > 0 ? <span className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white">{item.badge}</span> : null}</div>
        <span className="max-w-full truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-2 left-2 right-2 z-40 max-w-full sm:bottom-5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-[95vw]">
      {showMore && moreItems.length > 0 && <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-slate-200 shadow-2xl sm:hidden"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-bold">Menu Lainnya</span><button onClick={() => setShowMore(false)} className="p-1 cursor-pointer"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-4 gap-1">{moreItems.map(item => renderItem(item, true))}</div></div>}
      <nav className="flex items-center justify-around gap-0.5 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-1 text-slate-200 shadow-2xl backdrop-blur-md transition-all sm:justify-center sm:gap-2 sm:overflow-x-auto sm:p-2 no-scrollbar">
        <div className="contents sm:hidden">{primaryItems.map(item => renderItem(item))}{moreItems.length > 0 && <button onClick={() => setShowMore(v => !v)} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-bold cursor-pointer ${moreItems.some(item => item.id === activeTab) ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}><MoreHorizontal className="h-4 w-4" /><span>Lainnya</span></button>}</div>
        <div className="hidden sm:contents">{navItems.map(item => renderItem(item))}</div>
      </nav>
    </div>
  );
};
