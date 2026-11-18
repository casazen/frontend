import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AskContext } from './ask-context';

export function AskCasaZenButton() {
  const ask = useContext(AskContext);
  const { t } = useTranslation();
  if (!ask) return null;
  return (
    <Button
      type="button"
      variant="soft"
      aria-haspopup="dialog"
      title={t('ask.title')}
      data-testid="ask-casazen"
      onClick={(event) => ask.open('search', event.currentTarget)}
      className="shrink-0 rounded-full max-xl:size-11 max-xl:px-0"
    >
      <Sparkles className="size-[18px]" aria-hidden="true" />
      <span className="max-xl:sr-only">{t('ask.title')}</span>
    </Button>
  );
}

export function AskArrivalsButton() {
  const ask = useContext(AskContext);
  const { t } = useTranslation();
  if (!ask?.canReadArrivals) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-haspopup="dialog"
      className="min-h-11 whitespace-normal text-left"
      onClick={(event) => ask.open('arrivals.incompleteToday', event.currentTarget)}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      {t('ask.arrivalsShortcut')}
    </Button>
  );
}

export function AskBookingDraftButton() {
  const ask = useContext(AskContext);
  const { t } = useTranslation();
  if (!ask?.canPrepareDraft) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-haspopup="dialog"
      className="min-h-11 whitespace-normal text-left"
      onClick={(event) => ask.open('booking.prepareMessage', event.currentTarget)}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      {t('ask.draftShortcut')}
    </Button>
  );
}
