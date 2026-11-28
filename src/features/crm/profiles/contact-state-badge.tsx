import { Mail, MailCheck, MailMinus, MailQuestionMark, MailX, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import type { ContactState } from './contact-state';

interface StateView {
  tone: StatusTone;
  Icon: LucideIcon;
  labelKey: string;
  hintKey: string;
}

// The keys are written out, so that the i18n test finds a missing translation. The icon is always there: the state is never told by color alone.
const STATES: Record<ContactState, StateView> = {
  consent: { tone: 'success', Icon: MailCheck, labelKey: 'crm.state.consent.label', hintKey: 'crm.state.consent.hint' },
  softOptIn: { tone: 'info', Icon: MailCheck, labelKey: 'crm.state.softOptIn.label', hintKey: 'crm.state.softOptIn.hint' },
  toConfirm: { tone: 'warning', Icon: MailQuestionMark, labelKey: 'crm.state.toConfirm.label', hintKey: 'crm.state.toConfirm.hint' },
  serviceOnly: { tone: 'neutral', Icon: MailMinus, labelKey: 'crm.state.serviceOnly.label', hintKey: 'crm.state.serviceOnly.hint' },
  unsubscribed: { tone: 'neutral', Icon: MailX, labelKey: 'crm.state.unsubscribed.label', hintKey: 'crm.state.unsubscribed.hint' },
  noContact: { tone: 'neutral', Icon: Mail, labelKey: 'crm.state.noContact.label', hintKey: 'crm.state.noContact.hint' },
};

interface ContactStateBadgeProps {
  state: ContactState;
  className?: string;
}

export function ContactStateBadge({ state, className }: ContactStateBadgeProps) {
  const { t } = useTranslation();
  const view = STATES[state];
  const Icon = view.Icon;

  return (
    <span
      data-testid="contact-state-badge"
      data-state={state}
      title={t(view.hintKey)}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATUS_TONE_CLASSES[view.tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{t(view.labelKey)}</span>
    </span>
  );
}
