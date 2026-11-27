import type { RefObject } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { useGuestTouristTax } from '@/queries/use-checkin';
import type { PublicCheckInContextDto, PublicTouristTax } from '@/types/public-checkin.types';
import { guestTaxOutlook, isShownOnCompletedCheckIn } from '../lib/tourist-tax-model';
import { TouristTaxStep } from '../tourist-tax-step';

export function CheckInReceipt({ submitted, receiptHeading, context, next, taxView, taxRead, token }: {
  submitted: boolean;
  receiptHeading: RefObject<HTMLHeadingElement | null>;
  context: PublicCheckInContextDto;
  next?: { href: string; label: string };
  taxView: PublicTouristTax | null;
  taxRead: ReturnType<typeof useGuestTouristTax>;
  token: string;
}) {
  const { t } = useTranslation();
  const taxStillToSay = taxView !== null && isShownOnCompletedCheckIn(guestTaxOutlook(taxView));
  const taxToPay = taxView !== null && guestTaxOutlook(taxView) === 'payable';
  return (
    <>
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <CheckCircle2 aria-hidden="true" className="h-16 w-16 text-green-600 mx-auto" />
          <h1 ref={receiptHeading} tabIndex={-1} className="text-2xl font-bold outline-none">
            {submitted ? t('checkin.successTitle') : t('checkin.alreadyCompletedTitle')}
          </h1>
          <p className="text-muted-foreground">
            {submitted ? t('checkin.successDescription') : t('checkin.alreadyCompletedDescription')}
          </p>
          {context.propertyName && <p className="text-sm font-medium">{context.propertyName}</p>}
          {next && (
            <Button asChild variant={taxToPay ? 'outline' : 'default'} className="w-full sm:w-auto">
              <Link to={next.href} data-testid="checkin-success-next">{next.label}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
      {taxStillToSay && (
        <Card className="mx-auto w-full max-w-md" data-testid="checkin-completed-tourist-tax">
          <CardHeader>
            <CardTitle>{t('checkin.touristTax.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TouristTaxStep token={token} view={taxView} refetch={taxRead.refetch} fetching={taxRead.isFetching} completed />
          </CardContent>
        </Card>
      )}
    </>
  );
}
