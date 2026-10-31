import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { ArrowLeft, CircleAlert, Info, ListChecks, Lock, Mail, MessagesSquare, Send } from 'lucide-react';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { newClientRequestId, suggestEmail, type DraftComune } from '@/lib/supplier-site/booking-flow';
import { parseBookingParams } from '@/lib/supplier-site/booking-params';
import { readInquiryFailure, type InquiryFailure } from '@/lib/supplier-site/inquiry-errors';
import { INQUIRY_LIMITS, toInquiryBody, validateInquiry, type InquiryField, type InquiryProblems } from '@/lib/supplier-site/inquiry-flow';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { useComune } from '@/queries/use-comuni';
import { useCreateInquiry } from '@/queries/use-public-supplier-booking';
import type { Comune } from '@/types/comune.types';
import { BookingField } from '../booking/booking-field';
import { CheckEmail } from '../booking/check-email';
import { FinderComuneField } from '../finder-comune-field';
import { useSupplierSite } from '../site-context';
import { isFramedPreview } from '../use-preview-draft';
import { useInquiryDraft } from './use-inquiry-draft';

type Notice = InquiryFailure | { kind: 'unavailable' } | { kind: 'preview' };

/** A problem the server (or the page) found while sending, said above the button where the person is looking. */
function NoticeBox({ notice, comuneName, supplierName }: { notice: Notice; comuneName: string; supplierName: string }) {
  const { t } = useTranslation();
  let text: string;
  switch (notice.kind) {
    case 'rateLimited':
      text = notice.retryAfterSeconds
        ? t('supplierSite.inquiry.notice.rateLimitedWait', { minutes: Math.max(1, Math.ceil(notice.retryAfterSeconds / 60)) })
        : t('supplierSite.inquiry.notice.rateLimited');
      break;
    case 'consent':
      text = notice.outdated ? t('supplierSite.inquiry.notice.consentOutdated') : t('supplierSite.inquiry.notice.consent');
      break;
    case 'outsideZone':
      text = t('supplierSite.inquiry.notice.outsideZone', { comune: comuneName, name: supplierName });
      break;
    case 'offline':
      text = t('supplierSite.inquiry.notice.offline', { name: supplierName });
      break;
    default:
      text = t(`supplierSite.inquiry.notice.${notice.kind}`);
  }
  return (
    <p className="vb-note vb-note--warn" role="alert" data-testid="supplier-inquiry-notice">
      <CircleAlert aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

/**
 * The request on measure from the public site of a supplier, `/fornitori/:slug/preventivo` (SP-12c): for what the price list does not say,
 * or says with variations. The customer says what it needs, where, and who it is, checks its e-mail and — only then — the supplier
 * receives the request and answers in a conversation inside CasaZen. One form on one page: the draft survives a reload (see
 * `useInquiryDraft`), the consent is asked every time, and the address of the page never carries a name, an e-mail or a word of the request.
 */
export function InquiryForm() {
  const { t, i18n } = useTranslation();
  const { model, showcase } = useSupplierSite();
  const [search] = useSearchParams();
  const preview = isFramedPreview(search);
  const online = useOnlineStatus();
  const slug = model.slug;
  const services = model.services ?? [];
  const consentId = useId();
  const trapId = useId();
  const comuneId = useId();

  // What the buttons of the site already told (the service, the comune): read once, over what the device remembered.
  const [seed] = useState(() => parseBookingParams(search));
  const { draft, update, discard } = useInquiryDraft(slug, { service: seed.service, comune: seed.comune });
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState('');
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [serverProblems, setServerProblems] = useState<InquiryProblems>({});
  const [sent, setSent] = useState<{ email: string; expiresAt: string } | null>(null);
  const attempt = useRef<{ id: string; fingerprint: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const create = useCreateInquiry(slug);

  const chosen = services.find((service) => service.slug === draft.service) ?? null;
  const seededComune = useComune(draft.comune === undefined ? (seed.comune ?? null) : null);
  const comune: DraftComune | null =
    draft.comune !== undefined
      ? draft.comune
      : seededComune.data
        ? { istatCode: seededComune.data.istatCode, name: seededComune.data.name, provinceCode: seededComune.data.provinceCode }
        : null;

  const problems = validateInquiry(draft, comune !== null, consent);
  const shown: InquiryProblems = { ...serverProblems, ...(tried ? problems : {}) };
  const suggestion = suggestEmail(draft.email);
  const problem = (field: Exclude<InquiryField, 'comune' | 'consent'>) => {
    const found = shown[field];
    return found ? t(`supplierSite.inquiry.problems.${field}.${found}`, { min: INQUIRY_LIMITS.messageMin, max: INQUIRY_LIMITS.messageMax }) : undefined;
  };
  const change = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    if (Object.keys(serverProblems).length > 0) setServerProblems({});
  };
  const onComune = (picked: Comune | null) => {
    change({ comune: picked ? { istatCode: picked.istatCode, name: picked.name, provinceCode: picked.provinceCode } : null });
    setNotice(null);
  };

  const send = async () => {
    if (!comune) return;
    if (preview) {
      setNotice({ kind: 'preview' });
      return;
    }
    const version = showcase.privacyNoticeVersion?.trim();
    if (!version) {
      setNotice({ kind: 'unavailable' });
      return;
    }
    const body = toInquiryBody({ draft: { ...draft, service: chosen?.slug ?? null }, comune, locale: i18n.language, privacyNoticeVersion: version, clientRequestId: '', trap });
    // The same request again (a retry after a lost answer) keeps its id and so sends no second e-mail; any change is a new attempt.
    const fingerprint = JSON.stringify({ ...body, clientRequestId: '' });
    const thisAttempt = attempt.current?.fingerprint === fingerprint ? attempt.current : { id: newClientRequestId(), fingerprint };
    attempt.current = thisAttempt;
    try {
      const created = await create.mutateAsync({ ...body, clientRequestId: thisAttempt.id });
      discard();
      setSent({ email: draft.email.trim(), expiresAt: created.expiresAt });
    } catch (error) {
      const failure = readInquiryFailure(error);
      if (failure.kind === 'invalid') {
        setServerProblems(Object.fromEntries(failure.fields.map((field) => [field, field === 'message' ? 'tooShort' : 'invalid'])));
      } else if (failure.kind === 'consent') {
        setConsent(false);
      }
      setNotice(failure);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    setTried(true);
    setNotice(null);
    if (Object.keys(problems).length > 0) {
      // The first field at fault takes the focus, once the page has drawn what is wrong with it.
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus());
      return;
    }
    void send();
  };

  if (sent) {
    return (
      <div className="vz-container vb" data-testid="supplier-inquiry-sent">
        <CheckEmail slug={slug} supplierName={model.name} email={sent.email} expiresAt={sent.expiresAt} variant="inquiry" />
      </div>
    );
  }

  const backTo = chosen ? supplierSitePaths.service(slug, chosen.slug) : supplierSitePaths.home(slug);
  const length = draft.message.length;

  return (
    <div className="vz-container vb vi" data-testid="supplier-inquiry-page">
      <header className="vb-head">
        <Link className="vb-back" to={backTo}>
          <ArrowLeft aria-hidden="true" />
          <span>{chosen ? t('supplierSite.booking.back.toService', { name: chosen.name }) : t('supplierSite.inquiry.back', { name: model.name })}</span>
        </Link>
        <h1 id="vz-title">{chosen ? t('supplierSite.inquiry.titleFor', { service: chosen.name }) : t('supplierSite.inquiry.title')}</h1>
        <p className="vi-lead">{t('supplierSite.inquiry.lead', { name: model.name })}</p>
      </header>

      <div className="vb-cols">
        <form ref={formRef} className="vb-panel" onSubmit={onSubmit} noValidate aria-label={t('supplierSite.inquiry.title')} data-testid="supplier-inquiry-form">
          <div className="vb-fields">
            <section className="vb-group" aria-labelledby={`${consentId}-what`}>
              <h3 id={`${consentId}-what`}>{t('supplierSite.inquiry.form.whatTitle')}</h3>
              {services.length > 0 ? (
                <BookingField label={t('supplierSite.inquiry.form.service')} optional hint={t('supplierSite.inquiry.form.serviceHint')}>
                  {(control) => (
                    <select {...control} className="vb-input" name="service" value={chosen?.slug ?? ''} onChange={(event) => change({ service: event.target.value || null })}>
                      <option value="">{t('supplierSite.inquiry.form.serviceOther')}</option>
                      {services.map((service) => (
                        <option key={service.slug} value={service.slug}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  )}
                </BookingField>
              ) : null}
              <BookingField label={t('supplierSite.inquiry.form.message')} hint={t('supplierSite.inquiry.form.messageHint')} error={problem('message')}>
                {(control) => (
                  <textarea
                    {...control}
                    className="vb-input vb-input--area vi-message"
                    name="message"
                    rows={6}
                    maxLength={INQUIRY_LIMITS.messageMax}
                    placeholder={t('supplierSite.inquiry.form.messagePlaceholder')}
                    value={draft.message}
                    onChange={(event) => change({ message: event.target.value })}
                  />
                )}
              </BookingField>
              <p className="vb-hint vi-counter">{t('supplierSite.inquiry.form.counter', { used: length, max: INQUIRY_LIMITS.messageMax })}</p>
              <div className="vb-field" data-invalid={shown.comune || (tried && !comune) ? 'true' : undefined}>
                <label className="vb-label" htmlFor={comuneId}>
                  {t('supplierSite.inquiry.form.comune')}
                </label>
                <p className="vb-hint">{t('supplierSite.booking.where.hint')}</p>
                <div className="vb-comune">
                  <FinderComuneField id={comuneId} value={comune} onChange={onComune} />
                </div>
                {shown.comune || (tried && !comune) ? (
                  <p className="vb-error" role="alert">
                    <CircleAlert aria-hidden="true" />
                    <span>{t('supplierSite.booking.problems.comune.required')}</span>
                  </p>
                ) : null}
              </div>
            </section>

            <section className="vb-group" aria-labelledby={`${consentId}-who`}>
              <h3 id={`${consentId}-who`}>{t('supplierSite.inquiry.form.whoTitle')}</h3>
              <BookingField label={t('supplierSite.inquiry.form.fullName')} error={problem('fullName')}>
                {(control) => <input {...control} className="vb-input" name="fullName" type="text" autoComplete="name" maxLength={120} value={draft.fullName} onChange={(event) => change({ fullName: event.target.value })} />}
              </BookingField>
              <div className="vb-row">
                <BookingField label={t('supplierSite.inquiry.form.email')} hint={t('supplierSite.inquiry.form.emailHint')} error={problem('email')}>
                  {(control) => (
                    <input {...control} className="vb-input" name="email" type="email" inputMode="email" autoComplete="email" maxLength={260} value={draft.email} onChange={(event) => change({ email: event.target.value })} />
                  )}
                </BookingField>
                <BookingField label={t('supplierSite.inquiry.form.phone')} hint={t('supplierSite.inquiry.form.phoneHint')} error={problem('phone')}>
                  {(control) => (
                    <input {...control} className="vb-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={60} value={draft.phone} onChange={(event) => change({ phone: event.target.value })} />
                  )}
                </BookingField>
              </div>
              {suggestion ? (
                <p className="vb-suggest" role="status">
                  <Info aria-hidden="true" />
                  <span>{t('supplierSite.inquiry.form.emailSuggest', { email: suggestion })}</span>
                  <button type="button" className="vz-linkbtn" onClick={() => change({ email: suggestion })}>
                    {t('supplierSite.inquiry.form.emailFix')}
                  </button>
                </p>
              ) : null}
              <p className="vb-hint vb-hint--icon">
                <Lock aria-hidden="true" />
                <span>{t('supplierSite.inquiry.form.privacy')}</span>
              </p>
            </section>

            <div className="vb-consent">
              <label className="vb-check" htmlFor={consentId}>
                <input
                  id={consentId}
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  aria-invalid={shown.consent ? true : undefined}
                  aria-describedby={shown.consent ? `${consentId}-error` : undefined}
                />
                <span>
                  <Trans i18nKey="supplierSite.inquiry.form.consent" components={{ privacy: <Link to={LEGAL_DOCUMENT_PATHS.privacy} target="_blank" rel="noopener noreferrer" /> }} />
                </span>
              </label>
              {shown.consent ? (
                <p className="vb-error" id={`${consentId}-error`} role="alert">
                  <CircleAlert aria-hidden="true" />
                  <span>{t('supplierSite.booking.problems.consent.required')}</span>
                </p>
              ) : null}
            </div>

            {/* The trap for robots: hidden by the stylesheet, not by `type="hidden"`, out of the tab order and out of the reading order. */}
            <div className="vb-trap" aria-hidden="true">
              <label htmlFor={trapId}>{t('supplierSite.booking.details.trap')}</label>
              <input
                id={trapId}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                // A password manager or an autofill must not fill the trap for a person: the request would be answered and dropped.
                data-lpignore="true"
                data-1p-ignore=""
                data-form-type="other"
                value={trap}
                onChange={(event) => setTrap(event.target.value)}
              />
            </div>
          </div>

          {notice ? <NoticeBox notice={notice} comuneName={comune?.name ?? ''} supplierName={model.name} /> : null}
          {preview && !notice ? <NoticeBox notice={{ kind: 'preview' }} comuneName="" supplierName={model.name} /> : null}
          {!online ? (
            <p className="vb-note vb-note--warn" role="status">
              {t('supplierSite.inquiry.actions.offline')}
            </p>
          ) : null}

          <div className="vb-actions">
            <span />
            <button type="submit" className="vz-btn vz-btn--primary vz-btn--lg" disabled={create.isPending || !online} data-testid="supplier-inquiry-send">
              <Send aria-hidden="true" />
              <span>{create.isPending ? t('supplierSite.inquiry.actions.sending') : t('supplierSite.inquiry.actions.send')}</span>
            </button>
          </div>
          <p className="vb-after">{t('supplierSite.inquiry.actions.after', { name: model.name })}</p>
        </form>

        <aside className="vb-aside" aria-label={t('supplierSite.inquiry.how.title')}>
          <section className="vi-how">
            <h2>{t('supplierSite.inquiry.how.title')}</h2>
            <ol>
              <li>
                <ListChecks aria-hidden="true" />
                <div>
                  <strong>{t('supplierSite.inquiry.how.describe')}</strong>
                  <p>{t('supplierSite.inquiry.how.describeText')}</p>
                </div>
              </li>
              <li>
                <Mail aria-hidden="true" />
                <div>
                  <strong>{t('supplierSite.inquiry.how.check')}</strong>
                  <p>{t('supplierSite.inquiry.how.checkText', { name: model.name })}</p>
                </div>
              </li>
              <li>
                <MessagesSquare aria-hidden="true" />
                <div>
                  <strong>{t('supplierSite.inquiry.how.talk', { name: model.name })}</strong>
                  <p>{t('supplierSite.inquiry.how.talkText')}</p>
                </div>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
