import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { CircleAlert, Info } from 'lucide-react';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';
import { suggestEmail, type BookingDraft, type DetailsField, type DetailsProblems } from '@/lib/supplier-site/booking-flow';
import { BookingField } from './booking-field';

interface StepDetailsProps {
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  /** The trap for robots: a field the page never shows to a person. */
  trap: string;
  onTrap: (value: string) => void;
  /** What is wrong, once the person tried to go on. */
  problems: DetailsProblems;
}

/** Step 4, "I tuoi dati": where the work is, who the customer is, the consent. */
export function StepDetails({ draft, onChange, consent, onConsent, trap, onTrap, problems }: StepDetailsProps) {
  const { t } = useTranslation();
  const consentId = useId();
  const trapId = useId();
  const suggestion = suggestEmail(draft.email);
  const problem = (field: DetailsField) => {
    const found = problems[field];
    return found ? t(`supplierSite.booking.problems.${field}.${found}`) : undefined;
  };

  return (
    <div className="vb-step-details">
      <section className="vb-group" aria-labelledby={`${consentId}-where`}>
        <h3 id={`${consentId}-where`}>{t('supplierSite.booking.details.whereTitle')}</h3>
        <BookingField label={t('supplierSite.booking.details.address')} hint={t('supplierSite.booking.details.addressHint')} error={problem('address')}>
          {(control) => (
            <input {...control} className="vb-input" name="address" type="text" autoComplete="address-line1" maxLength={220} value={draft.address} onChange={(event) => onChange({ address: event.target.value })} />
          )}
        </BookingField>
        <div className="vb-row">
          <BookingField label={t('supplierSite.booking.details.postalCode')} error={problem('postalCode')}>
            {(control) => (
              <input {...control} className="vb-input" name="postalCode" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={draft.postalCode} onChange={(event) => onChange({ postalCode: event.target.value.replace(/\D/g, '') })} />
            )}
          </BookingField>
          <BookingField label={t('supplierSite.booking.details.floor')} optional error={problem('floor')}>
            {(control) => (
              <input {...control} className="vb-input" name="floor" type="text" autoComplete="off" maxLength={80} value={draft.floor} onChange={(event) => onChange({ floor: event.target.value })} />
            )}
          </BookingField>
        </div>
        <BookingField label={t('supplierSite.booking.details.accessNotes')} optional hint={t('supplierSite.booking.details.accessNotesHint')} error={problem('accessNotes')}>
          {(control) => (
            <textarea {...control} className="vb-input vb-input--area" name="accessNotes" rows={3} maxLength={600} value={draft.accessNotes} onChange={(event) => onChange({ accessNotes: event.target.value })} />
          )}
        </BookingField>
      </section>

      <section className="vb-group" aria-labelledby={`${consentId}-who`}>
        <h3 id={`${consentId}-who`}>{t('supplierSite.booking.details.whoTitle')}</h3>
        <BookingField label={t('supplierSite.booking.details.fullName')} error={problem('fullName')}>
          {(control) => (
            <input {...control} className="vb-input" name="fullName" type="text" autoComplete="name" maxLength={120} value={draft.fullName} onChange={(event) => onChange({ fullName: event.target.value })} />
          )}
        </BookingField>
        <div className="vb-row">
          <BookingField label={t('supplierSite.booking.details.email')} hint={t('supplierSite.booking.details.emailHint')} error={problem('email')}>
            {(control) => (
              <input {...control} className="vb-input" name="email" type="email" inputMode="email" autoComplete="email" maxLength={260} value={draft.email} onChange={(event) => onChange({ email: event.target.value })} />
            )}
          </BookingField>
          <BookingField label={t('supplierSite.booking.details.phone')} hint={t('supplierSite.booking.details.phoneHint')} error={problem('phone')}>
            {(control) => (
              <input {...control} className="vb-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={60} value={draft.phone} onChange={(event) => onChange({ phone: event.target.value })} />
            )}
          </BookingField>
        </div>
        {suggestion ? (
          <p className="vb-suggest" role="status">
            <Info aria-hidden="true" />
            <span>{t('supplierSite.booking.details.emailSuggest', { email: suggestion })}</span>
            <button type="button" className="vz-linkbtn" onClick={() => onChange({ email: suggestion })}>
              {t('supplierSite.booking.details.emailFix')}
            </button>
          </p>
        ) : null}
      </section>

      <div className="vb-consent">
        <label className="vb-check" htmlFor={consentId}>
          <input id={consentId} type="checkbox" checked={consent} onChange={(event) => onConsent(event.target.checked)} aria-invalid={problems.consent ? true : undefined} aria-describedby={problems.consent ? `${consentId}-error` : undefined} />
          <span>
            <Trans
              i18nKey="supplierSite.booking.details.consent"
              components={{ privacy: <Link to={LEGAL_DOCUMENT_PATHS.privacy} target="_blank" rel="noopener noreferrer" /> }}
            />
          </span>
        </label>
        {problems.consent ? (
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
          // A password manager or an autofill must not fill the trap for a person: the booking would be answered and dropped.
          data-lpignore="true"
          data-1p-ignore=""
          data-form-type="other"
          value={trap}
          onChange={(event) => onTrap(event.target.value)}
        />
      </div>
    </div>
  );
}
