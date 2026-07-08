import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Toaster } from '../ui/sonner';
import { useUserAccent } from '../../hooks/useUserAccent';

export function AppLayout() {
  useUserAccent();
  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A]">
      <div className="mx-auto w-full min-h-[100dvh] relative pb-24 overflow-x-hidden max-w-md sm:max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl lg:shadow-2xl">
        <Outlet />
        <BottomNav />
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
