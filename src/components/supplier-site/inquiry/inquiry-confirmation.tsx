import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, Hourglass, Mail, MessagesSquare, TriangleAlert, Undo2 } from 'lucide-react';
import type { PublicInquiryConfirmation } from '@/api/public-supplier-inquiry.api';
import { readConfirmFailure, type ConfirmFailure } from '@/lib/supplier-site/booking-errors';
import { formatSlotLabel } from '@/lib/supplier-site/format';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { useInquiryConfirmation } from '@/queries/use-public-supplier-booking';
import { CodeLine } from '../booking/code-line';
import { Outcome } from '../booking/outcome';
import { useSupplierSite } from '../site-context';

function Done({ slug, supplierName, result }: { slug: string; supplierName: string; result: PublicInquiryConfirmation }) {
  const { t, i18n } = useTranslation();
  const when = result.respondBy ? formatSlotLabel(result.respondBy, t, i18n.language) : '';
  const already = result.alreadyConfirmed;
  return (
    <div data-testid="supplier-inquiry-confirmed">
      <section className="vf-hero" aria-labelledby="vf-title">
        <div className="vz-container vf-hero__in">
          <div className="vf-hero__main">
            <span className="vf-tick" aria-hidden="true">
              <Check />
            </span>
            <h1 id="vf-title" tabIndex={-1}>
              {already ? t('supplierSite.inquiry.confirm.already.title') : t('supplierSite.inquiry.confirm.done.title')}
            </h1>
            <p className="vf-hero__lead">
              {already
                ? t('supplierSite.inquiry.confirm.already.lead')
                : when
                  ? t('supplierSite.inquiry.confirm.done.lead', { name: supplierName, when })
                  : t('supplierSite.inquiry.confirm.done.leadNoDeadline', { name: supplierName })}
            </p>
            <div className="vf-hero__a">
              <Link className="vz-btn vz-btn--primary vz-btn--lg" to={`${supplierSitePaths.request(slug)}?code=${encodeURIComponent(result.publicCode)}`}>
                {t('supplierSite.inquiry.confirm.myRequest')}
              </Link>
            </div>
          </div>
          <aside className="vf-ticket" aria-label={t('supplierSite.booking.confirm.ticket')}>
            <CodeLine code={result.publicCode} />
            <p className="vf-ticket__t">{result.serviceName ?? t('supplierSite.inquiry.confirm.kind')}</p>
            {result.serviceName ? <p className="vf-ticket__d">{t('supplierSite.inquiry.confirm.kind')}</p> : null}
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
                <MessagesSquare />
              </span>
              <div>
                <strong>{t('supplierSite.inquiry.confirm.next.talk', { name: supplierName })}</strong>
                <p>{when ? t('supplierSite.inquiry.confirm.next.talkText', { when }) : t('supplierSite.inquiry.confirm.next.talkTextNoDeadline')}</p>
              </div>
            </li>
            <li>
              <span className="vf-list__i" aria-hidden="true">
                <Mail />
              </span>
              <div>
                <strong>{t('supplierSite.inquiry.confirm.next.mail')}</strong>
                <p>{t('supplierSite.inquiry.confirm.next.mailText')}</p>
              </div>
            </li>
            <li>
              <span className="vf-list__i" aria-hidden="true">
                <Undo2 />
              </span>
              <div>
                <strong>{t('supplierSite.inquiry.confirm.next.close')}</strong>
                <p>{t('supplierSite.inquiry.confirm.next.closeText')}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}

interface InquiryConfirmationProps {
  /** The request the link of the e-mail was about (`?inquiry=`). */
  inquiryId: string;
  /** The secret of the link, read from the fragment: null when the link had none that fits. */
  token: string | null;
}

/**
 * The check of the e-mail of a request on measure (SP-12c), on the page the link opens: it says the request is with the supplier, that
 * it already was, or that the link is no good or ran out. The token stays in memory for the one call (the page above takes it out of
 * the address bar at once).
 */
export function InquiryConfirmation({ inquiryId, token }: InquiryConfirmationProps) {
  const { t } = useTranslation();
  const { model } = useSupplierSite();
  const confirmation = useInquiryConfirmation(model.slug, inquiryId, token);
  const again = (
    <Link className="vz-btn vz-btn--primary vz-btn--lg" to={supplierSitePaths.inquiry(model.slug)}>
      {t('supplierSite.inquiry.confirm.again')}
    </Link>
  );
  // A link that is no good may be one already used (the token leaves the address when the page opens, so a reload cannot use it again):
  // whoever already checked the e-mail finds the request with its code.
  const invalidActions = (
    <>
      {again}
      <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={supplierSitePaths.request(model.slug)}>
        {t('supplierSite.inquiry.confirm.myRequest')}
      </Link>
    </>
  );

  if (!token) {
    return <Outcome testId="supplier-inquiry-link-invalid" tone="error" icon={<TriangleAlert />} title={t('supplierSite.inquiry.confirm.invalid.title')} text={t('supplierSite.inquiry.confirm.invalid.text')} actions={invalidActions} />;
  }
  if (confirmation.isLoading) {
    return (
      <div className="vz-container vz-loading" role="status" aria-busy="true" data-testid="supplier-inquiry-confirming">
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
      return <Outcome testId="supplier-inquiry-link-expired" icon={<Hourglass />} title={t('supplierSite.inquiry.confirm.expired.title')} text={t('supplierSite.inquiry.confirm.expired.text')} actions={again} />;
    }
    if (failure.kind === 'supplierUnavailable') {
      return <Outcome testId="supplier-inquiry-supplier-unavailable" tone="error" icon={<CircleAlert />} title={t('supplierSite.booking.confirm.unavailable.title', { name: model.name })} text={t('supplierSite.inquiry.confirm.unavailable')} />;
    }
    if (failure.kind === 'invalid') {
      return <Outcome testId="supplier-inquiry-link-invalid" tone="error" icon={<TriangleAlert />} title={t('supplierSite.inquiry.confirm.invalid.title')} text={t('supplierSite.inquiry.confirm.invalid.text')} actions={invalidActions} />;
    }
    const wait = failure.kind === 'rateLimited' && failure.retryAfterSeconds ? Math.max(1, Math.ceil(failure.retryAfterSeconds / 60)) : null;
    return (
      <Outcome
        testId="supplier-inquiry-confirm-error"
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
  return <Done slug={model.slug} supplierName={model.name} result={result} />;
}
