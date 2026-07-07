import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate } from '@/lib/utils';
import { useCheckInContext, useSubmitGuestCheckIn } from '@/queries/use-checkin';
import { publicCheckInFormSchema, type PublicCheckInFormValues } from './schemas/checkin.schema';
import { getDocumentTypeLabel } from '@/lib/i18n-labels';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicCheckInGuestPrefill } from '@/types/public-checkin.types';

const DOCUMENT_TYPES = ['Passport', 'IdentityCard', 'DriversLicense', 'Other'] as const;
const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const COMPLETE_STATUSES = new Set(['Completo', 'AlloggiatiInviato']);

function defaultValues(prefill?: PublicCheckInGuestPrefill | null): PublicCheckInFormValues {
  return {
    firstName: prefill?.firstName ?? '',
    lastName: prefill?.lastName ?? '',
    dateOfBirth: prefill?.dateOfBirth?.slice(0, 10) ?? '',
    placeOfBirth: prefill?.placeOfBirth ?? '',
    nationality: prefill?.nationality ?? '',
    documentType: 'Passport',
    documentNumber: prefill?.documentNumber ?? '',
    documentIssuingCountry: prefill?.documentIssuingCountry ?? '',
    gdprConsent: false,
    marketingConsent: false,
  };
}

export function CheckInPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const { data: context, isLoading, isError } = useCheckInContext(token);
  const submitCheckIn = useSubmitGuestCheckIn(token);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<PublicCheckInFormValues>({
    resolver: zodResolver(publicCheckInFormSchema),
    defaultValues: defaultValues(),
  });

  const { register, handleSubmit, setValue, watch, trigger, reset } = form;

  useEffect(() => {
    if (context?.guestPrefill) reset(defaultValues(context.guestPrefill));
  }, [context?.sessionId, context?.guestPrefill, reset]);

  const gdprConsent = watch('gdprConsent');
  const marketingConsent = watch('marketingConsent');

  const goNext = async () => {
    const fieldsByStep: (keyof PublicCheckInFormValues)[][] = [
      ['firstName', 'lastName', 'dateOfBirth', 'placeOfBirth', 'nationality'],
      ['documentType', 'documentNumber', 'documentIssuingCountry'],
      ['gdprConsent'],
    ];
    if (await trigger(fieldsByStep[step - 1])) setStep((s) => Math.min(3, s + 1));
  };

  const onSubmit = handleSubmit(async (values) => {
    await submitCheckIn.mutateAsync({ ...values, marketingConsent: values.marketingConsent ?? false });
    setSubmitted(true);
  });

  if (isLoading) return <LoadingScreen message={t('checkin.loading')} />;

  if (isError || !context) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t('checkin.invalidLink')}</CardTitle>
            <CardDescription>{t('checkin.invalidLinkDescription')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (COMPLETE_STATUSES.has(context.status) || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30" data-testid="checkin-success">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold">{t('checkin.successTitle')}</h1>
            <p className="text-muted-foreground">{t('checkin.successDescription')}</p>
            <p className="text-sm font-medium">{context.propertyName}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4" data-testid="checkin-page">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t('checkin.guestCheckIn')}</h1>
          <p className="text-muted-foreground">{context.propertyName}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(context.checkInDate)} – {formatDate(context.checkOutDate)}
          </p>
        </div>
        <div className="flex justify-center gap-2" data-testid="checkin-progress">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-2 w-16 rounded-full ${n <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && t('checkin.stepPersonal')}
              {step === 2 && t('checkin.stepDocument')}
              {step === 3 && t('checkin.stepConsents')}
            </CardTitle>
            <CardDescription>{t('checkin.stepOf', { step, total: 3 })}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" data-testid="guest-data-form">
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t('checkin.firstName')}</Label>
                    <Input id="firstName" {...register('firstName')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t('checkin.lastName')}</Label>
                    <Input id="lastName" {...register('lastName')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">{t('checkin.birthDate')}</Label>
                    <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="placeOfBirth">{t('checkin.birthPlace')}</Label>
                    <Input id="placeOfBirth" {...register('placeOfBirth')} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="nationality">{t('checkin.nationality')}</Label>
                    <Input id="nationality" {...register('nationality')} />
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="documentType">{t('checkin.documentTypeLabel')}</Label>
                    <select id="documentType" {...register('documentType')} className={selectClassName}>
                      {DOCUMENT_TYPES.map((value) => (
                        <option key={value} value={value}>{getDocumentTypeLabel(value, t)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="documentNumber">{t('checkin.documentNumber')}</Label>
                    <Input id="documentNumber" {...register('documentNumber')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="documentIssuingCountry">{t('checkin.documentIssuingCountry')}</Label>
                    <Input id="documentIssuingCountry" {...register('documentIssuingCountry')} />
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-md border p-4" data-testid="checkin-gdpr-consent">
                    <Checkbox
                      id="gdprConsent"
                      checked={gdprConsent === true}
                      onCheckedChange={(v) => setValue('gdprConsent', v === true, { shouldValidate: true })}
                    />
                    <Label htmlFor="gdprConsent" className="text-sm leading-relaxed cursor-pointer">
                      {t('checkin.gdprConsent')}
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border p-4">
                    <Checkbox
                      id="marketingConsent"
                      checked={marketingConsent === true}
                      onCheckedChange={(v) => setValue('marketingConsent', v === true)}
                    />
                    <Label htmlFor="marketingConsent" className="text-sm leading-relaxed cursor-pointer">
                      {t('checkin.marketingConsent')}
                    </Label>
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                  <ChevronLeft className="mr-1 h-4 w-4" />{t('checkin.back')}
                </Button>
                {step < 3 ? (
                  <Button type="button" onClick={goNext}>
                    {t('checkin.next')}<ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={submitCheckIn.isPending} data-testid="checkin-submit">
                    {submitCheckIn.isPending ? t('checkin.saving') : t('checkin.submit')}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
