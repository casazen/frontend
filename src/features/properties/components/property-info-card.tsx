import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed, Bath, Users, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PropertyInfoCardProps {
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  cleaningFee: number;
  damageDeposit: number;
  timezone: string;
}

export function PropertyInfoCard({
  bedrooms,
  bathrooms,
  maxGuests,
  nightlyRate,
  cleaningFee,
  damageDeposit,
  timezone,
}: PropertyInfoCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('property.info.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">{t('property.info.bedrooms')}</span>
          </div>
          <span className="font-semibold">{bedrooms}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">{t('property.info.bathrooms')}</span>
          </div>
          <span className="font-semibold">{bathrooms}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">{t('property.info.maxGuests')}</span>
          </div>
          <span className="font-semibold">{maxGuests}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">{t('property.info.timezone')}</span>
          </div>
          <span className="font-semibold text-sm">{timezone}</span>
        </div>
        <div className="border-t pt-4 space-y-2">
          <div>
            <div className="text-sm text-muted-foreground">{t('property.info.nightlyRate')}</div>
            <div className="text-2xl font-bold">{formatCurrency(nightlyRate)}</div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('property.info.cleaning')}</span>
            <span>{formatCurrency(cleaningFee)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('property.info.deposit')}</span>
            <span>{formatCurrency(damageDeposit)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
