import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ExtraEUWarningBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p className="font-semibold">{t('leases.rli.extraEuTitle')}</p>
        <p className="text-sm">{t('leases.rli.extraEuBody')}</p>
      </div>
    </div>
  );
}
