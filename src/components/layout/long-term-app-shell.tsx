import { Outlet } from 'react-router-dom';
import { LongTermSidebar } from './long-term-sidebar';
import { Header } from './header';
import { LayerSwitcher } from './layer-switcher';
import { DemoBanner } from '@/components/shared/demo-banner';
import { useAppLayerContext } from '@/hooks/use-app-layer-context';

interface LongTermAppShellProps {
  children?: React.ReactNode;
}

export function LongTermAppShell({ children }: LongTermAppShellProps) {
  const { canSwitchLayer } = useAppLayerContext();

  return (
    <div className="flex h-screen overflow-hidden">
      <LongTermSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DemoBanner />
        <Header slotStart={canSwitchLayer ? <LayerSwitcher /> : undefined} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
