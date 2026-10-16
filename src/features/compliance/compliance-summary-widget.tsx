import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FocusBlock, PlainSection, type CalmTone } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { ComplianceRow, ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { buildCockpit, type CockpitBadge, type CockpitRow } from '@/features/compliance/lib/cockpit-model';
import { useComplianceSummary } from '@/features/compliance/use-compliance';
import { NoteLine } from '@/features/dashboard/components/note-line';
import { useWorkspace } from '@/hooks/use-workspace';
import { useDashboardToday } from '@/queries/use-dashboard';
import { useProperties } from '@/queries/use-properties';

/** How many rows a list of the cockpit shows before "Vedi tutte". */
const VISIBLE = 5;

function Badge({ badge }: { badge: CockpitBadge }) {
  return badge.kind === 'property' ? <StatusBadge kind="property" status={badge.status} /> : <StatusBadge kind="alloggiati" status={badge.status} />;
}

/** Red for what failed or is past its deadline, amber for the rest: the words of the block say the same. */
function toneOf(row: CockpitRow): CalmTone {
  return row.note?.tone === 'danger' || (row.badge?.kind === 'alloggiati' && row.badge.status === 'Errore') ? 'danger' : 'warning';
}

function CockpitRowItem({ row }: { row: CockpitRow }) {
  const { t } = useTranslation();
  return (
    <ComplianceRow
      icon={row.icon}
      title={row.title}
      to={row.quiet ? (row.to ?? undefined) : undefined}
      sub={row.sub}
      detail={row.detail}
      badge={row.badge ? <Badge badge={row.badge} /> : undefined}
      note={row.note ? <NoteLine note={row.note} /> : undefined}
      titleTestId={row.to || row.quiet ? undefined : `compliance-summary-${row.testKey}-item`}
      testId="compliance-summary-row"
      action={
        row.to && !row.quiet ? (
          <Button asChild variant="outline" size="sm" className={ROW_BUTTON}>
            <Link to={row.to} aria-label={t('dashboard.row.actionFor', { action: row.cta, name: row.subject })} data-testid={`compliance-summary-${row.testKey}-link`}>
              {row.cta}
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

/** The rows of a section, one under the other with a line between them. */
function RowList({ rows }: { rows: readonly CockpitRow[] }) {
  return (
    <ul role="list" className="divide-y divide-border border-y border-border">
      {rows.map((row) => (
        <CockpitRowItem key={row.id} row={row} />
      ))}
    </ul>
  );
}

/**
 * What the host still has to do for the law, on the page `/compliance` (the Home no longer carries it): the one thing that
 * lacks first, with the button that takes to the right place, then the stays to look after and the state of every property,
 * each with what it lacks. Everything comes from `GET api/compliance/summary`; the property and the deadline of a stay come
 * from the Home's "Da fare", and the state and the city of a property from the list of properties: when those are late or
 * fail the rows do without them.
 */
export function ComplianceSummaryWidget() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const summary = useComplianceSummary();
  const today = useDashboardToday();
  // Read again at every visit: the page is where one comes back to see whether what was fixed is fixed.
  const properties = useProperties({ mode: 'short' }, { fresh: true });
  const [showAllStays, setShowAllStays] = useState(false);
  const [showAllProperties, setShowAllProperties] = useState(false);

  const propertyList = Array.isArray(properties.data) ? properties.data : undefined;
  const todo = today.data?.todo?.items;
  const locale = i18n.language;
  const model = useMemo(
    () => (summary.data ? buildCockpit(summary.data, { todo, properties: propertyList }, { t, locale, hasPermission, exists: (key) => i18n.exists(key) }) : null),
    [summary.data, todo, propertyList, t, locale, hasPermission, i18n],
  );

  if (!model) {
    return (
      <div data-testid="compliance-summary-widget" className="space-y-6">
        {summary.isError ? (
          <ErrorState title={t('compliance.summary.error')} error={summary.error} onRetry={() => void summary.refetch()} testId="compliance-summary-error" />
        ) : (
          <>
            <SkeletonCard lines={3} label={t('compliance.summary.loading')} />
            <SkeletonLine lines={4} />
          </>
        )}
      </div>
    );
  }

  const { stays, focus } = model;
  const propertyRows = [...model.properties, ...model.activeProperties];
  const total = model.stayTotal + model.propertyTotal;
  // The properties that need something are always there; the ones in order are listed up to the same number of rows.
  const propertyLimit = Math.max(VISIBLE, model.properties.length);
  const shownStays = showAllStays ? stays : stays.slice(0, VISIBLE);
  const shownProperties = showAllProperties ? propertyRows : propertyRows.slice(0, propertyLimit);
  const more = (expanded: boolean, rows: number, limit: number, toggle: () => void) =>
    rows > limit ? { actionLabel: expanded ? t('compliance.cockpit.showLess') : t('compliance.cockpit.seeAll', { count: rows }), onAction: toggle } : {};

  return (
    <div data-testid="compliance-summary-widget" className="space-y-6 md:space-y-8">
      {focus?.to ? (
        <FocusBlock
          tone={toneOf(focus)}
          kicker={t('compliance.cockpit.kicker')}
          title={focus.title}
          body={[focus.sub, focus.detail].filter(Boolean).join(' · ') || undefined}
          when={focus.note?.text}
          then={total > 1 ? t('compliance.cockpit.then', { count: total - 1 }) : undefined}
          primary={{ label: focus.cta, href: focus.to, ariaLabel: `${focus.cta}: ${focus.subject}`, testId: 'compliance-summary-focus-cta' }}
          data-testid="compliance-summary-focus"
        />
      ) : total === 0 ? (
        <FocusBlock
          tone="success"
          title={t('compliance.cockpit.allClear.title')}
          body={t('compliance.cockpit.allClear.body')}
          primary={{ label: t('compliance.cockpit.allClear.cta'), href: '/app/short-rent/properties', testId: 'compliance-summary-all-clear-cta' }}
          data-testid="compliance-summary-all-clear"
        />
      ) : null}

      {stays.length > 0 ? (
        <PlainSection
          title={t('compliance.cockpit.stays.title')}
          count={model.stayTotal}
          data-testid="compliance-summary-stays"
          {...more(showAllStays, stays.length, VISIBLE, () => setShowAllStays((value) => !value))}
        >
          <RowList rows={shownStays} />
          {model.hidden > 0 ? (
            <p className="text-sm text-foreground/70" data-testid="compliance-summary-more">
              {t('compliance.summary.moreItems', { count: model.hidden })}
            </p>
          ) : null}
        </PlainSection>
      ) : null}

      {propertyRows.length > 0 ? (
        <PlainSection
          title={t('compliance.cockpit.properties.title')}
          data-testid="compliance-summary-properties-section"
          {...more(showAllProperties, propertyRows.length, propertyLimit, () => setShowAllProperties((value) => !value))}
        >
          <RowList rows={shownProperties} />
        </PlainSection>
      ) : null}
    </div>
  );
}
