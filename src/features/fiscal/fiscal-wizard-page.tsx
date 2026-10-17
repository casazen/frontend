import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useFiscalTaxProfile, useUpdateFiscalTaxProfile } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import type { FiscalTaxProfile } from '@/api/fiscal.api';
import { compactIdentifier, FISCAL_CODE, PARTITA_IVA, taxProfileChanges } from '@/features/fiscal/tax-profile-changes';

/**
 * The tax profile of the organization: whether it has a partita IVA and its number, and the codice fiscale. One short form,
 * prefilled from what is saved; only what the host changed is sent.
 */
export function FiscalWizardPage() {
  const { t } = useTranslation();
  const profile = useFiscalTaxProfile();

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6 md:space-y-8')} data-testid="fiscal-wizard-page">
        <PageHeader title={t('fiscal.wizard.title')} description={t('fiscal.wizard.description')} crumbs="auto" />
        {profile.isError && !profile.data ? (
          // A failed load is never shown as an empty form.
          <ErrorState
            title={t('fiscal.wizard.loadError')}
            error={profile.error}
            onRetry={() => void profile.refetch()}
            testId="fiscal-wizard-error"
          />
        ) : profile.isLoading ? (
          <div data-testid="fiscal-wizard-loading">
            <SkeletonLine lines={3} lineClassName="h-10" label={t('fiscal.loading')} />
          </div>
        ) : profile.data ? (
          <TaxProfileForm saved={profile.data} />
        ) : null}
        <FiscalDisclaimer />
      </div>
    </AppShell>
  );
}

/** The reason a field is not valid, with an icon: it is told by the words and the icon, not by the color alone. */
function FieldProblem({ id, testId, children }: { id: string; testId: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" data-testid={testId} className="flex items-start gap-1.5 break-words text-sm text-danger-foreground">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function TaxProfileForm({ saved }: { saved: FiscalTaxProfile }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const update = useUpdateFiscalTaxProfile();
  // Prefilled from the saved profile: the form is mounted only once the profile is loaded.
  const [hasPartitaIva, setHasPartitaIva] = useState(saved.hasPartitaIva);
  const [partitaIvaNumber, setPartitaIvaNumber] = useState(saved.partitaIvaNumber ?? '');
  const [fiscalCode, setFiscalCode] = useState(saved.fiscalCode ?? '');
  const [submitted, setSubmitted] = useState(false);

  const changes = taxProfileChanges(saved, { hasPartitaIva, partitaIvaNumber, fiscalCode });
  const hasChanges = Object.keys(changes).length > 0;
  const pivaError =
    hasPartitaIva && !PARTITA_IVA.test(compactIdentifier(partitaIvaNumber)) ? t('fiscal.wizard.pivaInvalid') : undefined;
  const cf = compactIdentifier(fiscalCode).toUpperCase();
  const cfError = cf.length > 0 && !FISCAL_CODE.test(cf) ? t('fiscal.wizard.cfInvalid') : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (pivaError || cfError || !hasChanges) return;
    update.mutate(changes, {
      onSuccess: () => {
        toast.success(t('fiscal.wizard.saved'));
        navigate('/app/short-rent/fiscal');
      },
      onError: (err) => toast.error(getProblemMessage(err, t) ?? t('fiscal.wizard.saveFailed')),
    });
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate data-testid="fiscal-wizard-form">
      <div className="space-y-5">
        <label className="flex min-h-11 w-fit max-w-full cursor-pointer items-center gap-3 text-sm font-medium">
          <Checkbox
            data-testid="fiscal-has-piva"
            checked={hasPartitaIva}
            onCheckedChange={(value) => setHasPartitaIva(value === true)}
          />
          <span className="min-w-0 break-words">{t('fiscal.wizard.hasPiva')}</span>
        </label>
        {hasPartitaIva && (
          <div className="space-y-2">
            <Label htmlFor="piva">{t('fiscal.wizard.piva')}</Label>
            <Input
              id="piva"
              data-testid="fiscal-piva-input"
              inputMode="numeric"
              maxLength={13}
              value={partitaIvaNumber}
              aria-invalid={submitted && !!pivaError}
              aria-describedby={submitted && pivaError ? 'piva-error' : undefined}
              onChange={(ev) => setPartitaIvaNumber(ev.target.value)}
            />
            {submitted && pivaError && (
              <FieldProblem id="piva-error" testId="fiscal-piva-error">
                {pivaError}
              </FieldProblem>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="cf">{t('fiscal.wizard.cf')}</Label>
          <Input
            id="cf"
            data-testid="fiscal-cf-input"
            maxLength={20}
            value={fiscalCode}
            aria-invalid={submitted && !!cfError}
            aria-describedby={submitted && cfError ? 'cf-error' : undefined}
            onChange={(ev) => setFiscalCode(ev.target.value)}
          />
          {submitted && cfError && (
            <FieldProblem id="cf-error" testId="fiscal-cf-error">
              {cfError}
            </FieldProblem>
          )}
        </div>
      </div>
      {!hasChanges && (
        <p className="text-sm text-foreground/70" data-testid="fiscal-wizard-no-changes">
          {t('fiscal.wizard.noChanges')}
        </p>
      )}
      <Button
        type="submit"
        data-testid="fiscal-wizard-save"
        className="w-full sm:w-auto"
        loading={update.isPending}
        disabled={!hasChanges}
      >
        {t('fiscal.wizard.save')}
      </Button>
    </form>
  );
}
