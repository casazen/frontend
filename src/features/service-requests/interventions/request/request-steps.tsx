import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Info } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { FormFieldError } from '@/components/shared/form-field-error';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { supplierFacts } from '@/features/marketplace/lib/supplier-labels';
import { orderStaysForRequest, stayOptionLabel } from '@/features/service-requests/lib/stays';
import { formatPrice } from '@/features/supplier/services/lib/service-labels';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { formatWorkDuration } from '@/lib/work-duration';
import { usePropertyBookings } from '@/queries/use-bookings';
import { useHostSupplierServices, useHostSupplierSlots } from '@/queries/use-host-supplier-catalog';
import { useProperties } from '@/queries/use-properties';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useSuppliersByProperty } from '@/queries/use-service-requests';
import type { HostSupplierService } from '@/types/host-supplier-catalog';
import type { SupplierPicker } from '@/types/service-request';
import { marketplaceForPropertyPath } from '../paths';
import {
  CUSTOM_SERVICE,
  DEFAULT_CHECK_IN_FROM,
  DEFAULT_CHECK_OUT_BY,
  DURATION_OTHER,
  DURATIONS,
  isCatalogService,
  MAX_DURATION,
  MIN_DURATION,
  proposedSchedule,
  REQUEST_NOTES_MAX,
  slotsInWindow,
  slotsOfDay,
  daysWithSlots,
  SUPPLIER_SEES,
  timedByHost,
  turnoverWindow,
  typedDuration,
  URGENCIES,
  type RequestValues,
} from './request-model';

type SetValue = UseFormSetValue<RequestValues>;

/** The fields that describe the service chosen, empty: nothing chosen. */
const NO_SERVICE: Partial<RequestValues> = {
  serviceId: '',
  serviceName: '',
  serviceMinutes: null,
  serviceEstimateCents: null,
  serviceRequiresQuote: false,
  servicePriceFromCents: null,
  servicePriceUnit: '',
  startTime: '',
};

function assign(setValue: SetValue, values: Partial<RequestValues>) {
  (Object.keys(values) as (keyof RequestValues)[]).forEach((name) => {
    setValue(name, values[name] as never, { shouldDirty: true });
  });
}

/** The first day the work can be on for a stay: its check-out day, never one that has passed. */
export function dayForStay(checkOutDate: string, today: string = todayInRome()): string {
  const checkOut = stayDateOf(checkOutDate);
  return checkOut >= today ? checkOut : today;
}

/* ------------------------------------------------------------------------------------------------ ① Cosa serve */

/** Step ①: what is needed (a category of the catalog), how pressing it is and what the supplier should know. No guests' data. */
export function WhatStep() {
  const { t } = useTranslation();
  const { register, control, formState } = useFormContext<RequestValues>();
  const categories = useServiceCategories();
  const notes = useWatch({ control, name: 'notes' });

  return (
    <div className="space-y-6">
      <Field label={t('requestWizard.what.category')} error={formState.errors.category}>
        <Select data-testid="request-category" {...register('category')}>
          <option value="">{t('requestWizard.what.categoryPlaceholder')}</option>
          {(categories.data ?? []).map((code) => (
            <option key={code} value={code}>
              {getServiceCategoryLabel(code, t)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-2">
        <ChoiceGroup legend={t('requestWizard.what.urgency')} legendVisible minCardWidth={12}>
          {URGENCIES.map((urgency) => (
            <ChoiceCard
              key={urgency}
              value={urgency}
              title={t(`requestWizard.what.urgencies.${urgency}.title`)}
              description={t(`requestWizard.what.urgencies.${urgency}.text`)}
              data-testid={`request-urgency-${urgency}`}
              {...register('urgency')}
            />
          ))}
        </ChoiceGroup>
        <FormFieldError error={formState.errors.urgency} />
      </div>

      <Field
        label={t('requestWizard.what.notes')}
        hint={t('requestWizard.what.notesHint')}
        optional
        counter={`${notes.length}/${REQUEST_NOTES_MAX}`}
        error={formState.errors.notes}
      >
        <Textarea rows={4} maxLength={REQUEST_NOTES_MAX} data-testid="request-notes" {...register('notes')} />
      </Field>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- ② Dove e quando */

/** The stays a request can be linked to: those not over yet (check-out today or later), soonest first. */
function useUpcomingStays(propertyId: string) {
  const bookings = usePropertyBookings(propertyId || undefined);
  const today = todayInRome();
  const stays = useMemo(
    () => orderStaysForRequest(bookings.data ?? [], today).filter((stay) => stayDateOf(stay.checkOutDate) >= today),
    [bookings.data, today],
  );
  return { stays, all: bookings.data, loading: bookings.isLoading };
}

/**
 * Step ②: the property, the stay it is for (optional: without one the request is for the house alone) and the day. For cleaning it says
 * the hours that are advised between the guests who leave and the ones who arrive.
 */
export function WhenStep() {
  const { t, i18n } = useTranslation();
  const { register, control, setValue, formState } = useFormContext<RequestValues>();
  const properties = useProperties({ mode: 'short' });
  const propertyList = Array.isArray(properties.data) ? properties.data : [];
  const [propertyId, day, category] = useWatch({ control, name: ['propertyId', 'day', 'category'] });
  const { stays, all, loading } = useUpcomingStays(propertyId);
  const window = category === 'cleaning' ? turnoverWindow(day, all ?? []) : null;
  const propertyField = register('propertyId');
  const stayField = register('bookingId');

  return (
    <div className="space-y-6">
      <Field label={t('requestWizard.when.property')} error={formState.errors.propertyId}>
        <Select
          data-testid="request-property"
          {...propertyField}
          onChange={(event) => {
            void propertyField.onChange(event);
            // The stay belongs to the property: another property has other stays.
            setValue('bookingId', '', { shouldDirty: true });
          }}
        >
          <option value="">{t('requestWizard.when.propertyPlaceholder')}</option>
          {propertyList.map((property) => (
            <option key={property.id} value={property.id}>
              {[property.name, property.city].filter(Boolean).join(' · ')}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('requestWizard.when.stay')} hint={t('requestWizard.when.stayHint')} optional error={formState.errors.bookingId}>
        <Select
          data-testid="request-stay"
          disabled={propertyId === '' || loading}
          {...stayField}
          onChange={(event) => {
            void stayField.onChange(event);
            const stay = stays.find((candidate) => candidate.id === event.target.value);
            // The work is on the day the guests leave, unless the host says otherwise below.
            if (stay) setValue('day', dayForStay(stay.checkOutDate), { shouldDirty: true });
          }}
        >
          <option value="">{t('requestWizard.when.stayNone')}</option>
          {stays.map((stay) => (
            <option key={stay.id} value={stay.id}>
              {stayOptionLabel(stay, t, i18n.language)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('requestWizard.when.day')} error={formState.errors.day}>
        <Input type="date" min={todayInRome()} data-testid="request-day" {...register('day')} />
      </Field>

      {window ? (
        <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm" data-testid="request-window">
          <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground/70" />
          <span className="min-w-0 break-words">
            {window.to ? t('requestWizard.when.window.both', { from: window.from, to: window.to }) : t('requestWizard.when.window.open', { from: window.from })}{' '}
            <span className="text-foreground/70">{t('requestWizard.when.window.defaults', { checkOut: DEFAULT_CHECK_OUT_BY, checkIn: DEFAULT_CHECK_IN_FROM })}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------------- ③ Chi */

/** What a refusal of the supplier's catalog (it is not active, or does not cover the comune) says. */
function CatalogProblem({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  const text =
    code === 'service_request_supplier_outside_comune'
      ? t('requestWizard.errors.supplierOutsideComune')
      : code === 'service_request_supplier_inactive' || getHttpStatus(error) === 404
        ? t('requestWizard.errors.supplierInactive')
        : t('requestWizard.who.catalogError');
  return (
    <Alert variant="warning" data-testid="request-catalog-problem">
      {text}
    </Alert>
  );
}

function supplierDescription(supplier: SupplierPicker, t: TFunction, language: string): ReactNode {
  const facts = supplierFacts(supplier, t, language);
  return facts ?? t('requestWizard.who.priceOnRequest');
}

/** The suppliers that cover the comune of the property for the category, one to choose. */
function SupplierChoices() {
  const { t, i18n } = useTranslation();
  const { control, setValue, formState } = useFormContext<RequestValues>();
  const [propertyId, category, chosen] = useWatch({ control, name: ['propertyId', 'category', 'supplierOrgId'] });
  const suppliers = useSuppliersByProperty(propertyId, category);

  if (suppliers.isPending) return <SkeletonLine lines={4} label={t('requestWizard.who.loadingSuppliers')} />;
  if (suppliers.isError) {
    return (
      <Alert
        variant="danger"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void suppliers.refetch()}>
            {t('requestWizard.retry')}
          </Button>
        }
      >
        {t('requestWizard.who.suppliersError')}
      </Alert>
    );
  }

  const items = suppliers.data.items;
  const notAvailable = chosen !== '' && !items.some((supplier) => supplier.orgId === chosen);

  const choose = (supplier: SupplierPicker) => {
    if (supplier.orgId === chosen) return;
    assign(setValue, { ...NO_SERVICE, supplierOrgId: supplier.orgId, supplierName: supplier.legalName });
  };

  return (
    <div className="space-y-3">
      {notAvailable ? (
        <Alert variant="warning" data-testid="request-supplier-unavailable">
          {t('requestWizard.who.supplierUnavailable')}
        </Alert>
      ) : null}
      {items.length === 0 ? (
        <Alert variant="info" data-testid="request-no-suppliers">
          {t('requestWizard.who.noSuppliers')}{' '}
          <Link to={marketplaceForPropertyPath(propertyId)} className="font-medium underline underline-offset-4">
            {t('requestWizard.who.lookAround')}
          </Link>
        </Alert>
      ) : (
        <ChoiceGroup legend={t('requestWizard.who.suppliers')} legendVisible minCardWidth={14}>
          {items.map((supplier) => (
            <ChoiceCard
              key={supplier.orgId}
              name="request-supplier"
              value={supplier.orgId}
              checked={chosen === supplier.orgId}
              onChange={() => choose(supplier)}
              title={supplier.legalName}
              description={supplierDescription(supplier, t, i18n.language)}
              data-testid={`request-supplier-${supplier.orgId}`}
            />
          ))}
        </ChoiceGroup>
      )}
      <FormFieldError error={formState.errors.supplierOrgId} />
    </div>
  );
}

/** What the card of a service says: how long it takes and what it costs. */
function serviceDescription(service: HostSupplierService, t: TFunction, language: string): string {
  const duration = service.durationMinutes === null ? t('requestWizard.who.noDuration') : formatWorkDuration(service.durationMinutes, t);
  const price = formatPrice(service, t, language);
  return `${duration} · ${price}`;
}

/** The services of the supplier for the category, one to choose, or «altro lavoro» outside the catalog. */
function ServiceChoices() {
  const { t, i18n } = useTranslation();
  const { control, setValue, formState } = useFormContext<RequestValues>();
  const [supplierOrgId, propertyId, category, day, serviceId] = useWatch({ control, name: ['supplierOrgId', 'propertyId', 'category', 'day', 'serviceId'] });
  const services = useHostSupplierServices(supplierOrgId, propertyId, category);
  const { all } = useUpcomingStays(propertyId);
  const items = services.data?.items;

  const chooseService = useCallback(
    (service: HostSupplierService) => {
      if (service.id === serviceId) return;
      const proposal = proposedSchedule(category === 'cleaning' ? turnoverWindow(day, all ?? []) : null);
      assign(setValue, {
        ...NO_SERVICE,
        serviceId: service.id,
        serviceName: service.name,
        serviceMinutes: service.durationMinutes,
        serviceEstimateCents: service.estimatedAmountCents,
        serviceRequiresQuote: service.requiresQuote,
        servicePriceFromCents: service.priceFromCents,
        servicePriceUnit: service.priceUnit,
        // A service without a duration has no slots: the host gives the time and the length, from the advised hours.
        ...(service.durationMinutes === null ? { startTime: proposal.startTime, durationChoice: proposal.durationChoice } : {}),
      });
    },
    [serviceId, category, day, all, setValue],
  );

  const chooseCustom = () => {
    if (serviceId === CUSTOM_SERVICE) return;
    const proposal = proposedSchedule(category === 'cleaning' ? turnoverWindow(day, all ?? []) : null);
    assign(setValue, { ...NO_SERVICE, serviceId: CUSTOM_SERVICE, startTime: proposal.startTime, durationChoice: proposal.durationChoice });
  };

  // A supplier with a single service for this work: it is the one chosen (the host can still pick «altro lavoro»).
  useEffect(() => {
    if (serviceId === '' && items?.length === 1) chooseService(items[0]);
  }, [items, serviceId, chooseService]);

  if (services.isPending) return <SkeletonLine lines={3} label={t('requestWizard.who.loadingServices')} />;
  if (services.isError) return <CatalogProblem error={services.error} />;

  return (
    <div className="space-y-3">
      <ChoiceGroup legend={t('requestWizard.who.services')} legendVisible minCardWidth={14}>
        {services.data.items.map((service) => (
          <ChoiceCard
            key={service.id}
            name="request-service"
            value={service.id}
            checked={serviceId === service.id}
            onChange={() => chooseService(service)}
            title={service.name}
            description={serviceDescription(service, t, i18n.language)}
            data-testid={`request-service-${service.id}`}
          />
        ))}
        <ChoiceCard
          name="request-service"
          value={CUSTOM_SERVICE}
          checked={serviceId === CUSTOM_SERVICE}
          onChange={chooseCustom}
          title={t('requestWizard.who.custom.title')}
          description={t('requestWizard.who.custom.text')}
          data-testid="request-service-custom"
        />
      </ChoiceGroup>
      <FormFieldError error={formState.errors.serviceId} />
    </div>
  );
}

/** The slots of the day, as buttons; the advised hours first for a cleaning; the nearest days when the day has none. */
function SlotChoices() {
  const { t, i18n } = useTranslation();
  const { control, setValue, formState } = useFormContext<RequestValues>();
  const [supplierOrgId, serviceId, propertyId, category, day, startTime] = useWatch({
    control,
    name: ['supplierOrgId', 'serviceId', 'propertyId', 'category', 'day', 'startTime'],
  });
  const slots = useHostSupplierSlots(supplierOrgId, serviceId, propertyId, day, true);
  const { all: stays } = useUpcomingStays(propertyId);
  const window = category === 'cleaning' ? turnoverWindow(day, stays ?? []) : null;
  const [showEvery, setShowEvery] = useState(false);

  const free = useMemo(() => slotsOfDay(slots.data?.slots ?? [], day), [slots.data, day]);
  const advised = useMemo(() => slotsInWindow(free, window), [free, window]);
  const filtered = window !== null && advised.length > 0 && !showEvery;
  const shown = filtered ? advised : free;
  const nearby = useMemo(() => daysWithSlots(slots.data?.slots ?? []).filter((candidate) => candidate > day).slice(0, 4), [slots.data, day]);
  const dayText = formatStayDate(day, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });

  // A time that is not free any more (someone took it, or the day was changed) is not kept: the host is asked again.
  useEffect(() => {
    if (startTime !== '' && slots.data && !free.some((slot) => slot.time === startTime)) setValue('startTime', '');
  }, [free, slots.data, startTime, setValue]);

  if (slots.isPending) return <SkeletonLine lines={3} label={t('requestWizard.who.loadingSlots')} />;
  if (slots.isError) {
    return (
      <Alert
        variant="danger"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void slots.refetch()}>
            {t('requestWizard.retry')}
          </Button>
        }
      >
        {t('requestWizard.who.slotsError')}
      </Alert>
    );
  }

  const pick = (time: string) => setValue('startTime', time, { shouldDirty: true, shouldValidate: true });
  const goTo = (nextDay: string) => {
    setValue('day', nextDay, { shouldDirty: true });
    setValue('startTime', '', { shouldDirty: true });
    setShowEvery(false);
  };

  return (
    <div className="space-y-3" data-testid="request-slots">
      <h3 className="text-sm font-semibold">{t('requestWizard.who.slotsTitle', { day: dayText })}</h3>
      <p role="status" className="sr-only">
        {t('requestWizard.who.slotsCount', { count: shown.length, day: dayText })}
      </p>

      {filtered ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/70" data-testid="request-slots-advised">
          <span>
            {window?.to
              ? t('requestWizard.who.advised.both', { from: window.from, to: window.to })
              : t('requestWizard.who.advised.open', { from: window?.from })}
          </span>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setShowEvery(true)} data-testid="request-slots-all">
            {t('requestWizard.who.showEvery')}
          </Button>
        </p>
      ) : null}
      {window !== null && advised.length === 0 && free.length > 0 ? <p className="text-sm text-foreground/70">{t('requestWizard.who.advised.none')}</p> : null}

      {shown.length > 0 ? (
        <div role="group" aria-label={t('requestWizard.who.slotsLabel', { day: dayText })} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((slot) => (
            <button
              key={slot.startUtc}
              type="button"
              aria-pressed={startTime === slot.time}
              aria-label={t('requestWizard.who.slot', { from: slot.time, to: slot.endTime })}
              onClick={() => pick(slot.time)}
              data-testid={`request-slot-${slot.time}`}
              className={
                startTime === slot.time
                  ? 'min-h-11 rounded-md border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  : 'min-h-11 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              }
            >
              {slot.time}
              <span className="block text-xs font-normal opacity-80" aria-hidden="true">
                {t('requestWizard.who.until', { to: slot.endTime })}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3" data-testid="request-no-slots">
          <Alert variant="info">{t('requestWizard.who.noSlotsDay', { day: dayText })}</Alert>
          {nearby.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('requestWizard.who.nearbyDays')}</p>
              <div className="flex flex-wrap gap-2">
                {nearby.map((candidate) => (
                  <Button key={candidate} type="button" variant="outline" className="min-h-11" onClick={() => goTo(candidate)} data-testid={`request-nearby-${candidate}`}>
                    {formatStayDate(candidate, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/70">{t('requestWizard.who.noSlotsAtAll')}</p>
          )}
        </div>
      )}
      <FormFieldError error={formState.errors.startTime} />
    </div>
  );
}

/** A job the host times itself (outside the catalog, or a service with no duration): the time and the length, proposed and changeable. */
function CustomTime() {
  const { t } = useTranslation();
  const { register, control, formState } = useFormContext<RequestValues>();
  const choice = useWatch({ control, name: 'durationChoice' });

  return (
    <div className="space-y-4" data-testid="request-custom-time">
      <p className="text-sm text-foreground/70">{t('requestWizard.who.custom.help')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('requestWizard.who.startTime')} error={formState.errors.startTime}>
          <Input type="time" step={300} data-testid="request-start-time" {...register('startTime')} />
        </Field>
        <Field label={t('requestWizard.who.duration')} error={formState.errors.durationChoice}>
          <Select data-testid="request-duration" {...register('durationChoice')}>
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {formatWorkDuration(minutes, t)}
              </option>
            ))}
            <option value={DURATION_OTHER}>{t('requestWizard.who.durationOther')}</option>
          </Select>
        </Field>
      </div>
      {choice === DURATION_OTHER ? (
        <Field label={t('requestWizard.who.durationMinutes')} hint={t('requestWizard.who.durationRange', { min: MIN_DURATION, max: MAX_DURATION })} error={formState.errors.durationOther}>
          <Input type="number" inputMode="numeric" min={MIN_DURATION} max={MAX_DURATION} step={1} data-testid="request-duration-other" {...register('durationOther')} />
        </Field>
      ) : null}
    </div>
  );
}

/** When the work is: a slot of the service, or the time the host gives. */
function TimeChoices() {
  const { control } = useFormContext<RequestValues>();
  const [serviceId, serviceMinutes] = useWatch({ control, name: ['serviceId', 'serviceMinutes'] });
  return timedByHost({ serviceId, serviceMinutes }) ? <CustomTime /> : <SlotChoices />;
}

/** Step ③: the supplier, the service and when. Nothing here is kept in the draft: the suppliers and their agendas change. */
export function WhoStep() {
  const { control } = useFormContext<RequestValues>();
  const [supplierOrgId, serviceId] = useWatch({ control, name: ['supplierOrgId', 'serviceId'] });

  return (
    <div className="space-y-8">
      <SupplierChoices />
      {supplierOrgId !== '' ? <ServiceChoices /> : null}
      {supplierOrgId !== '' && serviceId !== '' ? <TimeChoices /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------- ④ Riepilogo */

/** "10:00" plus 120 minutes is "12:00" (the wall clock of the day; a job that runs past midnight is written "24:00"). */
function endTime(start: string, minutes: number): string {
  const [hour, minute] = start.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  if (total >= 24 * 60) return '24:00';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The price the summary says: the service's estimate, «su preventivo», its «da» price, or nothing known. */
function priceLine(values: RequestValues, t: TFunction, language: string): string {
  if (!isCatalogService(values.serviceId)) return t('requestWizard.review.priceTbd');
  if (values.serviceEstimateCents !== null) return t('requestWizard.review.priceEstimate', { price: formatMoney(values.serviceEstimateCents, language) });
  if (values.serviceRequiresQuote) return t('requestWizard.review.priceQuote');
  if (values.servicePriceFromCents !== null) {
    return t('requestWizard.review.priceFrom', {
      price: formatPrice({ requiresQuote: false, priceFromCents: values.servicePriceFromCents, priceUnit: values.servicePriceUnit as HostSupplierService['priceUnit'] }, t, language),
    });
  }
  return t('requestWizard.review.priceTbd');
}

/** Step ④: everything in plain words, each answer with its «Modifica», and what the supplier will see of it (decision D9). */
export function ReviewStep() {
  const { t, i18n } = useTranslation();
  const { control } = useFormContext<RequestValues>();
  const values = useWatch({ control }) as RequestValues;
  const properties = useProperties({ mode: 'short' });
  const { stays } = useUpcomingStays(values.propertyId);

  const property = (Array.isArray(properties.data) ? properties.data : []).find((candidate) => candidate.id === values.propertyId);
  const stay = stays.find((candidate) => candidate.id === values.bookingId);
  const minutes = isCatalogService(values.serviceId) && values.serviceMinutes !== null ? values.serviceMinutes : typedDuration(values);
  const dayText = formatStayDate(values.day, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const hours = minutes ? `${values.startTime}–${endTime(values.startTime, minutes)}` : values.startTime;

  const items: WizardSummaryItem[] = [
    {
      id: 'what',
      label: t('requestWizard.review.what'),
      value: [getServiceCategoryLabel(values.category, t), t(`requestWizard.what.urgencies.${values.urgency}.title`)].join(' · '),
      stepId: 'what',
    },
    { id: 'notes', label: t('requestWizard.review.notes'), value: values.notes.trim() ? <span className="whitespace-pre-wrap">{values.notes.trim()}</span> : '', stepId: 'what' },
    {
      id: 'where',
      label: t('requestWizard.review.where'),
      value: [[property?.name, property?.city].filter(Boolean).join(' · '), stay ? stayOptionLabel(stay, t, i18n.language) : t('requestWizard.review.houseOnly')].filter(Boolean).join(' — '),
      stepId: 'when',
    },
    {
      id: 'when',
      label: t('requestWizard.review.when'),
      value: [dayText, hours, minutes ? formatWorkDuration(minutes, t) : ''].filter(Boolean).join(' · '),
      stepId: 'who',
    },
    {
      id: 'who',
      label: t('requestWizard.review.who'),
      value: [values.supplierName, isCatalogService(values.serviceId) ? values.serviceName : t('requestWizard.who.custom.title')].filter(Boolean).join(' · '),
      stepId: 'who',
    },
    { id: 'price', label: t('requestWizard.review.price'), value: priceLine(values, t, i18n.language) },
  ];

  return (
    <div className="space-y-6">
      <WizardSummary items={items} />

      <PlainSection title={t('requestWizard.review.sees.title')} data-testid="request-supplier-sees">
        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <p className="font-medium">{t('requestWizard.review.sees.beforeTitle')}</p>
            <ul className="list-disc space-y-1 pl-5">
              {SUPPLIER_SEES.before.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-medium">{t('requestWizard.review.sees.afterTitle')}</p>
            <ul className="list-disc space-y-1 pl-5">
              {SUPPLIER_SEES.after.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
          <p className="flex items-start gap-2 text-foreground/70">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{t(SUPPLIER_SEES.never)}</span>
          </p>
        </div>
      </PlainSection>
    </div>
  );
}
