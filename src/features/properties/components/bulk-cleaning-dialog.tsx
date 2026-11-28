import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { useCleaningSuppliers, usePropertyCleaningSetups, useSaveBulkCleaningSetup } from '@/queries/property-cleaning';
import { useProperties } from '@/queries/use-properties';
import { useOrgMembers } from '@/queries/use-org-team';
import type { CleaningSetupBulkResponse, Property } from '@/types';
import {
  MAX_BULK_PROPERTIES,
  SUPPLIER_CURRENCY,
  bulkOutcomeOf,
  cleaningDtoOf,
  cleaningProblems,
  cleaningPropertiesOf,
  cleaningReadOf,
  cleaningStaffOf,
  emptyCleaningForm,
  memberName,
  supplierChoicesOf,
  type CleaningForm,
  type CleaningRead,
} from '../lib/property-cleaning-model';
import { AUTOMATIONS_PATH } from '../properties-paths';
import { PropertyCleaningFields, type StaffChoice } from './property-cleaning-fields';

interface BulkCleaningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineLink?: boolean;
}

/** The save of the dialog: kept above its content, so that the layer knows whether it is on its way (see `BulkCleaningDialog`). */
type BulkSave = ReturnType<typeof useSaveBulkCleaningSetup>;

/**
 * «Chi pulisce, per più immobili» (E24/F01/US02/T01): the same cleaner, price and time for many properties of Affitti brevi at once, as a layer over the page it was opened from. The properties are the ones
 * of the list; the dialog takes one currency at a time (the price is in the currency of the property, which the setup of each property says: the list does not, and the suppliers work in euro). The
 * answer is one line for each property: the ones that were saved and, with the reason, the ones that were not: never «all saved» while one was not.
 */
export function BulkCleaningDialog({ open, onOpenChange, routineLink = true }: BulkCleaningDialogProps) {
  const { t } = useTranslation();
  // The save is kept here, above the content that comes and goes with the layer: while it is on its way the layer does not close (Esc, the X, the grip of a phone and a click outside all come
  // through `onOpenChange`), because what the person has to read is what was done for each property, and a layer that closed would lose it. Closed, nothing of the request is kept.
  const save = useSaveBulkCleaningSetup();
  const handleOpenChange = (next: boolean) => {
    if (!next && save.isPending) return;
    if (!next) save.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="bulk-cleaning-dialog">
        <DialogHeader>
          <DialogTitle>{t('propertyCleaning.bulk.title')}</DialogTitle>
          <DialogDescription>{t('propertyCleaning.bulk.description')}</DialogDescription>
        </DialogHeader>
        <BulkCleaningBody save={save} onClose={() => handleOpenChange(false)} routineLink={routineLink} />
      </DialogContent>
    </Dialog>
  );
}

function BulkCleaningBody({ save, onClose, routineLink }: { save: BulkSave; onClose: () => void; routineLink: boolean }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canListTeam = hasPermission('account', 'org.members.manage');

  const list = useProperties({ mode: 'short' }, { fresh: true });
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<CleaningForm>(() => emptyCleaningForm(SUPPLIER_CURRENCY));
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleaningSetupBulkResponse | null>(null);

  const properties = useMemo(() => cleaningPropertiesOf(list.isError ? undefined : list.data), [list.data, list.isError]);
  const byId = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties]);
  const chosen = useMemo(() => selected.flatMap((id) => byId.get(id) ?? []), [selected, byId]);

  const reads = usePropertyCleaningSetups(properties.map((property) => property.id));
  const readsById = new Map<string, CleaningRead>(properties.map((property, index) => [property.id, cleaningReadOf({ isError: reads[index].isError, data: reads[index].data })]));
  const readOf = (propertyId: string): CleaningRead => readsById.get(propertyId) ?? { state: 'unread' };

  const chosenReads = chosen.map((property) => readOf(property.id));
  const chosenUnread = chosenReads.some((read) => read.state === 'unread');
  const first = chosenReads[0];
  const lockCurrency = first?.state === 'known' ? first.currency : null;
  const ready = chosenReads.length > 0 && chosenReads.every((read) => read.state === 'known');
  const currency = ready ? lockCurrency : null;
  const form: CleaningForm = currency !== null && currency !== SUPPLIER_CURRENCY && draft.kind === 'Supplier' ? { ...draft, kind: 'Staff' } : draft;

  const supplierReads = useCleaningSuppliers(
    chosen.map((property) => property.id),
    form.kind === 'Supplier' && ready,
  );
  // A list that failed to be read again is not used, as for one property: the old suppliers are never offered as if they were still there (the warning says they are not read).
  const supplierChoices = supplierChoicesOf(
    supplierReads.map((read) => read.isError ? [] : (read.data?.items ?? [])),
    false,
  );
  const members = useOrgMembers(canListTeam, { fresh: true });
  const staffChoices = useMemo<StaffChoice[]>(
    () => (members.isError ? [] : cleaningStaffOf(members.data?.items)).map((member) => ({ userId: member.userId, name: memberName(member) })),
    [members.data, members.isError],
  );

  const toggle = (property: Property, checked: boolean) => {
    setSelected((current) => {
      if (!checked) return current.filter((id) => id !== property.id);
      return current.includes(property.id) || current.length >= MAX_BULK_PROPERTIES ? current : [...current, property.id];
    });
  };

  const reading = properties.some((property) => readOf(property.id).state === 'reading');
  const unreadCount = properties.filter((property) => readOf(property.id).state === 'unread').length;
  const firstKnown = properties.map((property) => readOf(property.id)).find((read) => read.state === 'known');
  const lockedCurrency = lockCurrency ?? (firstKnown?.state === 'known' ? firstKnown.currency : null);
  const selectable =
    lockedCurrency === null
      ? []
      : properties
          .filter((property) => {
            const read = readOf(property.id);
            return read.state === 'known' && read.currency === lockedCurrency;
          })
          .slice(0, MAX_BULK_PROPERTIES);
  const allSelected = selectable.length > 0 && selectable.every((property) => selected.includes(property.id));

  const existing = chosen.filter((property) => {
    const read = readOf(property.id);
    return read.state === 'known' && read.configured;
  });

  const runSave = async () => {
    if (save.isPending || currency === null) return;
    setError(null);
    try {
      setResult(await save.mutateAsync({ ...cleaningDtoOf(form, currency), propertyIds: chosen.map((property) => property.id) }));
    } catch (failure) {
      setError(getProblemMessage(failure, t) ?? t('propertyCleaning.bulk.saveError'));
    } finally {
      setConfirming(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending || currency === null) return;
    setAttempted(true);
    if (Object.keys(cleaningProblems(form)).length > 0) return;
    if (existing.length > 0) {
      setConfirming(true);
      return;
    }
    void runSave();
  };

  if (result) {
    const outcome = bulkOutcomeOf(result);
    const nameOf = (propertyId: string) => byId.get(propertyId)?.name ?? t('propertyCleaning.bulk.unknownProperty');
    return (
      <div className="space-y-4" data-testid="bulk-cleaning-result">
        {outcome.failed.length === 0 ? (
          <Alert variant="success" data-testid="bulk-cleaning-all-saved">
            {t('propertyCleaning.bulk.allSaved', { count: outcome.saved.length })}
          </Alert>
        ) : (
          <Alert variant="warning" data-testid="bulk-cleaning-some-failed">
            {t('propertyCleaning.bulk.someFailed', { saved: outcome.saved.length, failed: outcome.failed.length })}
          </Alert>
        )}
        <ul className="divide-y rounded-md border text-sm" aria-label={t('propertyCleaning.bulk.resultList')}>
          {result.results.map((line) => (
            <li key={line.propertyId} className="flex items-start gap-2 px-3 py-2" data-testid={`bulk-cleaning-line-${line.propertyId}`}>
              {line.saved ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[color:var(--color-success-foreground,#166534)]" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[color:var(--color-warning-foreground,#8a4b05)]" />}
              <div className="min-w-0">
                <p className="break-words font-medium">{nameOf(line.propertyId)}</p>
                <p className="break-words text-foreground/70">
                  {line.saved ? t('propertyCleaning.bulk.lineSaved') : (translateErrorCode(line.code, t) ?? line.message ?? t('propertyCleaning.bulk.lineNotSaved'))}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {outcome.saved.length > 0 && routineLink ? (
          <p className="text-sm text-foreground/70">
            {t('propertyCleaning.bulk.routineHint')}{' '}
            <Link to={AUTOMATIONS_PATH} onClick={onClose} className="font-medium text-primary underline underline-offset-4" data-testid="bulk-cleaning-routine-link">
              {t('propertyCleaning.routine.link')}
            </Link>
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          {outcome.failed.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelected(outcome.failed.map((line) => line.propertyId));
                setResult(null);
                setAttempted(false);
                save.reset();
              }}
              data-testid="bulk-cleaning-retry-failed"
            >
              {t('propertyCleaning.bulk.retryFailed')}
            </Button>
          ) : null}
          <Button type="button" onClick={onClose} data-testid="bulk-cleaning-close">
            {t('propertyCleaning.bulk.close')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-4" data-testid="bulk-cleaning-confirm">
        <Alert variant="warning">{t('propertyCleaning.bulk.replaceWarning', { count: existing.length })}</Alert>
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm" aria-label={t('propertyCleaning.bulk.replaceList')} data-testid="bulk-cleaning-confirm-list">
          {existing.map((property) => (
            <li key={property.id} className="break-words px-3 py-2 font-medium">
              {property.name}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={save.isPending} data-testid="bulk-cleaning-replace-back">
            {t('propertyCleaning.bulk.replaceBack')}
          </Button>
          <Button type="button" loading={save.isPending} disabled={!ready} onClick={() => void runSave()} data-testid="bulk-cleaning-replace-confirm">
            {t('propertyCleaning.bulk.replaceConfirm')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  let chooser: React.ReactNode;
  if (list.isPending) {
    chooser = (
      <div className="space-y-2" role="status" data-testid="bulk-cleaning-loading">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <span className="sr-only">{t('propertyCleaning.bulk.loading')}</span>
      </div>
    );
  } else if (list.isError) {
    chooser = (
      <Alert
        variant="danger"
        data-testid="bulk-cleaning-list-error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>
            {t('propertyCleaning.retry')}
          </Button>
        }
      >
        {t('propertyCleaning.bulk.listError')}
      </Alert>
    );
  } else if (properties.length === 0) {
    chooser = <p className="text-sm text-foreground/70" data-testid="bulk-cleaning-empty">{t('propertyCleaning.bulk.noProperties')}</p>;
  } else {
    chooser = (
      <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
        <legend className="sr-only">{t('propertyCleaning.bulk.properties')}</legend>
        <div className="mb-1 flex w-full items-center justify-between gap-2">
          <span className="text-sm font-medium" aria-hidden="true">
            {t('propertyCleaning.bulk.properties')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={save.isPending || (!allSelected && (reading || selectable.length === 0))}
            onClick={() => setSelected(allSelected ? [] : selectable.map((property) => property.id))}
            data-testid="bulk-cleaning-select-all"
          >
            {allSelected ? t('propertyCleaning.bulk.selectNone') : t('propertyCleaning.bulk.selectAll')}
          </Button>
        </div>
        {unreadCount > 0 ? (
          <Alert
            variant="warning"
            data-testid="bulk-cleaning-currency-unread"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  reads.forEach((read) => {
                    if (read.isError) void read.refetch();
                  })
                }
              >
                {t('propertyCleaning.retry')}
              </Button>
            }
          >
            {t('propertyCleaning.bulk.currencyUnreadAlert', { count: unreadCount })}
          </Alert>
        ) : null}
        <ul className="max-h-56 divide-y overflow-y-auto rounded-md border" data-testid="bulk-cleaning-properties">
          {properties.map((property) => {
            const read = readOf(property.id);
            const otherCurrency = lockCurrency !== null && read.state === 'known' && read.currency !== lockCurrency;
            const checked = selected.includes(property.id);
            const id = `bulk-cleaning-${property.id}`;
            const note =
              read.state === 'reading'
                ? t('propertyCleaning.bulk.currencyReading')
                : read.state === 'unread'
                  ? t('propertyCleaning.bulk.currencyUnread')
                  : otherCurrency
                    ? t('propertyCleaning.bulk.otherCurrency', { currency: read.currency })
                    : null;
            return (
              <li key={property.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  id={id}
                  checked={checked}
                  disabled={save.isPending || (!checked && (read.state !== 'known' || otherCurrency))}
                  onCheckedChange={(value) => toggle(property, value === true)}
                  data-testid={`bulk-cleaning-property-${property.id}`}
                />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm">
                  <span className="block break-words font-medium">{property.name}</span>
                  <span className="block break-words text-foreground/70">{[property.city, note].filter(Boolean).join(' · ')}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-foreground/70" aria-live="polite" data-testid="bulk-cleaning-count">
          {t('propertyCleaning.bulk.selected', { count: chosen.length })}
          {chosen.length >= MAX_BULK_PROPERTIES ? ` ${t('propertyCleaning.bulk.limit', { max: MAX_BULK_PROPERTIES })}` : ''}
        </p>
      </fieldset>
    );
  }

  const problems = attempted ? cleaningProblems(form) : {};
  const suppliersFailed = form.kind === 'Supplier' && supplierReads.some((read) => read.isError);
  const suppliersLoading = form.kind === 'Supplier' && supplierReads.some((read) => read.isPending);

  return (
    <form className="space-y-5" onSubmit={submit} noValidate data-testid="bulk-cleaning-form">
      {chooser}

      {currency !== null ? (
        <PropertyCleaningFields
          idPrefix="bulk-cleaning"
          form={form}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          problems={problems}
          currency={currency}
          suppliers={{
            state: suppliersFailed ? 'error' : suppliersLoading ? 'loading' : 'ready',
            choices: supplierChoices,
            storedName: null,
            onRetry: () => supplierReads.forEach((read) => void read.refetch()),
          }}
          staff={{
            state: !canListTeam ? 'unavailable' : members.isError ? 'error' : members.isPending ? 'loading' : 'ready',
            choices: staffChoices,
            onRetry: () => void members.refetch(),
          }}
          timeSource={null}
          disabled={save.isPending}
        />
      ) : chosen.length > 0 ? (
        <p className="text-sm text-foreground/70" role={chosenUnread ? undefined : 'status'} data-testid="bulk-cleaning-currency-state">
          {chosenUnread ? t('propertyCleaning.bulk.currencyBlocked') : t('propertyCleaning.bulk.currencyWaiting')}
        </p>
      ) : list.isSuccess && properties.length > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="bulk-cleaning-choose-first">
          {t('propertyCleaning.bulk.chooseFirst')}
        </p>
      ) : null}

      {error ? (
        <Alert variant="danger" data-testid="bulk-cleaning-error">
          {error}
        </Alert>
      ) : null}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending} data-testid="bulk-cleaning-cancel">
          {t('propertyCleaning.cancel')}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!ready} data-testid="bulk-cleaning-save">
          {chosen.length === 0 ? t('propertyCleaning.save') : t('propertyCleaning.bulk.save', { count: chosen.length })}
        </Button>
      </DialogFooter>
    </form>
  );
}
