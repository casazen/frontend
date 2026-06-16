import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { publicBookingApi } from '@/api/public-booking.api';
import type { GuestBookingItem } from '@/types';
import { toast } from 'sonner';

const lookupSchema = z.object({
  email: z.string().email('Email non valido'),
});

type LookupForm = z.infer<typeof lookupSchema>;

export function GuestBookingsPage() {
  const [bookings, setBookings] = useState<GuestBookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LookupForm>({
    resolver: zodResolver(lookupSchema),
  });

  const onSubmit = async (data: LookupForm) => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await publicBookingApi.lookupGuestBookings(data.email);
      setBookings(response.bookings);
      if (response.bookings.length === 0) {
        toast.info('Nessuna prenotazione trovata per questo indirizzo email');
      }
    } catch (error) {
      toast.error('Errore nella ricerca. Riprova più tardi.');
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Confermata</span>;
      case 'Pending':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium"><Clock className="h-4 w-4" /> In sospeso</span>;
      case 'CheckedIn':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">Check-in</span>;
      case 'CheckedOut':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">Completata</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">Annullata</span>;
      default:
        return <span className="text-sm text-muted-foreground">{status}</span>;
    }
  };

  const getPaymentBadge = (paymentOption: string) => {
    switch (paymentOption) {
      case 'Immediate':
        return <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Pagato online</span>;
      case 'OnCancellationDeadline':
        return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Pagamento al deadline</span>;
      case 'OnSite':
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Pagamento in struttura</span>;
      default:
        return null;
    }
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('it-IT', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const daysUntilDeadline = (deadline: string | Date) => {
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const today = new Date();
    const diff = d.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-3xl font-bold">Le mie prenotazioni</h2>
        <p className="text-muted-foreground">
          Inserisci il tuo indirizzo email per visualizzare le tue prenotazioni
        </p>
      </section>

      <div className="max-w-md space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input
              placeholder="nome@esempio.com"
              type="email"
              disabled={isLoading}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cerca
          </Button>
        </form>
      </div>

      {hasSearched && !isLoading && bookings.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Nessuna prenotazione trovata</p>
            <p className="text-sm text-amber-800">Non abbiamo trovato prenotazioni per questo indirizzo email.</p>
          </div>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Trovate {bookings.length} prenotazione{bookings.length !== 1 ? 'i' : ''}
          </p>
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.bookingId} className="border rounded-lg p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{booking.propertyName}</h3>
                    <p className="text-sm text-muted-foreground">{booking.propertyCity}</p>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(booking.status)}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Check-in</p>
                    <p className="text-sm font-medium">{formatDate(booking.checkInDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Check-out</p>
                    <p className="text-sm font-medium">{formatDate(booking.checkOutDate)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Metodo di pagamento</p>
                    {getPaymentBadge(booking.paymentOption)}
                  </div>

                  {booking.paymentOption === 'OnCancellationDeadline' && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm font-medium text-orange-900">
                        Cancellazione gratuita fino al {formatDate(booking.freeRefundDeadline)}
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        ({daysUntilDeadline(booking.freeRefundDeadline)} giorni rimanenti)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
