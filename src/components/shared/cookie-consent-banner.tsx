import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useConsent } from '@/hooks/use-consent';
import { cn } from '@/lib/utils';
import { useCookiePreferencesStore } from '@/store/cookie-preferences-store';

/**
 * The card of the cookie notice, at the bottom left (the full width on a phone). Above the fixed bar of the property page
 * (z-40), below the sheets and the dialogs (z-50): the only place that says it. The banner and the panel of the choices are the
 * same card, so the one that is open takes the place of the other.
 */
const CARD_CLASS =
  'fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[45] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[var(--cz-public-radius,0.75rem)] bg-background p-4 shadow-[var(--cz-public-shadow-widget)] ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[26rem] sm:p-5';

/**
 * "Rifiuta" and "Accetta" are the very same button, one next to the other: refusing is as easy and as visible as
 * accepting (same variant, same size, same look; only the label tells them apart). The two buttons of the panel are the same too.
 */
const CHOICE_CLASS = 'public-site-outline h-11 w-full px-3';

const TITLE_CLASS = 'flex items-center gap-2 text-base font-semibold text-foreground';
const ICON_CLASS = 'h-5 w-5 shrink-0 text-[var(--cz-public-primary-text,var(--color-primary))]';

/**
 * The cookie notice of the public site (DB-02b): shown until the visitor chooses. Three ways to answer, "Rifiuta" and "Accetta" of
 * the same weight and "Scegli tu", which opens the panel of the choices (what is always on, and the anonymous statistics that
 * the visitor can allow). The choice is the one `lib/cookie-consent.ts` keeps, and what measures asks it (`hasConsent`). The panel
 * can be opened again at any time from the "Cookie" link of the footer.
 */
export function CookieConsentBanner() {
  const { choice } = useConsent();
  const preferencesOpen = useCookiePreferencesStore((state) => state.open);

  if (preferencesOpen) return <CookiePreferences />;
  if (choice !== null) return null;
  return <CookieNotice />;
}

function CookieNotice() {
  const { t } = useTranslation();
  const textId = useId();
  const { choose } = useConsent();
  const openPreferences = useCookiePreferencesStore((state) => state.openPreferences);

  return (
    <div
      role="dialog"
      aria-label={t('shared.cookieConsent.ariaLabel')}
      aria-describedby={textId}
      className={CARD_CLASS}
      data-testid="cookie-consent-banner"
    >
      <p className={TITLE_CLASS}>
        <ShieldCheck className={ICON_CLASS} aria-hidden />
        {t('shared.cookieConsent.title')}
      </p>
      <p id={textId} className="mt-2 text-sm text-muted-foreground">
        {t('shared.cookieConsent.text')}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className={CHOICE_CLASS} onClick={() => choose('rejected')}>
          {t('shared.cookieConsent.reject')}
        </Button>
        <Button type="button" variant="outline" className={CHOICE_CLASS} onClick={() => choose('accepted')}>
          {t('shared.cookieConsent.accept')}
        </Button>
      </div>
      <button
        type="button"
        data-cookie-choose=""
        className="mt-1 inline-flex min-h-11 cursor-pointer items-center px-1 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
        onClick={(event) => openPreferences(event.currentTarget)}
      >
        {t('shared.cookieConsent.choose')}
      </button>
    </div>
  );
}

/** One category of the panel: its name, what it is for, and the switch (always on for the necessary ones). */
function CategoryRow({
  name,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  name: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const nameId = useId();
  const hintId = useId();

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={nameId} className="text-sm font-semibold text-foreground">
          {name}
        </p>
        <p id={hintId} className="mt-0.5 text-sm text-muted-foreground">
          {hint}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-labelledby={nameId}
        aria-describedby={hintId}
        // The "off" track is dark enough to be seen against the card (the pale hairline of the app is not, AA 1.4.11).
        className="mt-0.5 data-[state=unchecked]:bg-[var(--cz-public-muted,var(--color-muted-foreground))]"
      />
    </li>
  );
}

/**
 * The panel "Le tue scelte sui cookie": the necessary ones, always on and said so, and the anonymous statistics, which are off until
 * the visitor turns them on. "Solo i necessari" and "Salva le mie scelte" are the same button. It closes with the cross or Escape (the
 * notice is then still there if the visitor has not chosen), and the focus goes back to what opened it.
 */
function CookiePreferences() {
  const { t } = useTranslation();
  const titleId = useId();
  const { statistics: allowed, choose } = useConsent();
  const closePreferences = useCookiePreferencesStore((state) => state.closePreferences);
  const [statistics, setStatistics] = useState(allowed);
  const panelRef = useRef<HTMLDivElement>(null);

  // The keyboard and the screen reader land in the panel when it opens.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const leave = () => {
    const opener = closePreferences();
    // After the page has drawn again: the opener of the footer is still there; the "Scegli tu" of the notice is drawn anew;
    // with the notice gone (a choice was made) the focus goes to the start of the page.
    requestAnimationFrame(() => {
      const target = opener?.isConnected
        ? opener
        : (document.querySelector<HTMLElement>('[data-cookie-choose]') ?? document.getElementById('main-content'));
      target?.focus();
    });
  };

  const save = (allowStatistics: boolean) => {
    choose(allowStatistics ? 'accepted' : 'rejected');
    toast.success(t('shared.cookieConsent.saved'), { description: t('shared.cookieConsent.savedHint') });
    leave();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(CARD_CLASS, 'outline-none')}
      data-testid="cookie-preferences"
      onKeyDown={(event) => {
        if (event.key === 'Escape') leave();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={titleId} className={TITLE_CLASS}>
          <ShieldCheck className={ICON_CLASS} aria-hidden />
          {t('shared.cookieConsent.preferencesTitle')}
        </h2>
        <button
          type="button"
          aria-label={t('shared.close')}
          className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-black/5"
          onClick={leave}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="mt-1 divide-y">
        <CategoryRow
          name={t('shared.cookieConsent.necessary')}
          hint={t('shared.cookieConsent.necessaryHint')}
          checked
          disabled
        />
        <CategoryRow
          name={t('shared.cookieConsent.statistics')}
          hint={t('shared.cookieConsent.statisticsHint')}
          checked={statistics}
          onChange={setStatistics}
        />
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className={CHOICE_CLASS} onClick={() => save(false)}>
          {t('shared.cookieConsent.onlyNecessary')}
        </Button>
        <Button type="button" variant="outline" className={CHOICE_CLASS} onClick={() => save(statistics)}>
          {t('shared.cookieConsent.save')}
        </Button>
      </div>
    </div>
  );
}
