import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { hasRole } from '@/lib/auth-roles';
import {
  LayoutDashboard,
  Home,
  Calendar,
  CreditCard,
  Repeat,
  Search,
  User,
  FileText,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  role?: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/properties', icon: Home, label: 'Properties' },
  { to: '/leases', icon: FileText, label: 'Leases', role: 'LongTermLandlord' },
  { to: '/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/ota', icon: Repeat, label: 'OTA Sync' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function Sidebar() {
  const { user } = useAuth();
  const visibleItems = navItems.filter(
    (item) => !item.role || hasRole(user, item.role)
  );

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Home className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">CASAZEN</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">Property Manager</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </>
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <p className="text-[10px] text-muted-foreground text-center tracking-wide">v1.0.0 · casazen.io</p>
      </div>
    </aside>
  );
}
