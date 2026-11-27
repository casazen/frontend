import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { publicCheckinApi } from '@/api/checkin.api';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { getDocumentTypeLabel } from '@/lib/i18n-labels';
import { prepareDocumentPhoto } from '@/lib/image-capture';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';
import { useCheckInContext, useGuestTouristTax, useSetCheckInLanguage, useSubmitGuestCheckIn } from '@/queries/use-checkin';
import type { AlloggiatiCodeList, CheckInDocumentReadResult, StayGuestType } from '@/types/public-checkin.types';
import { isListAvailable, type CodeTableSource } from './components/code-table';
import { countFieldErrors, documentPaths, emptyForm, firstStepWithProblems, personalPaths, toFormPath, type FormPath } from './lib/checkin-form-paths';
import { STEP_CONSENTS, STEP_DOCUMENT, STEP_GUESTS, STEP_IDENTITY, STEP_SCAN, STEP_TAX, stepAfterGone, stepsOf } from './lib/checkin-steps';
import { IDENTITY_STEP_PARAM } from './lib/door-model';
import { buildPrefill, withConfirmedValues, type DocumentPrefill, type PrefillValues } from './lib/document-prefill';
import { guestProblemMessage, translateGuestServerCode } from './lib/guest-errors';
import { offeredGuestLocales, resolveGuestLocale, useGuestPageLocale, type GuestLocale } from './lib/guest-locale';
import { blocksNextStep, guestTaxAvailability, withoutPaymentReturn } from './lib/tourist-tax-model';
import {
  createPublicCheckInFormSchema,
  documentLevelsOf,
  followerTypeOf,
  initialStayGuests,
  officialListIssues,
  requiredStatisticalFields,
  stayGuestDefaults,
  swissRulesOf,
  toPublicCheckInSubmitRequest,
  type PublicCheckInFormValues,
  type StayGuestFormValues,
} from './schemas/checkin.schema';
import { useIdentityVerification } from './use-identity-verification';

const COMPLETE_STATUSES = new Set(['Completo', 'AlloggiatiInviato']);

function scanReasonKey(reason?: string | null): string {
  if (reason === 'not_document') return 'checkin.scanNotDocument';
  return reason === 'unavailable' || reason === 'budget' ? 'checkin.scanUnavailable' : 'checkin.scanUnread';
}

/**
 * The state of the guest check-in (the link, the steps, the form, the reading of the document, the tourist tax, the identity check, the consents and the send), moved out of the page as it was: the same hooks in the
 * same order. The translation function is the one of the page, so that no hook is added.
 */
export function useGuestCheckInFlow({ token, embedded, onCompleted, t }: { token: string; embedded: boolean; onCompleted?: () => void; t: TFunction }) {
  const { data: context, isLoading, isFetching, error: contextError, refetch } = useCheckInContext(token);
  const submitCheckIn = useSubmitGuestCheckIn(token);
  const saveLanguage = useSetCheckInLanguage(token);
  // The identity check (CHK-11): its state lives here, so that going back and forth between the steps keeps where the guest is in it.
  const identity = useIdentityVerification(token, context?.identityVerification);
  const [searchParams, setSearchParams] = useSearchParams();
  const { flags } = useFeatureFlags();
  const taxOffered = isFeatureEnabled(flags, 'touristTaxOnlinePayment');
  const taxRead = useGuestTouristTax(token, taxOffered && Boolean(context));
  const taxAvailability = guestTaxAvailability({
    enabled: taxOffered,
    isPending: taxRead.isPending,
    isError: taxRead.isError,
    error: taxRead.error,
    hasData: taxRead.data !== undefined,
  });
  const taxView = taxAvailability === 'ready' ? (taxRead.data ?? null) : null;
  const steps = stepsOf(identity.progress !== null, taxAvailability === 'ready' || taxAvailability === 'failed');
  const [resumed] = useState(() => searchParams.get('resume') === 'guests');
  const [step, setStep] = useState<number | null>(null);
  const doorIdentity = searchParams.get('step') === IDENTITY_STEP_PARAM && steps.includes(STEP_IDENTITY);
  const startStep = doorIdentity ? STEP_IDENTITY : resumed ? STEP_GUESTS : STEP_SCAN;
  const wantedStep = step ?? startStep;
  const current = steps.includes(wantedStep) ? wantedStep : stepAfterGone(wantedStep, steps);
  const [taxCannotPay, setTaxCannotPay] = useState(false);
  const taxBlocksNext = current === STEP_TAX && taxView !== null && blocksNextStep(taxView) && !taxCannotPay;
  const [taxPaying, setTaxPaying] = useState(false);
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
  const verifyingPhoto = useRef<File | null>(null);
  const [review, setReview] = useState<{ result: CheckInDocumentReadResult; file: File } | null>(null);
  // The values the local reading gave (self-hosted flow, E71/F02/US01/T02), for the guest to check before they go into the form. Personal data: in memory only, never in a storage, an address or a log,
  // and gone as soon as the guest confirms them, drops them or leaves the step.
  const [zonedReading, setZonedReading] = useState<{ prefill: DocumentPrefill; result: CheckInDocumentReadResult; file: File } | null>(null);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [acceptedRulesVersion, setAcceptedRulesVersion] = useState<string | undefined>();
  const activeRulesVersion = context?.houseRulesVersion ?? undefined;
  const rulesAccepted = !activeRulesVersion || activeRulesVersion === acceptedRulesVersion;
  const consentsGiven = privacyRead && rulesAccepted;
  useEffect(() => {
    if (!identity.progress || identity.concluded || submitted) verifyingPhoto.current = null;
  }, [identity.progress, identity.concluded, submitted]);
  const takeVerifyingPhoto = useCallback(() => {
    const photo = verifyingPhoto.current;
    verifyingPhoto.current = null;
    return photo;
  }, []);
  const formElement = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    stepHeading.current?.focus();
  }, [current]);

  function goToStep(nextStep: number) {
    focusHeading.current = true;
    setStep(nextStep);
    if (current === STEP_SCAN || nextStep === STEP_SCAN) {
      const next = new URLSearchParams(searchParams);
      if (nextStep === STEP_SCAN) next.delete('resume');
      else next.set('resume', 'guests');
      next.delete('step');
      setSearchParams(next, { replace: true });
    }
  }

  const moveFromScan = () => {
    setReview(null);
    setZonedReading(null);
    goToStep(STEP_GUESTS);
  };

  const portalLanguage = embedded ? offeredGuestLocales(context?.supportedLanguages).find((language) => language === searchParams.get('lang')) : undefined;
  const locale = chosenLocale ?? portalLanguage ?? resolveGuestLocale(context?.language);
  const keepLocale = useCallback((stayedIn: GuestLocale) => {
    setChosenLocale(stayedIn);
    setLanguageNotLoaded(true);
  }, []);
  useGuestPageLocale(locale, keepLocale);
  const status = getHttpStatus(contextError);
  const invalidLink = !token || status === 404 || status === 410 || context?.status === 'Scaduto';
  const completed = submitted || context?.completed || (context && COMPLETE_STATUSES.has(context.status));
  const sessionOpen = context && !invalidLink && !completed;
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (completed) receiptHeading.current?.focus();
  }, [completed]);

  const statisticalFields = useMemo(() => requiredStatisticalFields(context?.requiredGuestFields), [context?.requiredGuestFields]);
  const swiss = useMemo(() => swissRulesOf(context?.requiredGuestFields, context?.checkInDate), [context?.requiredGuestFields, context?.checkInDate]);
  const askVehiclePlate = context?.askVehiclePlate === true;
  const schema = useMemo(() => createPublicCheckInFormSchema(statisticalFields, swiss), [statisticalFields, swiss]);

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
      marketingConsentEmail: false,
      marketingConsentWhatsApp: false,
      marketingEmail: '',
    });
  }, [context, reset]);

  useEffect(() => {
    if (focusRequest === 0) return;
    formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  // A payment method that redirects sends the guest back to this page with the secret of the intent in the address (E25/F01/US02/T01): the address is replaced by the one without
  // it, so the secret stays neither in the address bar nor in the history. What the payment did is read from the server, never from these words.
  useEffect(() => {
    const cleaned = withoutPaymentReturn(searchParams);
    if (cleaned) setSearchParams(cleaned, { replace: true });
  }, [searchParams, setSearchParams]);

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
    if (currentStep === STEP_GUESTS) return [...personalPaths(current, statisticalFields), ...(askVehiclePlate ? (['vehiclePlate'] as const) : [])];
    if (currentStep === STEP_DOCUMENT) return documentPaths(documentLevelsOf(current, swiss));
    if (currentStep === STEP_CONSENTS) return ['marketingConsentEmail', 'marketingConsentWhatsApp', 'marketingEmail'];
    return [];
  };

  const reportProblems = () => setFocusRequest((n) => n + 1);
  const problemCount = countFieldErrors(form.formState.errors);

  const goNext = async () => {
    if (current === STEP_SCAN) {
      moveFromScan();
      return;
    }
    if (current === STEP_IDENTITY && !identity.concluded) return;
    if (taxBlocksNext || taxPaying) return;
    const extra =
      current === STEP_GUESTS || current === STEP_DOCUMENT
        ? officialListIssues(getValues('guests'), context?.availableCodeTables ?? []).filter((issue) =>
            current === STEP_GUESTS ? issue.field !== 'documentIssuePlaceName' : issue.field === 'documentIssuePlaceName',
          )
        : [];
    const valid = await trigger(stepPaths(current));
    extra.forEach((issue) => setError(`guests.${issue.index}.${issue.field}`, { type: 'official', message: issue.message }));
    if (valid && extra.length === 0) goToStep(steps[Math.min(totalSteps - 1, stepIndex + 1)]);
    else reportProblems();
  };

  const bindOfficial = async (
    index: number,
    list: AlloggiatiCodeList,
    query: string | null | undefined,
    nameField: 'documentTypeLabel' | 'birthComuneName' | 'birthCountryName' | 'citizenshipName' | 'documentIssuePlaceName' | 'residenceComuneName' | 'residenceCountryName',
    codeField: 'documentTypeCode' | 'birthComuneCode' | 'birthCountryCode' | 'citizenshipCode' | 'documentIssuePlaceCode' | 'residenceComuneCode' | 'residenceCountryCode',
    province?: string | null,
  ) => {
    if (query) setValue(`guests.${index}.${codeField}`, '', { shouldDirty: true });
    if (!query || !isListAvailable(codeSource, list)) return;
    const entries = await codeSource.search(list, query).catch(() => []);
    const norm = (value: string) => value.trim().toLocaleLowerCase('it');
    const matches = entries.filter((entry) =>
      (!province || norm(entry.province ?? '') === norm(province)) &&
      [entry.code, entry.description, entry.citizenshipLabel].some((value) => value && norm(value) === norm(query)));
    if (matches.length !== 1) return;
    const [hit] = matches;
    setValue(`guests.${index}.${nameField}`, hit.description, { shouldDirty: true });
    setValue(`guests.${index}.${codeField}`, hit.code, { shouldDirty: true });
    if (nameField === 'documentTypeLabel') setValue(`guests.${index}.documentType`, '', { shouldDirty: true });
    if (hit.province && nameField === 'residenceComuneName') setValue(`guests.${index}.residenceProvince`, hit.province, { shouldDirty: true });
    if (hit.province && nameField === 'birthComuneName') setValue(`guests.${index}.birthProvince`, hit.province, { shouldDirty: true });
  };

  const applyDocument = async (result: CheckInDocumentReadResult, file: File) => {
    const index = result.guestPosition;
    const guest = result.guest;
    if (!guest || index == null || !getValues('guests')[index]) {
      setScanMessage(t('checkin.scanMismatch'));
      return;
    }
    const booked = context?.guests?.[index];
    if (!booked) return;
    if (context?.identityVerification?.verifyingGuestPosition === index && result.side !== 'back') {
      if (result.side || !verifyingPhoto.current) verifyingPhoto.current = file;
    }
    const write = (field: keyof StayGuestFormValues, value: string | null | undefined) => {
      if (value) setValue(`guests.${index}.${field}`, value, { shouldDirty: true });
    };
    write('firstName', booked.firstName);
    write('lastName', booked.lastName);
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
    write('residenceStreet', guest.residenceStreet);
    write('residencePostalCode', guest.residencePostalCode);
    write('residenceCityName', guest.residenceCityName);
    write('residenceCountryName', guest.residenceCountryName);
    if (guest.residenceInItaly != null) {
      write('residenceInItaly', guest.residenceInItaly ? 'yes' : 'no');
      if (guest.residenceInItaly) {
        write('residenceComuneName', guest.residenceCityName);
        write('residenceProvince', guest.residenceProvince);
      }
    }
    let officialKind: string | undefined;
    if (guest.documentKind === 'Passport' || guest.documentKind === 'IdentityCard' || guest.documentKind === 'DriversLicense') {
      if (isListAvailable(codeSource, 'documenti')) {
        officialKind = { Passport: 'PASOR', IdentityCard: 'IDENT', DriversLicense: 'PATEN' }[guest.documentKind];
        write('documentType', guest.documentKind);
        write('documentTypeLabel', getDocumentTypeLabel(guest.documentKind, t));
      } else {
        write('documentType', guest.documentKind);
      }
    }
    write('documentNumber', guest.documentNumber);
    write('documentIssuedOn', guest.documentIssuedOn);
    write('documentExpiresOn', guest.documentExpiresOn);
    write('documentIssuePlaceName', guest.issuePlace);
    await Promise.all([
      bindOfficial(index, 'documenti', officialKind, 'documentTypeLabel', 'documentTypeCode'),
      guest.bornInItaly === true && bindOfficial(index, 'comuni', guest.birthPlace, 'birthComuneName', 'birthComuneCode', guest.birthProvince),
      guest.residenceInItaly === true && bindOfficial(index, 'comuni', guest.residenceCityName, 'residenceComuneName', 'residenceComuneCode', guest.residenceProvince),
      bindOfficial(index, 'stati', guest.residenceCountryName, 'residenceCountryName', 'residenceCountryCode'),
      guest.bornInItaly === false && bindOfficial(index, 'stati', guest.birthPlace, 'birthCountryName', 'birthCountryCode'),
      bindOfficial(index, 'stati', guest.citizenship, 'citizenshipName', 'citizenshipCode'),
      bindOfficial(index, 'luoghi', guest.issuePlace, 'documentIssuePlaceName', 'documentIssuePlaceCode'),
    ]);
    setDocumentsRead((count) => count + 1);
    setScanMessage(t('checkin.scanReadOk', { name: [booked.firstName, booked.lastName].join(' ') }));
  };

  const formHolds = (index: number, name: string): boolean => {
    const guest = getValues('guests')[index];
    if (!guest) return false;
    const held = (value: unknown) => typeof value === 'string' && value.trim() !== '';
    switch (name) {
      case 'lastName':
        return held(guest.lastName);
      case 'firstName':
        return held(guest.firstName);
      case 'gender':
        return held(guest.gender);
      case 'dateOfBirth':
        return held(guest.dateOfBirth);
      case 'birthPlace':
        return held(guest.birthComuneName) || held(guest.birthCountryName);
      case 'citizenship':
        return held(guest.citizenshipName);
      case 'documentKind':
        return held(guest.documentType);
      case 'documentNumber':
        return held(guest.documentNumber);
      case 'issuePlace':
        return held(guest.documentIssuePlaceName);
      default:
        return false;
    }
  };

  const proceedWithReading = async (result: CheckInDocumentReadResult, file: File) => {
    const index = result.guestPosition;
    const prefill = index == null ? null : buildPrefill(result, (name) => formHolds(index, name));
    if (prefill) setZonedReading({ prefill, result, file });
    else await applyDocument(result, file);
  };

  const confirmPrefill = async (values: PrefillValues) => {
    if (!zonedReading) return;
    const { result, file } = zonedReading;
    setZonedReading(null);
    setReadingDocument(true);
    try {
      await applyDocument(withConfirmedValues(result, values), file);
    } finally {
      setReadingDocument(false);
    }
  };

  const readDocument = async (file: File) => {
    setReadingDocument(true);
    setScanMessage(null);
    setReview(null);
    setZonedReading(null);
    try {
      const prepared = await prepareDocumentPhoto(file, { withSelfie: true });
      if (!prepared.ok) {
        setScanMessage(t(`checkin.identity.problem.${prepared.problem}`));
        return;
      }
      const photo = prepared.blob === file ? file : new File([prepared.blob], 'document.jpg', { type: prepared.blob.type });
      const result = await publicCheckinApi.readDocument(token, photo);
      if (!result.read || result.guestPosition == null || !context?.guests?.[result.guestPosition]) {
        setScanMessage(t(result.reason === 'guest_mismatch' || result.read ? 'checkin.scanMismatch' : scanReasonKey(result.reason)));
        return;
      }
      if (result.confirmGuest) setReview({ result, file: photo });
      else await proceedWithReading(result, photo);
    } catch (error) {
      setScanMessage(getProblemMessage(error, t) ?? t('checkin.scanUnread'));
    } finally {
      setReadingDocument(false);
    }
  };

  const onSubmit = handleSubmit(
    async (values) => {
      if (current !== STEP_CONSENTS || !privacyRead || !rulesAccepted || (identity.progress && !identity.concluded)) return;
      setSubmitError(null);
      try {
        await submitCheckIn.mutateAsync({ ...toPublicCheckInSubmitRequest(values, { statisticalFields, swiss }), privacyNoticeAcknowledged: privacyRead, houseRulesVersion: acceptedRulesVersion });
        setSubmitted(true);
        onCompleted?.();
      } catch (error) {
        if (getHttpStatus(error) === 409) {
          const latest = await refetch();
          if (latest.data?.completed || (latest.data && COMPLETE_STATUSES.has(latest.data.status))) {
            onCompleted?.();
            return;
          }
          setSubmitError(guestProblemMessage(error, t));
          return;
        }

        const current = getValues('guests');
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
    (errors) => {
      const target = firstStepWithProblems(errors, statisticalFields);
      if (target !== null && target !== current) setStep(target);
      reportProblems();
    },
  );

  return {
    context, isLoading, isFetching, refetch, invalidLink, completed, submitted, receiptHeading, searchParams,
    locale, chooseLanguage, languageNotSaved, languageNotLoaded,
    steps, current, stepIndex, totalSteps, stepHeading, goToStep, goNext, resumed, step,
    taxRead, taxView, taxPaying, setTaxPaying, setTaxCannotPay, taxBlocksNext,
    identity, takeVerifyingPhoto,
    form, formElement, onSubmit, focusRequest, problemCount, guests, fields, remove, statisticalFields, swiss, codeSource, changeLeaderType, addGuest, askVehiclePlate,
    readingDocument, setReadingDocument, scanMessage, documentsRead, review, setReview, zonedReading, setZonedReading, proceedWithReading, confirmPrefill, readDocument, moveFromScan,
    activeRulesVersion, rulesAccepted, setAcceptedRulesVersion, privacyRead, setPrivacyRead, submitError, submitCheckIn, consentsGiven,
  };
}
