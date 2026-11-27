import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { ComplianceRow, ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { ComplianceSummaryLine } from '@/features/compliance/components/compliance-summary-line';
import { ComplianceDrawerButton } from '@/features/compliance/compliance-drawer/compliance-drawer-button';
import { useComplianceDrawerAvailable } from '@/features/compliance/compliance-drawer/use-compliance-drawer';
import { type CockpitBadge, type CockpitRow } from '@/features/compliance/lib/cockpit-model';
import { useCockpit } from '@/features/compliance/use-cockpit';
import { NoteLine } from '@/features/dashboard/components/note-line';

/** How many rows of the calm levels show before "Mostra le altre": what the law dates is never cut. */
const CALM_VISIBLE = 3;

/** Where every Alloggiati Web communication is listed, the ones the cockpit does not. */
const ALLOGGIATI_PATH = '/app/short-rent/alloggiati';

function Badge({ badge }: { badge: CockpitBadge }) {
  return badge.kind === 'property' ? <StatusBadge kind="property" status={badge.status} /> : <StatusBadge kind="alloggiati" status={badge.status} />;
}

function CockpitRowItem({ row }: { row: CockpitRow }) {
  const { t } = useTranslation();
  // What the law dates and is still to do is the urgent one: its icon takes the color of urgency and its button is the solid one. What is in
  // hand (yellow) or done (green) is not.
  const urgent = row.tier === 'fine' && row.light !== 'yellow' && row.light !== 'green';
  // «Verifica nel tuo Cassetto Compliance»: for the rows whose outcome the server says is held by the connected area, where the connector is on.
  const drawer = useComplianceDrawerAvailable() ? row.drawer : undefined;
  // The button of the row: where it goes, unless the row is only to read.
  const link = row.quiet ? null : row.to;
  return (
    <ComplianceRow
      icon={row.icon}
      urgent={urgent}
      title={row.title}
      to={row.quiet ? (row.to ?? undefined) : undefined}
      sub={row.sub}
      detail={row.detail}
      light={row.light}
      reason={row.reason}
      badge={row.badge ? <Badge badge={row.badge} /> : undefined}
      note={row.note ? <NoteLine note={row.note} /> : undefined}
      titleTestId={row.to || row.quiet ? undefined : `compliance-summary-${row.testKey}-item`}
      testId="compliance-summary-row"
      action={
        link || drawer ? (
          <>
            {link ? (
              // What the law dates has the solid button: it is the one thing the eye should land on; the rest asks less.
              <Button asChild variant={urgent ? 'default' : 'outline'} size="sm" className={ROW_BUTTON}>
                <Link to={link} aria-label={t('dashboard.row.actionFor', { action: row.cta, name: row.subject })} data-testid={`compliance-summary-${row.testKey}-link`}>
                  {row.cta}
                </Link>
              </Button>
            ) : null}
            {drawer ? <ComplianceDrawerButton target={drawer} subject={row.subject} className={ROW_BUTTON} testId={`compliance-summary-${row.testKey}-drawer`} /> : null}
          </>
        ) : undefined
      }
    />
  );
}

/** The rows of a section, one under the other with a line between them. */
function RowList({ rows }: { rows: readonly CockpitRow[] }) {
  return (
    <ul role="list" className="divide-y divide-border rounded-2xl border bg-card">
      {rows.map((row) => (
        <CockpitRowItem key={row.id} row={row} />
      ))}
    </ul>
  );
}

/** A line that opens a list kept out of the way ("3 case in regola"): a button of 44 px, the list under it. */
function Disclosure({ id, label, open, onToggle, testId, children }: { id: string; label: string; open: boolean; onToggle: () => void; testId: string; children: React.ReactNode }) {
  return (
    <div data-testid={testId}>
      <Button type="button" variant="ghost" size="sm" className="h-auto min-h-11 gap-1.5 px-2 text-foreground/80" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        {open ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />}
        {label}
      </Button>
      {open ? <div id={id}>{children}</div> : null}
    </div>
  );
}

/**
 * Why a section matters, one click away (UX round 2026-11): the host reads it once, and then it stops taking the room of the rows
 * every time the page opens. A native disclosure: Enter and Space open it, a screen reader says whether it is open.
 */
function SectionWhy({ testId, children }: { testId: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <details className="group text-sm" data-testid={testId}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-sm font-medium text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        {t('compliance.cockpit.why')}
      </summary>
      <p className="mt-1 max-w-prose text-foreground/70">{children}</p>
    </details>
  );
}

/** Group open obligations by deadline, activation and upkeep. Each action appears once, in its own row. */
export function ComplianceSummaryWidget() {
  const { t } = useTranslation();
  const { model, summary } = useCockpit({ freshProperties: true });
  const [showAllStart, setShowAllStart] = useState(false);
  const [showAllChore, setShowAllChore] = useState(false);
  const [showGreen, setShowGreen] = useState(false);
  const [showActive, setShowActive] = useState(false);

  if (!model || summary.isError) {
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

  const { fine, start, chore } = model;
  const shown = (rows: CockpitRow[], expanded: boolean) => (expanded ? rows : rows.slice(0, CALM_VISIBLE));
  const more = (rows: CockpitRow[], expanded: boolean, toggle: () => void) =>
    rows.length > CALM_VISIBLE
      ? { actionLabel: expanded ? t('compliance.cockpit.showLess') : t('compliance.cockpit.showMore', { count: rows.length - CALM_VISIBLE }), onAction: toggle }
      : {};

  return (
    <div data-testid="compliance-summary-widget" className="space-y-6 md:space-y-8">
      {model.total > 0 ? <ComplianceSummaryLine lights={model.lights} /> : null}

      {/* Nothing to do is the empty state of the app, not a box of its own (UX round 2026-11). */}
      {model.total === 0 && (
        <div data-testid="compliance-summary-all-clear">
          <EmptyState
            icon={model.lights.lightsOn ? CheckCircle2 : ListChecks}
            title={t(model.lights.lightsOn ? 'compliance.cockpit.allClear.title' : 'complianceNoDeadlines')}
            description={t(model.lights.lightsOn ? 'compliance.cockpit.allClear.body' : 'compliance.cockpit.allClear.noDeadlinesBody')}
          />
        </div>
      )}

      {fine.total > 0 ? (
        <PlainSection title={t('compliance.cockpit.fine.title')} count={fine.total} data-testid="compliance-tier-fine">
          <SectionWhy testId="compliance-tier-fine-why">{t('compliance.cockpit.fine.intro')}</SectionWhy>
          <RowList rows={fine.rows} />
          {fine.hidden > 0 ? (
            <p className="text-sm text-foreground/70" data-testid="compliance-summary-more">
              {t('compliance.summary.moreItems', { count: fine.hidden })}{' '}
              <Link to={ALLOGGIATI_PATH} className="font-medium text-primary-text underline underline-offset-2">
                {t('compliance.cockpit.fine.moreLink')}
              </Link>
            </p>
          ) : null}
        </PlainSection>
      ) : null}

      {start.total > 0 ? (
        <PlainSection
          title={t('compliance.cockpit.start.title')}
          count={start.total}
          data-testid="compliance-tier-start"
          {...more(start.rows, showAllStart, () => setShowAllStart((value) => !value))}
        >
          <SectionWhy testId="compliance-tier-start-why">{t('compliance.cockpit.start.intro')}</SectionWhy>
          <RowList rows={shown(start.rows, showAllStart)} />
        </PlainSection>
      ) : null}

      {chore.total > 0 ? (
        <PlainSection
          title={t('compliance.cockpit.chore.title')}
          count={chore.total}
          data-testid="compliance-tier-chore"
          {...more(chore.rows, showAllChore, () => setShowAllChore((value) => !value))}
        >
          <RowList rows={shown(chore.rows, showAllChore)} />
        </PlainSection>
      ) : null}

      {model.green.length > 0 ? (
        <Disclosure
          id="compliance-green-rows"
          testId="compliance-summary-green"
          label={t('compliance.cockpit.green.toggle', { count: model.green.length })}
          open={showGreen}
          onToggle={() => setShowGreen((value) => !value)}
        >
          <div data-testid="compliance-summary-green-section">
            <RowList rows={model.green} />
          </div>
        </Disclosure>
      ) : null}

      {model.activeProperties.length > 0 ? (
        <Disclosure
          id="compliance-active-properties"
          testId="compliance-summary-active"
          label={t('compliance.cockpit.active.toggle', { count: model.activeProperties.length })}
          open={showActive}
          onToggle={() => setShowActive((value) => !value)}
        >
          <div data-testid="compliance-summary-properties-section">
            <RowList rows={model.activeProperties} />
          </div>
        </Disclosure>
      ) : null}
    </div>
  );
}
