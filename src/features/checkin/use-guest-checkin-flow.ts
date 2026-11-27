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
  // The tourist tax (E25/F01/US02/T01): asked only while the flag is on and the link is known; with the flag off nothing is asked and nothing changes on the page. The page has
  // the step while the API offers the payment (a 404 or a 409 is «not offered», whatever an earlier answer left in the cache) or when it cannot be read and the guest may try again.
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
  // Only the return point is kept in the address. Personal fields and photos stay in memory until submitted.
  const [resumed] = useState(() => searchParams.get('resume') === 'guests');
  const [step, setStep] = useState<number | null>(null);
  const doorIdentity = searchParams.get('step') === IDENTITY_STEP_PARAM && steps.includes(STEP_IDENTITY);
  const startStep = doorIdentity ? STEP_IDENTITY : resumed ? STEP_GUESTS : STEP_SCAN;
  const wantedStep = step ?? startStep;
  // A step that went away (the verification or the tax payment was switched off while the page was open) leaves the guest at the step that follows it.
  const current = steps.includes(wantedStep) ? wantedStep : stepAfterGone(wantedStep, steps);
  // The payment cannot be made (the server says it is not offered, e.g. the platform key is not there): the backend then does not hold the lock code either, so the guest is never kept out.
  const [taxCannotPay, setTaxCannotPay] = useState(false);
  // The organization asks for the tax before the lock code and something can still be paid: the guest stays at the step until the server records the payment.
  const taxBlocksNext = current === STEP_TAX && taxView !== null && blocksNextStep(taxView) && !taxCannotPay;
  // The guest's confirmation of the payment is under way: «Indietro» and «Avanti» wait for it, so the step is not left while the money moves.
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
    // A refresh can restore only data present in the server response, never an unsent document or consent.
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

  // The page opens in the language the API resolved (the guest's earlier choice, else the browser's, else Italian) until the guest chooses.
  const portalLanguage = embedded ? offeredGuestLocales(context?.supportedLanguages).find((language) => language === searchParams.get('lang')) : undefined;
  const locale = chosenLocale ?? portalLanguage ?? resolveGuestLocale(context?.language);
  // The texts of a language that cannot be loaded (the network): the page stays in the language it has and says so.
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

  // The statistical fields are asked only where the region requires them (data minimization): none while the page does not know.
  const statisticalFields = useMemo(() => requiredStatisticalFields(context?.requiredGuestFields), [context?.requiredGuestFields]);
  // A property in Switzerland asks the document of every adult, the home of each guest and the plate of the car (NF-132): exactly what the API names in
  // `requiredGuestFields` and `askVehiclePlate`. For an Italian stay both are empty and the page is the one it has always been.
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

  // After a failed "Next" or submit the focus goes to the first field in error (NF-11); the fields that are not plain inputs
  // (the official lists) have no reference in the form, so the page looks for the first one marked invalid.
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
    if (currentStep === STEP_GUESTS) return [...personalPaths(current, statisticalFields), ...(askVehiclePlate ? (['vehiclePlate'] as const) : [])];
    if (currentStep === STEP_DOCUMENT) return documentPaths(documentLevelsOf(current, swiss));
    if (currentStep === STEP_CONSENTS) return ['marketingConsentEmail', 'marketingConsentWhatsApp', 'marketingEmail'];
    return [];
  };

  // A failed attempt asks for the focus on the first field in error and for the announcement of how many there are.
  const reportProblems = () => setFocusRequest((n) => n + 1);
  const problemCount = countFieldErrors(form.formState.errors);

  const goNext = async () => {
    if (current === STEP_SCAN) {
      moveFromScan();
      return;
    }
    // The identity check goes on only when it is over: it passed, or a person was asked and has it (the way to a person is always open).
    if (current === STEP_IDENTITY && !identity.concluded) return;
    // The tax the organization asks for before the lock code goes on only when the server has recorded it, and nothing goes on while the payment is being confirmed.
    if (taxBlocksNext || taxPaying) return;
    // The official lists belong to the two steps of the guests; the invoice step has none (and is never in the way of the check-in without a reason).
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

  /**
   * Whether the form already holds a datum of the guest at `index`, in the words of the `missing` of `read-document`: typed by the guest, taken from the booking, or put there by the other photo of the card.
   * What the prefill says is still to be typed is what the form does not hold after all the photos, not only after this one.
   */
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

  /**
   * What follows a reading that belongs to a guest of the stay. With the local reading of the self-hosted flow (the answer carries `fields`, `missing` and `source`) the values are shown first, marked as read from
   * the document and editable, with what is still to be typed (E71/F02/US01/T02); with the answer of before they go straight into the form, as they always did.
   */
  const proceedWithReading = async (result: CheckInDocumentReadResult, file: File) => {
    const index = result.guestPosition;
    const prefill = index == null ? null : buildPrefill(result, (name) => formHolds(index, name));
    if (prefill) setZonedReading({ prefill, result, file });
    else await applyDocument(result, file);
  };

  /** The guest checked the values: what they left in them goes into the form, and the panel (with every value it held) is gone. */
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
        // Already submitted (e.g. from another tab): reload the context, which now shows the completed state.
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
    (errors) => {
      // The fields in error may be on a step the guest has left, or never reached: they are taken to the first one that has something to correct.
      const target = firstStepWithProblems(errors, statisticalFields);
      if (target !== null && target !== current) setStep(target);
      reportProblems();
    },
  );

  return {
    // The link and what the API says of it.
    context, isLoading, isFetching, refetch, invalidLink, completed, submitted, receiptHeading, searchParams,
    // The language of the page.
    locale, chooseLanguage, languageNotSaved, languageNotLoaded,
    // The steps and where the guest is.
    steps, current, stepIndex, totalSteps, stepHeading, goToStep, goNext, resumed, step,
    // The tourist tax.
    taxRead, taxView, taxPaying, setTaxPaying, setTaxCannotPay, taxBlocksNext,
    // The identity check.
    identity, takeVerifyingPhoto,
    // The form and the guests.
    form, formElement, onSubmit, focusRequest, problemCount, guests, fields, remove, statisticalFields, swiss, codeSource, changeLeaderType, addGuest, askVehiclePlate,
    // The reading of the document.
    readingDocument, setReadingDocument, scanMessage, documentsRead, review, setReview, zonedReading, setZonedReading, proceedWithReading, confirmPrefill, readDocument, moveFromScan,
    // The consents and the send.
    activeRulesVersion, rulesAccepted, setAcceptedRulesVersion, privacyRead, setPrivacyRead, submitError, submitCheckIn, consentsGiven,
  };
}
