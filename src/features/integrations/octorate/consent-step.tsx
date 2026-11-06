import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { getProblemMessage } from '@/lib/api-errors';
import type { OctorateConnect } from './use-octorate-connect';

/** What happens, in the order it happens. The keys are written out so that the i18n test finds a missing translation. */
const WHAT_HAPPENS: readonly string[] = [
  'octorate.connect.consent.steps.open',
  'octorate.connect.consent.steps.signIn',
  'octorate.connect.consent.steps.comeBack',
];

/** Before the consent, and again when it has to be made again: what is about to happen, before anything does (UX-05). */
function Explanation() {
  const { t } = useTranslation();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-4" data-testid="octorate-consent-explanation">
      <p>{t('octorate.connect.consentExplanation')}</p>
      <div className="space-y-2">
        <h3 id={headingId} className="text-sm font-semibold">
          {t('octorate.connect.consent.whatHappens')}
        </h3>
        <ol className="space-y-2" role="list">
          {WHAT_HAPPENS.map((textKey, index) => (
            <li key={textKey} className="flex min-w-0 items-start gap-3 text-sm">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                {index + 1}
              </span>
              <span className="min-w-0 break-words pt-0.5">{t(textKey)}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="flex min-w-0 items-start gap-2 rounded-lg bg-muted p-3 text-sm">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">{t('octorate.connect.consent.notes')}</span>
      </p>
    </section>
  );
}

/** A line of work in progress: the state of the connection being read, or the code being exchanged. */
function Working({ message, testId }: { message: string; testId: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted p-4 text-sm" data-testid={testId}>
      <Spinner size="sm" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

interface ConsentStepProps {
  connect: OctorateConnect;
}

/**
 * Step 3, the consent (E02/F01/US01/T04, ADR-023): says what is about to happen, and shows how it went when the host comes back. The
 * button that sends the host to the channel manager is the main button of the wizard, not one of this step. The channel manager is
 * called "il tuo channel manager" here and nowhere in this step by its name (NF-12).
 */
export function ConsentStep({ connect }: ConsentStepProps) {
  const { t } = useTranslation();
  const { phase, propertyCount } = connect;
  const explains = phase === 'checking' || phase === 'ready' || phase === 'attention' || phase === 'denied' || phase === 'failed';

  return (
    <div className="space-y-4" data-testid="octorate-consent-step" data-phase={phase}>
      {phase === 'checking' ? <Working message={t('octorate.connect.consent.checking')} testId="octorate-consent-checking" /> : null}
      {phase === 'completing' ? <Working message={t('octorate.connect.consent.completing')} testId="octorate-consent-completing" /> : null}
      {phase === 'connected' ? (
        <Alert variant="success" title={t('octorate.connect.consent.connected.title')} data-testid="octorate-consent-connected">
          {propertyCount === null
            ? t('octorate.connect.consent.connected.already')
            : propertyCount === 0
              ? t('octorate.connect.consent.connected.none')
              : t('octorate.connect.consent.connected.found', { count: propertyCount })}
        </Alert>
      ) : null}
      {phase === 'attention' ? (
        <Alert variant="warning" title={t('octorate.connect.consent.attention.title')} data-testid="octorate-consent-attention">
          {t('octorate.connect.consent.attention.text')}
        </Alert>
      ) : null}
      {phase === 'denied' ? (
        <Alert variant="warning" title={t('octorate.connect.consent.denied.title')} data-testid="octorate-consent-denied">
          {t('octorate.connect.consent.denied.text')}
        </Alert>
      ) : null}
      {phase === 'failed' ? (
        <Alert variant="danger" title={t('octorate.connect.consent.failed.title')} data-testid="octorate-consent-failed">
          {getProblemMessage(connect.error, t) ?? t('octorate.connect.consent.failed.text')}
        </Alert>
      ) : null}
      {explains ? <Explanation /> : null}
    </div>
  );
}
