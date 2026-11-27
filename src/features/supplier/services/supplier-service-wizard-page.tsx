import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useFormContext, type UseFormReturn } from 'react-hook-form';
import { PackagePlus, CalendarCheck, EyeOff, Pencil, Send } from 'lucide-react';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatRomeDateTime } from '@/lib/stay-dates';
import {
  supplierServiceKeys,
  useCreateSupplierService,
  useDuplicateSupplierService,
  usePublishSupplierService,
  useSupplierService,
  useSupplierServices,
  useUpdateSupplierService,
} from '@/queries/use-supplier-services';
import type { SupplierService } from '@/types/supplier-services';
import { BasicsFields, BookingFields, PriceFields, SwitchRow } from './components/service-fields';
import { LiveServicePreview } from './components/live-service-preview';
import { ServicePhotos } from './components/service-photos';
import { describeServiceError, markServerFields } from './lib/service-errors';
import {
  bookingStepSchema,
  draftValues,
  emptyServiceForm,
  priceStepSchema,
  serviceStepSchema,
  serviceToForm,
  toServiceBody,
  type ServiceFormValues,
} from './lib/service-form';
import { SERVICE_LIMITS } from './lib/service-limits';
import { NEW_SERVICE_PATH, SERVICES_PATH, draftPath, servicePath } from './lib/service-paths';

const T = 'supplier.services.wizard';

const FIRST_STEP = 'service';

interface WizardResult {
  service: SupplierService;
  published: boolean;
}

function FormBridge({ onForm }: { onForm: (form: UseFormReturn<ServiceFormValues>) => void }) {
  const form = useFormContext<ServiceFormValues>();
  useEffect(() => {
    onForm(form);
  }, [form, onForm]);
  return null;
}

function PhotosStep({ service, publishNow, onPublishNow }: { service: SupplierService | undefined; publishNow: boolean; onPublishNow: (value: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 space-y-8">
      {service ? (
        <section className="min-w-0 space-y-3" aria-labelledby="service-photos-title">
          <h3 id="service-photos-title" className="text-sm font-medium">
            {t(`${T}.photosTitle`)}
          </h3>
          <ServicePhotos service={service} />
        </section>
      ) : (
        <Alert variant="warning" data-testid="service-wizard-needs-draft">
          {t(`${T}.needsDraft`)}
        </Alert>
      )}
      <section className="min-w-0 space-y-3" aria-labelledby="service-preview-title">
        <h3 id="service-preview-title" className="text-sm font-medium">
          {t(`${T}.previewTitle`)}
        </h3>
        <LiveServicePreview photoUrl={service?.photoUrls[0]} />
      </section>
      <SwitchRow checked={publishNow} onCheckedChange={onPublishNow} label={t(`${T}.publishNow`)} hint={t(`${T}.publishNowHint`)} testId="service-publish-now" />
    </div>
  );
}

function Done({ result }: { result: WizardResult | undefined }) {
  const { t } = useTranslation();
  if (!result) return <Navigate to={SERVICES_PATH} replace />;
  const { service, published } = result;
  return (
    <WizardDone
      title={t(published ? `${T}.done.publishedTitle` : `${T}.done.draftTitle`)}
      description={service.name}
      whatNext={
        published
          ? [
              { text: t(`${T}.done.catalog`), icon: Pencil },
              { text: t(`${T}.done.availability`), icon: CalendarCheck },
            ]
          : [
              { text: t(`${T}.done.draftHidden`), icon: EyeOff },
              { text: t(`${T}.done.draftPublish`), icon: Send },
            ]
      }
      primary={{ label: t(`${T}.done.open`), to: servicePath(service.id) }}
      secondary={{ label: t(`${T}.done.back`), to: SERVICES_PATH }}
    />
  );
}

/**
 * The creation, step by step. The draft is the service itself: it is created when the first step is done and saved at every
 * step (`POST`, then `PUT` with the `version` the last answer carried), so a reload or another day gives it back
 * (`?bozza=`, and the list opens it with "Continua"); nothing is kept in the browser. Photos are saved as they are added, the
 * last button saves the form and, unless the supplier chose to keep a draft, publishes.
 */
function WizardBody({ initial, onStarted }: { initial?: SupplierService; onStarted?: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const create = useCreateSupplierService();
  const update = useUpdateSupplierService();
  const publish = usePublishSupplierService();

  const decimal = i18n.language.startsWith('it') ? ',' : '.';
  const [serviceId, setServiceId] = useState<string | undefined>(initial?.id);
  const { data: service } = useSupplierService(serviceId);
  const idRef = useRef(serviceId);
  const formRef = useRef<UseFormReturn<ServiceFormValues> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [publishNow, setPublishNow] = useState(true);
  const [defaults] = useState(() => (initial ? serviceToForm(initial, decimal) : emptyServiceForm()));

  const stepInAddress = searchParams.get('step') !== null;
  useEffect(() => {
    if (!serviceId || searchParams.get('bozza') === serviceId || !(initial || stepInAddress)) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('bozza', serviceId);
        return next;
      },
      { replace: true },
    );
  }, [serviceId, searchParams, stepInAddress, initial, setSearchParams]);

  const rememberForm = useCallback((form: UseFormReturn<ServiceFormValues>) => {
    formRef.current = form;
  }, []);

  const latest = () => (idRef.current ? client.getQueryData<SupplierService>(supplierServiceKeys.detail(idRef.current)) : undefined);

  const remember = (saved: SupplierService) => {
    idRef.current = saved.id;
    setServiceId(saved.id);
  };

  const refuse = async (error: unknown): Promise<never> => {
    const found = describeServiceError(error, t);
    if (found.kind === 'changed' && idRef.current) {
      // The draft was changed elsewhere (another tab): take its latest version, so that the next "Continue" is not refused again.
      await client.refetchQueries({ queryKey: supplierServiceKeys.detail(idRef.current) }).catch(() => undefined);
      setProblem(t(`${T}.changed`));
    } else {
      setProblem(found.message);
    }
    if (formRef.current) markServerFields(formRef.current, found);
    throw new Error(found.message);
  };

  const save = async (values: ServiceFormValues, { complete = false } = {}): Promise<SupplierService> => {
    setProblem(null);
    const current = latest();
    try {
      const sent = complete ? values : draftValues(values, current ? serviceToForm(current, decimal) : emptyServiceForm());
      const body = toServiceBody(sent);
      const saved = current
        ? await update.mutateAsync({ id: current.id, body: { ...body, version: current.version } })
        : await create.mutateAsync(body);
      if (!current) onStarted?.();
      remember(saved);
      return saved;
    } catch (error) {
      return refuse(error);
    }
  };

  const finish = async (values: ServiceFormValues): Promise<WizardResult> => {
    let saved = await save(values, { complete: true });
    if (publishNow) {
      try {
        saved = await publish.mutateAsync(saved.id);
        remember(saved);
      } catch (error) {
        return refuse(error);
      }
    }
    return { service: saved, published: publishNow };
  };

  const savedAt = service ? formatRomeDateTime(service.updatedAt, i18n.language, { hour: '2-digit', minute: '2-digit' }) : '';
  const stepText = (id: string) => ({
    label: t(`${T}.steps.${id}.label`),
    title: t(`${T}.steps.${id}.title`),
    purpose: t(`${T}.steps.${id}.purpose`),
  });
  const steps: WizardStep<ServiceFormValues>[] = [
    {
      id: FIRST_STEP,
      ...stepText('service'),
      schema: serviceStepSchema,
      beforeNext: async (values) => void (await save(values)),
      render: () => (
        <>
          <FormBridge onForm={rememberForm} />
          <BasicsFields />
        </>
      ),
    },
    {
      id: 'price',
      ...stepText('price'),
      schema: priceStepSchema,
      beforeNext: async (values) => void (await save(values)),
      render: () => (
        <>
          <FormBridge onForm={rememberForm} />
          <PriceFields />
        </>
      ),
    },
    {
      id: 'booking',
      ...stepText('booking'),
      schema: bookingStepSchema,
      beforeNext: async (values) => void (await save(values)),
      render: () => (
        <>
          <FormBridge onForm={rememberForm} />
          <BookingFields />
        </>
      ),
    },
    {
      id: 'photos',
      ...stepText('photos'),
      render: () => (
        <>
          <FormBridge onForm={rememberForm} />
          <PhotosStep service={service} publishNow={publishNow} onPublishNow={setPublishNow} />
        </>
      ),
    },
  ];

  return (
    <WizardShell<ServiceFormValues, WizardResult>
      id="supplier-service-new"
      steps={steps}
      defaultValues={defaults}
      finishLabel={t(publishNow ? `${T}.publish` : `${T}.saveDraft`)}
      finishFailedMessage={problem ?? t(`${T}.failed`)}
      onFinish={finish}
      draft={false}
      onExit={() => navigate(SERVICES_PATH)}
      renderDone={({ result }) => <Done result={result} />}
      aboveFooter={
        service ? (
          <p role="status" className="text-sm text-foreground/70" data-testid="service-wizard-saved">
            {t(`${T}.savedAt`, { time: savedAt })}
          </p>
        ) : undefined
      }
      testIds={{ root: 'supplier-service-wizard', back: 'service-wizard-back', next: 'service-wizard-next', finish: 'service-wizard-finish', exit: 'service-wizard-exit', finishError: 'service-wizard-error' }}
    />
  );
}

/**
 * The wizard of a draft that was opened. What it opened with is kept (`useState` keeps the first `initial`): the cache moves on
 * under the wizard, and publishing the draft makes the service "Active" there, which must not take the wizard away before its
 * confirmation is shown.
 */
function OpenedDraft({ initial }: { initial: SupplierService }) {
  const [opened] = useState(initial);
  if (opened.status !== 'Draft') return <Navigate to={servicePath(opened.id)} replace />;
  return <WizardBody initial={opened} />;
}

function DraftLoader({ id, onStartNew }: { id: string; onStartNew: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useSupplierService(id);

  if (isLoading) return <LoadingScreen message={t(`${T}.loadingDraft`)} className="h-auto flex-1" />;
  if (isError || !data) {
    const found = describeServiceError(error, t);
    return (
      <div className="w-full" data-testid="service-wizard-draft-error">
        <EmptyState
          icon={Pencil}
          title={t(`${T}.draftErrorTitle`)}
          description={found.kind === 'notFound' ? found.message : t(`${T}.draftErrorDescription`)}
          action={{ label: t(`${T}.startNew`), href: NEW_SERVICE_PATH, onClick: onStartNew }}
          secondaryAction={{ label: t(`${T}.done.back`), href: SERVICES_PATH }}
        />
      </div>
    );
  }
  return <OpenedDraft key={data.id} initial={data} />;
}

function DuplicateStarter({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync } = useDuplicateSupplierService();
  const started = useRef(false);
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutateAsync(sourceId).then(
      (copy) => navigate(draftPath(copy.id), { replace: true }),
      (error: unknown) => setFailed({ error }),
    );
  }, [sourceId, mutateAsync, navigate]);

  if (!failed) return <LoadingScreen message={t(`${T}.duplicating`)} className="h-auto flex-1" />;
  return (
    <div className="w-full space-y-4" data-testid="service-wizard-duplicate-error">
      <Alert variant="danger">{describeServiceError(failed.error, t).message}</Alert>
      <Button asChild variant="outline">
        <Link to={SERVICES_PATH}>{t(`${T}.done.back`)}</Link>
      </Button>
    </div>
  );
}

/**
 * What the address says when the page opens: a new service, a draft to continue, or nothing to do because there is no room for
 * another. It is read once, because the address changes under the wizard (`?step=`, then `?bozza=`) and so does the list (the
 * draft it creates is one more service): neither may take the wizard away while it is being filled.
 */
function WizardEntry() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [draftId, setDraftId] = useState(() => params.get('bozza'));
  const [lostAtOpening] = useState(() => {
    const step = params.get('step');
    return !params.get('bozza') && step !== null && ![FIRST_STEP, '1', 'fatto'].includes(step);
  });
  const [started, setStarted] = useState(false);
  const lost = lostAtOpening && !started && params.get('step') !== null && !params.get('bozza');
  const list = useSupplierServices();
  const atLimit = !draftId && !started && list.data !== undefined && list.data.total >= (list.data.limit || SERVICE_LIMITS.maxServices);

  if (lost) return <Navigate to={NEW_SERVICE_PATH} replace />;
  if (draftId) return <DraftLoader id={draftId} onStartNew={() => setDraftId(null)} />;
  if (atLimit) {
    return (
      <div className="w-full" data-testid="service-wizard-limit">
        <EmptyState
          icon={Pencil}
          title={t(`${T}.limitTitle`)}
          description={t('supplier.services.errors.limit', { max: list.data?.limit || SERVICE_LIMITS.maxServices })}
          action={{ label: t(`${T}.done.back`), href: SERVICES_PATH }}
        />
      </div>
    );
  }
  return <WizardBody onStarted={() => setStarted(true)} />;
}

export function SupplierServiceWizardPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const duplicateId = params.get('duplica');

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-service-wizard-page">
      <ServicePageHeader icon={PackagePlus} title={t(`${T}.title`)} description={t(`${T}.description`)} crumbs="auto" />
      <div className={FOCUS_COLUMN}>{duplicateId ? <DuplicateStarter sourceId={duplicateId} /> : <WizardEntry />}</div>
    </div>
  );
}
