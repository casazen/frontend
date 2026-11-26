import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useRoutines } from '@/queries/routines';
import { useSavePropertyCleaningSetup, usePropertyCleaningSetup } from '@/queries/property-cleaning';
import { useOrgMembers } from '@/queries/use-org-team';
import { useProperty } from '@/queries/use-properties';
import { useSuppliersByProperty } from '@/queries/use-service-requests';
import type { PropertyCleaningSetup } from '@/types';
import {
  CLEANING_CATEGORY,
  cleaningDtoOf,
  cleaningFormOf,
  cleaningProblems,
  cleaningRoutineStateOf,
  cleaningStaffOf,
  cleaningTimeSourceOf,
  formatCleaningPrice,
  memberName,
  supplierChoicesOf,
  toClock,
  type CleaningForm,
} from '../lib/property-cleaning-model';
import { AUTOMATIONS_PATH } from '../properties-paths';
import { PropertyCleaningFields, type StaffChoice } from './property-cleaning-fields';

interface PropertyCleaningCardProps {
  propertyId: string;
}

/**
 * «Pulizie al check-out» of a property (E24/F01/US02/T01, NF-120): who cleans when the guests of a stay leave (a supplier of the marketplace or a member of the staff), the price agreed in the
 * currency of the property, the time and the length. It is what the routine action `CreateCleaningRequest` reads; a property with no active setup is not automated. The property detail mounts it only
 * with the flag `routines` on and the permission `property.write`, which is what the API behind it asks. It tells what the server holds and nothing else: a read that fails is «we do not know», never
 * the answer it gave before, and a price is told in the currency the answer says.
 */
export function PropertyCleaningCard({ propertyId }: PropertyCleaningCardProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canListTeam = hasPermission('account', 'org.members.manage');
  const decimalSeparator = i18n.language.toLowerCase().startsWith('en') ? '.' : ',';

  const query = usePropertyCleaningSetup(propertyId);
  const save = useSavePropertyCleaningSetup(propertyId);
  // The record of the property says whether it has a check-out time (`checkOutBy`): the page of the property has read it already, so this asks for nothing more. Said only from a read that worked.
  const record = useProperty(propertyId);
  const [form, setForm] = useState<CleaningForm | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A read that failed keeps the old answer in the query: the card never shows it as if it were current.
  const setup = query.isError ? undefined : query.data;
  const editing = form !== null;

  const wantsSuppliers = editing && form.kind === 'Supplier';
  const suppliers = useSuppliersByProperty(wantsSuppliers ? propertyId : undefined, CLEANING_CATEGORY, { fresh: true });
  // The team is read again every time the card opens (a person who left is not offered, a new one is), and only by who may list it: the server answers 403 to the others, which sends the whole app
  // to the page of no access.
  const members = useOrgMembers(canListTeam, { fresh: true });
  // Whether the routine is on: said only from a read that worked.
  const routines = useRoutines();

  const supplierChoices = useMemo(
    () => supplierChoicesOf([suppliers.isError ? [] : (suppliers.data?.items ?? [])], true),
    [suppliers.data, suppliers.isError],
  );
  const staffChoices = useMemo<StaffChoice[]>(
    () => (members.isError ? [] : cleaningStaffOf(members.data?.items)).map((member) => ({ userId: member.userId, name: memberName(member) })),
    [members.data, members.isError],
  );

  const startEditing = (from: PropertyCleaningSetup) => {
    save.reset();
    setSaveError(null);
    setAttempted(false);
    setForm(cleaningFormOf(from, decimalSeparator));
  };

  const stopEditing = () => {
    save.reset();
    setSaveError(null);
    setForm(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || !setup || save.isPending) return;
    setAttempted(true);
    if (Object.keys(cleaningProblems(form)).length > 0) return;
    setSaveError(null);
    try {
      await save.mutateAsync(cleaningDtoOf(form, setup.currency));
      setForm(null);
      toast.success(t('propertyCleaning.saved'));
    } catch (error) {
      setSaveError(getProblemMessage(error, t) ?? t('propertyCleaning.saveError'));
    }
  };

  const problems = form && attempted ? cleaningProblems(form) : {};
  // What an empty time stands for: the check-out time of the property, or the default time of the server when the property has none (the server tells the time, not where it comes from).
  const timeSource = setup ? cleaningTimeSourceOf(setup, record.data?.checkOutBy, !record.isError && record.data !== undefined) : null;

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="property-cleaning-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('propertyCleaning.loading')}
      </p>
    );
  } else if (query.isError) {
    const status = getHttpStatus(query.error);
    body = (
      <Alert
        variant="danger"
        data-testid="property-cleaning-error"
        action={
          status === 404 || status === 403 ? undefined : (
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              {t('propertyCleaning.retry')}
            </Button>
          )
        }
      >
        {status === 404 ? t('propertyCleaning.notFound') : status === 403 ? t('propertyCleaning.forbidden') : t('propertyCleaning.loadError')}
      </Alert>
    );
  } else if (setup && form) {
    body = (
      <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate data-testid="property-cleaning-form">
        {saveError ? (
          <Alert variant="danger" data-testid="property-cleaning-save-error">
            {saveError}
          </Alert>
        ) : null}
        <PropertyCleaningFields
          idPrefix="property-cleaning"
          form={form}
          onChange={(patch) => setForm((current) => (current ? { ...current, ...patch } : current))}
          problems={problems}
          currency={setup.currency}
          suppliers={{
            state: suppliers.isError ? 'error' : suppliers.isPending && wantsSuppliers ? 'loading' : 'ready',
            choices: supplierChoices,
            storedName: setup.supplierName,
            onRetry: () => void suppliers.refetch(),
          }}
          staff={{
            state: !canListTeam ? 'unavailable' : members.isError ? 'error' : members.isPending ? 'loading' : 'ready',
            choices: staffChoices,
            onRetry: () => void members.refetch(),
          }}
          timeSource={timeSource}
          disabled={save.isPending}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={save.isPending} data-testid="property-cleaning-save">
            {t('propertyCleaning.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={stopEditing} disabled={save.isPending} data-testid="property-cleaning-cancel">
            {t('propertyCleaning.cancel')}
          </Button>
        </div>
      </form>
    );
  } else if (setup) {
    const price = setup.priceCents === null ? null : formatCleaningPrice(setup.priceCents, setup.currency, i18n.language);
    // The name of the person is said only from a read of the team that worked: after a failed read the card says «a member of the staff», never a name from the old answer.
    const staffName = setup.staffUserId && !members.isError ? members.data?.items.find((member) => member.userId === setup.staffUserId) : undefined;
    const startsAt = toClock(setup.effectiveStartTime);
    // The time of the setup as it is; when the setup leaves it empty, the time with where it comes from (said only when the card knows it).
    const startText =
      setup.startTime === null && timeSource
        ? t(timeSource.kind === 'property' ? 'propertyCleaning.summary.timeOfProperty' : 'propertyCleaning.summary.timeDefault', { time: startsAt })
        : startsAt;
    body = !setup.configured ? (
      <div className="space-y-3" data-testid="property-cleaning-none">
        <p className="text-sm">{t('propertyCleaning.none')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => startEditing(setup)} data-testid="property-cleaning-set">
          {t('propertyCleaning.set')}
        </Button>
      </div>
    ) : (
      <div className="space-y-3" data-testid="property-cleaning-summary">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-foreground/70">{t('propertyCleaning.summary.cleaner')}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2" data-testid="property-cleaning-cleaner">
            <span className="break-words">
              {setup.cleanerKind === 'Supplier'
                ? (setup.supplierName ?? t('propertyCleaning.summary.supplierUnknown'))
                : staffName
                  ? t('propertyCleaning.summary.staffNamed', { name: memberName(staffName) })
                  : t('propertyCleaning.summary.staffUnknown')}
            </span>
            {setup.cleanerKind === 'Supplier' && setup.supplierIsTrusted ? <Badge variant="secondary">{t('propertyCleaning.summary.trusted')}</Badge> : null}
          </dd>
          <dt className="text-foreground/70">{t('propertyCleaning.summary.price')}</dt>
          <dd className="min-w-0 break-words" data-testid="property-cleaning-price">
            {price ? (
              <>
                {price.text}
                {price.currencyKnown ? null : <span className="block text-foreground/70">{t('propertyCleaning.summary.noCurrency')}</span>}
              </>
            ) : (
              t('propertyCleaning.summary.noPrice')
            )}
          </dd>
          <dt className="text-foreground/70">{t('propertyCleaning.summary.time')}</dt>
          <dd data-testid="property-cleaning-time">{startText}</dd>
          <dt className="text-foreground/70">{t('propertyCleaning.summary.duration')}</dt>
          <dd>{t('propertyCleaning.summary.minutes', { count: setup.effectiveDurationMinutes })}</dd>
          <dt className="text-foreground/70">{t('propertyCleaning.summary.state')}</dt>
          <dd data-testid="property-cleaning-state">
            {setup.active ? <Badge variant="success">{t('propertyCleaning.state.on')}</Badge> : <span>{t('propertyCleaning.state.off')}</span>}
          </dd>
        </dl>
        <Button type="button" variant="outline" size="sm" onClick={() => startEditing(setup)} data-testid="property-cleaning-edit">
          {t('propertyCleaning.edit')}
        </Button>
      </div>
    );
  } else {
    body = null;
  }

  // The routine that makes the cleaning is said only from a read that worked: an error says nothing, and a stale list is not trusted either. An empty list is not «off»: the server answers it also
  // to who reaches only some of the properties, and such a person cannot see the routines at all, so the card says it cannot tell and sends to the automations.
  const routineState = routines.isError || routines.data === undefined ? undefined : cleaningRoutineStateOf(routines.data);
  // The routine acts only on a property that has an active setup (without one the action is blocked, `routine_cleaning_not_configured`): «it starts by itself» is told only then.
  const setupRuns = setup?.configured === true && setup.active;
  const routineText =
    routineState === 'on'
      ? setupRuns
        ? t('propertyCleaning.routine.on')
        : t('propertyCleaning.routine.onNoCleaner')
      : routineState === 'off'
        ? t('propertyCleaning.routine.off')
        : routineState === 'unknown'
          ? t('propertyCleaning.routine.unknown')
          : undefined;

  return (
    <PlainSection title={t('propertyCleaning.title')} data-testid="property-cleaning-card">
      <p className="text-sm text-muted-foreground">{t('propertyCleaning.description')}</p>
      {body}
      {setup && !editing && routineText !== undefined ? (
        <p className="text-sm text-foreground/70" data-testid="property-cleaning-routine">
          {routineText}{' '}
          <Link to={AUTOMATIONS_PATH} className="font-medium text-primary underline underline-offset-4">
            {t('propertyCleaning.routine.link')}
          </Link>
        </p>
      ) : null}
    </PlainSection>
  );
}
