import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import { focusToneOf } from '@/features/compliance/lib/cockpit-model';
import { useCockpit } from '@/features/compliance/use-cockpit';

/** The page of the adempimenti, where the rest of the list is. */
const COMPLIANCE_PATH = '/app/short-rent/compliance';

/**
 * On the Home: the one thing that carries a risk of a sanction, when there is one (an Alloggiati Web communication to send or to fix,
 * the guest data it needs), with the button that does it and the way to the whole list. Nothing when the law dates nothing: what only
 * keeps a property from starting is on the page of the adempimenti, not here. It reads what the page reads (the same cache entry), so
 * the Home and the menu say the same number. Only for whoever may read the bookings: the summary asks for it.
 */
export function ComplianceUrgentBlock() {
  const { t } = useTranslation();
  const { model } = useCockpit();
  const focus = model?.fine.rows.find((row) => row.to !== null);
  if (!model || model.fine.total === 0 || !focus?.to) return null;

  const rest = model.fine.total - 1;
  return (
    <FocusBlock
      tone={focusToneOf(focus)}
      kicker={t('compliance.cockpit.kicker.fine')}
      title={focus.title}
      body={[focus.sub, focus.detail].filter(Boolean).join(' · ') || undefined}
      when={focus.note?.text}
      then={rest > 0 ? t('compliance.cockpit.then.lead', { what: t('compliance.cockpit.then.fine', { count: rest }) }) : undefined}
      primary={{ label: focus.cta, href: focus.to, ariaLabel: `${focus.cta}: ${focus.subject}`, testId: 'home-compliance-cta' }}
      secondary={{ label: t('compliance.cockpit.openAll'), href: COMPLIANCE_PATH, testId: 'home-compliance-all' }}
      data-testid="home-compliance-block"
    />
  );
}
