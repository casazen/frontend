import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFiscalRegime, useUpdateFiscalTaxProfile } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';

const TAX_YEAR = new Date().getUTCFullYear() < 2026 ? 2026 : new Date().getUTCFullYear();

export function FiscalWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useFiscalRegime(TAX_YEAR);
  const update = useUpdateFiscalTaxProfile();
  const [hasPartitaIva, setHasPartitaIva] = useState(true);
  const [partitaIvaNumber, setPartitaIvaNumber] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');

  return (
    <AppShell>
      <div className="space-y-6 max-w-xl mx-auto" data-testid="fiscal-wizard-page">
        <PageHeader title={t('fiscal.wizard.title')} description={t('fiscal.wizard.description')} />
        {data && <FiscalDisclaimer text={data.disclaimer} />}
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await update.mutateAsync({
              hasPartitaIva,
              partitaIvaNumber: hasPartitaIva ? partitaIvaNumber : null,
              fiscalCode: fiscalCode || null,
            });
            navigate('/app/short-rent/fiscal');
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
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
                maxLength={11}
                value={partitaIvaNumber}
                onChange={(ev) => setPartitaIvaNumber(ev.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cf">{t('fiscal.wizard.cf')}</Label>
            <Input
              id="cf"
              data-testid="fiscal-cf-input"
              maxLength={16}
              value={fiscalCode}
              onChange={(ev) => setFiscalCode(ev.target.value)}
            />
          </div>
          <Button type="submit" disabled={update.isPending}>
            {t('fiscal.wizard.save')}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
