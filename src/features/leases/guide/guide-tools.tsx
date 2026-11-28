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
  open?: { label: string; onClick: () => void };
  testId: string;
}

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
  advisory: CedolareAdvisory | undefined;
  showRent: boolean;
  onOpenTool: (tool: GuideTool) => void;
}

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
