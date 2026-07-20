import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDuoNavLabel } from '../../hooks/useDuoNavLabel';
import { useDuoUnreadCount } from '../../hooks/useDuoUnreadCount';
import { useTranslation } from 'react-i18next';

export function DesktopNav() {
  const { t } = useTranslation('navigation');
  const location = useLocation();
  const duoNav = useDuoNavLabel();
  const { count: duoUnread, badge: duoBadge } = useDuoUnreadCount();
  const baseNavItems = [
    { path: '/', icon: Home, label: t('items.home') },
    { path: '/workouts', icon: Dumbbell, label: t('items.workouts') },
    { path: '/create', icon: Plus, label: t('items.create') },
    { path: '/profile', icon: User, label: t('items.profile') },
  ];
  const navItems = [
    ...baseNavItems.slice(0, 3),
    { path: duoNav.path, icon: duoNav.Icon, label: duoNav.label, isDuo: true },
    ...baseNavItems.slice(3),
  ];

  // Pas de nav desktop sur auth/player
  if (
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register') ||
    location.pathname.startsWith('/player')
  ) {
    return null;
  }

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-white/5 bg-[#0A0A0A]">
      <div className="flex h-full flex-col p-4">
        <div className="px-2 py-3">
          <div className="text-white font-black tracking-tight font-['Outfit'] text-lg">
            Anthea
          </div>
          <div className="text-zinc-500 text-xs mt-0.5">{t('tagline')}</div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const ariaLabel = item.isDuo && duoUnread > 0 ? t('aria.duoUnread', {
              count: duoUnread,
              label: item.label,
              countLabel: duoUnread > 9 ? t('aria.countMoreThan9') : t('aria.countExact', { count: duoUnread }),
            }) : item.label;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                aria-label={ariaLabel}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                    isActive
                      ? 'bg-[var(--theme-surface-active)] text-white border border-[var(--theme-primary)]/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )
                }
              >
                <span className="relative inline-flex">
                  <Icon size={18} />
                  {item.isDuo && duoBadge ? (
                    <span
                      data-testid="nav-duo-unread-badge-desktop"
                      className="absolute -top-1.5 -right-2.5 min-w-[1rem] h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white"
                    >
                      {duoBadge}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 border-t border-white/5 pt-4 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                isActive
                  ? 'bg-[var(--theme-surface-active)] text-white border border-[var(--theme-primary)]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              )
            }
          >
            <Settings size={18} />
            <span className="text-sm font-medium">{t('items.settings')}</span>
          </NavLink>
          <p className="text-[10px] text-zinc-600 px-2 pt-2">v0.x • responsive patch</p>
        </div>
      </div>
    </aside>
  );
}
