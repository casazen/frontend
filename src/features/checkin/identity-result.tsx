import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { guidanceKey, retakeTargetOf } from './lib/identity-model';

interface IdentityResultProps {
  /** What the guest is told: passed, try again, or a person verifies. */
  kind: 'ok' | 'retry' | 'operator';
  /** The lock code of the property: shown only for `ok`, whatever else is passed. */
  lockCode: string | null;
  /** What to change, as codes of the API (a `retry`). */
  guidanceCodes: readonly string[];
  attemptsRemaining: number;
  /** A person was asked and has the verification. */
  operatorRequested: boolean;
  /** A call of the step is in flight: the buttons stay disabled. */
  busy: boolean;
  /** The guest takes again what the guidance asked for. */
  onRetake: () => void;
  /** The guest asks for a person (GDPR art. 22). */
  onRequestOperator: () => void;
}

/**
 * The answer of the identity check (CHK-11, NF-50): `ok` shows the lock code in large clear text and says it is also e-mailed; `retry` says in plain words
 * what to change and how many attempts are left; `operator` says that the host verifies and that the code comes after the decision. No code is ever
 * shown for any answer but `ok`. After a `retry` or an `operator` the button to ask a person for the verification is always there (GDPR art. 22).
 */
export function IdentityResult({
  kind,
  lockCode,
  guidanceCodes,
  attemptsRemaining,
  operatorRequested,
  busy,
  onRetake,
  onRequestOperator,
}: IdentityResultProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The answer is announced by moving the focus to its title, where a screen reader starts reading it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [kind]);

  if (kind === 'ok') {
    return (
      <section className="space-y-4" aria-labelledby={titleId} data-testid="identity-result-ok">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-6 shrink-0 text-green-600" aria-hidden="true" />
          <h4 id={titleId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            {t('checkin.identity.result.ok.title')}
          </h4>
        </div>
        {lockCode ? (
          <>
            <p className="text-sm">{t('checkin.identity.result.ok.codeLabel')}</p>
            <p
              className="rounded-lg bg-muted p-6 text-center font-mono text-4xl font-bold tracking-wider break-all"
              data-testid="identity-lock-code"
            >
              {lockCode}
            </p>
            <p className="text-sm text-muted-foreground" data-testid="identity-code-email">
              {t('checkin.identity.result.ok.codeEmail')}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="identity-no-code">
            {t('checkin.identity.result.ok.noCode')}
          </p>
        )}
      </section>
    );
  }

  const retakeLabel = retakeTargetOf(guidanceCodes) === 'document' ? 'checkin.identity.result.retry.againDocument' : 'checkin.identity.result.retry.again';

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid={kind === 'retry' ? 'identity-result-retry' : 'identity-result-operator'}>
      <div className="flex items-center gap-2">
        {kind === 'retry' ? (
          <RotateCcw className="size-6 shrink-0 text-amber-600" aria-hidden="true" />
        ) : (
          <Clock className="size-6 shrink-0 text-primary" aria-hidden="true" />
        )}
        <h4 id={titleId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {kind === 'retry' ? t('checkin.identity.result.retry.title') : t('checkin.identity.result.operator.title')}
        </h4>
      </div>

      {kind === 'retry' ? (
        <>
          {guidanceCodes.length > 0 ? (
            <div className="space-y-1" data-testid="identity-retry-reasons">
              <p className="text-sm">{t('checkin.identity.result.retry.intro')}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {guidanceCodes.map((code) => (
                  <li key={code}>{t(guidanceKey(code))}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm" data-testid="identity-retry-reasons">
              {t('checkin.identity.result.retry.noReason')}
            </p>
          )}
          <p className="text-sm font-medium" data-testid="identity-attempts-left">
            {t('checkin.identity.result.retry.attempts', { count: attemptsRemaining })}
          </p>
          <Button type="button" size="lg" onClick={onRetake} disabled={busy} data-testid="identity-retake">
            {t(retakeLabel)}
          </Button>
        </>
      ) : (
        <p className="text-sm" data-testid="identity-operator-text">
          {operatorRequested ? t('checkin.identity.result.operator.text') : t('checkin.identity.result.operator.notOffered')}
        </p>
      )}

      {operatorRequested && (
        <p role="status" className="text-sm text-muted-foreground" data-testid="identity-operator-requested">
          {t('checkin.identity.operator.requested')}
        </p>
      )}

      <div>
        <Button
          type="button"
          size="lg"
          variant={kind === 'operator' && !operatorRequested ? 'default' : 'outline'}
          onClick={onRequestOperator}
          disabled={busy || operatorRequested}
          loading={busy}
          data-testid="identity-ask-operator"
        >
          {t('checkin.identity.operator.ask')}
        </Button>
      </div>
    </section>
  );
}
