import { Outlet } from 'react-router-dom';
import { LongTermSidebar } from './long-term-sidebar';
import { Header } from './header';
import { WorkspaceSwitcher } from './workspace-switcher';
import { DemoBanner } from '@/components/shared/demo-banner';
import { useWorkspace } from '@/hooks/use-workspace';

interface LongTermAppShellProps {
  children?: React.ReactNode;
}

export function LongTermAppShell({ children }: LongTermAppShellProps) {
  const { contexts } = useWorkspace();

  return (
    <div className="flex h-screen overflow-hidden">
      <LongTermSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DemoBanner />
        <Header slotStart={contexts.length > 1 ? <WorkspaceSwitcher /> : undefined} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
