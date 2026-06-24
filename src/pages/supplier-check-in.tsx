import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { MapPin, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface CheckInData {
  jobId: string;
  propertyAddress: string;
  description: string;
  status: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkedInAt?: string;
  checkedOutAt?: string;
}

export function SupplierCheckInPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const loc = searchParams.get('loc') ?? '';

  const [data, setData] = useState<CheckInData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!jobId || !token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    fetch(`/api/public/check-in/${jobId}?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: CheckInData) => setData(d))
      .catch(() => setError('Check-in link is invalid or expired'))
      .finally(() => setLoading(false));
  }, [jobId, token]);

  const requestGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // GPS denied — proceed without
    );
  };

  useEffect(() => {
    requestGps();
  }, []);

  const doCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/check-in/${jobId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, gpsLatitude: gps?.lat, gpsLongitude: gps?.lng }),
      });
      if (!res.ok) throw res;
      const updated = await fetch(`/api/public/check-in/${jobId}?token=${encodeURIComponent(token)}`);
      setData(await updated.json());
    } catch {
      setError('Check-in failed. Make sure you are at the property.');
    } finally {
      setActionLoading(false);
    }
  };

  const doCheckOut = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/check-in/${jobId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw res;
      const updated = await fetch(`/api/public/check-in/${jobId}?token=${encodeURIComponent(token)}`);
      setData(await updated.json());
    } catch {
      setError('Check-out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6">
            <p className="text-lg font-medium text-destructive">{error ?? 'Not found'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('checkin.invalidLinkDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-green-50 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium">{loc || data.propertyAddress}</p>
              <p className="text-sm text-muted-foreground">{data.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {new Date(data.scheduledStartUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {new Date(data.scheduledEndUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {data.checkedInAt && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              Check-in: {new Date(data.checkedInAt).toLocaleTimeString()}
            </div>
          )}

          {data.checkedOutAt && (
            <div className="rounded-md bg-green-100 px-3 py-2 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t('checkin.checkInComplete')}
            </div>
          )}

          {data.canCheckIn && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => void doCheckIn()}
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner /> : <><MapPin className="mr-2 h-4 w-4" /> Check-In</>}
            </Button>
          )}

          {data.canCheckOut && (
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => void doCheckOut()}
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner /> : <><ArrowRight className="mr-2 h-4 w-4" /> Check-Out</>}
            </Button>
          )}

          {!data.canCheckIn && !data.canCheckOut && data.status === 'Completed' && (
            <p className="text-center text-sm font-medium text-green-600">
              <CheckCircle2 className="inline mr-1 h-4 w-4" />
              {t('checkin.checkInComplete')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
