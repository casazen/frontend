import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useOrgPublicProperty, usePropertyAvailability } from '@/queries/use-public-org';
import { PropertyCinBadge } from '@/features/properties/components/property-cin-badge';
import { AiContentNotice } from '@/components/shared/ai-content-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import type { PublicOrgDto } from '@/types';
import { ArrowLeft, Bed, Bath, Loader2, Users, AlertCircle } from 'lucide-react';

interface PublicBookingContext {
  org: PublicOrgDto;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function PublicPropertyPage() {
  const { orgSlug, propertyId } = useParams<{ orgSlug: string; propertyId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const navigate = useNavigate();
  const { data: property, isLoading, isError } = useOrgPublicProperty(orgSlug, propertyId);
  const { data: availability } = usePropertyAvailability(propertyId);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const lodgingTotal = property ? property.nightlyRate * nights : 0;
  const estimatedTotal = property ? lodgingTotal + property.cleaningFee : 0;

  const isDateBooked = (dateStr: string): boolean => {
    return availability?.bookedDates.includes(dateStr) ?? false;
  };

  const checkInBooked = checkIn && isDateBooked(checkIn);
  const checkOutBooked = checkOut && isDateBooked(checkOut);
  const dateRangeAvailable = useMemo(() => {
    if (!checkIn || !checkOut || !availability) return true;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    let current = new Date(start);
    while (current < end) {
      if (availability.bookedDates.includes(current.toISOString().split('T')[0])) {
        return false;
      }
      current.setDate(current.getDate() + 1);
    }
    return true;
  }, [checkIn, checkOut, availability]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">Struttura non trovata.</p>
        <Button asChild variant="outline">
          <Link to={`/book/${orgSlug}`}>Torna alle strutture</Link>
        </Button>
      </div>
    );
  }

  const heroPhoto = property.photoUrls[0];

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" className="px-0">
        <Link to={`/book/${orgSlug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna a {org.displayName}
        </Link>
      </Button>

      {heroPhoto ? (
        <img src={heroPhoto} alt={property.name} className="h-72 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-72 items-center justify-center rounded-lg bg-muted text-6xl">🏠</div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{property.name}</h2>
            <p className="text-muted-foreground">
              {property.city}
              {property.postalCode ? ` (${property.postalCode})` : ''}
            </p>
          </div>
          <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
        </div>

        <AiContentNotice visible={false} />

        <p className="text-muted-foreground">{property.description}</p>

        <div className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Bed className="h-4 w-4" /> {property.bedrooms} camere
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-4 w-4" /> {property.bathrooms} bagni
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" /> fino a {property.maxGuests} ospiti
          </span>
        </div>

        {property.amenities.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Servizi</h3>
            <p className="text-sm text-muted-foreground">{property.amenities.join(' · ')}</p>
          </div>
        )}

        {property.houseRules && (
          <div>
            <h3 className="font-semibold mb-2">Regolamento</h3>
            <p className="text-sm whitespace-pre-wrap">{property.houseRules}</p>
          </div>
        )}

        {property.cancellationPolicySummary && (
          <div>
            <h3 className="font-semibold mb-2">Cancellazione</h3>
            <p className="text-sm text-muted-foreground">{property.cancellationPolicySummary}</p>
          </div>
        )}
      </div>

      <section className="rounded-lg border p-6 space-y-4" data-testid="booking-preview">
        <h3 className="text-xl font-semibold">Prenota il soggiorno</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="check-in">Check-in</Label>
            <Input
              id="check-in"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={checkInBooked ? 'border-red-500' : ''}
            />
            {checkInBooked && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Questa data è già prenotata
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-out">Check-out</Label>
            <Input
              id="check-out"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className={checkOutBooked ? 'border-red-500' : ''}
            />
            {checkOutBooked && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Questa data è già prenotata
              </p>
            )}
          </div>
        </div>

        {checkIn && checkOut && !dateRangeAvailable && (
          <div className="rounded-md border border-red-500 bg-red-50 p-3 flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">
              Una o più date nel periodo selezionato sono già prenotate. Scegli date diverse.
            </p>
          </div>
        )}

        {nights > 0 && (
          <div className="space-y-1 text-sm">
            <p>
              {nights} notte{nights !== 1 ? 'i' : ''} × {formatCurrency(property.nightlyRate)} ={' '}
              {formatCurrency(lodgingTotal)}
            </p>
            <p>Pulizia: {formatCurrency(property.cleaningFee)}</p>
            <p className="text-muted-foreground">Tassa di soggiorno: calcolata al checkout</p>
            <p className="text-lg font-semibold pt-2">Totale stimato: {formatCurrency(estimatedTotal)}</p>
          </div>
        )}

        <Button
          className="w-full sm:w-auto"
          disabled={nights <= 0 || !dateRangeAvailable}
          onClick={() =>
            navigate(
              `/book/${orgSlug}/property/${propertyId}/checkout?checkIn=${checkIn}&checkOut=${checkOut}`,
            )
          }
        >
          Procedi al checkout
        </Button>
      </section>
    </div>
  );
}
