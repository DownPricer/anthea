import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, Heart, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/workouts', icon: Dumbbell, label: 'Séances' },
  { path: '/create', icon: Plus, label: 'Créer' },
  { path: '/duo', icon: Heart, label: 'Duo' },
  { path: '/profile', icon: User, label: 'Profil' },
];

export function DesktopNav() {
  const location = useLocation();

  // Pas de nav desktop sur auth/player
  if (
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register') ||
    location.pathname.startsWith('/player')
  ) {
    return null;
  }

  return (
    <aside className="hidden md:block w-64 shrink-0 border-r border-white/5 bg-[#0A0A0A]">
      <div className="sticky top-0 h-[100dvh] p-4 flex flex-col">
        <div className="px-2 py-3">
          <div className="text-white font-black tracking-tight font-['Outfit'] text-lg">
            Anthea
          </div>
          <div className="text-zinc-500 text-xs mt-0.5">Fitness duo</div>
        </div>

        <nav className="mt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                    isActive
                      ? 'bg-[var(--theme-surface-active)] text-white border border-[var(--theme-primary)]/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )
                }
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 space-y-1">
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
            <span className="text-sm font-medium">Paramètres</span>
          </NavLink>
          <p className="text-[10px] text-zinc-600 px-2 pt-2">v0.x • responsive patch</p>
        </div>
      </div>
    </aside>
  );
}

