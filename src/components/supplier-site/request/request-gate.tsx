import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Lock } from 'lucide-react';
import { normalizeCode } from '@/lib/supplier-site/request-view';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';
import { BookingField } from '../booking/booking-field';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface RequestGateProps {
  /** The code the link of the e-mail carried (`?code=`), if any. */
  initialCode: string;
  pending: boolean;
  failure: RequestFailure | null;
  onFind: (code: string, email: string) => void;
}

/**
 * Where the customer proves it is the one who booked: the code of the request and the e-mail it was made with. The server gives one
 * answer for everything that does not match, and so does the page; nothing is kept in the browser (the e-mail lives in memory only).
 */
export function RequestGate({ initialCode, pending, failure, onFind }: RequestGateProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState(() => normalizeCode(initialCode));
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const codeProblem = tried && normalizeCode(code).length !== 11 ? t('supplierSite.request.gate.codeInvalid') : undefined;
  const emailProblem = tried && !EMAIL_SHAPE.test(email.trim()) ? t('supplierSite.request.gate.emailInvalid') : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (pending || normalizeCode(code).length !== 11 || !EMAIL_SHAPE.test(email.trim())) return;
    onFind(normalizeCode(code), email);
  };

  let failureText: string | null = null;
  if (failure?.kind === 'notFound') failureText = t('supplierSite.request.gate.notFound');
  else if (failure?.kind === 'rateLimited') {
    failureText = failure.retryAfterSeconds
      ? t('supplierSite.request.gate.rateLimitedWait', { minutes: Math.max(1, Math.ceil(failure.retryAfterSeconds / 60)) })
      : t('supplierSite.request.gate.rateLimited');
  } else if (failure) failureText = t('supplierSite.request.gate.error');

  return (
    <div className="vz-container vf-gate" data-testid="supplier-request-gate">
      <form className="vb-panel vf-gate__panel" onSubmit={submit} noValidate aria-labelledby="vf-gate-title">
        <div className="vb-panel__head">
          <h1 id="vf-gate-title">{t('supplierSite.request.gate.title')}</h1>
          <p>{t('supplierSite.request.gate.lead')}</p>
        </div>
        {failureText ? (
          <p className="vb-note vb-note--warn" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{failureText}</span>
          </p>
        ) : null}
        <div className="vb-fields">
          <BookingField label={t('supplierSite.request.gate.code')} hint={t('supplierSite.request.gate.codeHint')} error={codeProblem}>
            {(control) => (
              <input
                {...control}
                className="vb-input vf-gate__code"
                name="code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
              />
            )}
          </BookingField>
          <BookingField label={t('supplierSite.request.gate.email')} hint={t('supplierSite.request.gate.emailHint')} error={emailProblem}>
            {(control) => (
              <input {...control} className="vb-input" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            )}
          </BookingField>
        </div>
        <div className="vb-actions">
          <span />
          <button type="submit" className="vz-btn vz-btn--primary vz-btn--lg" disabled={pending}>
            {pending ? t('supplierSite.request.gate.searching') : t('supplierSite.request.gate.submit')}
          </button>
        </div>
        <p className="vb-hint vb-hint--icon">
          <Lock aria-hidden="true" />
          <span>{t('supplierSite.request.gate.privacy')}</span>
        </p>
      </form>
    </div>
  );
}
