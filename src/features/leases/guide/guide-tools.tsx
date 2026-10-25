import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { formatCurrency } from '@/lib/utils';
import type { CedolareAdvisory, LeaseDetail } from '@/types';
import type { GuideTool } from './advice-catalogue';
import { regimeOutcome, storedRentAnswer } from './guide-answers';
import { GuideButton } from './guide-button';
import { describeRegimeOutcome } from './regime-text';

interface ToolRowProps {
  title: string;
  summary: string;
  detail?: string | null;
  /** The button that opens the tool; none when the tool cannot be used yet (a contract with no rent to compare). */
  open?: { label: string; onClick: () => void };
  testId: string;
}

/** A tool of the guide in one row: what it answers, the answer so far in a sentence, and the button that opens it. */
function ToolRow({ title, summary, detail, open, testId }: ToolRowProps) {
  return (
    <li className="min-w-0 space-y-2 py-4" data-testid={testId}>
      <h3 className="break-words text-base font-semibold leading-snug">{title}</h3>
      <p className="break-words text-sm text-foreground/80" data-testid={`${testId}-summary`}>
        {summary}
      </p>
      {detail ? <p className="break-words text-sm text-foreground/70">{detail}</p> : null}
      {open ? (
        <div>
          <GuideButton label={open.label} onClick={open.onClick} testId={`${testId}-open`} />
        </div>
      ) : null}
    </li>
  );
}

interface GuideToolsProps {
  lease: LeaseDetail;
  /** The tax comparison, once the server has worked it out; `undefined` while it has not (or for a lease with no rent). */
  advisory: CedolareAdvisory | undefined;
  /** The check of the rent against the agreement: for a canone concordato only. */
  showRent: boolean;
  onOpenTool: (tool: GuideTool) => void;
}

/**
 * «Strumenti»: the two tools of the guide, each in one row with the answer the contract's data already give (LR-GUIDE-1). The tax
 * comparison for every contract; the check of the rent against the agreement for a canone concordato. Nothing else is a tool: the rest
 * is advice, or data.
 */
export function GuideTools({ lease, advisory, showRent, onOpenTool }: GuideToolsProps) {
  const { t } = useTranslation();
  const hasRent = lease.monthlyRent > 0;

  let regimeSummary = hasRent ? t('leaseGuide.tools.regime.idle') : t('leaseGuide.tools.regime.needsRent');
  let regimeDetail: string | null = null;
  if (hasRent && advisory) {
    const { sentence, detail } = describeRegimeOutcome(regimeOutcome(advisory), t);
    regimeSummary = sentence;
    regimeDetail = detail;
  }

  const stored = storedRentAnswer(lease.concordatoAssessment, lease.monthlyRent);

  return (
    <PlainSection title={t('leaseGuide.tools.title')} data-testid="lease-guide-tools">
      <ul role="list" className="divide-y divide-border border-y border-border">
        <ToolRow
          testId="guide-tool-regime"
          title={t('leaseGuide.tools.regime.title')}
          summary={regimeSummary}
          detail={regimeDetail}
          open={hasRent ? { label: t('leaseGuide.tools.regime.open'), onClick: () => onOpenTool('regime') } : undefined}
        />
        {showRent ? (
          <ToolRow
            testId="guide-tool-rent"
            title={t('leaseGuide.tools.rent.title')}
            summary={
              stored
                ? t(`leaseGuide.rent.answer.${stored.place}`, {
                    rent: formatCurrency(lease.monthlyRent),
                    min: formatCurrency(stored.min),
                    max: formatCurrency(stored.max),
                  })
                : t('leaseGuide.tools.rent.noData')
            }
            detail={stored?.indicative ? t('leaseGuide.rent.indicative') : null}
            open={{ label: t('leaseGuide.tools.rent.open'), onClick: () => onOpenTool('rent') }}
          />
        ) : null}
      </ul>
    </PlainSection>
  );
}
