import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFiscalTaxProfile, useUpdateFiscalTaxProfile } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { getProblemMessage } from '@/lib/api-errors';
import type { FiscalTaxProfile } from '@/api/fiscal.api';
import { compactIdentifier, FISCAL_CODE, PARTITA_IVA, taxProfileChanges } from '@/features/fiscal/tax-profile-changes';

export function FiscalWizardPage() {
  const { t } = useTranslation();
  const profile = useFiscalTaxProfile();

  return (
    <AppShell>
      <div className="space-y-6 max-w-xl mx-auto" data-testid="fiscal-wizard-page">
        <PageHeader title={t('fiscal.wizard.title')} description={t('fiscal.wizard.description')} />
        <FiscalDisclaimer />
        {profile.isLoading && <p data-testid="fiscal-wizard-loading">{t('fiscal.loading')}</p>}
        {profile.isError && (
          <Card>
            <CardContent className="space-y-3 py-8 text-center" data-testid="fiscal-wizard-error">
              <p className="text-destructive">{getProblemMessage(profile.error, t) ?? t('fiscal.wizard.loadError')}</p>
              <Button variant="outline" size="sm" disabled={profile.isFetching} onClick={() => void profile.refetch()}>
                {t('fiscal.retry')}
              </Button>
            </CardContent>
          </Card>
        )}
        {profile.data && <TaxProfileForm saved={profile.data} />}
      </div>
    </AppShell>
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
    <form className="space-y-4" onSubmit={onSubmit} noValidate data-testid="fiscal-wizard-form">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="fiscal-has-piva"
          checked={hasPartitaIva}
          onChange={(ev) => setHasPartitaIva(ev.target.checked)}
        />
        {t('fiscal.wizard.hasPiva')}
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
            onChange={(ev) => setPartitaIvaNumber(ev.target.value)}
          />
          {submitted && pivaError && (
            <p className="text-sm text-destructive" data-testid="fiscal-piva-error">
              {pivaError}
            </p>
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
          onChange={(ev) => setFiscalCode(ev.target.value)}
        />
        {submitted && cfError && (
          <p className="text-sm text-destructive" data-testid="fiscal-cf-error">
            {cfError}
          </p>
        )}
      </div>
      {!hasChanges && (
        <p className="text-sm text-muted-foreground" data-testid="fiscal-wizard-no-changes">
          {t('fiscal.wizard.noChanges')}
        </p>
      )}
      <Button type="submit" data-testid="fiscal-wizard-save" disabled={update.isPending || !hasChanges}>
        {t('fiscal.wizard.save')}
      </Button>
    </form>
  );
}
