import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

function useBreadcrumbLabelMap(t: (key: string) => string): Record<string, string> {
  return {
    'app': t('breadcrumb.home'),
    'short-rent': t('breadcrumb.home'),
    'admin': t('breadcrumb.admin'),
    'properties': t('breadcrumb.properties'),
    'bookings': t('breadcrumb.bookings'),
    'guests': t('breadcrumb.guests'),
    'payments': t('breadcrumb.payments'),
    'finance': t('breadcrumb.finance'),
    'ota': t('breadcrumb.ota'),
    'compliance': t('breadcrumb.compliance'),
    'cin': t('breadcrumb.cin'),
    'alloggiati': t('breadcrumb.alloggiati'),
    'calendar': t('breadcrumb.calendar'),
    'revenue': t('breadcrumb.revenue'),
    'profile': t('breadcrumb.profile'),
    'settings': t('breadcrumb.settings'),
    'pricing': t('breadcrumb.pricing'),
    'history': t('breadcrumb.history'),
    'tax-rates': t('breadcrumb.taxRates'),
    'create': t('breadcrumb.create'),
    'edit': t('breadcrumb.edit'),
    'users': t('breadcrumb.users'),
    'jobs': t('breadcrumb.jobs'),
    'seo': t('breadcrumb.seo'),
    'suppliers': t('breadcrumb.suppliers'),
    'invite': t('breadcrumb.invite'),
    'activation': t('breadcrumb.activation'),
    'availability': t('breadcrumb.availability'),
    'inbox': t('breadcrumb.inbox'),
    'plan': t('breadcrumb.plan'),
    'leases': t('breadcrumb.leases'),
  };
}

function pathToBreadcrumbs(pathname: string, labelMap: Record<string, string>): BreadcrumbItem[] {
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
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const labelMap = useBreadcrumbLabelMap(t);
  const items = customItems || pathToBreadcrumbs(pathname, labelMap);

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
