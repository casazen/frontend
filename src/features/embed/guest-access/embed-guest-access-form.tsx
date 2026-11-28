import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEmbed } from '@/features/embed/embed-context';
import { buildEmbedGuestAreaAddress, buildEmbedGuestAreaUrl } from '@/features/embed/embed-urls';
import { useEmbedBridge } from '@/features/embed/use-embed-bridge';
import { formatBookingCode } from '@/lib/booking-code';

type CodeProblem = 'required' | 'invalid' | null;

/**
 * The entry of «Gestisci la tua prenotazione» for a page of the agency's website (NF-143, NF-144): ONE field, the booking code, and a button that hands the
 * guest to the guest area of the booking site, which asks for the second proof (the e-mail, or the last four digits of the phone) itself.
 *
 * It sends nothing but the code and the language. The guest's e-mail or phone, and a session, must never cross a frame: a `postMessage` can be read by every script
 * of the page that frames the widget (the analytics and the ad scripts too), an address ends up in logs and in the history, and a page of `/embed/*` has no storage,
 * so a session opened here could not reach the top window anyway. So the form makes NO request (it cannot even tell whether a code exists: it never asks), reads no
 * session, keeps nothing in the browser and tells the page no event.
 *
 * What it accepts is exactly what the form of the guest area accepts (`formatBookingCode`/`isValidBookingCode` of `lib/booking-code.ts`, the same two messages):
 * an empty or malformed code is an error announced to assistive technology (`role="alert"`, the field named by it) and nothing happens. A valid code leaves
 * the frame: with the loader of the page attached (`bridge.attached`) the page is asked to take the WHOLE window to the guest area (`navigate`, `top`); without one
 * (the page was opened on its own, a frame embedded by hand) the form is a plain form of the web, a GET to the guest area of the same origin aimed at the top
 * window (`target="_top"`), with the code and the language as its two hidden fields, so it degrades to a link.
 */
export function EmbedGuestAccessForm() {
  const { t } = useTranslation();
  const embed = useEmbed();
  const bridge = useEmbedBridge();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<CodeProblem>(null);
  if (!embed) return null;

  const code = formatBookingCode(value);
  const where = { origin: window.location.origin, hostMode: embed.hostMode, orgSlug: embed.orgSlug };
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (code === null) {
      event.preventDefault();
      setProblem(value.trim() === '' ? 'required' : 'invalid');
      input.current?.focus({ preventScroll: true });
      return;
    }
    setProblem(null);
    if (!bridge.attached) return;
    event.preventDefault();
    bridge.send.navigate(buildEmbedGuestAreaUrl({ ...where, code, lang: embed.lang }), 'top');
  };

  return (
    <form
      method="get"
      action={buildEmbedGuestAreaAddress(where)}
      target="_top"
      noValidate
      aria-label={t('embed.guestAccess.label')}
      className="space-y-3 px-1 py-2"
      onSubmit={submit}
      data-testid="embed-guest-access-form"
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-code`}>{t('publicBooking.guestBookings.codeLabel')}</Label>
        <Input
          ref={input}
          id={`${id}-code`}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          placeholder={t('publicBooking.guestBookings.codePlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-11 font-mono uppercase tracking-wider"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${hintId} ${errorId}` : hintId}
          data-testid="embed-guest-access-code"
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          {t('publicBooking.guestBookings.codeHint')}
        </p>
        {problem ? (
          <p id={errorId} role="alert" className="text-sm text-destructive" data-testid="embed-guest-access-error">
            {t(problem === 'required' ? 'publicBooking.guestBookings.codeRequired' : 'publicBooking.guestBookings.codeInvalid')}
          </p>
        ) : null}
      </div>

      {code ? <input type="hidden" name="code" value={code} /> : null}
      <input type="hidden" name="lang" value={embed.lang} />

      <Button type="submit" className="min-h-11 w-full" data-testid="embed-guest-access-submit">
        {t('embed.guestAccess.submit')}
      </Button>
    </form>
  );
}
