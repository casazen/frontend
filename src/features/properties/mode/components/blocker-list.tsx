import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays, CalendarOff, FilePen, FileText, type LucideIcon } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status/status-badge';
import type { StatusOf } from '@/lib/status-dictionary';
import type { PropertyModeBlocker, PropertyModeBlockerKind } from '@/types/property-mode.types';
import { blockerPath } from '../mode-wizard-model';
import { useRangeLabel } from '../use-mode-labels';

const KIND_ICON: Record<PropertyModeBlockerKind, LucideIcon> = {
  Stay: CalendarDays,
  ImportedBlock: CalendarOff,
  Lease: FileText,
  DraftLease: FilePen,
};

/** Stays and leases come with their status; a block imported from a portal has none. */
function BlockerStatus({ blocker }: { blocker: PropertyModeBlocker }) {
  if (!blocker.status) return null;
  if (blocker.kind === 'Stay') return <StatusBadge kind="booking" status={blocker.status as StatusOf<'booking'>} />;
  if (blocker.kind === 'Lease' || blocker.kind === 'DraftLease') {
    return <StatusBadge kind="lease" status={blocker.status as StatusOf<'lease'>} />;
  }
  return null;
}

interface BlockerListProps {
  blockers: readonly PropertyModeBlocker[];
  propertyId: string;
  /** Rows shown before "and N more": a busy property can have dozens of stays after a near date. */
  limit?: number;
  /** Where the whole list is (the bookings of the property, the leases): offered next to "and N more". */
  seeAll?: { to: string; label: string };
}

/**
 * What stands in the way of the day chosen: the stays, the dates taken on a portal, the leases, the drafts. Ids, dates and a
 * status only (the API sends no name), each with the place where it is dealt with: the booking, the calendars of the
 * property, the contract. The list is short on purpose; the rest is counted, with the way to all of it.
 */
export function BlockerList({ blockers, propertyId, limit = 5, seeAll }: BlockerListProps) {
  const { t } = useTranslation();
  const range = useRangeLabel();
  const shown = blockers.slice(0, limit);

  return (
    <div className="space-y-2">
      <ul role="list" className="divide-y rounded-md border" data-testid="property-mode-blockers">
        {shown.map((blocker) => {
          const Icon = KIND_ICON[blocker.kind];
          return (
            <li
              key={`${blocker.kind}-${blocker.id}`}
              data-testid={`property-mode-blocker-${blocker.kind}`}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
            >
              <div className="flex min-w-0 items-start gap-2 text-sm">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-medium">{t(`propertyMode.checks.blockers.${blocker.kind}.title`)}</p>
                  <p className="break-words text-muted-foreground">{range(blocker.start, blocker.end)}</p>
                  <BlockerStatus blocker={blocker} />
                </div>
              </div>
              <Link
                to={blockerPath(blocker, propertyId)}
                data-testid={`property-mode-blocker-open-${blocker.kind}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t(`propertyMode.checks.blockers.${blocker.kind}.open`)}
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
      {blockers.length > shown.length && (
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground" data-testid="property-mode-blockers-more">
          <span>{t('propertyMode.checks.more', { count: blockers.length - shown.length })}</span>
          {seeAll && (
            <Link
              to={seeAll.to}
              data-testid="property-mode-blockers-see-all"
              className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {seeAll.label}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
