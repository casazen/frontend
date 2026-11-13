import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch, type FieldErrors, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { useCheckInContext, useSetCheckInLanguage, useSubmitGuestCheckIn } from '@/queries/use-checkin';
import { publicCheckinApi } from '@/api/checkin.api';
import {
  MAX_STAY_GUESTS,
  createPublicCheckInFormSchema,
  emptyInvoiceStep,
  followerTypeOf,
  guestFormPathOf,
  initialInvoiceStep,
  initialStayGuests,
  officialListIssues,
  requiredStatisticalFields,
  requiresDocument,
  stayGuestDefaults,
  toPublicCheckInSubmitRequest,
  type PublicCheckInFormValues,
  type StatisticalGuestField,
  type StayGuestFormValues,
} from './schemas/checkin.schema';
import { StayGuestDocumentFields, StayGuestPersonalFields } from './components/stay-guest-fields';
import { DocumentReadStep } from './components/document-read-step';
import { InvoiceStep } from './components/invoice-step';
import { LanguageSwitcher } from './components/language-switcher';
import { isListAvailable, type CodeTableSource } from './components/code-table';
import { offeredGuestLocales, resolveGuestLocale, useGuestPageLocale, type GuestLocale } from './lib/guest-locale';
import { guestProblemMessage, translateGuestServerCode } from './lib/guest-errors';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { readInvoiceDataProblems } from '@/lib/invoice-data-schema';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';
import { CheckCircle2, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { INVOICE_DATA_FIELDS } from '@/types/invoice-data.types';
import type { AlloggiatiCodeList, CheckInDocumentReadResult, StayGuestType } from '@/types/public-checkin.types';
import { ConsentStep } from './ConsentStep';
import { IdentityStep } from './identity-step';
import { useIdentityVerification } from './use-identity-verification';

type FormPath = FieldPath<PublicCheckInFormValues>;

const COMPLETE_STATUSES = new Set(['Completo', 'AlloggiatiInviato']);

/**
 * The steps of the page, in order: the photo of the document, the guests, the document, the identity check (E03/F04/US03/T01, only while the API
 * offers it), the invoice (FIS-01, optional) and the consents. The invoice step comes after everything the guests say about themselves and before the
 * privacy notice, which stays the last thing the guest reads before sending. A number is the name of a step, not its place: the place is its position
 * in `stepsOf`.
 */
const STEP_SCAN = 1;
const STEP_GUESTS = 2;
const STEP_DOCUMENT = 3;
const STEP_INVOICE = 4;
const STEP_CONSENTS = 5;
const STEP_IDENTITY = 6;

/**
 * The steps of the page in order. The identity step is there only while the API offers the identity verification (`identityVerification` in the
 * context): with the verification off the page has the steps it has always had.
 */
function stepsOf(identity: boolean): readonly number[] {
  return identity
    ? [STEP_SCAN, STEP_GUESTS, STEP_DOCUMENT, STEP_IDENTITY, STEP_INVOICE, STEP_CONSENTS]
    : [STEP_SCAN, STEP_GUESTS, STEP_DOCUMENT, STEP_INVOICE, STEP_CONSENTS];
}

function scanReasonKey(reason?: string | null): string {
  return reason === 'unavailable' || reason === 'budget' ? 'checkin.scanUnavailable' : 'checkin.scanUnread';
}

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
  'residenceInItaly',
  'residenceComuneName',
  'residenceProvince',
  'residenceCountryName',
] as const satisfies readonly (keyof StayGuestFormValues)[];

/** Fields of a single guest or head checked before leaving the second step (document). */
const DOCUMENT_FIELDS = [
  'documentType',
  'documentNumber',
  'documentIssuePlaceName',
  'documentIssuedOn',
  'documentExpiresOn',
] as const satisfies readonly (keyof StayGuestFormValues)[];

function personalPaths(guests: readonly StayGuestFormValues[], statistical: readonly StatisticalGuestField[]): FormPath[] {
  return guests.flatMap((_, index) =>
    [...PERSONAL_FIELDS, ...statistical].map((field) => `guests.${index}.${field}` as FormPath),
  );
}

function documentPaths(guests: readonly StayGuestFormValues[]): FormPath[] {
  return guests.flatMap((guest, index) =>
    requiresDocument(guest.type) ? DOCUMENT_FIELDS.map((field) => `guests.${index}.${field}` as FormPath) : [],
  );
}

/** The fields of the invoice step checked before leaving it: the answer and the data of a «yes» (nothing of it is checked for a «no» or no answer). */
const INVOICE_PATHS: FormPath[] = ['invoice.answer', ...INVOICE_DATA_FIELDS.map((field) => `invoice.${field}` as const)];

/** Server error path → the form path that shows it, or null when the form has no such field. */
function toFormPath(path: string, guestCount: number): FormPath | null {
  if (path === 'marketingConsentEmail') return 'marketingConsentEmail';
  if (path === 'marketingConsentWhatsApp') return 'marketingConsentWhatsApp';
  if (path === 'marketingEmail') return 'marketingEmail';
  return guestFormPathOf(path, guestCount);
}

/** How many fields are in error, for the announcement that follows a failed attempt (the form keeps the errors in a tree). */
function countFieldErrors(errors: FieldErrors | undefined): number {
  if (!errors) return 0;
  let count = 0;
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object' || ['ref', 'type', 'types', 'root'].includes(key)) continue;
    const entry = value as { message?: unknown } & FieldErrors;
    if (typeof entry.message === 'string' && entry.message) count += 1;
    count += countFieldErrors(entry);
  }
  return count;
}

function emptyForm(): PublicCheckInFormValues {
  return {
    guests: [stayGuestDefaults('SingleGuest')],
    invoice: emptyInvoiceStep(),
    marketingConsentEmail: false,
    marketingConsentWhatsApp: false,
    marketingEmail: '',
  };
}

/** The frame of every state of the page: the language switcher is always at the top, whatever the page shows below it. */
function GuestPageFrame({ switcher, children, testId }: { switcher: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6" data-testid={testId}>
      <div className="mx-auto max-w-2xl space-y-6">
        {switcher}
        {children}
      </div>
    </div>
  );
}

export function CheckInPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const { data: context, isLoading, isError, refetch } = useCheckInContext(token);
  const submitCheckIn = useSubmitGuestCheckIn(token);
  const saveLanguage = useSetCheckInLanguage(token);
  // The identity check (CHK-11): its state lives here, so that going back and forth between the steps keeps where the guest is in it.
  const identity = useIdentityVerification(token, context?.identityVerification);
  const steps = stepsOf(identity.progress !== null);
  const [step, setStep] = useState<number>(STEP_SCAN);
  // An identity step that went away (the verification was switched off while the page was open) leaves the guest at the step that follows it.
  const current = steps.includes(step) ? step : STEP_INVOICE;
  const stepIndex = steps.indexOf(current);
  const totalSteps = steps.length;
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [languageNotSaved, setLanguageNotSaved] = useState(false);
  const [languageNotLoaded, setLanguageNotLoaded] = useState(false);
  const [chosenLocale, setChosenLocale] = useState<GuestLocale | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [readingDocument, setReadingDocument] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [documentsRead, setDocumentsRead] = useState(0);
  const formElement = useRef<HTMLFormElement>(null);

  // The page opens in the language the API resolved (the guest's earlier choice, else the browser's, else Italian) until the guest chooses.
  const locale = chosenLocale ?? resolveGuestLocale(context?.language);
  // The texts of a language that cannot be loaded (the network): the page stays in the language it has and says so.
  const keepLocale = useCallback((stayedIn: GuestLocale) => {
    setChosenLocale(stayedIn);
    setLanguageNotLoaded(true);
  }, []);
  useGuestPageLocale(locale, keepLocale);
  const sessionOpen = Boolean(context) && !context?.completed;

  // The statistical fields are asked only where the region requires them (data minimization): none while the page does not know.
  const statisticalFields = useMemo(() => requiredStatisticalFields(context?.requiredGuestFields), [context?.requiredGuestFields]);
  const schema = useMemo(() => createPublicCheckInFormSchema(statisticalFields), [statisticalFields]);

  const form = useForm<PublicCheckInFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(),
  });
  const { control, handleSubmit, setValue, setError, getValues, trigger, reset } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'guests' });

  // The form starts from what the server has on file (the guests and how many are declared) and is set again only when that changes: a
  // new `context` object with the same data (a refetch, another field of the context) must never wipe what the guest has typed. The invoice
  // step starts with the guest's «yes» when the booking has it (the flags of the context, never the data), and is not part of that key: the
  // flags do not change while the guest fills in the form.
  const startedFrom = useRef<string | null>(null);
  useEffect(() => {
    if (!context || context.completed) return;
    const onFile = JSON.stringify([context.guests ?? null, context.declaredGuests ?? null]);
    if (startedFrom.current === onFile) return;
    startedFrom.current = onFile;
    reset({
      guests: initialStayGuests(context.guests, context.declaredGuests),
      invoice: initialInvoiceStep(context),
      marketingConsentEmail: false,
      marketingConsentWhatsApp: false,
      marketingEmail: '',
    });
  }, [context, reset]);

  // After a failed "Next" or submit the focus goes to the first field in error (NF-11); the fields that are not plain inputs
  // (the official lists) have no reference in the form, so the page looks for the first one marked invalid.
  useEffect(() => {
    if (focusRequest === 0) return;
    formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const codeSource = useMemo<CodeTableSource>(
    () => ({
      scope: `checkin-${token}`,
      availableTables: context?.availableCodeTables ?? [],
      search: (list, query) => publicCheckinApi.searchCodes(token, list, query),
    }),
    [context?.availableCodeTables, token],
  );

  const guests = useWatch({ control, name: 'guests' });

  const chooseLanguage = (next: GuestLocale) => {
    setChosenLocale(next);
    setLanguageNotSaved(false);
    setLanguageNotLoaded(false);
    // Only an open session has a language to save: after the check-in, or with a wrong link, the choice is just for this page.
    if (sessionOpen) saveLanguage.mutate(next, { onError: () => setLanguageNotSaved(true) });
  };

  const changeLeaderType = (type: StayGuestType) => {
    const follower = followerTypeOf(type);
    getValues('guests').forEach((_, index) => {
      if (index > 0) setValue(`guests.${index}.type`, follower, { shouldDirty: true });
    });
  };

  const addGuest = () => append(stayGuestDefaults(followerTypeOf(getValues('guests.0.type'))));

  const stepPaths = (currentStep: number): FormPath[] => {
    const current = getValues('guests');
    if (currentStep === STEP_GUESTS) return personalPaths(current, statisticalFields);
    if (currentStep === STEP_DOCUMENT) return documentPaths(current);
    if (currentStep === STEP_INVOICE) return INVOICE_PATHS;
    if (currentStep === STEP_CONSENTS) return ['marketingConsentEmail', 'marketingConsentWhatsApp', 'marketingEmail'];
    return [];
  };

  // A failed attempt asks for the focus on the first field in error and for the announcement of how many there are.
  const reportProblems = () => setFocusRequest((n) => n + 1);
  const problemCount = countFieldErrors(form.formState.errors);

  const goNext = async () => {
    if (current === STEP_SCAN) {
      setStep(STEP_GUESTS);
      return;
    }
    // The identity check goes on only when it is over: it passed, or a person was asked and has it (the way to a person is always open).
    if (current === STEP_IDENTITY && !identity.concluded) return;
    // The official lists belong to the two steps of the guests; the invoice step has none (and is never in the way of the check-in without a reason).
    const extra =
      current === STEP_GUESTS || current === STEP_DOCUMENT
        ? officialListIssues(getValues('guests'), context?.availableCodeTables ?? []).filter((issue) =>
            current === STEP_GUESTS ? issue.field !== 'documentIssuePlaceName' : issue.field === 'documentIssuePlaceName',
          )
        : [];
    const valid = await trigger(stepPaths(current));
    extra.forEach((issue) => setError(`guests.${issue.index}.${issue.field}`, { type: 'official', message: issue.message }));
    if (valid && extra.length === 0) setStep(steps[Math.min(totalSteps - 1, stepIndex + 1)]);
    else reportProblems();
  };

  const bindOfficial = async (
    index: number,
    list: AlloggiatiCodeList,
    query: string | null | undefined,
    nameField: 'birthComuneName' | 'birthCountryName' | 'citizenshipName' | 'documentIssuePlaceName',
    codeField: 'birthComuneCode' | 'birthCountryCode' | 'citizenshipCode' | 'documentIssuePlaceCode',
  ) => {
    if (!query || !isListAvailable(codeSource, list)) return;
    const entries = await codeSource.search(list, query).catch(() => []);
    const norm = (value: string) => value.trim().toLocaleLowerCase('it');
    const hit = entries.find((entry) => norm(entry.description) === norm(query) || (entry.citizenshipLabel != null && norm(entry.citizenshipLabel) === norm(query)));
    if (!hit) return;
    setValue(`guests.${index}.${nameField}`, hit.description, { shouldDirty: true });
    setValue(`guests.${index}.${codeField}`, hit.code, { shouldDirty: true });
    if (hit.province && nameField === 'birthComuneName') setValue(`guests.${index}.birthProvince`, hit.province, { shouldDirty: true });
  };

  const readDocument = async (file: File) => {
    setReadingDocument(true);
    setScanMessage(null);
    try {
      const result = await publicCheckinApi.readDocument(token, file);
      const guest: CheckInDocumentReadResult['guest'] = result.guest;
      if (!result.read || !guest) {
        setScanMessage(t(scanReasonKey(result.reason)));
        return;
      }
      let index = getValues('guests').findIndex((row) => !row.firstName.trim() && !row.lastName.trim());
      if (index < 0 && getValues('guests').length < MAX_STAY_GUESTS) {
        append(stayGuestDefaults(followerTypeOf(getValues('guests.0.type'))));
        index = getValues('guests').length - 1;
      }
      if (index < 0) {
        setScanMessage(t('checkin.scanUnread'));
        return;
      }
      const write = (field: keyof StayGuestFormValues, value: string | null | undefined) => {
        if (value) setValue(`guests.${index}.${field}`, value, { shouldDirty: true });
      };
      write('firstName', guest.firstName);
      write('lastName', guest.lastName);
      if (guest.gender === 'Male' || guest.gender === 'Female') write('gender', guest.gender);
      write('dateOfBirth', guest.dateOfBirth);
      if (guest.bornInItaly === true) {
        setValue(`guests.${index}.bornInItaly`, 'yes', { shouldDirty: true });
        write('birthComuneName', guest.birthPlace);
        write('birthProvince', guest.birthProvince);
      } else if (guest.bornInItaly === false) {
        setValue(`guests.${index}.bornInItaly`, 'no', { shouldDirty: true });
        write('birthCountryName', guest.birthPlace);
      }
      write('citizenshipName', guest.citizenship);
      if (guest.documentKind === 'Passport' || guest.documentKind === 'IdentityCard' || guest.documentKind === 'DriversLicense') {
        write('documentType', guest.documentKind);
      }
      write('documentNumber', guest.documentNumber);
      write('documentIssuePlaceName', guest.issuePlace);
      if (guest.bornInItaly === true) await bindOfficial(index, 'comuni', guest.birthPlace, 'birthComuneName', 'birthComuneCode');
      if (guest.bornInItaly === false) await bindOfficial(index, 'stati', guest.birthPlace, 'birthCountryName', 'birthCountryCode');
      await bindOfficial(index, 'stati', guest.citizenship, 'citizenshipName', 'citizenshipCode');
      await bindOfficial(index, 'luoghi', guest.issuePlace, 'documentIssuePlaceName', 'documentIssuePlaceCode');
      setDocumentsRead((count) => count + 1);
      const who = `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim();
      setScanMessage(t('checkin.scanReadOk', { name: who || t('checkin.guestHeading', { index: index + 1 }) }));
    } catch (error) {
      setScanMessage(getProblemMessage(error, t) ?? t('checkin.scanUnread'));
    } finally {
      setReadingDocument(false);
    }
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setSubmitError(null);
      try {
        await submitCheckIn.mutateAsync(toPublicCheckInSubmitRequest(values, { statisticalFields }));
        setSubmitted(true);
      } catch (error) {
        // Already submitted (e.g. from another tab): reload the context, which now shows the completed state.
        if (getHttpStatus(error) === 409) {
          await refetch();
          return;
        }

        // The invoice block the server refused (422 `invoice_data_*`, FIS-01): nothing was saved, the check-in included. The guest goes back to the
        // invoice step with the error on each field the server names, in the words of the page, and everything typed is still in the form.
        const invoiceProblems = readInvoiceDataProblems(error);
        if (invoiceProblems.length > 0) {
          invoiceProblems.forEach(({ field, code }) => setError(`invoice.${field}`, { type: 'server', message: code }));
          setStep(STEP_INVOICE);
          setSubmitError(t('checkin.fixHighlightedFields'));
          reportProblems();
          return;
        }

        const current = getValues('guests');
        // The 400 carries the key of each message (`codes`): the page writes it in its own language, and shows the message of the server
        // only for a key it does not know.
        const serverErrors = getServerFieldErrorsByPath(error, t('checkin.validation.invalidValue'), {
          translateCode: (code) => translateGuestServerCode(code, t),
        });
        const invalid = Object.entries(serverErrors)
          .map(([path, message]) => ({ path: toFormPath(path, current.length), message }))
          .filter((entry): entry is { path: FormPath; message: string } => entry.path !== null);
        invalid.forEach(({ path, message }) => setError(path, { type: 'server', message }));

        const firstInvalidStep = [STEP_GUESTS, STEP_DOCUMENT, STEP_CONSENTS].find((candidate) => {
          const paths = stepPaths(candidate);
          return invalid.some(({ path }) => paths.includes(path));
        });
        if (firstInvalidStep) {
          setStep(firstInvalidStep);
          setSubmitError(t('checkin.fixHighlightedFields'));
          reportProblems();
        } else {
          setSubmitError(guestProblemMessage(error, t));
        }
      }
    },
    reportProblems,
  );

  const switcher = (
    <div className="space-y-1">
      <LanguageSwitcher
        value={locale}
        onChange={chooseLanguage}
        locales={offeredGuestLocales(context?.supportedLanguages)}
      />
      {languageNotSaved && (
        <p role="status" className="text-right text-xs text-muted-foreground" data-testid="checkin-language-not-saved">
          {t('checkin.language.notSaved')}
        </p>
      )}
      {languageNotLoaded && (
        <p role="status" className="text-right text-xs text-muted-foreground" data-testid="checkin-language-not-loaded">
          {t('checkin.language.loadFailed')}
        </p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <GuestPageFrame switcher={switcher}>
        <LoadingScreen message={t('checkin.loading')} className="h-64" />
      </GuestPageFrame>
    );
  }

  if (isError || !context) {
    return (
      <GuestPageFrame switcher={switcher}>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('checkin.invalidLink')}</CardTitle>
            <CardDescription>{t('checkin.invalidLinkDescription')}</CardDescription>
          </CardHeader>
        </Card>
      </GuestPageFrame>
    );
  }

  if (submitted || context.completed || COMPLETE_STATUSES.has(context.status)) {
    return (
      <GuestPageFrame switcher={switcher} testId="checkin-success">
        <Card className="mx-auto w-full max-w-md text-center">
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
      </GuestPageFrame>
    );
  }

  const declaredGuests = context.declaredGuests ?? 1;
  const leaders = fields
    .map((field, index) => ({ field, index }))
    .filter(({ index }) => guests[index] && requiresDocument(guests[index].type));

  return (
    <GuestPageFrame switcher={switcher} testId="checkin-page">
      <>
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
          {steps.map((n, index) => (
            <div key={n} className={`h-2 w-16 rounded-full ${index <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              {current === STEP_SCAN && t('checkin.stepScan')}
              {current === STEP_GUESTS && t('checkin.stepGuests')}
              {current === STEP_DOCUMENT && t('checkin.stepDocument')}
              {current === STEP_IDENTITY && t('checkin.stepIdentity')}
              {current === STEP_INVOICE && t('checkin.invoice.title')}
              {current === STEP_CONSENTS && t('checkin.stepConsents')}
            </CardTitle>
            <CardDescription>{t('checkin.stepOf', { step: stepIndex + 1, total: totalSteps })}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormProvider {...form}>
              <form ref={formElement} onSubmit={onSubmit} autoComplete="off" className="space-y-4" data-testid="guest-data-form">
                {/* A new element each time, so a second failed attempt is announced again. */}
                <p key={focusRequest} role="status" className="sr-only" data-testid="checkin-announcement">
                  {focusRequest > 0 && problemCount > 0 ? t('checkin.errors.summary', { count: problemCount }) : null}
                </p>
                {current === STEP_SCAN && (
                  <DocumentReadStep
                    reading={readingDocument}
                    message={scanMessage}
                    readCount={documentsRead}
                    onFile={(file) => { void readDocument(file); }}
                    onManual={() => setStep(STEP_GUESTS)}
                    onContinue={() => setStep(STEP_GUESTS)}
                  />
                )}
                {current === STEP_GUESTS && (
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
                        requiredFields={statisticalFields}
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
                {current === STEP_DOCUMENT && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t('checkin.documentIntro')}</p>
                    {leaders.map(({ field, index }) => (
                      <StayGuestDocumentFields key={field.id} index={index} source={codeSource} />
                    ))}
                  </div>
                )}
                {current === STEP_IDENTITY && <IdentityStep identity={identity} />}
                {current === STEP_INVOICE && <InvoiceStep hasInvoiceData={context.hasInvoiceData === true} />}
                {current === STEP_CONSENTS && (
                  <ConsentStep
                    privacyNoticeVersion={context.privacyNoticeVersion}
                    marketingConsentVersion={context.marketingConsentVersion}
                  />
                )}
                {submitError && (
                  <p role="alert" className="text-sm text-destructive" data-testid="checkin-submit-error">
                    {submitError}
                  </p>
                )}
                {current !== STEP_SCAN && (
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(steps[Math.max(0, stepIndex - 1)])} disabled={identity.busy}>
                    <ChevronLeft className="mr-1 h-4 w-4" />{t('checkin.back')}
                  </Button>
                  {current !== STEP_CONSENTS ? (
                    // Own key: the same DOM button must not turn from "button" to "submit" during the click that moves
                    // to the last step, or the browser submits the form and the privacy notice is never shown.
                    <Button
                      key="checkin-next"
                      type="button"
                      onClick={goNext}
                      disabled={current === STEP_IDENTITY && (!identity.concluded || identity.busy)}
                      data-testid="checkin-next"
                    >
                      {t('checkin.next')}<ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button key="checkin-submit" type="submit" disabled={submitCheckIn.isPending} data-testid="checkin-submit">
                      {submitCheckIn.isPending ? t('checkin.saving') : t('checkin.submit')}
                    </Button>
                  )}
                </div>
                )}
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </>
    </GuestPageFrame>
  );
}
