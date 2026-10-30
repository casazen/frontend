import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import './confirmation.css';

type CopyState = 'idle' | 'copied' | 'selected';

const RESET_AFTER_MS = 2200;

/** Selects the text of an element, for a device where the clipboard is not at hand: the guest then copies it themselves. */
function selectText(element: HTMLElement | null): void {
  const selection = window.getSelection();
  if (!element || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * The code of the booking, `XXXXX-XXXXX`, with the button «Copia». The code and the email of the booking find it again in the guest
 * area, so it is what the guest must be able to keep: the button copies it and says so aloud for a screen reader; where the clipboard
 * is not there (an insecure page, an old browser, a refused permission) the text is selected so that the person copies it with their
 * own keys.
 */
export function BookingCode({ code }: { code: string }) {
  const { t } = useTranslation();
  const valueRef = useRef<HTMLElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        copied = true;
      }
    } catch {
      // The browser refused: the code is selected below.
    }
    if (!copied) selectText(valueRef.current);
    setState(copied ? 'copied' : 'selected');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), RESET_AFTER_MS);
  };

  const done = state === 'copied';

  return (
    <div className="bc-code" data-testid="checkout-outcome-booking-code">
      <p className="bc-code__text">
        <span className="bc-k">{t('siteConfirm.ticket.code')}</span>
        <strong ref={valueRef} className="bc-code__value" data-testid="checkout-outcome-booking-code-value">
          {code}
        </strong>
      </p>
      <button
        type="button"
        className="bc-copy"
        data-done={done ? '' : undefined}
        onClick={() => void copy()}
        aria-label={done ? t('siteConfirm.ticket.copiedLabel', { code }) : t('siteConfirm.ticket.copyLabel', { code })}
        data-testid="checkout-outcome-copy-code"
      >
        {done ? <Check aria-hidden /> : <Copy aria-hidden />}
        <span>{done ? t('siteConfirm.ticket.copied') : t('siteConfirm.ticket.copy')}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? t('siteConfirm.ticket.copiedAnnounce') : state === 'selected' ? t('siteConfirm.ticket.selectedAnnounce') : ''}
      </span>
    </div>
  );
}
