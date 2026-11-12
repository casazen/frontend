import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Globe, KeyRound, Receipt, ShieldCheck, type LucideIcon } from 'lucide-react';
import { needKey } from '@/lib/onboarding-parts';
import type { OnboardingNeedCode } from '@/types/onboarding.types';

/** A small picture for each thing, decorative: the words carry the meaning. */
const NEED_ICONS: Record<OnboardingNeedCode, LucideIcon> = {
  alloggiatiCredentials: ShieldCheck,
  istatCredentials: FileText,
  fiscalData: Receipt,
  otaAccess: Globe,
  lockCode: KeyRound,
};

interface OnboardingNeedsPanelProps {
  /** The codes of «What you need» the plan sends, already reduced to the ones this version has a text for (`knownNeeds`). */
  needs: readonly OnboardingNeedCode[];
}

/**
 * «Cosa ti serve» (NF-104, ONB-01): what the host should have at hand before starting, told once at the top of the plan: the Alloggiati Web
 * credentials with the web service key, the ISTAT credentials of the region, the fiscal data, the access to the OTA accounts and the code of
 * the lock. A plain block, with no tint: the one highlighted block of the page is the part to do now.
 */
export function OnboardingNeedsPanel({ needs }: OnboardingNeedsPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();

  if (needs.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-lg border p-4" data-testid="onboarding-needs">
      <h2 id={titleId} className="text-base font-semibold">
        {t('onboardingPlan.needsPanel.title')}
      </h2>
      <p className="mt-1 text-sm text-foreground/70">{t('onboardingPlan.needsPanel.intro')}</p>
      <ul role="list" className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {needs.map((code) => {
          const Icon = NEED_ICONS[code];
          return (
            <li key={code} className="flex min-w-0 items-start gap-2 text-sm" data-testid={`onboarding-need-${code}`}>
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground/70" />
              <span className="min-w-0 break-words">{t(needKey(code))}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
