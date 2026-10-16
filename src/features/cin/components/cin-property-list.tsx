import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { ComplianceRow, ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import type { CinComplianceItem } from '@/types/cin.types';

interface CinPropertyListProps {
  items: CinComplianceItem[];
  /** Whoever may edit a property gets the button that adds or fixes its CIN; the others see the state of each one. */
  canWrite: boolean;
}

/** One row per property: its name (to its page), the city and the code, the state of the CIN and, if it needs it, the button to fix it. */
export function CinPropertyList({ items, canWrite }: CinPropertyListProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return <p className="text-sm text-foreground/70">{t('cin.table.empty')}</p>;
  }

  return (
    <ul role="list" className="divide-y divide-border border-y border-border" data-testid="cin-compliance-table">
      {items.map((item) => {
        const label = t(item.cinStatus === 'missing' ? 'cin.table.addCin' : 'cin.table.fixCin');
        return (
          <ComplianceRow
            key={item.propertyId}
            testId={`cin-row-${item.propertyId}`}
            title={item.propertyName}
            to={`/app/short-rent/properties/${item.propertyId}`}
            sub={[item.city, item.cinCode].filter(Boolean).join(' · ') || undefined}
            badge={
              <span data-testid="cin-status-badge">
                <StatusBadge kind="cin" status={item.cinStatus} />
              </span>
            }
            action={
              canWrite && item.cinStatus !== 'valid' ? (
                <Button asChild variant="outline" size="sm" className={ROW_BUTTON}>
                  <Link to={`/app/short-rent/properties/${item.propertyId}/edit`} aria-label={t('dashboard.row.actionFor', { action: label, name: item.propertyName })}>
                    {label}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        );
      })}
    </ul>
  );
}
