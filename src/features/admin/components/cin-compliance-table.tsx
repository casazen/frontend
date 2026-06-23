import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { CinStatusBadge } from './cin-status-badge';
import type { CinComplianceItem } from '@/types';

interface CinComplianceTableProps {
  items: CinComplianceItem[];
  isLoading: boolean;
}

export function CinComplianceTable({ items, isLoading }: CinComplianceTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">{t('admin.cin.table.property')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.cin.table.city')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.cin.table.owner')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.cin.table.cin')}</th>
            <th className="pb-2 font-medium">{t('admin.cin.table.status')}</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((item) => (
            <tr key={item.propertyId} className="border-b last:border-0">
              <td className="py-3 pr-4 font-medium">{item.propertyName}</td>
              <td className="py-3 pr-4 text-muted-foreground">{item.city}</td>
              <td className="py-3 pr-4 text-muted-foreground">{item.ownerEmail}</td>
              <td className="py-3 pr-4 font-mono text-xs">
                {item.cinCode ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-3">
                <CinStatusBadge status={item.cinStatus} />
              </td>
            </tr>
          ))}
          {(items ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('admin.cin.table.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
