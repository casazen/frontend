import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

function pathToBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const labelMap: Record<string, string> = {
    'app': 'Home',
    'short-rent': 'Home',
    'admin': 'Admin',
    'properties': 'Immobili',
    'bookings': 'Prenotazioni',
    'guests': 'Ospiti',
    'payments': 'Pagamenti',
    'finance': 'Finanza',
    'ota': 'Canali OTA',
    'compliance': 'Compliance',
    'cin': 'CIN',
    'alloggiati': 'Alloggiati',
    'calendar': 'Calendario',
    'revenue': 'Fatturato',
    'profile': 'Profilo',
    'settings': 'Impostazioni',
    'pricing': 'Prezzi AI',
    'history': 'Storico',
    'tax-rates': 'Tassa di Soggiorno',
    'create': 'Nuovo',
    'edit': 'Modifica',
    'users': 'Utenti',
    'jobs': 'Processi',
    'seo': 'SEO',
    'suppliers': 'Fornitori',
    'invite': 'Invita',
    'activation': 'Attivazione',
    'availability': 'Disponibilità',
    'inbox': 'Richieste',
    'plan': 'Piano',
    'leases': 'Contratti',
  };

  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let accumulatedPath = '';

  for (const segment of segments) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      accumulatedPath += `/${segment}`;
      continue;
    }

    accumulatedPath += `/${segment}`;
    const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    items.push({ label, path: accumulatedPath });
  }

  return items;
}

export function Breadcrumb({ items: customItems }: BreadcrumbProps) {
  const { pathname } = useLocation();
  const items = customItems || pathToBreadcrumbs(pathname);

  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
      <Link to="/app/short-rent" className="hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, i) => (
        <span key={item.path || i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.path && i < items.length - 1 ? (
            <Link to={item.path} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
