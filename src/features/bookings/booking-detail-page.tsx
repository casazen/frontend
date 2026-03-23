import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useBooking } from '@/queries/use-bookings';
import { formatDate, formatCurrency } from '@/lib/utils';
import { BOOKING_STATUS_LABELS } from './schemas/booking.schema';
import { Edit, Calendar, Users, Mail, Phone, MapPin } from 'lucide-react';

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: booking, isLoading } = useBooking(id!);

  if (isLoading) {
    return <LoadingScreen message="Loading booking..." />;
  }

  if (!booking) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Booking not found</h2>
          <p className="text-muted-foreground">The booking you're looking for doesn't exist.</p>
        </div>
      </AppShell>
    );
  }

  const statusConfig = BOOKING_STATUS_LABELS[booking.status] || BOOKING_STATUS_LABELS.PENDING;
  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={`Booking #${booking.id.slice(0, 8)}`}
          description={`${booking.guest.firstName} ${booking.guest.lastName}`}
          action={
            <Button onClick={() => navigate(`/bookings/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Booking
            </Button>
          }
        />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Details */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Booking Details</CardTitle>
                  <Badge variant={statusConfig.variant} className="text-base px-3 py-1">
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      Check-in
                    </div>
                    <div className="font-medium">{formatDate(booking.checkInDate, 'PPP')}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      Check-out
                    </div>
                    <div className="font-medium">{formatDate(booking.checkOutDate, 'PPP')}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>{booking.numberOfGuests} guests</span>
                  </div>
                  <div className="text-muted-foreground">
                    {nights} night{nights !== 1 ? 's' : ''}
                  </div>
                </div>

                {booking.specialRequests && (
                  <div className="pt-3 border-t">
                    <div className="text-sm text-muted-foreground mb-1">Special Requests</div>
                    <p className="text-sm">{booking.specialRequests}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guest Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">
                    {booking.guest.firstName} {booking.guest.lastName}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${booking.guest.email}`} className="text-sm hover:underline">
                    {booking.guest.email}
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${booking.guest.phone}`} className="text-sm hover:underline">
                    {booking.guest.phone}
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{booking.guest.country}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {nights} night{nights !== 1 ? 's' : ''}
                  </span>
                  <span>{formatCurrency(booking.totalPrice / nights, booking.currency)}/night</span>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(booking.totalPrice, booking.currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div>{formatDate(booking.createdAt, 'PPp')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last Updated</div>
                  <div>{formatDate(booking.updatedAt, 'PPp')}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
