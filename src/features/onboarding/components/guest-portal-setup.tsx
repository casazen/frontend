import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HostExtrasEditor } from '@/features/bookings/components/host-extras-editor';
import { GuestHouseGuideEditor } from '@/features/bookings/components/guest-house-guide-editor';
import { GuestSupplierOperations } from '@/features/guest-portal/guest-supplier-operations';
import type { HouseGuide } from '@/features/guest-portal/house-guide-fields';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { useProperties } from '@/queries/use-properties';

type Suggestion = {
  guide?: HouseGuide;
  extras?: { name: string; price: number; reason?: string }[];
  categories?: string[];
};

type Setup = {
  brandConfirmed: boolean;
  guideConfirmed: boolean;
  extrasConfirmed: boolean;
  regionalSuppliers: boolean | null;
  chatConfirmed: boolean;
  reviewsEnabled: boolean | null;
  otaRulesAcknowledged: boolean;
  hidePaidServicesOnAirbnb: boolean;
};

type SetupView = {
  setup: Setup;
  brand: { name: string; logoUrl: string | null; primaryColor: string | null };
  hasGuide: boolean;
  complete: boolean;
};

const steps = ['brand', 'guide', 'extras', 'suppliers', 'chat', 'reviews', 'ota'] as const;
type Step = (typeof steps)[number];

function completed(view: SetupView) {
  const setup = view.setup;
  return {
    brand: setup.brandConfirmed,
    guide: setup.guideConfirmed && view.hasGuide,
    extras: setup.extrasConfirmed,
    suppliers: setup.regionalSuppliers != null,
    chat: setup.chatConfirmed,
    reviews: setup.reviewsEnabled != null,
    ota: setup.otaRulesAcknowledged,
  };
}

export function GuestPortalSetupEntry() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className="order-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 lg:col-span-2">
      <div className="space-y-1">
        <h2 className="font-semibold">{t('guestPortal.setup.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('guestPortal.setup.subtitle')}</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" className="min-h-11">{t('guestPortal.setup.open')}</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <header className="space-y-1">
            <DialogTitle>{t('guestPortal.setup.title')}</DialogTitle>
            <DialogDescription>{t('guestPortal.setup.subtitle')}</DialogDescription>
          </header>
          {open && <PropertySetupSelection />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PropertySetupSelection() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('');
  const properties = useProperties({ mode: 'short' }, { fresh: true });

  if (properties.isPending) return <p role="status">{t('guestPortal.host.loading')}</p>;
  if (properties.isError) return <p role="alert">{t('guestPortal.host.unavailable')}</p>;
  if (!properties.data.length) return <p>{t('guestPortal.setup.noProperties')}</p>;

  const propertyId = selected || properties.data[0].id;
  return (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm font-medium">
        {t('guestPortal.setup.property')}
        <select className="min-h-11 rounded-md border bg-background px-3"
          value={propertyId} onChange={(event) => setSelected(event.target.value)}>
          {properties.data.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </label>
      <PropertySetup key={propertyId} propertyId={propertyId} />
    </div>
  );
}

function PropertySetup({ propertyId }: { propertyId: string }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  const endpoint = `/properties/${propertyId}/guest-portal-setup`;
  const queryKey = ['guest-portal-setup', propertyId];
  const query = useQuery({
    queryKey,
    queryFn: () => ApiClient.get<SetupView>(endpoint),
    refetchOnMount: 'always',
  });
  const [selected, setSelected] = useState<Step>();
  const [choice, setChoice] = useState<boolean>();
  const [guideDraft, setGuideDraft] = useState<HouseGuide>();
  const generate = useMutation({
    mutationFn: (kind: string) => ApiClient.post<Suggestion>(`${endpoint}/suggestions/${kind}`),
  });
  const save = useMutation({
    mutationFn: ({ step, value }: { step: Step; value?: boolean }) =>
      ApiClient.put<SetupView>(`${endpoint}/${step}`, { choice: value }),
    onSuccess: (view) => {
      client.setQueryData(queryKey, view);
      const done = completed(view);
      setSelected(steps.find((step) => !done[step]));
      setChoice(undefined);
      setGuideDraft(undefined);
      generate.reset();
    },
  });

  if (query.isPending) return <p role="status">{t('guestPortal.host.loading')}</p>;
  if (query.isError) return <p role="alert">{t('guestPortal.host.unavailable')}</p>;

  const { setup, brand, complete } = query.data;
  const done = completed(query.data);
  const step = selected ?? steps.find((item) => !done[item]);
  const value = choice ?? (step === 'suppliers' ? setup.regionalSuppliers : step === 'reviews' ? setup.reviewsEnabled : setup.hidePaidServicesOnAirbnb);
  const binaryChoice = step === 'suppliers' || step === 'reviews';
  const ota = step === 'ota';
  const needsAcknowledgement = step === 'extras' || step === 'chat';

  function choose(item: Step) {
    save.reset();
    generate.reset();
    setGuideDraft(undefined);
    setSelected(item);
    setChoice(undefined);
  }

  return (
    <div className="grid gap-4">
      <ol className="flex flex-wrap gap-2" aria-label={t('guestPortal.setup.steps')}>
        {steps.map((item, index) => (
          <li key={item}>
            <Button type="button" variant={step === item ? 'default' : 'outline'} size="sm" className="min-h-11"
              aria-current={step === item ? 'step' : undefined} disabled={save.isPending} onClick={() => choose(item)}>
              {done[item] ? <Check aria-label={t('guestPortal.setup.confirmed')} size={16} /> : <span>{index + 1}</span>}
              {t(`guestPortal.setup.${item}`)}
            </Button>
          </li>
        ))}
      </ol>
      {complete && <p role="status" className="rounded-md border bg-muted p-3 font-medium">{t('guestPortal.setup.complete')}</p>}
      {step && (
        <section className="grid gap-3" aria-labelledby="guest-portal-step">
          <h3 id="guest-portal-step" className="text-lg font-semibold">{t(`guestPortal.setup.${step}`)}</h3>
          <p className="text-sm text-muted-foreground">{t(`guestPortal.setup.${step}Note`)}</p>
          {step === 'brand' && (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              {brand.logoUrl && <img src={brand.logoUrl} alt="" className="size-12 rounded-md object-contain" />}
              <span className="font-semibold">{brand.name}</span>
              {brand.primaryColor && /^#[0-9a-f]{6}$/i.test(brand.primaryColor) && (
                <span className="size-6 rounded-full border" style={{ backgroundColor: brand.primaryColor }} aria-hidden="true" />
              )}
            </div>
          )}
          {(step === 'guide' || step === 'extras' || step === 'suppliers') && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" loading={generate.isPending}
                disabled={save.isPending} onClick={() => generate.mutate(step)}>
                {t('guestPortal.setup.suggest')}
              </Button>
              {step === 'guide' && (
                <Button type="button" variant="outline" className="min-h-11" disabled={generate.isPending || save.isPending}
                  onClick={() => generate.mutate('local')}>{t('guestPortal.setup.suggestLocal')}</Button>
              )}
            </div>
          )}
          {generate.isError && <p role="alert">{t('guestPortal.setup.suggestionsUnavailable')}</p>}
          {generate.isSuccess && !generate.data?.guide && !generate.data?.extras?.length && !generate.data?.categories?.length &&
            <p role="status">{t('guestPortal.setup.suggestionsUnavailable')}</p>}
          {generate.data?.guide && (
            <div className="space-y-2 rounded-lg border p-3">
              <ul className="space-y-2">{Object.entries(generate.data.guide).map(([key, text]) => typeof text === 'string' && text && (
                <li key={key} className="break-words text-sm">
                  <span className="font-semibold">{t(`guestPortal.guide.${key}`)}</span>
                  <p className="whitespace-pre-wrap">{text}</p>
                </li>
              ))}</ul>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => {
                const fields = Object.entries(generate.data.guide ?? {}).filter(([, value]) => typeof value === 'string' && value);
                setGuideDraft((current) => ({ ...current, ...Object.fromEntries(fields) }));
              }}>
                {t('guestPortal.setup.applySuggestion')}
              </Button>
            </div>
          )}
          {Boolean(generate.data?.extras?.length) && (
            <ul className="space-y-2 rounded-lg border p-3">
              {generate.data?.extras?.map((extra, index) => (
                <li key={`${extra.name}-${index}`} className="text-sm">
                  <span className="font-semibold">{extra.name} · {new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'EUR' }).format(extra.price)}</span>
                  {extra.reason && <p>{extra.reason}</p>}
                </li>
              ))}
            </ul>
          )}
          {Boolean(generate.data?.categories?.length) && (
            <ul className="list-inside list-disc rounded-lg border p-3">
              {generate.data?.categories?.map((code) => <li key={code}>{t(`serviceRequest.categories.${code}`)}</li>)}
            </ul>
          )}
          {(step === 'guide' || step === 'chat') && (
            <GuestHouseGuideEditor key={step} propertyId={propertyId} section={step} suggestion={guideDraft}
              onSaved={() => void query.refetch()} />
          )}
          {step === 'extras' && <HostExtrasEditor propertyId={propertyId} suggestions={generate.data?.extras} />}
          {step === 'suppliers' && flags.guestPortalSupplierServices && <GuestSupplierOperations scope={{ role: 'host', propertyId }} />}
          {step === 'suppliers' && flags.agencyTier && hasPermission('short-rent', 'property.read') && (
            <Button type="button" variant="link" asChild className="min-h-11 justify-self-start px-0">
              <Link to="/app/short-rent/trusted-suppliers">{t('guestPortal.setup.manageSuppliers')}</Link>
            </Button>
          )}
          {binaryChoice && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t(`guestPortal.setup.${step}`)}>
              {[true, false].map((option) => (
                <Button key={String(option)} type="button" className="min-h-11"
                  variant={value === option ? 'secondary' : 'outline'} aria-pressed={value === option}
                  disabled={save.isPending} onClick={() => setChoice(option)}>
                  {t(option ? 'guestPortal.setup.yes' : 'guestPortal.setup.no')}
                </Button>
              ))}
            </div>
          )}
          {(ota || needsAcknowledgement) && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" disabled={save.isPending}
                checked={ota ? value === true : (choice ?? done[step])}
                onChange={(event) => setChoice(event.target.checked)} />
              {t(ota ? 'guestPortal.setup.hideAirbnb' : `guestPortal.setup.${step}Confirm`)}
            </label>
          )}
          {save.isError && <p role="alert">{t(step === 'guide' ? 'guestPortal.setup.saveGuide' : 'guestPortal.host.changeError')}</p>}
          <Button type="button" className="min-h-11 justify-self-end"
            disabled={save.isPending || (binaryChoice && value == null) || (needsAcknowledgement && !(choice ?? done[step]))}
            onClick={() => save.mutate({ step, value: needsAcknowledgement ? true : value ?? undefined })}>
            {t('guestPortal.setup.save')}
          </Button>
        </section>
      )}
    </div>
  );
}
