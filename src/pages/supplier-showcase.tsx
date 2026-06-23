import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Wrench } from 'lucide-react';

interface ShowcaseData {
  slug: string;
  legalName: string;
  categories: string[];
  comuni: string[];
  bio?: string;
  photoUrls: string[];
  availability: { date: string; available: boolean }[];
}

export function SupplierShowcasePage() {
  const { t } = useTranslation();
  const { slug } = useParams();

  const { data, isLoading, error } = useQuery<ShowcaseData>({
    queryKey: ['supplier-showcase', slug],
    queryFn: () => fetch(`/api/public/suppliers/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject(r))),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-medium text-destructive">Supplier not found</p>
            <p className="mt-2 text-sm text-muted-foreground">This supplier page does not exist or is no longer active.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableDays = data.availability?.filter((d) => d.available).length ?? 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{data.legalName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {data.comuni?.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                <MapPin className="h-3 w-3" /> {c}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {data.categories?.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                <Wrench className="h-3 w-3" /> {c}
              </span>
            ))}
          </div>

          {data.bio && <p className="text-sm text-muted-foreground">{data.bio}</p>}

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{availableDays} days available in the next 2 weeks</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('supplier.availabilityTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {(data.availability ?? []).map((d) => (
              <div
                key={d.date}
                className={`rounded p-2 text-center text-xs ${
                  d.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-400'
                }`}
              >
                {d.date.slice(5)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
