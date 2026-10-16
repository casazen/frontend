import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormProvider, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { Check, Copy, Eye, Tag, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { getHttpStatus } from '@/lib/api-errors';
import { useSupplierService, useUpdateSupplierService } from '@/queries/use-supplier-services';
import type { SupplierService } from '@/types/supplier-services';
import { FormSection } from './components/form-section';
import { LiveServicePreview } from './components/live-service-preview';
import { BasicsFields, BookingFields, PriceFields, SwitchRow } from './components/service-fields';
import { ServicePhotos } from './components/service-photos';
import { ServiceZone } from './components/service-zone';
import { describeServiceError, markServerFields } from './lib/service-errors';
import { priceInputOf, serviceFormResolver, serviceToForm, toServiceBody, type ServiceFormValues } from './lib/service-form';
import { formatDuration, formatPrice } from './lib/service-labels';
import { SERVICE_LIMITS } from './lib/service-limits';
import { NEW_SERVICE_PATH, SERVICES_PATH, bookingPreviewPath, duplicatePath } from './lib/service-paths';
import { useServiceActions } from './use-service-actions';

const T = 'supplier.services.detail';

type SectionId = 'service' | 'price' | 'booking' | 'photos' | 'zone';

/** The part of the form a field is in: where a problem has to be shown. */
function sectionOfField(path: string): SectionId {
  const field = path.split('.')[0] ?? '';
  if (['priceMode', 'fixedUnit', 'amount', 'pricesIncludeVat', 'supplements'].includes(field)) return 'price';
  if (['durationMinutes', 'minNoticeHours', 'weekdays'].includes(field)) return 'booking';
  return 'service';
}

/** Whether the person can see the problem, a shut part of the form hides its fields. */
function sectionsWithProblems(errors: FieldErrors<ServiceFormValues>): SectionId[] {
  return [...new Set(Object.keys(errors).map(sectionOfField))];
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-service-not-found">
      <PageHeader title={t(`${T}.notFoundTitle`)} crumbs="auto" />
      <div className="rounded-xl bg-card p-2 shadow-sm ring-1 ring-inset ring-border">
        <EmptyState
          icon={Tag}
          title={t(`${T}.notFoundTitle`)}
          description={t(`${T}.notFoundDescription`)}
          action={{ label: t(`${T}.toList`), href: SERVICES_PATH }}
          secondaryAction={{ label: t('supplier.services.actions.add'), href: NEW_SERVICE_PATH }}
        />
      </div>
    </div>
  );
}

/**
 * The page of one service once it is loaded: every field in five parts that open (the first two are open), the preview that
 * follows what is typed, and the one decision that is not a field, "Visibile ai clienti". Saving carries the `version` the
 * service was read at: if it changed elsewhere the API says so (409) and the page offers to reload, it never overwrites.
 */
function ServiceEditor({ service }: { service: SupplierService }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const decimal = i18n.language.startsWith('it') ? ',' : '.';
  const update = useUpdateSupplierService();
  const { refetch } = useSupplierService(service.id, { refetchOnMount: false });
  const actions = useServiceActions({ onDeleted: () => navigate(SERVICES_PATH) });
  const [conflict, setConflict] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<ReadonlySet<SectionId>>(new Set<SectionId>(['service', 'price']));
  const focusAfterOpen = useRef<string | null>(null);

  const form = useForm<ServiceFormValues>({
    defaultValues: serviceToForm(service, decimal),
    resolver: serviceFormResolver,
    mode: 'onTouched',
  });
  const values = useWatch({ control: form.control });
  const { isDirty } = form.formState;

  // The part that holds a refused field opens, and only then the focus can go to the field (a shut part cannot take it).
  const reveal = (sections: readonly SectionId[], firstPath: string | undefined) => {
    focusAfterOpen.current = firstPath ?? null;
    setOpen((current) => new Set([...current, ...sections]));
  };
  useEffect(() => {
    const path = focusAfterOpen.current;
    if (!path) return;
    focusAfterOpen.current = null;
    form.setFocus(path as never);
  }, [open, form]);

  const persist = async (submitted: ServiceFormValues): Promise<boolean> => {
    setProblem(null);
    setConflict(false);
    try {
      const saved = await update.mutateAsync({ id: service.id, body: { ...toServiceBody(submitted), version: service.version } });
      form.reset(serviceToForm(saved, decimal));
      toast.success(t(`${T}.saved`));
      return true;
    } catch (error) {
      const found = describeServiceError(error, t);
      if (found.kind === 'changed') {
        setConflict(true);
      } else {
        setProblem(found.message);
        const paths = markServerFields(form, found);
        if (paths.length > 0) reveal(paths.map(sectionOfField), paths[0]);
      }
      return false;
    }
  };

  /** Checks the form and saves it; resolves with whether it was saved. */
  const submit = () =>
    new Promise<boolean>((resolve) => {
      void form.handleSubmit(
        async (submitted) => resolve(await persist(submitted)),
        (errors) => {
          const first = Object.keys(errors)[0];
          reveal(sectionsWithProblems(errors), first);
          resolve(false);
        },
      )();
    });

  const reload = async () => {
    const result = await refetch();
    if (result.data) {
      form.reset(serviceToForm(result.data, decimal));
      setConflict(false);
      setProblem(null);
    } else {
      setProblem(describeServiceError(result.error, t).message);
    }
  };

  /** "Visibile ai clienti": on puts the service on offer (saving first what is typed, so that what goes live is what is on screen), off pauses it. */
  const setVisible = async (next: boolean) => {
    if (!next) {
      await actions.pauseService(service);
      return;
    }
    if (isDirty && !(await submit())) return;
    await actions.publishService(service);
  };

  const live = service.status === 'Active';
  const price = formatPrice(priceInputOf({ priceMode: values.priceMode ?? 'fixed', fixedUnit: values.fixedUnit ?? 'PerJob', amount: values.amount ?? '' }), t, i18n.language);
  const weekdayCount = (values.weekdays ?? []).length;
  const sectionOf = (id: SectionId) => ({
    open: open.has(id),
    onOpenChange: (next: boolean) =>
      setOpen((current) => {
        const sections = new Set(current);
        if (next) sections.add(id);
        else sections.delete(id);
        return sections;
      }),
    testId: `service-section-${id}`,
  });
  const sections = { service: sectionOf('service'), price: sectionOf('price'), booking: sectionOf('booking'), photos: sectionOf('photos'), zone: sectionOf('zone') };

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-service-page">
      <PageHeader
        title={service.name}
        description={[getServiceCategoryLabel(service.category, t), formatPrice(service, t, i18n.language), formatDuration(service.durationMinutes, t)].join(' · ')}
        crumbs="auto"
        primary={{ label: t(`${T}.save`), icon: Check, onClick: () => void submit(), disabled: !isDirty || update.isPending, testId: 'service-save' }}
        secondary={[
          { label: t('supplier.services.actions.duplicate'), icon: Copy, to: duplicatePath(service.id) },
          { label: t('supplier.services.actions.preview'), icon: Eye, to: bookingPreviewPath(service.id) },
          { separator: true },
          { label: t('supplier.services.actions.delete'), icon: Trash2, danger: true, onClick: () => actions.askDelete(service), testId: 'service-delete' },
        ]}
      />

      {conflict ? (
        <Alert
          variant="warning"
          data-testid="service-conflict"
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void reload()} data-testid="service-reload">
              {t(`${T}.reload`)}
            </Button>
          }
        >
          {t('supplier.services.errors.changed')}
        </Alert>
      ) : null}
      {problem ? (
        <Alert variant="danger" data-testid="service-problem">
          {problem}
        </Alert>
      ) : null}

      <FormProvider {...form}>
        <form noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-inset ring-border" data-testid="service-visibility">
              <StatusBadge kind="serviceListing" status={service.status} className="self-start" />
              <SwitchRow
                checked={live}
                onCheckedChange={(next) => void setVisible(next)}
                disabled={actions.busy || update.isPending}
                label={t(`${T}.visible.label`)}
                hint={t(`${T}.visible.${service.status}`)}
                testId="service-visible"
              />
            </div>

            <FormSection title={t(`${T}.sections.service`)} summary={values.category ? getServiceCategoryLabel(values.category, t) : t(`${T}.sections.serviceHint`)} {...sections.service}>
              <BasicsFields />
            </FormSection>
            <FormSection title={t(`${T}.sections.price`)} summary={price} {...sections.price}>
              <PriceFields />
            </FormSection>
            <FormSection
              title={t(`${T}.sections.booking`)}
              summary={[formatDuration(values.durationMinutes ?? null, t), weekdayCount === 7 ? t(`${T}.weekdaysAll`) : t(`${T}.weekdaysSome`, { count: weekdayCount })].join(' · ')}
              {...sections.booking}
            >
              <BookingFields />
            </FormSection>
            <FormSection title={t(`${T}.sections.photos`)} summary={t('supplier.services.photos.counter', { count: service.photoUrls.length, max: SERVICE_LIMITS.maxPhotos })} {...sections.photos}>
              <ServicePhotos service={service} onConflict={() => setConflict(true)} />
            </FormSection>
            <FormSection title={t(`${T}.sections.zone`)} summary={t(`${T}.sections.zoneHint`)} {...sections.zone}>
              <ServiceZone />
            </FormSection>
          </div>

          <aside aria-label={t(`${T}.previewTitle`)} className="min-w-0">
            <div className="min-w-0 space-y-3 lg:sticky lg:top-6">
              <h2 className="text-base font-semibold">{t(`${T}.previewTitle`)}</h2>
              <LiveServicePreview photoUrl={service.photoUrls[0]} />
              <p className="break-words text-sm text-foreground/70">{t(`${T}.previewNote`)}</p>
            </div>
          </aside>
        </form>
      </FormProvider>

      {actions.deleteDialog}
    </div>
  );
}

/**
 * Scheda del servizio (SP-06): loads the service and opens its page. A service that is not in the catalog of the supplier (or
 * was deleted) is a page that says so, never an error to retry; any other failure can be retried.
 */
export function SupplierServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierService(id);

  if (isError) {
    const gone = getHttpStatus(error) === 404;
    if (gone) return <NotFound />;
    return (
      <div className="min-w-0 space-y-6" data-testid="supplier-service-load-error">
        <PageHeader title={t(`${T}.loadErrorTitle`)} crumbs="auto" />
        <ErrorState testId="supplier-service-error" title={t(`${T}.loadError`)} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !data) return <LoadingScreen message={t(`${T}.loading`)} className="h-auto flex-1" />;
  return <ServiceEditor key={data.id} service={data} />;
}
