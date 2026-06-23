import { Outlet } from 'react-router-dom';
import { SupplierSidebar } from './supplier-sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { MobileNavDrawer } from './mobile-nav-drawer';

interface SupplierAppShellProps {
  children?: React.ReactNode;
}

export function SupplierAppShell({ children }: SupplierAppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SupplierSidebar />
      <MobileNavDrawer contextKey="supplier" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-6 md:p-6">
          {children ?? <Outlet />}
        </main>
        <BottomNav contextKey="supplier" />
      </div>
    </div>
  );
}
