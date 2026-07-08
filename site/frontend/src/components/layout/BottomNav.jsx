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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full h-20 bg-[#0A0A0A]/80 backdrop-blur-2xl border-t border-white/10 flex justify-around items-center z-50 safe-bottom max-w-md sm:max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        if (item.isCenter) {
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid="nav-create"
              className="w-14 h-14 -translate-y-4 rounded-full flex items-center justify-center text-white border-4 border-[#0A0A0A] active:scale-95 transition-transform"
              style={{
                background: `linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))`,
                boxShadow: `0 8px 25px var(--theme-primary-glow)`,
              }}
            >
              <Icon size={24} strokeWidth={2} />
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            data-testid={`nav-${item.label.toLowerCase() || 'home'}`}
            className={`flex flex-col items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase transition-colors ${
              isActive ? 'text-[var(--theme-primary)]' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Icon size={22} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
