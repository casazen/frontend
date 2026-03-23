import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { BookingsList } from './components/bookings-list';
import { CheckInDialog } from './components/check-in-dialog';
import { CheckOutDialog } from './components/check-out-dialog';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import {
  useBookings,
  useDeleteBooking,
  useCheckIn,
  useCheckOut,
} from '@/queries/use-bookings';
import { Plus } from 'lucide-react';
import type { Booking, CheckInDto, CheckOutDto } from '@/types';

export function BookingsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useBookings();
  const deleteBooking = useDeleteBooking();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [bookingToCheckIn, setBookingToCheckIn] = useState<Booking | null>(null);
  const [bookingToCheckOut, setBookingToCheckOut] = useState<Booking | null>(null);

  const handleEdit = (booking: Booking) => {
    navigate(`/bookings/${booking.id}/edit`);
  };

  const handleView = (booking: Booking) => {
    navigate(`/bookings/${booking.id}`);
  };

  const handleDelete = async () => {
    if (bookingToDelete) {
      await deleteBooking.mutateAsync(bookingToDelete.id);
      setBookingToDelete(null);
    }
  };

  const handleCheckIn = async (data: CheckInDto) => {
    if (bookingToCheckIn) {
      await checkIn.mutateAsync({ id: bookingToCheckIn.id, data });
    }
  };

  const handleCheckOut = async (data: CheckOutDto) => {
    if (bookingToCheckOut) {
      await checkOut.mutateAsync({ id: bookingToCheckOut.id, data });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Bookings"
          description="Manage property bookings and reservations"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/bookings/calendar')}>
                Calendar View
              </Button>
              <Button onClick={() => navigate('/bookings/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Booking
              </Button>
            </div>
          }
        />

        <BookingsList
          bookings={data?.data || []}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={setBookingToDelete}
          onView={handleView}
          onCheckIn={setBookingToCheckIn}
          onCheckOut={setBookingToCheckOut}
          onAdd={() => navigate('/bookings/create')}
        />

        <ConfirmationDialog
          open={!!bookingToDelete}
          onOpenChange={(open) => !open && setBookingToDelete(null)}
          title="Delete Booking"
          description={`Are you sure you want to delete this booking for ${bookingToDelete?.guest.firstName} ${bookingToDelete?.guest.lastName}? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={deleteBooking.isPending}
        />

        <CheckInDialog
          booking={bookingToCheckIn}
          open={!!bookingToCheckIn}
          onOpenChange={(open) => !open && setBookingToCheckIn(null)}
          onConfirm={handleCheckIn}
          isLoading={checkIn.isPending}
        />

        <CheckOutDialog
          booking={bookingToCheckOut}
          open={!!bookingToCheckOut}
          onOpenChange={(open) => !open && setBookingToCheckOut(null)}
          onConfirm={handleCheckOut}
          isLoading={checkOut.isPending}
        />
      </div>
    </AppShell>
  );
}
