import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { CalendarRuns } from '@/features/owner-portal/calendar-runs';
import { calendarRuns, calendarWindow, currentData, type CalendarPeriodId, CALENDAR_PERIODS } from '@/features/owner-portal/owner-portal-model';
import { PortalLoading, PortalNotice, PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { StayList, StayRequestForm, StayRulePanel } from '@/features/owner-portal/stays-panel';
import { todayInRome } from '@/lib/stay-dates';
import {
  useCancelOwnerStay,
  useOwnerCalendar,
  useOwnerProperties,
  useOwnerStayRule,
  useOwnerStays,
  useRequestOwnerStay,
} from '@/queries/ownerPortal';

interface PropertyChoice {
  id: string;
  name: string;
}

/**
 * The calendar and the owner stays (E07/F07/US01/T03, NF-111): pick a property, see its nights as the server cuts them to the ownerships in force (free, occupied, closed,
 * a stay of the owner), read the rule an owner stay follows, ask for one, and follow or withdraw the ones already asked. The address says which property (`/calendario/:propertyId`)
 * and it wins: there is no draft that could put another one in its place. The page never shows a guest (the calendar has no member for one), and a stay is a request until the
 * server says that its block is confirmed.
 *
 * The properties come from the owner's own list and from the stays it already has (a contact the owner let in has no ownership of its own, so its properties are the ones its stays name).
 */
export function OwnerCalendar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { propertyId: routeProperty } = useParams<{ propertyId: string }>();
  const [periodId, setPeriodId] = useState<CalendarPeriodId>('threeMonths');

  const properties = useOwnerProperties();
  const stays = useOwnerStays();
  const request = useRequestOwnerStay();
  const cancel = useCancelOwnerStay();
  const busy = request.isPending || cancel.isPending;

  // The last answer of each read, never an earlier one a refusal left in the cache (a property of an access that was withdrawn stays out).
  const propertiesNow = currentData(properties);
  const staysNow = currentData(stays);
  const choices = useMemo<PropertyChoice[]>(() => {
    const byId = new Map<string, PropertyChoice>();
    for (const property of propertiesNow ?? []) byId.set(property.propertyId, { id: property.propertyId, name: property.propertyName });
    for (const stay of staysNow ?? []) if (!byId.has(stay.propertyId)) byId.set(stay.propertyId, { id: stay.propertyId, name: stay.propertyName });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [propertiesNow, staysNow]);

  // The address wins; without one, the first property. An id that is not one of the owner's is not drawn: it is «not found», never somebody else's calendar.
  const selected = routeProperty ?? choices[0]?.id;
  const known = selected ? choices.find((choice) => choice.id === selected) : undefined;
  const choicesReady = properties.isSuccess && stays.isSuccess;
  const unknownProperty = choicesReady && Boolean(routeProperty) && !known;

  const today = todayInRome();
  const span = calendarWindow(today, periodId);
  const calendar = useOwnerCalendar(known?.id, span.from, span.to);
  const rule = useOwnerStayRule(known?.id);

  if (properties.isLoading || stays.isLoading) return <PortalLoading label={t('ownerPortal.calendar.loading')} />;

  // The list of the properties could not be read: say so, whatever an earlier read left in memory (a refusal is a refusal, and the calendar of nobody is not «no properties»).
  if (properties.isError) {
    return (
      <PortalReadProblem
        error={properties.error}
        failedTitle={t('ownerPortal.calendar.propertiesError')}
        onRetry={() => void properties.refetch()}
        testId="owner-calendar-properties-error"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeading title={t('ownerPortal.calendar.title')} description={t('ownerPortal.calendar.description')} />

      {choices.length === 0 && !stays.isError ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-calendar-no-properties">
          {t('ownerPortal.calendar.noProperties')}
        </p>
      ) : null}

      {unknownProperty ? (
        <PortalNotice state="unavailable" testId="owner-calendar-unknown-property" />
      ) : known ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('ownerPortal.calendar.property')}>
              <Select
                value={known.id}
                className="min-h-11"
                onChange={(event) => void navigate(ownerPortalPaths.calendar(event.target.value), { replace: true })}
                data-testid="owner-calendar-property"
              >
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('ownerPortal.calendar.period')}>
              <Select
                value={periodId}
                className="min-h-11"
                onChange={(event) => setPeriodId(event.target.value as CalendarPeriodId)}
                data-testid="owner-calendar-period"
              >
                {CALENDAR_PERIODS.map((period) => (
                  <option key={period.id} value={period.id}>
                    {t(`ownerPortal.calendar.periods.${period.id}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <section aria-labelledby="owner-calendar-title" className="space-y-3">
            <h2 id="owner-calendar-title" className="text-xl font-semibold text-[#1f3a3d]">
              {t('ownerPortal.calendar.sectionTitle', { property: known.name })}
            </h2>
            <p className="text-sm text-muted-foreground">{t('ownerPortal.calendar.privacyNote')}</p>
            {calendar.isLoading ? (
              <PortalLoading label={t('ownerPortal.calendar.loading')} />
            ) : calendar.isError ? (
              <PortalReadProblem
                error={calendar.error}
                failedTitle={t('ownerPortal.calendar.error')}
                onRetry={() => void calendar.refetch()}
                testId="owner-calendar-error"
              />
            ) : calendar.data ? (
              <CalendarRuns runs={calendarRuns(calendar.data.ranges)} propertyName={known.name} />
            ) : null}
          </section>

          <section aria-labelledby="owner-stay-request-title" className="space-y-3">
            <h2 id="owner-stay-request-title" className="text-xl font-semibold text-[#1f3a3d]">
              {t('ownerPortal.stays.sectionTitle')}
            </h2>
            {rule.isLoading ? (
              <PortalLoading />
            ) : rule.isError ? (
              <PortalReadProblem
                error={rule.error}
                failedTitle={t('ownerPortal.stays.ruleError')}
                onRetry={() => void rule.refetch()}
                testId="owner-stay-rule-error"
              />
            ) : rule.data ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <StayRulePanel summary={rule.data} />
                <StayRequestForm propertyId={known.id} summary={rule.data} busy={busy} request={request} />
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <section aria-labelledby="owner-stays-title" className="space-y-3">
        <h2 id="owner-stays-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.stays.listTitle')}
        </h2>
        {stays.isError ? (
          <PortalReadProblem error={stays.error} failedTitle={t('ownerPortal.stays.error')} onRetry={() => void stays.refetch()} testId="owner-stays-error" />
        ) : stays.data ? (
          <StayList stays={stays.data} busy={busy} cancel={cancel} />
        ) : null}
      </section>
    </div>
  );
}
