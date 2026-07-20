import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, User } from 'lucide-react';
import { useDuoNavLabel } from '../../hooks/useDuoNavLabel';
import { useDuoUnreadCount } from '../../hooks/useDuoUnreadCount';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const { t } = useTranslation('navigation');
  const location = useLocation();
  const duoNav = useDuoNavLabel();
  const { count: duoUnread, badge: duoBadge } = useDuoUnreadCount();
  const navItems = [
    { path: '/', icon: Home, label: t('items.home'), testId: 'home' },
    { path: '/workouts', icon: Dumbbell, label: t('items.workouts'), testId: 'workouts' },
    { path: '/create', icon: Plus, label: t('items.create'), isCenter: true, testId: 'create' },
    { path: duoNav.path, icon: duoNav.Icon, label: duoNav.label, isDuo: true, testId: 'duo' },
    { path: '/profile', icon: User, label: t('items.profile'), testId: 'profile' },
  ];

  // Don't show nav on auth pages or workout player
  if (
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register') ||
    location.pathname.startsWith('/player')
  ) {
    return null;
  }

  return (
    <nav
      data-testid="bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid h-20 grid-cols-5 items-end border-t border-white/10 bg-[#0A0A0A]/80 backdrop-blur-2xl safe-bottom"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        if (item.isCenter) {
          return (
            <div key={item.path} className="flex justify-center">
              <NavLink
                to={item.path}
                data-testid="nav-create"
                aria-label={t('aria.create')}
                className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full border-4 border-[#0A0A0A] text-white transition-transform active:scale-95"
                style={{
                  background: `linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))`,
                  boxShadow: `0 8px 25px var(--theme-primary-glow)`,
                }}
              >
                <Icon size={24} strokeWidth={2} />
              </NavLink>
            </div>
          );
        }

        const ariaLabel = item.isDuo && duoUnread > 0 ? t('aria.duoUnread', {
          count: duoUnread,
          label: item.label,
          countLabel: duoUnread > 9 ? t('aria.countMoreThan9') : t('aria.countExact', { count: duoUnread }),
        }) : item.label;

        return (
          <div key={item.path} className="flex justify-center pb-2">
            <NavLink
              to={item.path}
              data-testid={`nav-${item.testId}`}
              aria-label={ariaLabel}
              className={`flex flex-col items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                isActive ? 'text-[var(--theme-primary)]' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <span className="relative inline-flex">
                <Icon size={22} strokeWidth={1.5} />
                {item.isDuo && duoBadge ? (
                  <span
                    data-testid="nav-duo-unread-badge"
                    className="absolute -top-1.5 -right-2.5 min-w-[1rem] h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white"
                  >
                    {duoBadge}
                  </span>
                ) : null}
              </span>
              <span>{item.isCenter ? '' : item.label}</span>
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}
