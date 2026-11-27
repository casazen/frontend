import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isFeatureEnabled } from '@/config/feature-flags';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { failureText } from '@/features/owner-accounting/owner-accounting-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { useDeclareExternalUnits, useOwnerUnitsCheck } from '@/queries/use-owner-tax-checks';
import type { OwnerUnitsCheck } from '@/types';

/** The most apartments an owner can declare outside the agency (the backend refuses more: 422 `owner_external_units_invalid`). */
const MAX_UNITS = 1000;

/**
 * The number typed, or `null` for anything that is not a whole number from 0 to 1000. An empty field is not a 0: the backend refuses a request without the number, and so does the form, so «none» is a thing the
 * person writes and never one they leave out.
 */
function unitsOf(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,4}$/.test(text)) return null;
  const units = Number(text);
  return units <= MAX_UNITS ? units : null;
}

function UnitsForm({ ownerId, check }: { ownerId: string; check: OwnerUnitsCheck }) {
  const { t, i18n } = useTranslation();
  const save = useDeclareExternalUnits(ownerId);
  const [value, setValue] = useState(String(check.externalUnits));
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second submit in between is stopped here.
  const sending = useRef(false);
  const units = unitsOf(value);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending || sending.current) return;
    if (units === null) {
      setError(t('ownerProfile.units.errors.units', { max: MAX_UNITS }));
      return;
    }
    sending.current = true;
    setError(null);
    setFailure(null);
    try {
      await save.mutateAsync(units);
      toast.success(t('ownerProfile.units.saved'));
    } catch (problem) {
      setFailure(failureText(problem, t, i18n.exists));
    } finally {
      sending.current = false;
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-3 sm:max-w-md" data-testid="owner-units-form">
      <Field label={t('ownerProfile.units.label')} hint={t('ownerProfile.units.hint')} error={error ?? undefined}>
        <Input inputMode="numeric" autoComplete="off" value={value} readOnly={save.isPending} onChange={(event) => setValue(event.target.value)} data-testid="owner-units-input" />
      </Field>
      {failure ? (
        <Alert variant="danger" data-testid="owner-units-error">
          {failure}
        </Alert>
      ) : null}
      <div>
        <Button type="submit" size="sm" variant="outline" loading={save.isPending} data-testid="owner-units-save">
          {t('ownerProfile.units.save')}
        </Button>
      </div>
    </form>
  );
}

interface OwnerTaxChecksSectionProps {
  ownerId: string;
  /** Who may write the finances of the owner (`agency.owner.financial.manage`): the others read the number and cannot change it. */
  canManage: boolean;
}

/**
 * «Affitti brevi fuori dall'agenzia» of an owner (E18/F01/US03/T01, NF-117, ⚖ I8): how many apartments the owner lets short outside the agency and the limit of a private person, counting the ones the agency manages
 * for it. Past the limit the owner is presumed to run a business: its stays get no withholding of the short lets, and the page says so in words, beside the numbers and not as a guess. It exists only behind the flag
 * `taxReportingExports` (the backend answers 404 without it), the number is saved only by who manages the owners' finances and is never a 0 by omission, and a refused read is told as such, never as «within the limit».
 */
export function OwnerTaxChecksSection({ ownerId, canManage }: OwnerTaxChecksSectionProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const enabled = isFeatureEnabled(flags, 'taxReportingExports');
  const check = useOwnerUnitsCheck(ownerId, enabled);
  if (!enabled) return null;

  let content;
  if (getHttpStatus(check.error) === 404) {
    // A 404 is «not found» whatever the cache still holds (a failed read keeps the old data).
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="owner-units-not-found">
        {t('ownerProfile.units.notFound')}
      </p>
    );
  } else if (check.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerProfile.units.loading')}
      </p>
    );
  } else if (check.isError) {
    content = <OwnerAccountingError error={check.error} title={t('ownerProfile.units.loadError')} onRetry={() => void check.refetch()} />;
  } else if (check.data === null) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="owner-units-not-for-you">
        {t('ownerProfile.units.notForYou')}
      </p>
    );
  } else {
    const data = check.data;
    content = (
      <div className="space-y-3">
        {data.applies ? (
          <>
            <p className="break-words text-sm" data-testid="owner-units-count">
              {t('ownerProfile.units.count', { managed: data.managedUnits, external: data.externalUnits, total: data.totalUnits, max: data.maxUnits })}
            </p>
            <p className="break-words text-sm font-medium" data-testid="owner-units-status" data-presumed={data.presumedBusiness}>
              {data.presumedBusiness ? t('ownerProfile.units.pastLimit', { max: data.maxUnits }) : t('ownerProfile.units.withinLimit', { max: data.maxUnits })}
            </p>
            {canManage ? <UnitsForm key={data.externalUnits} ownerId={ownerId} check={data} /> : <p className="break-words text-sm text-foreground/70">{t('ownerProfile.units.readOnly')}</p>}
          </>
        ) : (
          <p className="break-words text-sm text-foreground/70" data-testid="owner-units-not-applicable">
            {t('ownerProfile.units.notApplicable')}
          </p>
        )}
      </div>
    );
  }

  return (
    <PlainSection title={t('ownerProfile.units.title')} data-testid="owner-units-section">
      <p className="break-words text-sm text-foreground/70">{t('ownerProfile.units.description')}</p>
      {content}
    </PlainSection>
  );
}
