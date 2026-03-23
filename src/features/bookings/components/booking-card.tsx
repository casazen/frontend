import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Edit, Trash2, LogIn, LogOut } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { BOOKING_STATUS_LABELS } from '../schemas/booking.schema';
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
  const statusConfig = BOOKING_STATUS_LABELS[booking.status] || BOOKING_STATUS_LABELS.PENDING;
  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Booking #{booking.id.slice(0, 8)}</span>
          </div>
          <Badge variant={statusConfig.variant}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Guest</p>
          <p className="font-medium">{booking.guest.firstName} {booking.guest.lastName}</p>
          <p className="text-sm text-muted-foreground">{booking.guest.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Check-in</p>
            <p className="font-medium">{formatDate(booking.checkInDate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Check-out</p>
            <p className="font-medium">{formatDate(booking.checkOutDate)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{booking.numberOfGuests} guests</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {nights} night{nights !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold">
              {formatCurrency(booking.totalPrice, booking.currency)}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
        {onView && (
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(booking)}>
            View
          </Button>
        )}
        {onCheckIn && booking.status === 'CONFIRMED' && (
          <Button variant="outline" size="sm" onClick={() => onCheckIn(booking)}>
            <LogIn className="h-4 w-4 mr-1" />
            Check In
          </Button>
        )}
        {onCheckOut && booking.status === 'CHECKED_IN' && (
          <Button variant="outline" size="sm" onClick={() => onCheckOut(booking)}>
            <LogOut className="h-4 w-4 mr-1" />
            Check Out
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
