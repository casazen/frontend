import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SettingsWizard } from './settings-wizard';

export function MarketingSetupEntry() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="order-6 rounded-xl border bg-card p-4 lg:col-span-2">
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t('marketingStudio.settings')}
      </Button>
      <SettingsWizard open={open} onOpenChange={setOpen} />
    </section>
  );
}
