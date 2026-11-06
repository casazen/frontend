import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarSync, Euro, ShieldCheck, type LucideIcon } from 'lucide-react';

interface Reason {
  icon: LucideIcon;
  textKey: string;
}

/** What changes for the host when the channels talk to CasaZen: three short lines, in plain words. The keys are written out so that the i18n test finds a missing translation. */
const REASONS: readonly Reason[] = [
  { icon: CalendarSync, textKey: 'octorate.connect.why.calendars' },
  { icon: CalendarDays, textKey: 'octorate.connect.why.bookings' },
  { icon: Euro, textKey: 'octorate.connect.why.prices' },
];

/**
 * Step 2, "Perché collegare" (UX-05): why connecting the channels is worth a minute, before anything is asked. It names no channel
 * manager (NF-12) and promises nothing but what the connection does: nothing on the listings changes without the host's confirmation.
 */
export function WhyConnectStep() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="octorate-why-step">
      <ul className="space-y-3" role="list">
        {REASONS.map(({ icon: Icon, textKey }) => (
          <li key={textKey} className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 break-words pt-1.5">{t(textKey)}</span>
          </li>
        ))}
      </ul>
      <p className="flex min-w-0 items-start gap-2 rounded-lg bg-muted p-3 text-sm">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">{t('octorate.connect.why.safe')}</span>
      </p>
    </div>
  );
}
