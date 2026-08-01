import { Link, NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDuoNavLabel } from '../../hooks/useDuoNavLabel';
import { useDuoUnreadCount } from '../../hooks/useDuoUnreadCount';
import { useTranslation } from 'react-i18next';
import { AntheaLogo } from '../branding/AntheaLogo';

export function DesktopNav() {
  const { t } = useTranslation('navigation');
  const location = useLocation();
  const duoNav = useDuoNavLabel();
  const { count: duoUnread, badge: duoBadge } = useDuoUnreadCount();
  const baseNavItems = [
    { path: '/app', icon: Home, label: t('items.home') },
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
    location.pathname.startsWith('/verify-email') ||
    location.pathname.startsWith('/check-email') ||
    location.pathname.startsWith('/legacy-account') ||
    location.pathname.startsWith('/forgot-password') ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname.startsWith('/player')
  ) {
    return null;
  }

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-border bg-background">
      <div className="flex h-full flex-col p-4">
        <Link to="/app" className="px-2 py-3" aria-label={t('items.home')}>
          <div className="flex items-center gap-2.5 min-w-0">
            <AntheaLogo className="h-8 w-8" />
            <div className="min-w-0">
              <div className="text-foreground font-black tracking-tight font-['Outfit'] text-lg leading-tight">
                FitGather
              </div>
              <div className="text-subtle text-xs mt-0.5">{t('tagline')}</div>
            </div>
          </div>
        </Link>

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
                      ? 'bg-[var(--theme-surface-active)] text-foreground border border-[var(--theme-primary)]/20'
                      : 'text-muted hover:text-foreground hover:bg-hover border border-transparent'
                  )
                }
              >
                <span className="relative inline-flex">
                  <Icon size={18} />
                  {item.isDuo && duoBadge ? (
                    <span
                      data-testid="nav-duo-unread-badge-desktop"
                      className="absolute -top-1.5 -right-2.5 min-w-[1rem] h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-foreground"
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

        <div className="mt-auto shrink-0 border-t border-border pt-4 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                isActive
                  ? 'bg-[var(--theme-surface-active)] text-foreground border border-[var(--theme-primary)]/20'
                  : 'text-muted hover:text-foreground hover:bg-hover border border-transparent'
              )
            }
          >
            <Settings size={18} />
            <span className="text-sm font-medium">{t('items.settings')}</span>
          </NavLink>
          <p className="text-[10px] text-subtle px-2 pt-2">v0.x • responsive patch</p>
        </div>
      </div>
    </aside>
  );
}
