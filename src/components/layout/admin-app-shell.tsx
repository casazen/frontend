import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './admin-sidebar';
import { Header } from './header';

interface AdminAppShellProps {
  children?: React.ReactNode;
}

export function AdminAppShell({ children }: AdminAppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
