import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import { focusBodyOf, focusToneOf } from '@/features/compliance/lib/cockpit-model';
import { useCockpit } from '@/features/compliance/use-cockpit';
import { ComplianceSummaryLine } from './compliance-summary-line';

/** The page of the adempimenti, where the rest of the list is. */
const COMPLIANCE_PATH = '/app/short-rent/compliance';

/**
 * On the Home, «Sono in regola?» in one line (NF-52): «Tutto in regola», or «N cose da fare» counted from the lights the API sends, with the way to the
 * page of the adempimenti. It is a line, not a block: the one highlighted block of the Home is the first thing of the «Da fare» list, and with the
 * traffic light on the compliance reaches it through that list (the feeder keeps it in step with the cockpit), so this adds no second path to it and no
 * item twice.
 *
 * Without the traffic light (an older server, or the flag off) nothing feeds that list, so the block it always was stays: the one thing that carries
 * a risk of a sanction (an Alloggiati Web communication to send or to fix, the guest data it needs), with the button that does it. It reads what the
 * page reads (the same cache entry), so the Home and the menu say the same number. Only for whoever may read the bookings: the summary asks for it.
 */
export function ComplianceUrgentBlock() {
  const { t } = useTranslation();
  const { model } = useCockpit();
  if (!model) return null;

  const focus = model.lights.lightsOn ? undefined : model.fine.rows.find((row) => row.to !== null);
  if (!focus?.to || model.fine.total === 0) return <ComplianceSummaryLine lights={model.lights} variant="home" />;

  const rest = model.fine.total - 1;
  return (
    <FocusBlock
      tone={focusToneOf(focus)}
      kicker={t('compliance.cockpit.kicker.fine')}
      title={focus.title}
      body={focusBodyOf(focus)}
      when={focus.note?.text}
      then={rest > 0 ? t('compliance.cockpit.then.lead', { what: t('compliance.cockpit.then.fine', { count: rest }) }) : undefined}
      primary={{ label: focus.cta, href: focus.to, ariaLabel: `${focus.cta}: ${focus.subject}`, testId: 'home-compliance-cta' }}
      secondary={{ label: t('compliance.cockpit.openAll'), href: COMPLIANCE_PATH, testId: 'home-compliance-all' }}
      data-testid="home-compliance-block"
    />
  );
}
