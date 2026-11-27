import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PermissionPredicate } from '@/config/route-manifest';
import { COMPLIANCE_ACTION_TARGETS, complianceActionRoute, isCurrentAddress } from '@/lib/compliance-routes';
import { periodName, reasonText } from '../lib/compliance-light';
import { hasLinesToShow, viewOfLines, type ComplianceLine } from '../lib/compliance-lines';
import { ComplianceLight } from './compliance-light';
import { ROW_BUTTON } from './compliance-row';

/** The page of the adempimenti, where every item is. */
const COMPLIANCE_PATH = '/app/short-rent/compliance';

interface ComplianceLinesProps {
  /** The lines of the stay or the property, worst first (`stayLinesOf`, `propertyLinesOf`). */
  lines: readonly ComplianceLine[];
  /** The name of the list for a screen reader: «Adempimenti di questo soggiorno». */
  label: string;
  hasPermission: PermissionPredicate;
  /** The line the block already says in its title and its own button: not listed again. */
  skip?: string;
  /**
   * What a card says when nothing is left to do: each line that is in order (a stay has a few), or one count of them (a property has a
   * month of ISTAT and tax for each month it was lived in). Never «all in order»: a card tells the items it was given, not that it was given them all.
   */
  greens: 'each' | 'count';
  /** How many of the lines that still ask something are listed before «e altri N». */
  max?: number;
}

/**
 * The compliance lights of a stay or a property inside its «Cosa succede ora» block (NF-52, AC-NF52-9): one line per item, with the same
 * `ComplianceLight` as the page of the adempimenti, what the item is, the reason in plain words and, for what is not in order, the button that
 * opens the right page (`complianceActionRoute`: a user who cannot open it sees no button, never a dead one). The words and the vocabulary are the
 * page's; a card shows the few that matter, the page shows them all.
 */
export function ComplianceLines({ lines, label, hasPermission, skip, greens, max = 3 }: ComplianceLinesProps) {
  const { t, i18n } = useTranslation();
  const context = { t, exists: (key: string) => i18n.exists(key) };

  const view = viewOfLines(lines, { skip, max });
  const { shown, hidden, inOrder } = view;
  if (!hasLinesToShow(view)) return null;

  const canOpenPage = hasPermission('short-rent', 'property.read') && hasPermission('short-rent', 'booking.read');

  return (
    <div className="mt-3 space-y-2 text-sm sm:text-base" data-testid="compliance-lines">
      <ul role="list" aria-label={label} className="space-y-2">
        {shown.map((line) => (
          <ComplianceLineItem key={line.id} line={line} hasPermission={hasPermission} reason={reasonText(line.reason, line.state, context)} />
        ))}
        {greens === 'each' ? (
          inOrder.map((line) => <ComplianceLineItem key={line.id} line={line} hasPermission={hasPermission} reason={reasonText(line.reason, line.state, context)} />)
        ) : inOrder.length > 0 ? (
          <li className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="compliance-line" data-light="green">
            <ComplianceLight state="green" />
            <span className="min-w-0 break-words font-medium">{t('compliance.cockpit.green.toggle', { count: inOrder.length })}</span>
          </li>
        ) : null}
      </ul>
      {hidden > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-foreground/70" data-testid="compliance-lines-more">
          <span>{t('compliance.lines.more', { count: hidden })}</span>
          {canOpenPage ? (
            // A target of 44 px, as every link a calm block writes itself.
            <Link to={COMPLIANCE_PATH} className="inline-flex min-h-11 items-center font-medium text-primary-text underline underline-offset-2">
              {t('compliance.cockpit.openAll')}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

interface ComplianceLineItemProps {
  line: ComplianceLine;
  hasPermission: PermissionPredicate;
  reason: string | undefined;
}

function ComplianceLineItem({ line, hasPermission, reason }: ComplianceLineItemProps) {
  const { t, i18n } = useTranslation();
  const name = t(`compliance.item.${line.action}`, { period: periodName(line.period, i18n.language) || t('compliance.item.noPeriod') });

  // Only what is not in order has a button: the page it opens is the one of the action, or the read-only one for whoever cannot do it. A button
  // that opens the page the card is on does nothing (the police send and the tourist tax rate of the property card): there is none.
  const location = useLocation();
  const target = line.state === 'green' ? null : complianceActionRoute(line.item, hasPermission);
  const route = target !== null && !isCurrentAddress(target, location) ? target : null;
  const cta = hasPermission('short-rent', COMPLIANCE_ACTION_TARGETS[line.action].write) ? t(`dashboard.todo.${line.action}.cta`) : t('dashboard.todo.open');

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="compliance-line" data-light={line.state} data-action={line.action}>
      <ComplianceLight state={line.state} reason={reason} />
      <span className="min-w-0 break-words font-medium">{name}</span>
      {reason ? <span className="min-w-0 break-words text-foreground/70">{reason}</span> : null}
      {route ? (
        <Button asChild variant="outline" size="sm" className={ROW_BUTTON}>
          <Link to={route} aria-label={t('dashboard.row.actionFor', { action: cta, name })} data-testid="compliance-line-action">
            {cta}
          </Link>
        </Button>
      ) : null}
    </li>
  );
}
