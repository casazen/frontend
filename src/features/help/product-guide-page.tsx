import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowUpLeft, BookOpen, Building2, CalendarSync, ChevronRight, ClipboardCheck,
  DoorOpen, FileSignature, House, LifeBuoy, ListChecks, Search, Users, Wallet, Wrench,
} from 'lucide-react';
import { useAppShell } from '@/components/layout/app-shell-context';
import { PageHeader } from '@/components/layout/page-header';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getDefaultRoute } from '@/config/route-manifest';
import { safeReturnTo } from '@/lib/auth-return-to';

interface GuideSection {
  title: string;
  keywords: string;
  steps: string[];
}

const icons = {
  start: DoorOpen, properties: House, bookings: ListChecks, ical: CalendarSync, guests: Users,
  compliance: ClipboardCheck, payments: Wallet, team: Building2, leases: FileSignature,
  suppliers: Wrench, troubleshooting: LifeBuoy,
};

export function ProductGuidePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const shell = useAppShell();
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const previousTopic = useRef('');
  const sections = t('productGuide.sections', { returnObjects: true }) as Record<string, GuideSection>;
  const id = location.hash.replace(/^#guide-/, '');
  const topic = Object.hasOwn(sections, id) ? sections[id] : undefined;
  const entries = Object.entries(sections);
  const currentIndex = entries.findIndex(([key]) => key === id);
  const adjacent = [entries[currentIndex - 1], entries[currentIndex + 1]].filter(Boolean);
  const activeTopic = topic ? id : '';
  const matches = entries.filter(([, section]) =>
    matchesSearch([section.title, section.keywords, ...section.steps].join(' '), query));
  const areaRoot = location.pathname.replace(/\/help\/?$/, '');
  const source = safeReturnTo(location.state?.guideReturnTo);
  const sourcePath = source ? new URL(source, window.location.origin).pathname : '';
  const inArea = sourcePath === areaRoot || sourcePath.startsWith(areaRoot + '/');
  const from = source && inArea && sourcePath !== location.pathname ? source : null;
  const back = from ?? (shell ? getDefaultRoute(shell.contextKey) : null);

  useEffect(() => {
    if (activeTopic) {
      title.current?.focus();
      previousTopic.current = activeTopic;
    } else if (previousTopic.current) {
      document.getElementById('guide-link-' + previousTopic.current)?.focus();
      previousTopic.current = '';
    }
  }, [activeTopic]);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader title={t('productGuide.title')} description={topic ? undefined : t('productGuide.description')} />
      {topic ? (
        <section id={'guide-' + id} aria-labelledby="guide-topic-title" className="max-w-3xl space-y-4">
          <Link to={{ pathname: location.pathname, search: location.search }} state={location.state}
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-primary-text focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="size-4" />{t('productGuide.allTopics')}
          </Link>
          <article className="rounded-2xl border bg-card px-5 py-6 sm:px-8">
            <h2 ref={title} tabIndex={-1} id="guide-topic-title" className="scroll-mt-24 break-words text-xl font-semibold tracking-tight outline-none">{topic.title}</h2>
            <ol className="mt-5 list-decimal space-y-0 divide-y pl-7 marker:font-semibold marker:text-primary-text">
              {topic.steps.map(step => <li key={step} className="py-3 pl-2 leading-relaxed">{step}</li>)}
            </ol>
          </article>
          <nav aria-label={t('productGuide.contents')} className="grid gap-2 sm:grid-cols-2">
            {adjacent.map(([key, section]) => (
              <Link key={key} to={{ pathname: location.pathname, search: location.search, hash: '#guide-' + key }} state={location.state}
                className="flex min-h-12 items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                {section.title}<ChevronRight aria-hidden="true" className="size-4 shrink-0 text-primary-text" />
              </Link>
            ))}
          </nav>
        </section>
      ) : (
        <>
          <div className="space-y-2 rounded-2xl bg-primary-soft p-5 sm:p-6">
            <label htmlFor="guide-search" className="text-sm font-medium">{t('productGuide.search')}</label>
            <div className="relative max-w-2xl">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={searchInput} id="guide-search" className="h-11 pl-9" type="search" value={query} onChange={event => setQuery(event.target.value)} />
            </div>
          </div>
          <nav aria-label={t('productGuide.contents')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map(([key, section]) => {
              const Icon = icons[key as keyof typeof icons] ?? BookOpen;
              return (
                <Link key={key} id={'guide-link-' + key} to={{ pathname: location.pathname, search: location.search, hash: '#guide-' + key }} state={location.state}
                  className="group flex min-h-20 items-center gap-3 rounded-xl border bg-card px-4 py-4 hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary-text"><Icon aria-hidden="true" className="size-5" /></span>
                  <h2 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">{section.title}</h2>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </nav>
          {!matches.length && <div className="space-y-2">
            <p role="status" className="text-sm">{t('productGuide.empty')}</p>
            <Button variant="outline" type="button" onClick={() => { setQuery(''); searchInput.current?.focus(); }}>{t('productGuide.clearSearch')}</Button>
          </div>}
          <p className="text-sm text-muted-foreground">{t('productGuide.availability')}</p>
          <p className="text-sm">
            <a href="/guida/" target="_blank" rel="noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              <BookOpen aria-hidden="true" className="size-4 shrink-0" />
              <span>{t('productGuide.fullManual')}<span className="sr-only"> ({t('productGuide.fullManualNewTab')})</span></span>
            </a>
          </p>
        </>
      )}
      {back && <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
        <Link to={back}><ArrowUpLeft aria-hidden="true" className="size-4" />{t(from ? 'productGuide.backToWork' : 'productGuide.areaHome')}</Link>
      </Button>}
    </div>
  );
}
