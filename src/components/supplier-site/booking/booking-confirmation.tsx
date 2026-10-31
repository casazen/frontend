import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, Copy, Hourglass, Mail, TriangleAlert, Undo2 } from 'lucide-react';
import type { PublicBookingConfirmation } from '@/api/public-supplier-booking.api';
import { addressWithoutToken, readConfirmLink } from '@/lib/supplier-site/confirm-link';
import { readConfirmFailure, type ConfirmFailure } from '@/lib/supplier-site/booking-errors';
import { formatSlotLabel } from '@/lib/supplier-site/format';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { useBookingConfirmation } from '@/queries/use-public-supplier-booking';
import { useSupplierSite } from '../site-context';

/** A state of the page that is not the success: one icon, one sentence of what happened, the way on. */
function Outcome({ icon, tone, title, text, actions, testId }: { icon: ReactNode; tone?: 'error'; title: string; text: string; actions?: ReactNode; testId: string }) {
  return (
    <div className="vz-container" data-testid={testId}>
      <section className={`vz-state${tone ? ` vz-state--${tone}` : ''}`}>
        <span className="vz-state__icon" aria-hidden="true">
          {icon}
        </span>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{text}</p>
        {actions ? <div className="vz-state__actions">{actions}</div> : null}
      </section>
    </div>
  );
}

/** The code of the booking to keep: shown whole, with a button that copies it. */
function CodeLine({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <p className="vf-code">
      <span>{t('supplierSite.booking.confirm.code')}</span>
      <strong>{code}</strong>
      <button type="button" className="vf-copy" onClick={() => void copy()} aria-label={t('supplierSite.booking.confirm.copy')}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status">
        {copied ? t('supplierSite.booking.confirm.copied') : ''}
      </span>
    </p>
  );
}

function Done({ slug, supplierName, result }: { slug: string; supplierName: string; result: PublicBookingConfirmation }) {
  const { t, i18n } = useTranslation();
  const when = result.respondBy ? formatSlotLabel(result.respondBy, t, i18n.language) : '';
  const already = result.alreadyConfirmed;
  return (
    <div data-testid="supplier-booking-confirmed">
      <section className="vf-hero" aria-labelledby="vf-title">
        <div className="vz-container vf-hero__in">
          <div className="vf-hero__main">
            <span className="vf-tick" aria-hidden="true">
              <Check />
            </span>
            <h1 id="vf-title" tabIndex={-1}>
              {already ? t('supplierSite.booking.confirm.already.title') : t('supplierSite.booking.confirm.done.title')}
            </h1>
            <p className="vf-hero__lead">
              {already
                ? t('supplierSite.booking.confirm.already.lead')
                : when
                  ? t('supplierSite.booking.confirm.done.lead', { name: supplierName, service: result.serviceName, when })
                  : t('supplierSite.booking.confirm.done.leadNoDeadline', { name: supplierName, service: result.serviceName })}
            </p>
            <div className="vf-hero__a">
              <Link className="vz-btn vz-btn--primary vz-btn--lg" to={`${supplierSitePaths.request(slug)}?code=${encodeURIComponent(result.publicCode)}`}>
                {t('supplierSite.booking.confirm.myRequest')}
              </Link>
            </div>
          </div>
          <aside className="vf-ticket" aria-label={t('supplierSite.booking.confirm.ticket')}>
            <CodeLine code={result.publicCode} />
            <p className="vf-ticket__t">{result.serviceName}</p>
            <p className="vf-ticket__d">{formatSlotLabel(result.startUtc, t, i18n.language)}</p>
            <p className="vz-small">{t('supplierSite.booking.confirm.keepCode')}</p>
          </aside>
        </div>
      </section>
      <section className="vz-section vz-section--tight">
        <div className="vz-container">
          <h2 className="vf-h2">{t('supplierSite.booking.confirm.next.title')}</h2>
          <ol className="vf-list">
            <li>
              <span className="vf-list__i" aria-hidden="true">
                <Hourglass />
              </span>
              <div>
                <strong>{t('supplierSite.booking.confirm.next.review', { name: supplierName })}</strong>
                <p>{when ? t('supplierSite.booking.confirm.next.reviewText', { when }) : t('supplierSite.booking.confirm.next.reviewTextNoDeadline')}</p>
              </div>
            </li>
            <li>
              <span className="vf-list__i" aria-hidden="true">
                <Mail />
              </span>
              <div>
                <strong>{t('supplierSite.booking.confirm.next.mail')}</strong>
                <p>{t('supplierSite.booking.confirm.next.mailText')}</p>
              </div>
            </li>
            <li>
              <span className="vf-list__i" aria-hidden="true">
                <Undo2 />
              </span>
              <div>
                <strong>{t('supplierSite.booking.confirm.next.change')}</strong>
                <p>{t('supplierSite.booking.confirm.next.changeText')}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}

/**
 * The page the link of the verification e-mail opens, `/fornitori/:slug/conferma?hold=…#token=…` (SP-12b). It takes the token out of the
 * address as soon as it has read it (so it stays in no history entry, no bookmark and no shared screenshot), checks the e-mail once and
 * says what happened: the request is sent, it already was, the card still has to be blocked, the link is no good or ran out.
 */
export function BookingConfirmation() {
  const { t } = useTranslation();
  const { model } = useSupplierSite();
  const { pathname, search, hash } = useLocation();
  const [link] = useState(() => readConfirmLink(search, hash));

  // The token leaves the address bar at once; the page keeps it in memory for the one call.
  useEffect(() => {
    if (link.token) window.history.replaceState(window.history.state, '', addressWithoutToken(pathname, link));
  }, [link, pathname]);

  const confirmation = useBookingConfirmation(model.slug, link.hold, link.token);
  const bookAgain = (
    <Link className="vz-btn vz-btn--primary vz-btn--lg" to={supplierSitePaths.booking(model.slug)}>
      {t('supplierSite.booking.confirm.bookAgain')}
    </Link>
  );
  // A link that is no good may be one already used (the token leaves the address when the page opens, so a reload cannot use it again):
  // whoever already checked the e-mail finds the request with its code.
  const invalidActions = (
    <>
      {bookAgain}
      <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={supplierSitePaths.request(model.slug)}>
        {t('supplierSite.booking.confirm.myRequest')}
      </Link>
    </>
  );

  // A link for a request on measure (SP-12c) or one with nothing usable in it.
  if (!link.hold || !link.token) {
    return <Outcome testId="supplier-booking-link-invalid" tone="error" icon={<TriangleAlert />} title={t('supplierSite.booking.confirm.invalid.title')} text={t('supplierSite.booking.confirm.invalid.text')} actions={invalidActions} />;
  }
  if (confirmation.isLoading) {
    return (
      <div className="vz-container vz-loading" role="status" aria-busy="true" data-testid="supplier-booking-confirming">
        <span className="sr-only">{t('supplierSite.booking.confirm.checking')}</span>
        <div aria-hidden="true">
          <span className="vz-skel vz-skel-line vz-skel-line--title" />
          <span className="vz-skel vz-skel-hero" />
        </div>
      </div>
    );
  }
  if (confirmation.isError) {
    const failure: ConfirmFailure = readConfirmFailure(confirmation.error);
    if (failure.kind === 'expired') {
      return <Outcome testId="supplier-booking-link-expired" icon={<Hourglass />} title={t('supplierSite.booking.confirm.expired.title')} text={t('supplierSite.booking.confirm.expired.text')} actions={bookAgain} />;
    }
    if (failure.kind === 'supplierUnavailable') {
      return <Outcome testId="supplier-booking-supplier-unavailable" tone="error" icon={<CircleAlert />} title={t('supplierSite.booking.confirm.unavailable.title', { name: model.name })} text={t('supplierSite.booking.confirm.unavailable.text')} />;
    }
    if (failure.kind === 'invalid') {
      return <Outcome testId="supplier-booking-link-invalid" tone="error" icon={<TriangleAlert />} title={t('supplierSite.booking.confirm.invalid.title')} text={t('supplierSite.booking.confirm.invalid.text')} actions={invalidActions} />;
    }
    const wait = failure.kind === 'rateLimited' && failure.retryAfterSeconds ? Math.max(1, Math.ceil(failure.retryAfterSeconds / 60)) : null;
    return (
      <Outcome
        testId="supplier-booking-confirm-error"
        tone="error"
        icon={<CircleAlert />}
        title={t('supplierSite.booking.confirm.retry.title')}
        text={wait ? t('supplierSite.booking.confirm.retry.textWait', { minutes: wait }) : t('supplierSite.booking.confirm.retry.text')}
        actions={
          <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" onClick={() => void confirmation.refetch()}>
            {t('shared.errorState.retry')}
          </button>
        }
      />
    );
  }
  const result = confirmation.data;
  if (!result) return null;
  if (result.awaitingPayment) {
    return <Outcome testId="supplier-booking-awaiting-payment" icon={<Hourglass />} title={t('supplierSite.booking.confirm.awaitingPayment.title')} text={t('supplierSite.booking.confirm.awaitingPayment.text')} />;
  }
  return <Done slug={model.slug} supplierName={model.name} result={result} />;
}
