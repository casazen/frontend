import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CircleAlert, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import { COMPLAINT_REASONS, type PublicBookingDispute, type PublicBookingPayment, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { formatSlotLabel } from '@/lib/supplier-site/format';
import { BookingField } from '../booking/booking-field';
import { usePanelFocus } from './use-panel-focus';

/** What the server allows to say about the money, as the customer reads it. */
const STATUS_ICON: Record<PublicBookingPayment['status'], typeof Lock> = {
  authorized: Lock,
  held: ShieldCheck,
  released: Banknote,
  refunded: Undo2,
  canceled: Undo2,
  review: CircleAlert,
};

/** What the customer wrote, what happened to it, and what it may do: the complaint as the server states it (never the supplier's reply). */
function DisputeNote({ dispute, supplierName }: { dispute: PublicBookingDispute; supplierName: string }) {
  const { t, i18n } = useTranslation();
  const when = (instant: string) => formatSlotLabel(instant, t, i18n.language);
  const refund = dispute.refundCents ? formatMoney(dispute.refundCents, i18n.language) : null;
  return (
    <div className="vf-dispute" data-testid="supplier-request-dispute" data-status={dispute.status}>
      <h3>{t('supplierSite.request.dispute.title')}</h3>
      <p className="vf-dispute__reason">
        {dispute.openedByCasaZen ? t('supplierSite.request.dispute.openedByCasaZen') : t(`supplierSite.request.dispute.reasons.${dispute.reason}`)}
      </p>
      {dispute.text ? <blockquote>{dispute.text}</blockquote> : null}
      <p>
        {dispute.status === 'AwaitingSupplier'
          ? t('supplierSite.request.dispute.status.AwaitingSupplier', { name: supplierName, when: when(dispute.supplierReplyDueAt) })
          : t(`supplierSite.request.dispute.status.${dispute.status}`, { name: supplierName })}
      </p>
      {dispute.supplierReplied && (dispute.status === 'AwaitingSupplier' || dispute.status === 'AwaitingDecision') ? (
        <p>{t('supplierSite.request.dispute.supplierReplied', { name: supplierName })}</p>
      ) : null}
      {dispute.status === 'ResolvedForCustomer' && refund ? (
        <p className="vf-dispute__refund">{dispute.settled ? t('supplierSite.request.dispute.refundDone', { amount: refund }) : t('supplierSite.request.dispute.refundPending', { amount: refund })}</p>
      ) : null}
    </div>
  );
}

interface PaymentBlockProps {
  view: PublicBookingView;
  /** The customer may take its complaint back. */
  onWithdraw: () => void;
  pending: boolean;
}

/**
 * "Il pagamento": where the money of a booking paid inside CasaZen is — blocked, charged and held, released, given back — in words that
 * say exactly what is true (D24: no date of accounting, no fee, no promise of a time), and the complaint if there is one. Everything comes
 * from `payment` of the booking; the page adds up nothing.
 */
export function PaymentBlock({ view, onWithdraw, pending }: PaymentBlockProps) {
  const { t, i18n } = useTranslation();
  const payment = view.payment;
  if (!payment) return null;
  const Icon = STATUS_ICON[payment.status];
  const name = view.supplier.name;
  const amount = formatMoney(payment.amountCents, i18n.language);
  const refunded = formatMoney(payment.refundedCents > 0 ? payment.refundedCents : payment.amountCents, i18n.language);
  const reportUntil = view.actions.canReportProblem && payment.releaseAtUtc ? formatSlotLabel(payment.releaseAtUtc, t, i18n.language) : '';
  return (
    <section className="vz-section vz-section--tight vf-pay" aria-labelledby="vf-pay-title" data-testid="supplier-request-payment" data-payment={payment.status}>
      <div className="vz-container">
        <h2 id="vf-pay-title" className="vf-h2">
          {t('supplierSite.request.payment.title')}
        </h2>
        <div className="vf-pay__box">
          <span className="vf-pay__icon" aria-hidden="true">
            <Icon />
          </span>
          <div>
            <strong>{t(`supplierSite.request.payment.status.${payment.status}.title`)}</strong>
            <p>{t(`supplierSite.request.payment.status.${payment.status}.text`, { amount, name, refunded })}</p>
            {reportUntil ? <p className="vf-pay__window">{t('supplierSite.request.payment.window', { when: reportUntil })}</p> : null}
          </div>
        </div>
        {payment.dispute ? <DisputeNote dispute={payment.dispute} supplierName={name} /> : null}
        {view.actions.canWithdrawProblem ? (
          <button type="button" className="vz-btn vz-btn--secondary" onClick={onWithdraw} disabled={pending}>
            {t('supplierSite.request.dispute.withdraw')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

interface ConfirmOkPanelProps {
  supplierName: string;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

/** "Tutto a posto": the supplier is paid at once and the time to report a problem ends. One explicit press, because it cannot be undone. */
export function ConfirmOkPanel({ supplierName, pending, onConfirm, onBack }: ConfirmOkPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const title = usePanelFocus();
  return (
    <section className="vf-panel" aria-labelledby={titleId} data-testid="supplier-request-confirm-ok-panel">
      <h3 id={titleId} tabIndex={-1} ref={title}>
        {t('supplierSite.request.confirmOk.title')}
      </h3>
      <p>{t('supplierSite.request.confirmOk.text', { name: supplierName })}</p>
      <div className="vf-panel__a">
        <button type="button" className="vz-btn vz-btn--primary" disabled={pending} onClick={onConfirm}>
          {pending ? t('supplierSite.request.working') : t('supplierSite.request.confirmOk.confirm')}
        </button>
        <button type="button" className="vz-btn vz-btn--secondary" disabled={pending} onClick={onBack}>
          {t('supplierSite.request.confirmOk.back')}
        </button>
      </div>
    </section>
  );
}

/** What the customer may write: the server takes 1000 characters. */
const TEXT_MAX = 1000;

interface ReportProblemPanelProps {
  supplierName: string;
  /** Until when the customer may report, from the server (`payment.releaseAtUtc`), already said in words; empty when it is not known. */
  deadline: string;
  pending: boolean;
  onConfirm: (reason: string, text: string) => void;
  onBack: () => void;
}

/** "Segnala un problema": a reason among five and the customer's own words (required for "other"). Text only. */
export function ReportProblemPanel({ supplierName, deadline, pending, onConfirm, onBack }: ReportProblemPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const title = usePanelFocus();
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const trimmed = text.trim();
  const reasonProblem = tried && reason === null;
  const textProblem = tried && ((reason === 'other' && trimmed.length === 0) || trimmed.length > TEXT_MAX);

  const submit = () => {
    setTried(true);
    if (reason === null || (reason === 'other' && trimmed.length === 0) || trimmed.length > TEXT_MAX) return;
    onConfirm(reason, trimmed);
  };

  return (
    <section className="vf-panel" aria-labelledby={titleId} data-testid="supplier-request-report-panel">
      <h3 id={titleId} tabIndex={-1} ref={title}>
        {t('supplierSite.request.report.title')}
      </h3>
      <p>{t('supplierSite.request.report.text', { name: supplierName })}</p>
      {deadline ? <p>{t('supplierSite.request.payment.window', { when: deadline })}</p> : null}
      <fieldset className="vf-reasons">
        <legend>{t('supplierSite.request.report.reasonLegend')}</legend>
        {COMPLAINT_REASONS.map((code) => (
          <label key={code} className="vb-check">
            <input type="radio" name="problem-reason" value={code} checked={reason === code} onChange={() => setReason(code)} />
            <span>{t(`supplierSite.request.dispute.reasons.${code}`)}</span>
          </label>
        ))}
        {reasonProblem ? (
          <p className="vb-error" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{t('supplierSite.request.report.reasonRequired')}</span>
          </p>
        ) : null}
      </fieldset>
      <BookingField
        label={t('supplierSite.request.report.textLabel')}
        optional={reason !== 'other'}
        hint={t('supplierSite.request.report.textHint', { name: supplierName })}
        error={textProblem ? (trimmed.length > TEXT_MAX ? t('supplierSite.request.report.textTooLong') : t('supplierSite.request.report.textRequired')) : undefined}
      >
        {(control) => <textarea {...control} className="vb-input vb-input--area" rows={4} maxLength={TEXT_MAX + 200} value={text} onChange={(event) => setText(event.target.value)} />}
      </BookingField>
      <div className="vf-panel__a">
        <button type="button" className="vz-btn vz-btn--primary" disabled={pending} onClick={submit}>
          {pending ? t('supplierSite.request.working') : t('supplierSite.request.report.send')}
        </button>
        <button type="button" className="vz-btn vz-btn--secondary" disabled={pending} onClick={onBack}>
          {t('supplierSite.request.report.back')}
        </button>
      </div>
    </section>
  );
}
