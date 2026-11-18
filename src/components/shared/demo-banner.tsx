import { useTranslation } from 'react-i18next';
import { isDemoMode } from '@/config/demo.config';
import { Info } from 'lucide-react';
import { isGuidedDemo } from '@/lib/guided-demo/session';

export function DemoBanner() {
  const { t } = useTranslation();

  if (!isDemoMode) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-soft px-3 py-1.5 text-center text-sm font-medium text-warning-foreground">
      <Info aria-hidden="true" className="size-4 shrink-0" />
      <span>{t(isGuidedDemo() ? 'shared.demoBanner.guided' : 'shared.demoBanner.message')}</span>
    </div>
  );
}
