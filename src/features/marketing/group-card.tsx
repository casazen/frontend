import { Send, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { Segment } from '@/types/campaign.types';
import { SegmentCount } from './audience-count';
import { describeRule, rulesOf, type DescribeEnv } from './segment-rules';
import { ToneTile } from './tone-tile';

interface GroupCardProps {
  segment: Segment;
  env: DescribeEnv;
  onWrite: (segment: Segment) => void;
}

export function GroupCard({ segment, env, onWrite }: GroupCardProps) {
  const { t } = useTranslation();
  const rules = rulesOf(segment.condition);
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5" data-testid="group-card">
      <div className="flex items-start gap-3">
        <ToneTile icon={UsersRound} tone="neutral" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="break-words font-semibold leading-snug">{segment.name}</h3>
          <div className="text-sm font-medium">
            <SegmentCount segmentId={segment.id} />
          </div>
        </div>
      </div>
      {rules.length > 0 ? (
        <ul role="list" aria-label={t('marketingHub.groups.rulesLabel')} className="flex flex-wrap gap-1.5">
          {rules.map((rule, index) => (
            <li key={`${rule.fieldId}-${index}`} className="max-w-full break-words rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/85">
              {describeRule(rule, env)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/70">{t('marketingHub.groups.everyone')}</p>
      )}
      <div className="mt-auto">
        <Button type="button" size="sm" variant="soft" onClick={() => onWrite(segment)} data-testid="group-write-campaign">
          <Send aria-hidden="true" className="size-4" />
          {t('marketingHub.groups.write')}
        </Button>
      </div>
    </article>
  );
}
