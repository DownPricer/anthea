import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { DesktopNav } from './DesktopNav';
import { Toaster } from '../ui/sonner';
import { useUserAccent } from '../../hooks/useUserAccent';

export function AppLayout() {
  useUserAccent();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      <div className="min-h-[100dvh] flex">
        <DesktopNav />
        <div className="flex-1 min-w-0 md:ml-64">
          <div className="min-h-[100dvh] pb-24 md:pb-0">
            <Outlet />
          </div>
          <BottomNav />
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
