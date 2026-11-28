import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, CalendarCheck, ExternalLink, MessageSquare, Sparkles } from 'lucide-react';
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
import { resolveAsk, type AskAnswer } from './navigation';

interface Props {
  area: AppContextKey;
  orgName: string | null;
  propertyId: string | null;
  bookingId: string | null;
  scope: string;
  canReadArrivals: boolean;
  initialIntent: AskIntent;
  initialQuestion?: string;
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
  initialQuestion,
  opener,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [intent, setIntent] = useState(initialIntent);
  const [term, setTerm] = useState(initialQuestion ?? '');
  const [submitted, setSubmitted] = useState('');
  const navigated = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const context = useCommandContext(area);
  const mobilePrimary = useUiStore((state) => state.mobilePrimaryVisible);
  const navigate = useNavigate();
  const pending = useRef<AbortController | null>(null);
  const [answer, setAnswer] = useState<AskAnswer>({ links: [] });
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
  useEffect(() => {
    if (initialQuestion?.trim()) void ask(initialQuestion);
    // Once, when the dialog opens with a question: asking again at every render would be a loop. StrictMode runs this twice and the first request is aborted by the cleanup above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          'max-h-[82dvh] overflow-y-auto overscroll-contain sm:max-w-2xl',
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
        <DialogHeader className="rounded-xl bg-primary-soft px-4 py-4 pr-8 text-left">
          <DialogTitle ref={title} tabIndex={-1} className="flex items-center gap-3 text-xl tracking-tight outline-none">
            <Sparkles className="size-9 rounded-lg bg-card p-2 text-primary-text" aria-hidden="true" />
            {t('ask.title')}
          </DialogTitle>
          <DialogDescription className="break-words text-primary-text">
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
              <div aria-live="polite" aria-busy={thinking} className="space-y-3 rounded-xl border bg-surface-2 p-4 text-sm">
                {thinking || answer.message ? <p className="font-medium">{thinking ? t('ask.resolving') : answer.message}</p> : null}
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
                {answer.guide && answer.guide.length > 0 && (
                  <div className="space-y-2" data-testid="ask-guide">
                    <p className="flex items-center gap-2 font-medium">
                      <BookOpen className="size-4" aria-hidden="true" />
                      {t('ask.inManual')}
                    </p>
                    <ul className="divide-y rounded-md border">
                      {answer.guide.map(hit => (
                        <li key={`${hit.type}:${hit.id}`}>
                          <a href={hit.href} target="_blank" rel="noopener noreferrer"
                            className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 hover:bg-muted">
                            <span><span className="font-medium text-primary-text">{hit.title}</span>
                              {hit.chapter && <span className="block text-xs text-muted-foreground">{hit.chapter}</span>}
                            </span>
                            <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                            <span className="sr-only">{t('productGuide.fullManualNewTab')}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                <CalendarCheck aria-hidden="true" className="size-5 shrink-0" />
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
                <MessageSquare aria-hidden="true" className="size-5 shrink-0" />
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
