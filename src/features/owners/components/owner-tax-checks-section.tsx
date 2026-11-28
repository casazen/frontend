import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Building2, CheckCircle2, ExternalLink, Info, Lock, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { isFeatureEnabled } from '@/config/feature-flags';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { failureText } from '@/features/owner-accounting/owner-accounting-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { useDeclareExternalUnits, useOwnerUnitsCheck } from '@/queries/use-owner-tax-checks';
import type { OwnerUnitsCheck } from '@/types';
import { Metric, MetricRow, OwnerCard, QuietNote, StateChip } from './owner-ui';

const MAX_UNITS = 1000;

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
  canManage: boolean;
}

export function OwnerTaxChecksSection({ ownerId, canManage }: OwnerTaxChecksSectionProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const enabled = isFeatureEnabled(flags, 'taxReportingExports');
  const check = useOwnerUnitsCheck(ownerId, enabled);
  if (!enabled) return null;

  let content;
  let chip: ReactNode = null;
  if (getHttpStatus(check.error) === 404) {
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
      <QuietNote icon={Lock} data-testid="owner-units-not-for-you">
        {t('ownerProfile.units.notForYou')}
      </QuietNote>
    );
  } else {
    const data = check.data;
    if (data.applies) {
      chip = data.presumedBusiness ? <StateChip tone="warning">{t('ownerProfile.units.chip.past')}</StateChip> : <StateChip tone="success">{t('ownerProfile.units.chip.within')}</StateChip>;
    }
    content = data.applies ? (
      <>
        <MetricRow columns={3} data-testid="owner-units-count">
          <Metric icon={Building2} label={t('ownerProfile.units.managed')} value={data.managedUnits} testId="owner-units-managed" />
          <Metric icon={ExternalLink} label={t('ownerProfile.units.external')} value={data.externalUnits} testId="owner-units-external" />
          <Metric icon={Scale} label={t('ownerProfile.units.total')} value={data.totalUnits} detail={t('ownerProfile.units.limit', { max: data.maxUnits })} testId="owner-units-total" />
        </MetricRow>
        {data.presumedBusiness ? (
          <Alert variant="warning" data-testid="owner-units-status" data-presumed="true">
            {t('ownerProfile.units.pastLimit', { max: data.maxUnits })}
          </Alert>
        ) : (
          <QuietNote icon={CheckCircle2} data-testid="owner-units-status" data-presumed="false">
            {t('ownerProfile.units.withinLimit', { max: data.maxUnits })}
          </QuietNote>
        )}
        {canManage ? (
          <UnitsForm key={data.externalUnits} ownerId={ownerId} check={data} />
        ) : (
          <QuietNote icon={Lock}>{t('ownerProfile.units.readOnly')}</QuietNote>
        )}
      </>
    ) : (
      <QuietNote icon={Info} data-testid="owner-units-not-applicable">
        {t('ownerProfile.units.notApplicable')}
      </QuietNote>
    );
  }

  return (
    <OwnerCard
      icon={Building2}
      title={t('ownerProfile.units.title')}
      chip={chip}
      help={<HelpTip title={t('ownerProfile.units.title')}>{t('ownerProfile.units.description')}</HelpTip>}
      data-testid="owner-units-section"
    >
      {content}
    </OwnerCard>
  );
}
