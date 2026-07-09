import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, Heart, User } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/workouts', icon: Dumbbell, label: 'Séances' },
  { path: '/create', icon: Plus, label: '', isCenter: true },
  { path: '/duo', icon: Heart, label: 'Duo' },
  { path: '/profile', icon: User, label: 'Profil' },
];

export function BottomNav() {
  const location = useLocation();

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

        return (
          <div key={item.path} className="flex justify-center pb-2">
            <NavLink
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase() || 'home'}`}
              className={`flex flex-col items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                isActive ? 'text-[var(--theme-primary)]' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span>{item.label}</span>
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}
