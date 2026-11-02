import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { ComplianceRow, ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { focusToneOf, thenOf, type CockpitBadge, type CockpitRow } from '@/features/compliance/lib/cockpit-model';
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
  const urgent = row.tier === 'fine';
  return (
    <ComplianceRow
      icon={row.icon}
      urgent={urgent}
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
          // What the law dates has the solid button: it is the one thing the eye should land on; the rest asks less.
          <Button asChild variant={urgent ? 'default' : 'outline'} size="sm" className={ROW_BUTTON}>
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
 * What the host still has to do, on the page `/compliance`, in three levels that do not weigh the same (the Home no longer carries
 * it as a list): the one thing to do first in the block on top, then what the law dates (the Alloggiati Web communications and the
 * guest data they need: red, with its deadline in words, never cut, the nearest first), then what keeps a property from starting (the
 * activation, calm: without it the property just does not work), then the upkeep of the stays that are over. The properties in order
 * stay behind one line. Everything comes from `GET api/compliance/summary`.
 */
export function ComplianceSummaryWidget() {
  const { t } = useTranslation();
  const { model, summary } = useCockpit({ freshProperties: true });
  const [showAllStart, setShowAllStart] = useState(false);
  const [showAllChore, setShowAllChore] = useState(false);
  const [showActive, setShowActive] = useState(false);

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

  const { fine, start, chore, focus } = model;
  const shown = (rows: CockpitRow[], expanded: boolean) => (expanded ? rows : rows.slice(0, CALM_VISIBLE));
  const more = (rows: CockpitRow[], expanded: boolean, toggle: () => void) =>
    rows.length > CALM_VISIBLE
      ? { actionLabel: expanded ? t('compliance.cockpit.showLess') : t('compliance.cockpit.showMore', { count: rows.length - CALM_VISIBLE }), onAction: toggle }
      : {};

  return (
    <div data-testid="compliance-summary-widget" className="space-y-6 md:space-y-8">
      {focus?.to ? (
        <FocusBlock
          tone={focusToneOf(focus)}
          kicker={t(`compliance.cockpit.kicker.${focus.tier}`)}
          title={focus.title}
          body={[focus.sub, focus.detail].filter(Boolean).join(' · ') || undefined}
          when={focus.note?.text}
          then={thenOf(model, focus, t)}
          primary={{ label: focus.cta, href: focus.to, ariaLabel: `${focus.cta}: ${focus.subject}`, testId: 'compliance-summary-focus-cta' }}
          data-testid="compliance-summary-focus"
        />
      ) : model.total === 0 ? (
        <FocusBlock
          tone="success"
          title={t('compliance.cockpit.allClear.title')}
          body={t('compliance.cockpit.allClear.body')}
          primary={{ label: t('compliance.cockpit.allClear.cta'), href: '/app/short-rent/properties', testId: 'compliance-summary-all-clear-cta' }}
          data-testid="compliance-summary-all-clear"
        />
      ) : null}

      {fine.total > 0 ? (
        <PlainSection title={t('compliance.cockpit.fine.title')} count={fine.total} data-testid="compliance-tier-fine">
          <p className="text-sm text-foreground/70">{t('compliance.cockpit.fine.intro')}</p>
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
          <p className="text-sm text-foreground/70">{t('compliance.cockpit.start.intro')}</p>
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

      {model.activeProperties.length > 0 ? (
        <div data-testid="compliance-summary-active">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-11 gap-1.5 px-2 text-foreground/80"
            aria-expanded={showActive}
            aria-controls="compliance-active-properties"
            onClick={() => setShowActive((value) => !value)}
          >
            {showActive ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />}
            {t('compliance.cockpit.active.toggle', { count: model.activeProperties.length })}
          </Button>
          {showActive ? (
            <div id="compliance-active-properties" data-testid="compliance-summary-properties-section">
              <RowList rows={model.activeProperties} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
