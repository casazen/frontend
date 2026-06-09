import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'casazen_cookie_consent';

type ConsentChoice = 'accepted' | 'rejected';

function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  const persist = (choice: ConsentChoice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Consenso cookie"
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur p-4 shadow-lg"
      data-testid="cookie-consent-banner"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Utilizziamo cookie essenziali per il funzionamento del sito e, solo con il tuo consenso,
          cookie analitici. Puoi accettare o rifiutare i cookie non essenziali.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => persist('rejected')}>
            Rifiuta
          </Button>
          <Button size="sm" onClick={() => persist('accepted')}>
            Accetta
          </Button>
        </div>
      </div>
    </div>
  );
}
