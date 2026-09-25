import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate } from '@/lib/utils';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useCheckInContext, useSubmitGuestCheckIn } from '@/queries/use-checkin';
import { publicCheckinApi } from '@/api/checkin.api';
import {
  MAX_STAY_GUESTS,
  followerTypeOf,
  guestFormPathOf,
  initialStayGuests,
  publicCheckInFormSchema,
  requiresDocument,
  stayGuestDefaults,
  toPublicCheckInSubmitRequest,
  type PublicCheckInFormValues,
  type StayGuestFormValues,
} from './schemas/checkin.schema';
import { StayGuestDocumentFields, StayGuestPersonalFields } from './components/stay-guest-fields';
import type { CodeTableSource } from './components/code-table';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';
import { CheckCircle2, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import type { StayGuestType } from '@/types/public-checkin.types';

type FormPath = FieldPath<PublicCheckInFormValues>;

const COMPLETE_STATUSES = new Set(['Completo', 'AlloggiatiInviato']);
const TOTAL_STEPS = 3;

/** Fields of each guest checked before leaving the first step (personal data). */
const PERSONAL_FIELDS = [
  'type',
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'bornInItaly',
  'birthComuneName',
  'birthProvince',
  'birthCountryName',
  'citizenshipName',
] as const satisfies readonly (keyof StayGuestFormValues)[];

/** Fields of a single guest or head checked before leaving the second step (document). */
const DOCUMENT_FIELDS = [
  'documentType',
  'documentNumber',
  'documentIssuePlaceName',
] as const satisfies readonly (keyof StayGuestFormValues)[];

function personalPaths(guests: readonly StayGuestFormValues[]): FormPath[] {
  return guests.flatMap((_, index) => PERSONAL_FIELDS.map((field) => `guests.${index}.${field}` as FormPath));
}

function documentPaths(guests: readonly StayGuestFormValues[]): FormPath[] {
  return guests.flatMap((guest, index) =>
    requiresDocument(guest.type) ? DOCUMENT_FIELDS.map((field) => `guests.${index}.${field}` as FormPath) : [],
  );
}

/** Server error path → the form path that shows it, or null when the form has no such field. */
function toFormPath(path: string, guestCount: number): FormPath | null {
  if (path === 'marketingConsent') return 'marketingConsent';
  return guestFormPathOf(path, guestCount);
}

function emptyForm(): PublicCheckInFormValues {
  return { guests: [stayGuestDefaults('SingleGuest')], marketingConsent: false };
}

export function CheckInPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const { data: context, isLoading, isError, refetch } = useCheckInContext(token);
  const submitCheckIn = useSubmitGuestCheckIn(token);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<PublicCheckInFormValues>({
    resolver: zodResolver(publicCheckInFormSchema),
    defaultValues: emptyForm(),
  });
  const { control, handleSubmit, setValue, setError, getValues, trigger, reset, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'guests' });

  useEffect(() => {
    if (!context || context.completed) return;
    reset({
      guests: initialStayGuests(context.guests, context.declaredGuests),
      marketingConsent: false,
    });
  }, [context, reset]);

  const codeSource = useMemo<CodeTableSource>(
    () => ({
      scope: `checkin-${token}`,
      availableTables: context?.availableCodeTables ?? [],
      search: (list, query) => publicCheckinApi.searchCodes(token, list, query),
    }),
    [context?.availableCodeTables, token],
  );

  const guests = useWatch({ control, name: 'guests' });
  const marketingConsent = useWatch({ control, name: 'marketingConsent' });

  const changeLeaderType = (type: StayGuestType) => {
    const follower = followerTypeOf(type);
    getValues('guests').forEach((_, index) => {
      if (index > 0) setValue(`guests.${index}.type`, follower, { shouldDirty: true });
    });
  };

  const addGuest = () => append(stayGuestDefaults(followerTypeOf(getValues('guests.0.type'))));

  const stepPaths = (currentStep: number): FormPath[] => {
    const current = getValues('guests');
    if (currentStep === 1) return personalPaths(current);
    if (currentStep === 2) return documentPaths(current);
    return ['marketingConsent'];
  };

  const goNext = async () => {
    if (await trigger(stepPaths(step))) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await submitCheckIn.mutateAsync(toPublicCheckInSubmitRequest(values));
      setSubmitted(true);
    } catch (error) {
      // Already submitted (e.g. from another tab): reload the context, which now shows the completed state.
      if (getHttpStatus(error) === 409) {
        await refetch();
        return;
      }

      const current = getValues('guests');
      const serverErrors = getServerFieldErrorsByPath(error, t('checkin.validation.invalidValue'));
      const invalid = Object.entries(serverErrors)
        .map(([path, message]) => ({ path: toFormPath(path, current.length), message }))
        .filter((entry): entry is { path: FormPath; message: string } => entry.path !== null);
      invalid.forEach(({ path, message }) => setError(path, { type: 'server', message }));

      const firstInvalidStep = [1, 2, 3].find((candidate) => {
        const paths = stepPaths(candidate);
        return invalid.some(({ path }) => paths.includes(path));
      });
      if (firstInvalidStep) {
        setStep(firstInvalidStep);
        setSubmitError(t('checkin.fixHighlightedFields'));
      } else {
        setSubmitError(getProblemMessage(error, t) ?? t('toast.checkInDataSaveFailed'));
      }
    }
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

  if (submitted || context.completed || COMPLETE_STATUSES.has(context.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30" data-testid="checkin-success">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold">
              {submitted ? t('checkin.successTitle') : t('checkin.alreadyCompletedTitle')}
            </h1>
            <p className="text-muted-foreground">
              {submitted ? t('checkin.successDescription') : t('checkin.alreadyCompletedDescription')}
            </p>
            {context.propertyName && <p className="text-sm font-medium">{context.propertyName}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  const declaredGuests = context.declaredGuests ?? 1;
  const leaders = fields
    .map((field, index) => ({ field, index }))
    .filter(({ index }) => guests[index] && requiresDocument(guests[index].type));

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4" data-testid="checkin-page">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t('checkin.guestCheckIn')}</h1>
          <p className="text-muted-foreground">{context.propertyName}</p>
          {context.checkInDate && context.checkOutDate && (
            <p className="text-sm text-muted-foreground">
              {formatDate(context.checkInDate)} – {formatDate(context.checkOutDate)}
            </p>
          )}
        </div>
        <div className="flex justify-center gap-2" data-testid="checkin-progress">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-2 w-16 rounded-full ${n <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && t('checkin.stepGuests')}
              {step === 2 && t('checkin.stepDocument')}
              {step === 3 && t('checkin.stepConsents')}
            </CardTitle>
            <CardDescription>{t('checkin.stepOf', { step, total: TOTAL_STEPS })}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={onSubmit} className="space-y-4" data-testid="guest-data-form">
                {step === 1 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t('checkin.guestsIntro')}</p>
                    {fields.length !== declaredGuests && (
                      <p className="text-sm text-orange-700" data-testid="checkin-guest-count-mismatch">
                        {t('checkin.guestCountMismatch', { count: declaredGuests })}
                      </p>
                    )}
                    {fields.map((field, index) => (
                      <StayGuestPersonalFields
                        key={field.id}
                        index={index}
                        arrivalDate={context.checkInDate}
                        source={codeSource}
                        onLeaderTypeChange={index === 0 ? changeLeaderType : undefined}
                        onRemove={index > 0 ? () => remove(index) : undefined}
                      />
                    ))}
                    {fields.length < MAX_STAY_GUESTS && (
                      <Button type="button" variant="outline" onClick={addGuest} data-testid="checkin-add-guest">
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t('checkin.addGuest')}
                      </Button>
                    )}
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t('checkin.documentIntro')}</p>
                    {leaders.map(({ field, index }) => (
                      <StayGuestDocumentFields key={field.id} index={index} source={codeSource} />
                    ))}
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-4">
                    {/* CO-15 (A5-15): the Alloggiati registration is a legal obligation, not a consent: notice only, no checkbox. */}
                    <section
                      className="rounded-md border p-4 space-y-2 text-sm"
                      aria-labelledby="checkin-privacy-notice-title"
                      data-testid="checkin-privacy-notice"
                    >
                      <h2 id="checkin-privacy-notice-title" className="font-medium">
                        {t('checkin.privacyNotice.title')}
                      </h2>
                      <p>{t('checkin.privacyNotice.legalObligation')}</p>
                      <p className="text-muted-foreground">{t('checkin.privacyNotice.body')}</p>
                      {context.privacyNoticeVersion && (
                        <p className="text-xs text-muted-foreground">
                          {t('checkin.privacyNotice.version', { version: context.privacyNoticeVersion })}
                        </p>
                      )}
                    </section>
                    {context.marketingConsentVersion && (
                      <div className="flex items-start gap-3 rounded-md border p-4" data-testid="checkin-marketing-consent">
                        <Checkbox
                          id="marketingConsent"
                          checked={marketingConsent === true}
                          onCheckedChange={(v) => setValue('marketingConsent', v === true)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="marketingConsent" className="text-sm leading-relaxed cursor-pointer">
                            {t('checkin.marketingConsent')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('checkin.marketingConsentVersion', { version: context.marketingConsentVersion })}
                          </p>
                        </div>
                      </div>
                    )}
                    <FormFieldError id="marketingConsent-error" error={errors.marketingConsent} />
                  </div>
                )}
                {submitError && (
                  <p role="alert" className="text-sm text-destructive" data-testid="checkin-submit-error">
                    {submitError}
                  </p>
                )}
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                    <ChevronLeft className="mr-1 h-4 w-4" />{t('checkin.back')}
                  </Button>
                  {step < TOTAL_STEPS ? (
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
            </FormProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
