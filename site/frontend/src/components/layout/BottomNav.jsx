import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, User } from 'lucide-react';
import { useDuoNavLabel } from '../../hooks/useDuoNavLabel';
import { useDuoUnreadCount } from '../../hooks/useDuoUnreadCount';

export function BottomNav() {
  const location = useLocation();
  const duoNav = useDuoNavLabel();
  const { count: duoUnread, badge: duoBadge } = useDuoUnreadCount();
  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/workouts', icon: Dumbbell, label: 'Séances' },
    { path: '/create', icon: Plus, label: '', isCenter: true },
    { path: duoNav.path, icon: duoNav.Icon, label: duoNav.label, isDuo: true },
    { path: '/profile', icon: User, label: 'Profil' },
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

        const ariaLabel = item.isDuo && duoUnread > 0
          ? `${item.label}, ${duoUnread > 9 ? 'plus de 9' : duoUnread} notification${duoUnread > 1 ? 's' : ''} Duo non lue${duoUnread > 1 ? 's' : ''}`
          : item.label;

        return (
          <div key={item.path} className="flex justify-center pb-2">
            <NavLink
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase() || 'home'}`}
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
              <span>{item.label}</span>
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}
