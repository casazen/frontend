import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { leaseOverdueText, leaseRentText, leaseTenantName, leaseTermText } from '@/features/leases/lib/lease-list-format';
import { parseStayDate } from '@/lib/stay-dates';
import type { LeaseSummary } from '@/types';
import { longRentLeasePath } from './paths';

/** The lease that started last first: the one that holds the property now, then the ones before it. */
const startedLast = (a: LeaseSummary, b: LeaseSummary) => parseStayDate(b.startDate).localeCompare(parseStayDate(a.startDate));

/**
 * The leases of the property (LR-07d), read from `GET /leases?propertyId=`: who, in what state, for how long and for how much,
 * and the one thing that cannot wait (a rent that is late). Each row opens its lease. A list without a box around it; nothing at
 * all when the property has no lease (the highlighted block of the page says so).
 */
export function LongRentPropertyLeases({ leases }: { leases: readonly LeaseSummary[] }) {
  const { t, i18n } = useTranslation();
  if (leases.length === 0) return null;

  return (
    <PlainSection title={t('longRentProperties.detail.contractsTitle')} data-testid="long-rent-property-leases">
      <ul role="list" className="divide-y divide-border border-y border-border">
        {[...leases].sort(startedLast).map((lease) => {
          const overdue = leaseOverdueText(lease, t);
          return (
            <li key={lease.id}>
              <Link
                to={longRentLeasePath(lease.id)}
                data-testid={`long-rent-property-lease-${lease.id}`}
                className="group flex min-h-11 min-w-0 flex-col gap-1 rounded-md py-3 outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words font-semibold group-hover:underline">{leaseTenantName(lease, t)}</span>
                  <StatusBadge kind="lease" status={lease.status} />
                </span>
                <span className="break-words text-sm text-foreground/70">
                  {leaseTermText(lease, t, i18n.language)} · {leaseRentText(lease, t)}
                </span>
                {overdue ? (
                  <span className="flex items-start gap-1.5 text-sm font-medium text-danger-foreground">
                    <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 break-words">{overdue}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </PlainSection>
  );
}
