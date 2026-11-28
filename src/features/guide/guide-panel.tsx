import { useContext, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, CircleHelp, Compass, ExternalLink, Footprints, LifeBuoy, ListChecks, Search, Sparkles, Type, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supportConfig } from '@/config/support.config';
import { AskContext } from '@/features/assistant/ask/ask-context';
import { MANUAL_TYPE_ICONS } from '@/lib/manual/manual-icons';
import { MANUAL_BASE, type ManualEntryType, type ManualHit } from '@/lib/manual/manual-search';
import { useUiStore } from '@/store/ui-store';
import { useManualHints, useManualSearch } from './use-manual';

const PANEL_LINK =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

const ROW =
  'flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';

const TILE =
  'flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';

const TYPE_LABEL_KEYS: Record<ManualEntryType, string> = {
  pagina: 'guide.type.pagina',
  howto: 'guide.type.howto',
  funzione: 'guide.type.funzione',
  faq: 'guide.type.faq',
  flusso: 'guide.type.flusso',
  termine: 'guide.type.termine',
};

const TOPICS: ReadonlyArray<{ id: string; labelKey: string; href: string; icon: LucideIcon }> = [
  { id: 'start', labelKey: 'guide.topics.start', href: `${MANUAL_BASE}inizia-qui.html`, icon: Footprints },
  { id: 'howTo', labelKey: 'guide.topics.howTo', href: `${MANUAL_BASE}come-fare.html`, icon: ListChecks },
  { id: 'faq', labelKey: 'guide.topics.faq', href: `${MANUAL_BASE}domande-frequenti.html`, icon: CircleHelp },
  { id: 'glossary', labelKey: 'guide.topics.glossary', href: `${MANUAL_BASE}glossario.html`, icon: Type },
];

function NewTabNote() {
  const { t } = useTranslation();
  return <span className="sr-only"> ({t('productGuide.fullManualNewTab')})</span>;
}

function ManualRow({ hit }: { hit: ManualHit }) {
  const { t } = useTranslation();
  const Icon = MANUAL_TYPE_ICONS[hit.type];

  return (
    <li>
      <a href={hit.href} target="_blank" rel="noopener noreferrer" className={ROW} data-testid="guide-hit">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium">{hit.title}</span>
          {hit.chapter ? <span className="block break-words text-xs text-foreground/70">{hit.chapter}</span> : null}
        </span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
        <span className="sr-only">
          {t(TYPE_LABEL_KEYS[hit.type])}, {t('productGuide.fullManualNewTab')}
        </span>
      </a>
    </li>
  );
}

function PageHints({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const titleId = useId();
  const hints = useManualHints(pathname);
  if (!hints.data) return null;
  const { chapter, tasks } = hints.data;

  return (
    <section aria-labelledby={titleId} className="space-y-1" data-testid="guide-hints">
      <h3 id={titleId} className="px-2 text-sm font-semibold">
        {t('guide.forThisPage')}
      </h3>
      {tasks.length > 0 ? (
        <ul>
          {tasks.map((task) => (
            <ManualRow key={task.id} hit={task} />
          ))}
        </ul>
      ) : null}
      <a href={chapter.href} target="_blank" rel="noopener noreferrer" className={PANEL_LINK} data-testid="guide-chapter">
        <BookOpen aria-hidden="true" className="size-4" />
        {t('guide.openChapter', { title: chapter.title })}
        <NewTabNote />
      </a>
    </section>
  );
}

function Topics() {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="space-y-2" data-testid="guide-topics">
      <h3 id={titleId} className="px-2 text-sm font-semibold">
        {t('guide.topics.title')}
      </h3>
      <ul className="grid grid-cols-2 gap-2">
        {TOPICS.map(({ id, labelKey, href, icon: Icon }) => (
          <li key={id}>
            <a href={href} target="_blank" rel="noopener noreferrer" className={TILE}>
              <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
              <span className="min-w-0 break-words">
                {t(labelKey)}
                <NewTabNote />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <a href={MANUAL_BASE} target="_blank" rel="noopener noreferrer" className={PANEL_LINK} data-testid="guide-full-manual">
        <BookOpen aria-hidden="true" className="size-4" />
        {t('guide.fullManual')}
        <NewTabNote />
      </a>
    </section>
  );
}

function SearchResults({ search }: { search: ReturnType<typeof useManualSearch> }) {
  const { t } = useTranslation();

  if (search.failed) {
    return (
      <div className="space-y-2 px-2" role="alert" data-testid="guide-results-failed">
        <p className="text-sm">{t('guide.search.failed')}</p>
        <Button type="button" variant="outline" size="sm" onClick={search.retry}>
          {t('guide.search.retry')}
        </Button>
      </div>
    );
  }
  if (search.hits.length > 0) {
    return (
      <ul data-testid="guide-results" aria-busy={search.pending}>
        {search.hits.map((hit) => (
          <ManualRow key={`${hit.type}:${hit.id}`} hit={hit} />
        ))}
      </ul>
    );
  }
  return (
    <p className="px-2 text-sm text-foreground/70" role="status" data-testid="guide-results-empty">
      {search.pending ? t('guide.search.pending') : t('guide.search.empty')}
    </p>
  );
}

interface GuidePanelProps {
  opener: RefObject<HTMLElement | null>;
}

function GuidePanel({ opener }: GuidePanelProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const setOpen = useUiStore((state) => state.setGuideOpen);
  const ask = useContext(AskContext);
  const [query, setQuery] = useState('');
  const search = useManualSearch(query);
  const supportEmail = supportConfig.email;

  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setOpen(false);
  }, [pathname, setOpen]);

  const askCasaZen = (button: HTMLElement) => {
    setOpen(false);
    ask?.open('search', opener.current ?? button, query.trim() || undefined);
  };

  return (
    <Sheet open onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md" data-testid="guide-panel">
        <SheetHeader className="space-y-1 border-b bg-primary-soft px-6 pb-4 pr-14 pt-6 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Compass aria-hidden="true" className="size-5 text-primary-text" />
            {t('guide.title')}
          </SheetTitle>
          <SheetDescription>{t('guide.description')}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-surface-2 p-4 sm:p-5">
          <div role="search" className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/70" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t('guide.search.label')}
              placeholder={t('guide.search.placeholder')}
              autoComplete="off"
              maxLength={200}
              className="h-11 pl-9"
              data-testid="guide-search"
            />
          </div>
          {search.active ? (
            <SearchResults search={search} />
          ) : (
            <>
              <PageHints pathname={pathname} />
              <Topics />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t bg-card p-3" data-testid="guide-help">
          {ask ? (
            <Button type="button" variant="soft" className="min-h-11" onClick={(event) => askCasaZen(event.currentTarget)} data-testid="guide-ask">
              <Sparkles aria-hidden="true" className="size-4" />
              {t('guide.ask')}
            </Button>
          ) : null}
          {supportEmail ? (
            <Button asChild variant="ghost" className="min-h-11">
              <a href={`mailto:${supportEmail}`} data-testid="guide-help-support">
                <LifeBuoy aria-hidden="true" className="size-4" />
                {t('guide.help.support')}
              </a>
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function GuideButtonView({ buttonRef }: { buttonRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useTranslation();
  const setOpen = useUiStore((state) => state.setGuideOpen);
  const open = useUiStore((state) => state.guideOpen);
  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="ghost"
      size="sm"
      className="h-10 gap-2 px-2.5"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={t('guide.open')}
      title={t('guide.open')}
      onClick={() => setOpen(true)}
      data-testid="guide-button"
    >
      <Compass aria-hidden="true" className="size-5" />
      <span className="hidden text-sm font-medium lg:inline">{t('guide.button')}</span>
    </Button>
  );
}

export function GuideButton() {
  const open = useUiStore((state) => state.guideOpen);
  const hasQueryClient = useContext(QueryClientContext) !== undefined;
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <GuideButtonView buttonRef={trigger} />
      {open && hasQueryClient ? <GuidePanel opener={trigger} /> : null}
    </>
  );
}
