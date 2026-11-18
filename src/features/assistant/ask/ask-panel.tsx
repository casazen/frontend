import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getArea } from '@/config/areas';
import { isDemoMode } from '@/config/demo.config';
import type { AppContextKey } from '@/config/route-manifest';
import { useCommandContext } from '@/components/shared/command-palette/use-command-context';
import { normalizeText } from '@/components/shared/command-palette/search';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { asksForIncompleteArrivals } from './arrivals-capability';
import type { AskIntent } from './ask-context';
import { ArrivalsResult } from './arrivals-result';
import { BookingDraft } from './booking-draft';
import { resolveAsk, type AskLink } from './navigation';

interface Props {
  area: AppContextKey;
  orgName: string | null;
  propertyId: string | null;
  bookingId: string | null;
  scope: string;
  canReadArrivals: boolean;
  initialIntent: AskIntent;
  opener: HTMLElement;
  onClose: () => void;
}

export default function AskPanel({
  area,
  orgName,
  propertyId,
  bookingId,
  scope,
  canReadArrivals,
  initialIntent,
  opener,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [intent, setIntent] = useState(initialIntent);
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const navigated = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const context = useCommandContext(area);
  const mobilePrimary = useUiStore((state) => state.mobilePrimaryVisible);
  const navigate = useNavigate();
  const pending = useRef<AbortController | null>(null);
  const [answer, setAnswer] = useState<{ links: AskLink[]; message?: string }>({ links: [] });
  const [thinking, setThinking] = useState(false);
  useEffect(() => () => pending.current?.abort(), []);
  const sourceChosen = () => {
    navigated.current = true;
    onClose();
  };
  const ask = async (value: string) => {
    pending.current?.abort();
    setSubmitted(value.trim());
    setAnswer({ links: [] });
    const action =
      canReadArrivals && asksForIncompleteArrivals(value)
        ? 'arrivals.incompleteToday'
        : bookingId && normalizeText(value) === normalizeText(t('ask.draftPrompt'))
          ? 'booking.prepareMessage'
          : 'search';
    setIntent(action);
    if (action !== 'search') {
      setThinking(false);
      return;
    }
    const request = new AbortController();
    pending.current = request;
    setThinking(true);
    try {
      const next = !canReadArrivals && asksForIncompleteArrivals(value)
        ? { links: [], message: t('ask.noPages') }
        : await resolveAsk(value.trim(), context, orgName, request.signal);
      if (request.signal.aborted) return;
      if (next.direct && next.links.length === 1) {
        const { to, state } = next.links[0];
        sourceChosen();
        navigate(to, { state });
      } else {
        setAnswer(next);
      }
    } catch {
      if (!request.signal.aborted) setAnswer({ links: [], message: t('ask.lookupFailed') });
    } finally {
      if (!request.signal.aborted) setThinking(false);
    }
  };
  let detail = canReadArrivals ? t(propertyId ? 'ask.selectedProperty' : 'ask.allProperties') : null;
  if (intent === 'booking.prepareMessage') detail = t('ask.bookingContext');
  const queryLabel = [orgName, t(getArea(area).nameKey), detail].filter(Boolean).join(' · ');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'max-h-[82dvh] overflow-y-auto overscroll-contain sm:max-w-lg',
          mobilePrimary &&
            'max-sm:bottom-[calc(var(--bottom-nav-height)+var(--mobile-primary-height)+env(safe-area-inset-bottom))] max-sm:max-h-[60dvh]',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!navigated.current && opener.isConnected) opener.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1} className="flex items-center gap-2 outline-none">
            <Sparkles className="size-5 text-primary-text" aria-hidden="true" />
            {t('ask.title')}
          </DialogTitle>
          <DialogDescription className="break-words">
            {queryLabel}
            {isDemoMode && <> · {t('ask.demo')}</>}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (term.trim()) void ask(term);
          }}
        >
          <label htmlFor={id} className="text-sm font-medium">
            {t('ask.field')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={id}
              autoComplete="off"
              maxLength={200}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t('ask.placeholder')}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={!term.trim()} aria-label={t('ask.submit')}>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </form>
        {intent === 'arrivals.incompleteToday' && canReadArrivals ? (
          <ArrivalsResult scope={scope} propertyId={propertyId} onNavigate={sourceChosen} />
        ) : intent === 'booking.prepareMessage' && bookingId ? (
          <BookingDraft scope={scope} bookingId={bookingId} onNavigate={sourceChosen} />
        ) : (
          <>
            {submitted && (
              <div aria-live="polite" aria-busy={thinking} className="space-y-2 text-sm">
                <p className="font-medium">{thinking ? t('ask.resolving') : answer.message}</p>
                {answer.links.length > 0 && (
                  <ul className="divide-y rounded-md border">
                    {answer.links.map(link => (
                      <li key={link.to}>
                        <Link to={link.to} state={link.state} onClick={sourceChosen}
                          className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 hover:bg-muted">
                          <span><span className="font-medium text-primary-text">{link.title}</span>
                            {link.detail && <span className="block text-xs text-muted-foreground">{link.detail}</span>}
                          </span>
                          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {canReadArrivals && (
              <Button
                type="button"
                variant="soft"
                className="min-h-11 h-auto justify-start whitespace-normal text-left"
                onClick={() => void ask(t('ask.question'))}
              >
                {t('ask.question')}
              </Button>
            )}
            {bookingId && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 h-auto justify-start whitespace-normal text-left"
                onClick={() => void ask(t('ask.draftPrompt'))}
              >
                {t('ask.draftPrompt')}
              </Button>
            )}
            {!submitted && !canReadArrivals && <p className="text-sm text-muted-foreground">{t('ask.searchHint')}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
