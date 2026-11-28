import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip, type HelpTipProps } from '@/components/ui/help-tip';

type ManualPage =
  | 'alloggiati-istat'
  | 'canali-octorate'
  | 'cin-identificazione-ticino'
  | 'imposta-soggiorno-documenti'
  | 'immobili'
  | 'marketplace'
  | 'prezzi-tariffe'
  | 'routine-ai-crm';

interface ManualHintProps extends Pick<HelpTipProps, 'side' | 'className'> {
  page: ManualPage;
  anchor?: string;
  title: string;
  children: ReactNode;
}

export function ManualHint({ page, anchor, title, side, className, children }: ManualHintProps) {
  const { t } = useTranslation();

  return (
    <HelpTip title={title} learnMoreHref={`/guida/${page}.html${anchor ? `#${anchor}` : ''}`} learnMoreLabel={t('manual.open')} side={side} className={className}>
      {children}
    </HelpTip>
  );
}
