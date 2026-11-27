import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatRunTime } from '@/features/compliance/lib/connection-health-model';
import { getProblemMessage } from '@/lib/api-errors';
import type { PropertySender, SenderConnectionTest } from '@/types';
import { SenderStateBadge } from '../sender-state-badge';
import { SENDER_STEP, fixStepOf, knownReason, outcomeToShow, type SenderStepId } from '../sender-wizard-model';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface ConnectionTestStepProps {
  read: PropertySender;
  /** The answer of the last test of this visit, or `undefined` when the host has not run one. */
  result: SenderConnectionTest | undefined;
  /** What the last test, or the last declaration, failed with (`null` when nothing failed): a failure is told as one and never as a result. */
  testError: unknown;
  declareError: unknown;
  /** A request of the wizard is in flight (the test, the declaration or another): nothing on this card can be pressed again meanwhile. */
  busy: boolean;
  onTest: () => void;
  onDeclare: () => void;
  onFix: (step: SenderStepId) => void;
}

/**
 * Step «Verifica»: the connection test. «Attivo» appears only when the channel manager proved it (`Verified`). When it cannot be verified (`Unverifiable`: the channel manager does not tell)
 * the host is asked «Hai visto lo stato «Attivato»?»: yes is sent as a declaration and the state reads «Dichiarato attivo», which is the host's word and not a verification; no
 * goes back to the panel. When it does not work the words say what to fix, with the button that goes to the step where it is fixed. A test that failed is a failure, never a state.
 */
export function ConnectionTestStep({ read, result, testError, declareError, busy, onTest, onDeclare, onFix }: ConnectionTestStepProps) {
  const { t, i18n } = useTranslation();
  const outcome = outcomeToShow(read, result);
  const reason = knownReason(result?.reason ?? read.reason);
  const rawReason = result?.reason ?? read.reason;
  const guidance = reason ? t(`compliance.sender.test.reason.${reason}`) : (result?.guidance ?? read.guidance);
  const fixStep = outcome === 'inactive' || outcome === 'unverified' ? fixStepOf(rawReason) : null;
  const lastRun = result?.policeLastCron ?? read.policeLastCron;
  const asksToDeclare = read.sender === 'ChannelManager' && result?.outcome === 'Unverifiable' && read.state !== 'Declared';
  const tested = result !== undefined;

  return (
    <div className="flex flex-col gap-4" data-testid="sender-test-step">
      <div className="min-w-0 space-y-3" aria-live="polite" data-testid="sender-test-result" data-outcome={outcome}>
        <SenderStateBadge outcome={outcome} testId="sender-test-state" />
        <p className="break-words text-sm" data-testid="sender-test-detail">
          {t(`compliance.sender.test.outcome.${outcome}`)}
        </p>
        {guidance && outcome !== 'active' ? (
          <p className="break-words text-sm text-foreground/70" data-testid="sender-test-guidance">
            {guidance}
          </p>
        ) : null}
        {lastRun && read.sender === 'ChannelManager' ? (
          <p className="text-sm text-muted-foreground" data-testid="sender-test-last-run">
            {t('compliance.sender.test.lastRun', { when: formatRunTime(lastRun, i18n.language, 'Europe/Rome') })}
          </p>
        ) : null}
      </div>

      {testError ? (
        <Alert variant="danger" data-testid="sender-test-error">
          {getProblemMessage(testError, t) ?? t('compliance.sender.test.error')}
        </Alert>
      ) : null}
      {declareError ? (
        <Alert variant="danger" data-testid="sender-declare-error">
          {getProblemMessage(declareError, t) ?? t('compliance.sender.test.declareError')}
        </Alert>
      ) : null}

      {asksToDeclare ? (
        <section className="min-w-0 space-y-3 rounded-lg bg-muted p-4" aria-labelledby="sender-declare-title" data-testid="sender-declare">
          <h3 id="sender-declare-title" className="text-base font-semibold">
            {t('compliance.sender.test.ask.title')}
          </h3>
          <p className="break-words text-sm">{t('compliance.sender.test.ask.text')}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className={TOUCH_TARGET} disabled={busy} onClick={onDeclare} data-testid="sender-declare-yes">
              {t('compliance.sender.test.ask.yes')}
            </Button>
            <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={busy} onClick={() => onFix(SENDER_STEP.panel)} data-testid="sender-declare-no">
              {t('compliance.sender.test.ask.no')}
            </Button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={tested ? 'outline' : 'default'}
          className={TOUCH_TARGET}
          loading={busy}
          disabled={busy}
          onClick={onTest}
          data-testid="sender-test-run"
        >
          {t(tested ? 'compliance.sender.test.again' : 'compliance.sender.test.run')}
        </Button>
        {fixStep ? (
          <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={busy} onClick={() => onFix(fixStep)} data-testid="sender-test-fix">
            {t(`compliance.sender.test.fix.${fixStep}`)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
