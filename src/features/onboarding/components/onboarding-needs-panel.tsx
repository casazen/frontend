import { useTranslation } from 'react-i18next';
import { ChevronDown, ClipboardList, FileText, Globe, KeyRound, Receipt, ShieldCheck, type LucideIcon } from 'lucide-react';
import { needKey } from '@/lib/onboarding-parts';
import type { OnboardingNeedCode } from '@/types/onboarding.types';

const NEED_ICONS: Record<OnboardingNeedCode, LucideIcon> = {
  alloggiatiCredentials: ShieldCheck,
  istatCredentials: FileText,
  fiscalData: Receipt,
  otaAccess: Globe,
  lockCode: KeyRound,
};

export function OnboardingNeedsPanel({ needs }: { needs: readonly OnboardingNeedCode[] }) {
  const { t } = useTranslation();
  if (needs.length === 0) return null;
  return (
    <details className="group min-w-0 rounded-xl border bg-card" data-testid="onboarding-needs">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <ClipboardList className="size-5 shrink-0 text-foreground/70" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-semibold">{t('onboardingPlan.workspace.prepare')}</span>
        <ChevronDown className="size-4 shrink-0 text-foreground/70 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul role="list" className="space-y-3 border-t px-4 py-4">
        {needs.map(code => {
          const Icon = NEED_ICONS[code];
          return <li key={code} className="flex items-start gap-2.5 text-sm" data-testid={`onboarding-need-${code}`}>
            <Icon className="mt-0.5 size-4 shrink-0 text-foreground/65" aria-hidden="true" />
            <span>{t(needKey(code))}</span>
          </li>;
        })}
      </ul>
    </details>
  );
}
