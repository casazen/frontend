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
import { parseActions } from '@/lib/routine-model';
import { useRoutines } from '@/queries/routines';
import { useSavePropertyCleaningSetup, usePropertyCleaningSetup } from '@/queries/property-cleaning';
import { useOrgMembers } from '@/queries/use-org-team';
import { useSuppliersByProperty } from '@/queries/use-service-requests';
import type { PropertyCleaningSetup } from '@/types';
import {
  CLEANING_CATEGORY,
  cleaningDtoOf,
  cleaningFormOf,
  cleaningProblems,
  cleaningStaffOf,
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
  const [form, setForm] = useState<CleaningForm | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A read that failed keeps the old answer in the query: the card never shows it as if it were current.
  const setup = query.isError ? undefined : query.data;
  const editing = form !== null;

  const wantsSuppliers = editing && form.kind === 'Supplier';
  const suppliers = useSuppliersByProperty(wantsSuppliers ? propertyId : undefined, CLEANING_CATEGORY);
  const wantsTeam = canListTeam && ((editing && form.kind === 'Staff') || setup?.cleanerKind === 'Staff');
  const members = useOrgMembers(wantsTeam);
  // Whether the routine is on: said only from a read that worked.
  const routines = useRoutines();

  const supplierChoices = useMemo(
    () => supplierChoicesOf([{ size: 1, suppliers: suppliers.isError ? [] : (suppliers.data?.items ?? []) }], true),
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
  // What an empty time stands for: the check-out time of the property, which the server tells as the time a cleaning starts while the setup holds none.
  const checkOut = setup && setup.startTime === null ? toClock(setup.effectiveStartTime) || null : null;

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
          checkOutTime={checkOut}
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
    const staffName = setup.staffUserId ? members.data?.items.find((member) => member.userId === setup.staffUserId) : undefined;
    const startsAt = toClock(setup.effectiveStartTime);
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
          <dd data-testid="property-cleaning-time">
            {setup.startTime === null ? t('propertyCleaning.summary.timeOfProperty', { time: startsAt }) : startsAt}
          </dd>
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

  // The routine that makes the cleaning is said only from a read that worked: an error says nothing, and a stale list is not trusted either.
  const routineOn = routines.isError || routines.data === undefined
    ? undefined
    : routines.data.some((routine) => routine.active && !routine.testMode && parseActions(routine.actionsJson).some((action) => action.type === 'CreateCleaningRequest'));

  return (
    <PlainSection title={t('propertyCleaning.title')} data-testid="property-cleaning-card">
      <p className="text-sm text-muted-foreground">{t('propertyCleaning.description')}</p>
      {body}
      {setup && !editing && routineOn !== undefined ? (
        <p className="text-sm text-foreground/70" data-testid="property-cleaning-routine">
          {routineOn ? t('propertyCleaning.routine.on') : t('propertyCleaning.routine.off')}{' '}
          <Link to={AUTOMATIONS_PATH} className="font-medium text-primary underline underline-offset-4">
            {t('propertyCleaning.routine.link')}
          </Link>
        </p>
      ) : null}
    </PlainSection>
  );
}
