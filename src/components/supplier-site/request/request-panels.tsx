import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import { slotClock } from '@/lib/supplier-site/booking-flow';
import { useSupplierSlots } from '@/queries/use-public-supplier';
import { BookingField } from '../booking/booking-field';

/** What the customer may write for the supplier when it cancels: the server takes 500 characters. */
const REASON_MAX = 500;

/** A panel that opens in the page takes the focus on its title, so a keyboard or a screen reader lands on it. */
function usePanelFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

interface CancelPanelProps {
  supplierName: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onBack: () => void;
}

/** "Annulla la richiesta": costs nothing, says who is told, asks for a reason that is optional. One more press to confirm, nothing else. */
export function CancelPanel({ supplierName, pending, onConfirm, onBack }: CancelPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const title = usePanelFocus();
  const [reason, setReason] = useState('');
  const tooLong = reason.trim().length > REASON_MAX;
  return (
    <section className="vf-panel" aria-labelledby={titleId} data-testid="supplier-request-cancel-panel">
      <h3 id={titleId} tabIndex={-1} ref={title}>
        {t('supplierSite.request.cancel.title')}
      </h3>
      <p>{t('supplierSite.request.cancel.text', { name: supplierName })}</p>
      <BookingField label={t('supplierSite.request.cancel.reason')} optional hint={t('supplierSite.request.cancel.reasonHint', { name: supplierName })} error={tooLong ? t('supplierSite.request.cancel.reasonTooLong') : undefined}>
        {(control) => <textarea {...control} className="vb-input vb-input--area" rows={3} maxLength={REASON_MAX + 100} value={reason} onChange={(event) => setReason(event.target.value)} />}
      </BookingField>
      <div className="vf-panel__a">
        <button type="button" className="vz-btn vz-btn--primary" disabled={pending || tooLong} onClick={() => onConfirm(reason.trim())}>
          {pending ? t('supplierSite.request.working') : t('supplierSite.request.cancel.confirm')}
        </button>
        <button type="button" className="vz-btn vz-btn--secondary" disabled={pending} onClick={onBack}>
          {t('supplierSite.request.cancel.back')}
        </button>
      </div>
    </section>
  );
}

interface ReschedulePanelProps {
  slug: string;
  /** The slug of the service of the booking: its free times are asked for it. */
  serviceSlug: string;
  /** The time the request has now: it is not offered again. */
  currentStartUtc: string;
  pending: boolean;
  onConfirm: (startUtc: string) => void;
  onBack: () => void;
}

/** "Sposta l'orario": the free times of the service for the next two weeks; the server judges the chosen one again and says if it went. */
export function ReschedulePanel({ slug, serviceSlug, currentStartUtc, pending, onConfirm, onBack }: ReschedulePanelProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const title = usePanelFocus();
  const slots = useSupplierSlots(slug, serviceSlug);
  const [chosen, setChosen] = useState<string | null>(null);
  const days = (slots.data?.days ?? [])
    .map((day) => ({ ...day, slots: day.slots.filter((slot) => slot.startUtc !== currentStartUtc) }))
    .filter((day) => day.slots.length > 0);

  let body: ReactNode;
  if (slots.isLoading) body = <p className="vb-note" role="status">{t('supplierSite.request.reschedule.loading')}</p>;
  else if (slots.isError)
    body = (
      <div className="vb-note vb-note--warn" role="alert">
        <span>{t('supplierSite.request.reschedule.error')}</span>
        <button type="button" className="vz-linkbtn" onClick={() => void slots.refetch()}>
          {t('shared.errorState.retry')}
        </button>
      </div>
    );
  else if (days.length === 0) body = <p className="vb-note">{t('supplierSite.request.reschedule.none')}</p>;
  else
    body = (
      <div className="vf-rs">
        {days.map((day) => (
          <fieldset key={day.date} className="vf-rs__day">
            <legend>{formatStayDate(day.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}</legend>
            <ul>
              {day.slots.map((slot) => (
                <li key={slot.startUtc}>
                  <label className="vb-slot">
                    <input type="radio" name="reschedule-slot" value={slot.startUtc} checked={chosen === slot.startUtc} onChange={() => setChosen(slot.startUtc)} />
                    <span>
                      <strong>{slotClock(slot)}</strong>
                      <small>{t('supplierSite.booking.when.until', { time: slot.endLocal.slice(11, 16) })}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
    );

  return (
    <section className="vf-panel" aria-labelledby={titleId} data-testid="supplier-request-reschedule-panel">
      <h3 id={titleId} tabIndex={-1} ref={title}>
        {t('supplierSite.request.reschedule.title')}
      </h3>
      <p>{t('supplierSite.request.reschedule.text')}</p>
      {body}
      <div className="vf-panel__a">
        <button type="button" className="vz-btn vz-btn--primary" disabled={pending || chosen === null} onClick={() => chosen && onConfirm(chosen)}>
          {pending ? t('supplierSite.request.working') : t('supplierSite.request.reschedule.confirm')}
        </button>
        <button type="button" className="vz-btn vz-btn--secondary" disabled={pending} onClick={onBack}>
          {t('supplierSite.request.reschedule.back')}
        </button>
      </div>
    </section>
  );
}
