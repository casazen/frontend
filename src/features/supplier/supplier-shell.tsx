import { NavLink, Outlet } from 'react-router-dom';
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher';
import { cn } from '@/lib/utils';
const navItems = [
  { to: '/supplier/inbox', label: 'Inbox' },
  { to: '/supplier/profile', label: 'Profilo' },
  { to: '/supplier/availability', label: 'Disponibilità' },
];

export function SupplierShell() {
  return (
    <div className="min-h-screen bg-background" data-testid="supplier-shell">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">CasaZen</p>
            <h1 className="text-lg font-semibold">Console fornitore</h1>
          </div>
          <WorkspaceSwitcher layout="sidebar" className="sm:max-w-xs" />
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
