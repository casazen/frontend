import { isGuestPortalToken } from '@/lib/guest-portal-path';
import { FormProvider } from 'react-hook-form';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { formatDate } from '@/lib/utils';
import { asksSwissDocument, documentLevelsOf, type DocumentLevel } from './schemas/checkin.schema';
import { StayGuestDocumentFields } from './components/stay-guest-fields';
import { DocumentReadStep } from './components/document-read-step';
import { GuestPageFrame } from './components/guest-page-frame';
import { GuestInvoiceForm } from './guest-invoice-form';
import { CheckInConsentsStep } from './components/checkin-consents-step';
import { CheckInGuestsStep } from './components/checkin-guests-step';
import { CheckInReceipt } from './components/checkin-receipt';
import { CheckInStepActions } from './components/checkin-step-actions';
import { CheckInUnavailable } from './components/checkin-unavailable';
import { GuestLanguageBar } from './components/guest-language-bar';
import { STEP_CONSENTS, STEP_DOCUMENT, STEP_GUESTS, STEP_IDENTITY, STEP_LABEL, STEP_SCAN, STEP_TAX } from './lib/checkin-steps';
import { withoutPaymentReturn } from './lib/tourist-tax-model';
import { IdentityStep } from './identity-step';
import { TouristTaxStep } from './tourist-tax-step';
import { useGuestCheckInFlow } from './use-guest-checkin-flow';

export function CheckInPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  if (isGuestPortalToken(token)) {
    const next = withoutPaymentReturn(params) ?? new URLSearchParams(params);
    next.set('page', 'checkin');
    return <Navigate replace to={`/s/${token.slice(5)}?${next}`} />;
  }
  return <GuestCheckInFlow key={token} token={token} />;
}

export function GuestCheckInFlow({ token, embedded = false, onCompleted, next }: {
  token: string;
  embedded?: boolean;
  onCompleted?: () => void;
  next?: { href: string; label: string };
}) {
  const { t } = useTranslation();
  const {
    context, isLoading, isFetching, refetch, invalidLink, completed, submitted, receiptHeading, searchParams,
    locale, chooseLanguage, languageNotSaved, languageNotLoaded,
    steps, current, stepIndex, totalSteps, stepHeading, goToStep, goNext, resumed, step,
    taxRead, taxView, taxPaying, setTaxPaying, setTaxCannotPay, taxBlocksNext,
    identity, takeVerifyingPhoto,
    form, formElement, onSubmit, focusRequest, problemCount, guests, fields, remove, statisticalFields, swiss, codeSource, changeLeaderType, addGuest, askVehiclePlate,
    readingDocument, setReadingDocument, scanMessage, documentsRead, review, setReview, zonedReading, setZonedReading, proceedWithReading, confirmPrefill, readDocument, moveFromScan,
    activeRulesVersion, rulesAccepted, setAcceptedRulesVersion, privacyRead, setPrivacyRead, submitError, submitCheckIn, consentsGiven,
  } = useGuestCheckInFlow({ token, embedded, onCompleted, t });

  const switcher = !embedded && (
    <GuestLanguageBar
      locale={locale}
      chooseLanguage={chooseLanguage}
      context={context}
      languageNotSaved={languageNotSaved}
      languageNotLoaded={languageNotLoaded}
    />
  );

  if (isLoading) {
    return (
      <GuestPageFrame embedded={embedded} switcher={switcher}>
        <LoadingScreen message={t('checkin.loading')} className="h-64" />
      </GuestPageFrame>
    );
  }

  if (invalidLink || !context) {
    return (
      <GuestPageFrame embedded={embedded} switcher={switcher} testId={invalidLink ? 'checkin-invalid-link' : 'checkin-load-problem'}>
        <CheckInUnavailable invalidLink={invalidLink} isFetching={isFetching} refetch={refetch} />
      </GuestPageFrame>
    );
  }

  if (searchParams.get('invoice') === '1') {
    return <GuestPageFrame embedded={embedded} switcher={switcher}><GuestInvoiceForm token={token} context={context} /></GuestPageFrame>;
  }

  if (completed) {
    return (
      <GuestPageFrame embedded={embedded} switcher={switcher} testId="checkin-success">
        <CheckInReceipt submitted={submitted} receiptHeading={receiptHeading} context={context} next={next} taxView={taxView} taxRead={taxRead} token={token} />
      </GuestPageFrame>
    );
  }

  const declaredGuests = context.declaredGuests ?? 1;
  const documentLevels = documentLevelsOf(guests ?? [], swiss);
  const leaders = fields
    .map((field, index) => ({ field, index, level: documentLevels[index] ?? null }))
    .filter((entry): entry is typeof entry & { level: DocumentLevel } => entry.level !== null);
  const swissDocuments = asksSwissDocument(swiss);

  return (
    <GuestPageFrame embedded={embedded} switcher={switcher} testId="checkin-page">
      <>
        <div className={embedded ? 'space-y-2' : 'text-center space-y-2'}>
          <h1 className="text-2xl font-bold">{t('checkin.guestCheckIn')}</h1>
          <p className="text-muted-foreground">{context.propertyName}</p>
          {context.checkInDate && context.checkOutDate && (
            <p className="text-sm text-muted-foreground">
              {formatDate(context.checkInDate)} – {formatDate(context.checkOutDate)}
            </p>
          )}
        </div>
        <ol className="mx-auto flex max-w-md justify-center gap-2" aria-label={t('checkin.guestCheckIn')} data-testid="checkin-progress">
          {steps.map((n, index) => (
            <li key={n} aria-label={t(STEP_LABEL[n])} aria-current={n === current ? 'step' : undefined}
              className={`h-2 min-w-0 flex-1 rounded-full ${index <= stepIndex ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </ol>
        <Card>
          <CardHeader>
            <CardDescription>{t('checkin.stepOf', { step: stepIndex + 1, total: totalSteps })}</CardDescription>
            <h2 ref={stepHeading} tabIndex={-1} className="scroll-mt-4 text-2xl font-semibold tracking-tight">{t(STEP_LABEL[current])}</h2>
            {current !== STEP_SCAN && stepIndex + 1 < totalSteps && (
              <CardDescription>{t('checkin.reopen.nextStep', { name: t(STEP_LABEL[steps[stepIndex + 1]]) })}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <FormProvider {...form}>
              <form ref={formElement} onSubmit={onSubmit} autoComplete="off" className="space-y-4" data-testid="guest-data-form">
                <p key={focusRequest} role="status" className="sr-only" data-testid="checkin-announcement">
                  {focusRequest > 0 && problemCount > 0 ? t('checkin.errors.summary', { count: problemCount }) : null}
                </p>
                {current === STEP_SCAN && (
                  <DocumentReadStep
                    notArchived={context.documentNotArchived === true || swissDocuments}
                    reading={readingDocument}
                    message={scanMessage}
                    readCount={documentsRead}
                    review={review ? t('checkin.scanConfirm', {
                      read: [review.result.guest?.firstName, review.result.guest?.lastName].join(' '),
                      name: [context.guests?.[review.result.guestPosition!]?.firstName, context.guests?.[review.result.guestPosition!]?.lastName].join(' '),
                    }) : null}
                    onConfirm={async () => {
                      if (!review) return;
                      setReadingDocument(true);
                      setReview(null);
                      try { await proceedWithReading(review.result, review.file); }
                      finally { setReadingDocument(false); }
                    }}
                    prefill={zonedReading?.prefill ?? null}
                    onConfirmPrefill={(values) => { void confirmPrefill(values); }}
                    onDiscardPrefill={() => setZonedReading(null)}
                    onFile={(file) => { void readDocument(file); }}
                    onManual={moveFromScan}
                    onContinue={moveFromScan}
                  />
                )}
                {current === STEP_GUESTS && (
                  <CheckInGuestsStep
                    resumed={resumed}
                    step={step}
                    swissDocuments={swissDocuments}
                    fields={fields}
                    declaredGuests={declaredGuests}
                    context={context}
                    codeSource={codeSource}
                    statisticalFields={statisticalFields}
                    swiss={swiss}
                    changeLeaderType={changeLeaderType}
                    remove={remove}
                    addGuest={addGuest}
                    askVehiclePlate={askVehiclePlate}
                  />
                )}
                {current === STEP_DOCUMENT && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {swissDocuments ? t('checkin.swiss.documentIntro') : t('checkin.documentIntro')}
                    </p>
                    {leaders.map(({ field, index, level }) => (
                      <StayGuestDocumentFields key={field.id} index={index} source={codeSource} level={level} />
                    ))}
                  </div>
                )}
                {current === STEP_TAX && (
                  <TouristTaxStep
                    token={token}
                    view={taxView}
                    refetch={taxRead.refetch}
                    fetching={taxRead.isFetching}
                    onPayingChange={setTaxPaying}
                    onCannotPayChange={setTaxCannotPay}
                  />
                )}
                {current === STEP_IDENTITY && <IdentityStep identity={identity} token={token} takeFront={takeVerifyingPhoto} />}
                {current === STEP_CONSENTS && (
                  <CheckInConsentsStep
                    context={context}
                    activeRulesVersion={activeRulesVersion}
                    rulesAccepted={rulesAccepted}
                    setAcceptedRulesVersion={setAcceptedRulesVersion}
                    privacyRead={privacyRead}
                    setPrivacyRead={setPrivacyRead}
                  />
                )}
                {submitError && (
                  <p role="alert" className="text-sm text-destructive" data-testid="checkin-submit-error">
                    {submitError}
                  </p>
                )}
                {current !== STEP_SCAN && (
                  <CheckInStepActions
                    steps={steps}
                    stepIndex={stepIndex}
                    current={current}
                    identity={identity}
                    taxPaying={taxPaying}
                    taxBlocksNext={taxBlocksNext}
                    goToStep={goToStep}
                    goNext={goNext}
                    submitCheckIn={submitCheckIn}
                    consentsGiven={consentsGiven}
                  />
                )}
                {current === STEP_CONSENTS && !consentsGiven && (
                  <p id="checkin-submit-hint" className="text-right text-xs text-foreground/70" data-testid="checkin-submit-hint">
                    {t('checkin.submitHint')}
                  </p>
                )}
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </>
    </GuestPageFrame>
  );
}
