import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveBookingRequest,
  useBookingApprovalRequests,
  useDeclineBookingRequest,
} from '@/queries/use-bookings';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import type { BookingApprovalRequest } from '@/types';

const DECLINE_MESSAGE_MAX_LENGTH = 500;

function stayDate(value: string, locale: string): string {
  return formatStayDate(value.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function RequestRow({ request }: { request: BookingApprovalRequest }) {
  const { t, i18n } = useTranslation();
  const approve = useApproveBookingRequest();
  const decline = useDeclineBookingRequest();
  const [declining, setDeclining] = useState(false);
  const [message, setMessage] = useState('');
  const busy = approve.isPending || decline.isPending;

  return (
    <li className="space-y-3 rounded-lg border p-4" data-testid="booking-request">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">
            {request.guest.firstName} {request.guest.lastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {request.guest.email}
            {request.guest.phone ? ` · ${request.guest.phone}` : ''}
          </p>
        </div>
        <Badge variant="secondary">{t('booking.requests.badge')}</Badge>
      </div>
      <p className="text-sm">
        {t('booking.requests.stay', {
          property: request.propertyName,
          checkIn: stayDate(request.checkInDate, i18n.language),
          checkOut: stayDate(request.checkOutDate, i18n.language),
          count: request.nights,
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('booking.requests.guestsAndTotal', {
          count: request.numberOfGuests,
          total: request.totalPrice.toLocaleString(i18n.language, { style: 'currency', currency: request.currency }),
        })}
      </p>
      {request.specialRequests && (
        <p className="text-sm text-muted-foreground">
          {t('booking.requests.specialRequests', { text: request.specialRequests })}
        </p>
      )}
      {request.respondBy && (
        <p className="text-sm font-medium text-orange-700">
          {t('booking.requests.respondBy', { date: formatRomeDateTime(request.respondBy, i18n.language) })}
        </p>
      )}

      {declining ? (
        <div className="space-y-2">
          <Label htmlFor={`decline-message-${request.id}`}>{t('booking.requests.declineMessageLabel')}</Label>
          <Textarea
            id={`decline-message-${request.id}`}
            value={message}
            maxLength={DECLINE_MESSAGE_MAX_LENGTH}
            placeholder={t('booking.requests.declineMessagePlaceholder')}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() =>
                decline.mutate({ id: request.id, data: message.trim() ? { message: message.trim() } : {} })
              }
            >
              {decline.isPending ? t('booking.requests.declining') : t('booking.requests.confirmDecline')}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeclining(false)}>
              {t('booking.requests.cancelDecline')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => approve.mutate(request.id)}>
            {approve.isPending ? t('booking.requests.approving') : t('booking.requests.approve')}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeclining(true)}>
            {t('booking.requests.decline')}
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * "Pay at the property" requests waiting for the host (BK-06, decision D5): the booking is valid only once the host
 * accepts it; without an answer by the deadline it expires and the dates are released.
 */
export function BookingRequestsPanel() {
  const { t } = useTranslation();
  const { data: requests, isLoading, isError, refetch } = useBookingApprovalRequests();

  return (
    <Card data-testid="booking-requests-panel" id="booking-requests">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {t('booking.requests.title')}
          {requests && requests.length > 0 && <Badge data-testid="booking-requests-count">{requests.length}</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('booking.requests.description')}</p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('booking.requests.loading')}
          </div>
        )}
        {isError && (
          <div className="flex flex-wrap items-center gap-3 py-2 text-destructive" role="alert">
            {t('booking.requests.loadError')}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('booking.requests.retry')}
            </Button>
          </div>
        )}
        {!isLoading && !isError && requests && requests.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">{t('booking.requests.empty')}</p>
        )}
        {!isLoading && !isError && requests && requests.length > 0 && (
          <ul className="space-y-3">
            {requests.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
