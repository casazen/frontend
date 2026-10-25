import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileText, Loader2 } from 'lucide-react';
import { leaseDocumentsApi } from '@/api/lease-documents.api';
import { leasesApi } from '@/api/leases.api';
import { DocumentPages } from '@/components/documents/document-pages';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { EMPTY_DOCUMENT, documentReady, prepareDocument, type DocumentSelection } from '@/lib/document-pdf';
import { LEASE_MAX_SIGNED_CONTRACT_BYTES } from '@/lib/lease-signing';
import { useCreateLeaseDraft, useDraftReading } from '@/queries/use-lease-draft';
import type { LeaseContractType } from '@/types';
import { LeaseWizardFrame, WIZARD_BUTTON } from './lease-wizard-frame';
import { LeaseWizardStepper } from './lease-wizard-stepper';
import { NewLeaseStep } from './new-lease-step';
import { PropertyStep } from './property-step';
import { emptyFlow, firstStepWithNeeds, leaseEditPath, registeredSteps, stepKey, visibleSteps } from './wizard-model';

/** After this long the person is told it takes more than usual and may go on by hand while the reading goes on. */
const SLOW_AFTER_MS = 120_000;

/** The wizard of a contract already signed, from its second step: the first one with something missing, or by hand from the parties. */
async function wizardPath(leaseId: string, read: boolean): Promise<string> {
  if (!read) return leaseEditPath(leaseId, 2);
  try {
    const draft = await leasesApi.getDraft(leaseId);
    return leaseEditPath(leaseId, firstStepWithNeeds(draft.flow, registeredSteps('Imported')));
  } catch {
    // The wizard reads the draft itself and says what is wrong with it.
    return leaseEditPath(leaseId, 2);
  }
}

/**
 * «Ho già i documenti» of a new contract (NL-DOCS): the person gives the property and the signed contract (a PDF, or photos of its
 * pages put in one by the browser) and CasaZen reads it on the server and fills in the data of the draft, asking only what is missing.
 * The draft is created with the type chosen at the start, the contract is uploaded to it as its `Contract` document, and while the
 * server reads (a few seconds, up to a minute for a scan) the screen says so and asks how far it has got, never sooner than every three
 * seconds. Then the wizard opens on the first step with something missing, with the values read in their fields (marked «letto dal
 * contratto — controlla») and editable. If the reading fails, or finds nothing, the person is told so and goes on by hand with the PDF
 * already uploaded: it is the one the final import uses. Nothing of the contract is kept in the browser.
 */
export function DocumentsStart({ contractType, defaultPropertyId }: { contractType: LeaseContractType; defaultPropertyId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createDraft = useCreateLeaseDraft();
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? '');
  const [selection, setSelection] = useState<DocumentSelection>(EMPTY_DOCUMENT);
  const [missingProperty, setMissingProperty] = useState(false);
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState('');
  const [failure, setFailure] = useState<unknown>(null);
  const [slow, setSlow] = useState(false);
  const [byHand, setByHand] = useState(false);
  const left = useRef(false);

  const reading = useDraftReading(leaseId ?? '', uploaded);
  const state = reading.data?.state;

  // The reading is over (it read, or it could not): on to the wizard, once.
  useEffect(() => {
    if (!leaseId || left.current || (state !== 'Done' && state !== 'Failed')) return;
    left.current = true;
    void wizardPath(leaseId, state === 'Done').then((path) => navigate(path, { replace: true }));
  }, [leaseId, state, navigate]);

  // An honest limit: past it the person may go on by hand, and the reading goes on meanwhile.
  useEffect(() => {
    if (!uploaded) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [uploaded]);

  const steps = visibleSteps(emptyFlow('Imported'), registeredSteps('Imported'));
  const entries = steps.map((step) => ({
    step,
    label: t(`leaseWizard.steps.${stepKey(step, 'Imported')}.label`),
    mark: step === 1 ? ('current' as const) : ('todo' as const),
  }));

  const submit = async () => {
    if (working) return;
    setProblem('');
    setFailure(null);
    if (!propertyId) {
      setMissingProperty(true);
      document.getElementById('lw-property')?.focus();
      return;
    }
    if (!documentReady(selection)) return;

    setWorking(true);
    try {
      let id = leaseId;
      if (id === null) {
        try {
          id = await createDraft.mutateAsync({ propertyId, origin: 'Imported', contractType });
        } catch {
          return; // useCreateLeaseDraft.onError says why; nothing was created
        }
        setLeaseId(id);
      }

      try {
        const file = await prepareDocument(selection, LEASE_MAX_SIGNED_CONTRACT_BYTES);
        await leaseDocumentsApi.upload(id, file, 'Contract');
        setUploaded(true);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('documentPages.')) setProblem(t(error.message));
        else setFailure(error);
      }
    } finally {
      setWorking(false);
    }
  };

  // By hand: the wizard of a contract already signed, with the data typed.
  if (byHand) {
    return <NewLeaseStep origin="Imported" contractType={contractType} defaultPropertyId={propertyId || defaultPropertyId} />;
  }

  if (uploaded && leaseId !== null) {
    return (
      <LeaseWizardFrame
        stepper={<LeaseWizardStepper entries={entries} current={1} />}
        title={t('leaseWizard.documents.reading.title')}
        purpose={t('leaseWizard.documents.reading.purpose')}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={slow ? 'default' : 'ghost'}
              className={WIZARD_BUTTON}
              onClick={() => navigate(leaseEditPath(leaseId, 2), { replace: true })}
              data-testid="lease-documents-continue"
            >
              {t('leaseWizard.documents.continueByHand')}
            </Button>
          </div>
        }
      >
        <div className="flex min-w-0 flex-col items-center gap-3 rounded-xl border bg-muted/20 px-4 py-10 text-center" data-testid="lease-documents-reading">
          <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
          <p role="status" className="break-words text-base font-semibold">
            {t('leaseWizard.documents.reading.status')}
          </p>
          <p className="max-w-md break-words text-sm text-muted-foreground">{slow ? t('leaseWizard.documents.reading.slow') : t('leaseWizard.documents.reading.wait')}</p>
        </div>
      </LeaseWizardFrame>
    );
  }

  return (
    <LeaseWizardFrame
      stepper={<LeaseWizardStepper entries={entries} current={1} />}
      title={t('leaseWizard.documents.title')}
      purpose={t('leaseWizard.documents.purpose')}
      why={t('leaseWizard.documents.why')}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {leaseId === null ? (
            <Button type="button" variant="ghost" className={WIZARD_BUTTON} onClick={() => setByHand(true)} data-testid="lease-documents-manual">
              {t('leaseWizard.documents.manual')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={WIZARD_BUTTON}
              onClick={() => navigate(leaseEditPath(leaseId, 2), { replace: true })}
              data-testid="lease-documents-continue"
            >
              {t('leaseWizard.documents.continueByHand')}
            </Button>
          )}
          <Button
            type="submit"
            form="lease-documents-form"
            loading={working}
            disabled={!documentReady(selection)}
            iconRight={<ArrowRight />}
            className={`${WIZARD_BUTTON} grow sm:grow-0`}
            data-testid="lease-documents-submit"
          >
            {failure ? t('leaseWizard.documents.retry') : t('leaseWizard.documents.submit')}
          </Button>
        </div>
      }
    >
      <form
        id="lease-documents-form"
        noValidate
        aria-label={t('leaseWizard.documents.title')}
        className="space-y-6"
        data-testid="lease-documents-start"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {/* The property is the draft's from the moment it exists: a retry of the upload does not ask for it again. */}
        {leaseId === null ? (
          <PropertyStep
            value={propertyId}
            onChange={(id) => {
              setPropertyId(id);
              setMissingProperty(false);
            }}
            error={missingProperty ? 'leaseWizard.validation.property' : undefined}
            imported
          />
        ) : null}

        <section className="space-y-3" aria-labelledby="lease-documents-heading">
          <div className="space-y-1">
            <h3 id="lease-documents-heading" className="flex items-center gap-2 text-base font-semibold">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              {t('leaseWizard.documents.areaTitle')}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="lease-documents-promise">
              {t('leaseWizard.documents.promise')}
            </p>
          </div>
          <DocumentPages
            value={selection}
            onChange={(next) => {
              setSelection(next);
              setProblem('');
            }}
            disabled={working}
          />
          {problem ? (
            <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
              {problem}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('leaseWizard.documents.privacy')}</p>
        </section>

        {failure ? (
          <Alert variant="danger" data-testid="lease-documents-error">
            {getProblemMessage(failure, t) ?? t('leaseWizard.documents.uploadFailed')}
          </Alert>
        ) : null}
      </form>
    </LeaseWizardFrame>
  );
}
