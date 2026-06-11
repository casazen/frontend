import { Outlet } from 'react-router-dom';
import { LongTermSidebar } from './long-term-sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { DemoBanner } from '@/components/shared/demo-banner';

interface LongTermAppShellProps {
  children?: React.ReactNode;
}

export function LongTermAppShell({ children }: LongTermAppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <LongTermSidebar />
      <MobileNavDrawer contextKey="long-rent" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DemoBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-6 md:p-6">
          {children ?? <Outlet />}
        </main>
        <BottomNav contextKey="long-rent" />
      </div>
    </div>
  );
}
