import { useTranslation } from 'react-i18next';
import { BookingCard } from './booking-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';
import type { Booking } from '@/types';

interface BookingsListProps {
  bookings: Booking[];
  isLoading?: boolean;
  onEdit?: (booking: Booking) => void;
  onDelete?: (booking: Booking) => void;
  onView?: (booking: Booking) => void;
  onCheckIn?: (booking: Booking) => void;
  onCheckOut?: (booking: Booking) => void;
  onAdd?: () => void;
}

export function BookingsList({
  bookings,
  isLoading,
  onEdit,
  onDelete,
  onView,
  onCheckIn,
  onCheckOut,
  onAdd,
}: BookingsListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('booking.list.emptyTitle')}
        description={t('booking.list.emptyDescription')}
        action={onAdd ? { label: t('booking.list.addAction'), onClick: onAdd } : undefined}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
        />
      ))}
    </div>
  );
}
