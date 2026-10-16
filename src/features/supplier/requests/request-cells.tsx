import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SupplierServiceRequest } from '@/types/service-request';
import { formatMoney } from '../services/lib/service-money';
import { requestWhen, respondByText } from './request-model';

/** The cells of the list of the requests (`supplier-requests-list`): each one is the little piece of the row it names. */

/** Who asks, under the name of the job (the name is the link that opens the row, and the list draws it). */
export function RequestWho({ request }: { request: SupplierServiceRequest }) {
  const sub = [request.clientName, request.propertyName].filter(Boolean).join(' · ');
  return sub ? <span className="block break-words text-sm font-normal text-foreground/70">{sub}</span> : null;
}

/** The day and the hours of the job; for a new request, until when to answer. */
export function WhenCell({ request }: { request: SupplierServiceRequest }) {
  const { t, i18n } = useTranslation();
  const when = requestWhen(request, i18n.language);
  const respond = respondByText(request, i18n.language, t);
  return (
    <>
      <span className="block">{when.day ?? t('supplier.requests.facts.whenTbd')}</span>
      {when.time ? <span className="block text-sm text-foreground/70">{when.time}</span> : null}
      {respond ? (
        <span className="mt-1 flex items-center gap-1 text-sm font-medium text-warning-foreground">
          <Clock aria-hidden="true" className="size-3.5 shrink-0" />
          {respond}
        </span>
      ) : null}
    </>
  );
}

export function WhereCell({ request }: { request: SupplierServiceRequest }) {
  const { t } = useTranslation();
  return (
    <>
      <span className="block break-words">{request.postalCode ? `${request.city} (${request.postalCode})` : request.city}</span>
      {request.source === 'showcase' ? <span className="block text-sm text-foreground/70">{t('supplier.requests.facts.fromShowcase')}</span> : null}
    </>
  );
}

/** What the server says the job is worth, as it says it: nothing is worked out here. */
export function PriceCell({ request }: { request: SupplierServiceRequest }) {
  const { t, i18n } = useTranslation();
  const price = request.price?.amountCents;
  return price === null || price === undefined ? (
    <span className="text-foreground/70">{t('supplier.requests.facts.priceTbd')}</span>
  ) : (
    <span className="whitespace-nowrap font-medium">{formatMoney(price, i18n.language)}</span>
  );
}
