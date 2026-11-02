import { useTranslation } from 'react-i18next';
import type { PublicBookingOffer } from '@/api/public-supplier-booking.api';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { formatSlotLabel, formatSlotRange } from '@/lib/supplier-site/format';

/**
 * The offer of the supplier for a request on measure (SP-10b-b), as the customer reads it: what each line is for, how many and the
 * amount (the server's, never added up here), the total, the time on the clock of Rome, until when it stands and the supplier's note.
 * It says the one thing the customer must know before it answers: the time is not reserved until it accepts.
 */
export function InquiryOffer({ offer, stale }: { offer: PublicBookingOffer; stale?: boolean }) {
  const { t, i18n } = useTranslation();
  const money = (cents: number) => formatMoney(cents, i18n.language);
  const when = formatSlotRange(offer.startUtc, offer.endUtc, t, i18n.language);
  const until = offer.validUntil && !stale ? formatSlotLabel(offer.validUntil, t, i18n.language) : '';
  return (
    <div className="vf-offer vi-offer" data-testid="supplier-inquiry-offer">
      <ul>
        {offer.lines.map((line, index) => (
          <li key={`${index}-${line.label}`}>
            <span>{line.quantity > 1 ? t('supplierSite.inquiry.offer.line', { quantity: line.quantity, label: line.label }) : line.label}</span>
            <span>{money(line.amountCents)}</span>
          </li>
        ))}
      </ul>
      <p className="vf-offer__total">
        <span>{t('supplierSite.request.quote.total')}</span>
        <strong>{money(offer.totalCents)}</strong>
      </p>
      {when ? (
        <p className="vf-offer__note">
          <span>{t('supplierSite.request.ticket.when')}: </span>
          <strong>{when}</strong>
        </p>
      ) : null}
      {until ? <p className="vf-offer__note">{t('supplierSite.inquiry.offer.validUntil', { when: until })}</p> : null}
      {offer.note ? <p className="vf-offer__note vi-offer__note">{offer.note}</p> : null}
      <p className="vf-offer__note">{t('supplierSite.inquiry.offer.notReserved')}</p>
    </div>
  );
}
