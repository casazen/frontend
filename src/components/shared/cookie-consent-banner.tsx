import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'casazen_cookie_consent';

type ConsentChoice = 'accepted' | 'rejected';

function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

/**
 * "Rifiuta" and "Accetta" are the very same button, one next to the other: refusing is as easy and as visible as
 * accepting (same variant, same size, same look; only the label tells them apart).
 */
const CHOICE_CLASS = 'public-site-outline h-11 w-full px-3';

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const textId = useId();

  // Initialise directly from localStorage — avoids the setState-in-effect pattern
  const [visible, setVisible] = useState(() => readConsent() === null);

  if (!visible) return null;

  const persist = (choice: ConsentChoice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
  };

  return (
    // Above the fixed bar of the property page (z-40), below the sheets and the dialogs (z-50): the only place that says it.
    <div
      role="dialog"
      aria-label={t('shared.cookieConsent.ariaLabel')}
      aria-describedby={textId}
      className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[45] rounded-[var(--cz-public-radius,0.75rem)] bg-background p-4 shadow-[var(--cz-public-shadow-widget)] ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[26rem] sm:p-5"
      data-testid="cookie-consent-banner"
    >
      <p className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--cz-public-primary-text,var(--color-primary))]" aria-hidden />
        {t('shared.cookieConsent.title')}
      </p>
      <p id={textId} className="mt-2 text-sm text-muted-foreground">
        {t('shared.cookieConsent.text')}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className={CHOICE_CLASS} onClick={() => persist('rejected')}>
          {t('shared.cookieConsent.reject')}
        </Button>
        <Button type="button" variant="outline" className={CHOICE_CLASS} onClick={() => persist('accepted')}>
          {t('shared.cookieConsent.accept')}
        </Button>
      </div>
    </div>
  );
}
