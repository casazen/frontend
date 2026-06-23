import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'casazen_cookie_consent';

type ConsentChoice = 'accepted' | 'rejected';

function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

export function CookieConsentBanner() {
  const { t } = useTranslation();

  // Initialise directly from localStorage — avoids the setState-in-effect pattern
  const [visible, setVisible] = useState(() => readConsent() === null);

  if (!visible) return null;

  const persist = (choice: ConsentChoice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label={t('shared.cookieConsent.ariaLabel')}
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur p-4 shadow-lg"
      data-testid="cookie-consent-banner"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('shared.cookieConsent.text')}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => persist('rejected')}>
            {t('shared.cookieConsent.reject')}
          </Button>
          <Button size="sm" onClick={() => persist('accepted')}>
            {t('shared.cookieConsent.accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
