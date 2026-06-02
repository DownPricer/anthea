import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Toaster } from '../ui/sonner';
import { useUserAccent } from '../../hooks/useUserAccent';

export function AppLayout() {
  useUserAccent();
  return (
    <div className="max-w-md mx-auto w-full min-h-[100dvh] bg-[#0A0A0A] relative pb-24 shadow-2xl overflow-x-hidden">
      <Outlet />
      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}
