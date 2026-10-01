import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMe } from '@/queries/use-users';
import { getRentalTypeLabel } from '@/lib/i18n-labels';

export function OperatorTypeSection() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useMe();
  const { pathname } = useLocation();

  const label = profile?.rentalType
    ? getRentalTypeLabel(profile.rentalType, t)
    : t('profile.notConfigured');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('profile.operatorType')}</CardTitle>
        {/* "Annulla" of the edit wizard comes back to this profile page. */}
        <Button variant="outline" size="sm" asChild>
          <Link to="/onboarding?mode=edit" state={{ from: pathname }}>{t('profile.editType')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t('profile.currentType')}</p>
        <p className="font-medium">{isLoading ? t('profile.loading') : label}</p>
      </CardContent>
    </Card>
  );
}
