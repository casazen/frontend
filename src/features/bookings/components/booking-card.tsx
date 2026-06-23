import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Edit, Trash2, LogIn, LogOut } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { BOOKING_STATUS_VARIANTS } from '../schemas/booking.schema';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import type { Booking } from '@/types';

interface BookingCardProps {
  booking: Booking;
  onEdit?: (booking: Booking) => void;
  onDelete?: (booking: Booking) => void;
  onView?: (booking: Booking) => void;
  onCheckIn?: (booking: Booking) => void;
  onCheckOut?: (booking: Booking) => void;
}

export function BookingCard({ booking, onEdit, onDelete, onView, onCheckIn, onCheckOut }: BookingCardProps) {
  const { t } = useTranslation();
  const statusLabel = getBookingStatusLabel(booking.status, t);
  const statusVariant = BOOKING_STATUS_VARIANTS[booking.status] || BOOKING_STATUS_VARIANTS.Pending;
  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{t('booking.card.bookingPrefix')}{booking.id.slice(0, 8)}</span>
          </div>
          <Badge variant={statusVariant}>
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('booking.card.guest')}</p>
          <p className="font-medium">{booking.guest.firstName} {booking.guest.lastName}</p>
          <p className="text-sm text-muted-foreground">{booking.guest.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t('booking.card.checkIn')}</p>
            <p className="font-medium">{formatDate(booking.checkInDate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('booking.card.checkOut')}</p>
            <p className="font-medium">{formatDate(booking.checkOutDate)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{booking.numberOfGuests} {t('booking.card.guests')}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {nights} {nights !== 1 ? t('booking.card.night_other') : t('booking.card.night_one')}
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('booking.card.total')}</span>
            <span className="text-lg font-bold">
              {formatCurrency(booking.totalPrice, booking.currency)}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
        {onView && (
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(booking)}>
            {t('booking.card.view')}
          </Button>
        )}
        {onCheckIn && (booking.status === 'Confirmed' || booking.status === 'Pending') && (
          <Button variant="outline" size="sm" onClick={() => onCheckIn(booking)}>
            <LogIn className="h-4 w-4 mr-1" />
            {t('booking.card.checkInAction')}
          </Button>
        )}
        {onCheckOut && booking.status === 'CheckedIn' && (
          <Button variant="outline" size="sm" onClick={() => onCheckOut(booking)}>
            <LogOut className="h-4 w-4 mr-1" />
            {t('booking.card.checkOutAction')}
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="icon" onClick={() => onEdit(booking)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="icon" onClick={() => onDelete(booking)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
