import React from 'react';
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

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] sm:max-w-max">
      <nav className="bg-slate-900/95 backdrop-blur-md text-slate-200 p-1.5 sm:p-2 rounded-2xl border border-slate-700/80 shadow-2xl flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar transition-all">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`dock-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer relative shrink-0 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-105 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 sm:w-4 sm:h-4 ${isActive ? 'text-white' : item.isAi ? 'text-emerald-400' : 'text-slate-400'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 bg-indigo-500 text-white text-[9px] font-extrabold w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </div>

              <span className="whitespace-nowrap">{item.label}</span>

              {item.isAi && !isActive && (
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-extrabold px-1 rounded border border-emerald-500/30">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
