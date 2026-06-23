import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMe } from '@/queries/use-users';
import { RENTAL_TYPE_LABELS } from '@/lib/onboarding';
import type { RentalType } from '@/types';

export function OperatorTypeSection() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useMe();

  const label = profile?.rentalType
    ? RENTAL_TYPE_LABELS[profile.rentalType as RentalType]
    : t('profile.notConfigured');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('profile.operatorType')}</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link to="/onboarding?mode=edit">{t('profile.editType')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t('profile.currentType')}</p>
        <p className="font-medium">{isLoading ? t('profile.loading') : label}</p>
      </CardContent>
    </Card>
  );
}
