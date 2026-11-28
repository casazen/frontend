import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GUIDANCE_ICONS } from './components/guidance-icons';
import { assistedReasonOf, guidanceKey, LOCK_CODE_HELD_TOURIST_TAX, presenceGuidanceKey, retakeTargetOf } from './lib/identity-model';

interface IdentityResultProps {
  kind: 'ok' | 'retry' | 'operator';
  /**
   * The answer is the one of a self-hosted verification (E72/F02/US01/T01): a retry is the recording of the presence again, with a new challenge, and says what to change in its own words; the selfie, and the attempts of
   * the legacy path, are not there. The server decides how many guided retries there are, so the page counts none.
   */
  presence?: boolean;
  /**
   * The verification was already closed when the guest got here (the page was opened again, or another tab, or an earlier request that was answered after the screen was lost, ended it): the screen says it was already over, and
   * shows where it ended (E72/F02/US01/T02). It never says «passed» unless `kind` is `ok`, which only the server decides.
   */
  closed?: boolean;
  lockCode: string | null;
  lockCodeHeld?: string | null;
  /** What to change, as codes of the API (a `retry`). */
  guidanceCodes: readonly string[];
  attemptsRemaining: number;
  operatorRequested: boolean;
  busy: boolean;
  onRetake: () => void;
  onRequestOperator: () => void;
}

/**
 * The answer of the identity check (CHK-11, NF-50): `ok` shows the lock code in large clear text and says it is also e-mailed; `retry` says in plain words
 * what to change and how many attempts are left; `operator` says that the host verifies and that the code comes after the decision. No code is ever
 * shown for any answer but `ok`. After a `retry` or an `operator` the button to ask a person for the verification is always there (GDPR art. 22).
 */
export function IdentityResult({
  kind,
  presence = false,
  closed = false,
  lockCode,
  lockCodeHeld = null,
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
        {closed && (
          <p className="text-sm text-muted-foreground" data-testid="identity-closed-note">
            {t('checkin.identity.result.closed')}
          </p>
        )}
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
        ) : lockCodeHeld === LOCK_CODE_HELD_TOURIST_TAX ? (
          <p className="text-sm text-muted-foreground" data-testid="identity-code-held">
            {t('checkin.identity.result.ok.codeHeldTouristTax')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="identity-no-code">
            {t('checkin.identity.result.ok.noCode')}
          </p>
        )}
      </section>
    );
  }

  const retakeTarget = retakeTargetOf(guidanceCodes, presence);
  const retakeLabel = {
    document: 'checkin.identity.result.retry.againDocument',
    presence: 'checkin.identity.result.retry.againPresence',
    selfie: 'checkin.identity.result.retry.again',
  }[retakeTarget];
  const assistedReason = kind === 'operator' ? assistedReasonOf(guidanceCodes) : null;
  const AssistedIcon = assistedReason ? GUIDANCE_ICONS[assistedReason] : undefined;

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

      {closed && (
        <p className="text-sm text-muted-foreground" data-testid="identity-closed-note">
          {t('checkin.identity.result.closed')}
        </p>
      )}

      {kind === 'retry' ? (
        <>
          {guidanceCodes.length > 0 ? (
            <div className="space-y-1" data-testid="identity-retry-reasons">
              <p className="text-sm">{t('checkin.identity.result.retry.intro')}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {guidanceCodes.map((code) => (
                  <li key={code}>{t(presence ? presenceGuidanceKey(code) : guidanceKey(code))}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm" data-testid="identity-retry-reasons">
              {t('checkin.identity.result.retry.noReason')}
            </p>
          )}
          {!presence && (
            <p className="text-sm font-medium" data-testid="identity-attempts-left">
              {t('checkin.identity.result.retry.attempts', { count: attemptsRemaining })}
            </p>
          )}
          <Button type="button" size="lg" onClick={onRetake} disabled={busy} data-testid="identity-retake">
            {t(retakeLabel)}
          </Button>
        </>
      ) : (
        <>
          {assistedReason && (
            <p className="flex items-start gap-2 text-sm font-medium" data-testid="identity-operator-reason">
              {AssistedIcon && <AssistedIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              <span>{t(guidanceKey(assistedReason))}</span>
            </p>
          )}
          <p className="text-sm" data-testid="identity-operator-text">
            {operatorRequested ? t('checkin.identity.result.operator.text') : t('checkin.identity.result.operator.notOffered')}
          </p>
        </>
      )}

      {operatorRequested && (
        <p role="status" className="text-sm text-muted-foreground" data-testid="identity-operator-requested">
          {t('checkin.identity.operator.requested')}
        </p>
      )}

      {!operatorRequested && <div>
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
      </div>}
    </section>
  );
}
