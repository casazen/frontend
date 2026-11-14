import { useContext, useEffect, useId, useMemo, useRef } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, Compass, LifeBuoy } from 'lucide-react';
import { GuidePath, type GuidePathStep } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AppContextKey } from '@/config/route-manifest';
import { supportConfig } from '@/config/support.config';
import { useWorkspace } from '@/hooks/use-workspace';
import { useActivities, useActivityCount } from '@/queries/internalActivities';
import { useProperties } from '@/queries/use-properties';
import { useUiStore } from '@/store/ui-store';
import { todoActionRoute } from '@/features/todo/activity-card';
import { TODO_LIST_PATH, describeTodo } from '@/features/todo/lib/todo-model';
import { useSetupJourney, type SetupJourney } from './use-setup-journey';

/** How many items of «Da fare» the panel shows as a road: the one to do now and the next ones. */
const PANEL_TODO_ITEMS = 5;

/** Classes of a quiet link of the panel: the accent of the area, at least 44 px high. */
const PANEL_LINK =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

/** The setup of the host as a road: how far it is, the steps, «Continua» on the one to do now and the page with every step. */
function SetupSection({ journey }: { journey: SetupJourney }) {
  const { t } = useTranslation();
  const titleId = useId();
  const steps: GuidePathStep[] = journey.steps.map((step) => ({
    id: step.id,
    title: step.title,
    state: step.state,
    ...(step.state === 'current' ? { kicker: t('guide.setup.now') } : {}),
    ...(step.href && step.cta
      ? { action: { label: step.cta, href: step.href, state: step.linkState, testId: step.state === 'current' ? 'guide-setup-continue' : undefined } }
      : {}),
  }));

  return (
    <section aria-labelledby={titleId} className="space-y-4" data-testid="guide-setup">
      <div>
        <h3 id={titleId} className="text-base font-semibold">
          {t(journey.source === 'path' ? 'guide.setup.titlePath' : 'guide.setup.titleChecklist')}
        </h3>
        <p className="text-sm text-foreground/70">{t('guide.setup.progress', { done: journey.done, total: journey.total })}</p>
      </div>
      <GuidePath label={t('guide.setup.label')} steps={steps} density="compact" />
      {journey.allHref ? (
        <Link to={journey.allHref} className={PANEL_LINK} data-testid="guide-setup-all">
          {t('guide.setup.all')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

/** «Da fare» as a road: the item to do now and the next ones, each with its «Fallo ora», and the way to the whole list. */
function TodoSection() {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const { hasPermission } = useWorkspace();
  const activities = useActivities();
  const urgent = useActivityCount();
  const properties = useProperties({ mode: 'short' });
  const propertyNames = useMemo(
    () => new Map((Array.isArray(properties.data) ? properties.data : []).map((property) => [property.id, property.name] as const)),
    [properties.data],
  );
  const items = Array.isArray(activities.data) ? activities.data : [];
  if (activities.isPending) return null;

  const context = { t, exists: (key: string) => i18n.exists(key), locale: i18n.language, propertyNames };
  const steps: GuidePathStep[] = items.slice(0, PANEL_TODO_ITEMS).map((activity, index) => {
    const text = describeTodo(activity, context);
    const route = todoActionRoute(activity, hasPermission);
    return {
      id: activity.id,
      title: text.title,
      detail: text.object,
      note: text.deadline?.text,
      noteTone: text.deadline?.overdue ? 'danger' : text.urgency === 'High' ? 'warning' : 'neutral',
      kicker: index === 0 ? t('activity.todo.path.now') : undefined,
      state: index === 0 ? 'current' : 'upcoming',
      action: route
        ? { label: t('activity.todo.actions.doNow'), href: route, ariaLabel: t('activity.todo.actions.doNowFor', { title: text.title }) }
        : undefined,
    };
  });
  const urgentCount = urgent.data?.count ?? 0;

  return (
    <section aria-labelledby={titleId} className="space-y-4" data-testid="guide-todo">
      <div>
        <h3 id={titleId} className="text-base font-semibold">
          {t('guide.todo.title')}
        </h3>
        <p className="text-sm text-foreground/70">
          {items.length === 0
            ? t('guide.todo.nothing')
            : urgentCount > 0
              ? t('guide.todo.countUrgent', { count: items.length, urgent: urgentCount })
              : t('guide.todo.count', { count: items.length })}
        </p>
      </div>
      <GuidePath label={t('guide.todo.title')} steps={steps} density="compact" />
      {items.length > 0 ? (
        <Link to={TODO_LIST_PATH} className={PANEL_LINK} data-testid="guide-todo-all">
          {t('guide.todo.all')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

/** Where to find more help: the guide of the product, and CasaZen support when an address is set. */
function HelpSection({ contextKey }: { contextKey: AppContextKey }) {
  const { t } = useTranslation();
  const titleId = useId();
  const helpEmail = supportConfig.email;

  return (
    <section aria-labelledby={titleId} className="space-y-2" data-testid="guide-help">
      <h3 id={titleId} className="text-base font-semibold">
        {t('guide.help.title')}
      </h3>
      <p className="text-sm text-foreground/70">{t('guide.help.text')}</p>
      <div className="flex flex-col items-start">
        <Link to={`/app/${contextKey}/help`} className={PANEL_LINK} data-testid="guide-help-manual">
          <BookOpen aria-hidden="true" className="size-4" />
          {t('guide.help.manual')}
        </Link>
        {helpEmail ? (
          <a href={`mailto:${helpEmail}`} className={PANEL_LINK} data-testid="guide-help-support">
            <LifeBuoy aria-hidden="true" className="size-4" />
            {t('guide.help.support')}
          </a>
        ) : null}
      </div>
    </section>
  );
}

interface GuidePanelProps {
  contextKey: AppContextKey;
}

/**
 * «La tua guida» (the guide of CasaZen): a panel on the right, over the page, that tells the host where they are on the road and what comes
 * next, so that nobody is left alone in front of a page. In Affitti brevi: the setup as a road (the path «Inizia con CasaZen» or the
 * activation checklist, only while it is incomplete), the «Da fare» list as a road, and the help. In the other areas: the help.
 *
 * It is what replaces the notices that looked like errors: nothing here is tinted, the step to do now has its marker and its button. Every link
 * closes it (the page changes under it); the button of the header opens it, and so does the end of the welcome of the first access.
 */
function GuidePanel({ contextKey }: GuidePanelProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const setOpen = useUiStore((state) => state.setGuideOpen);
  const { hasPermission } = useWorkspace();
  const shortRent = contextKey === 'short-rent';
  const { journey } = useSetupJourney({ enabled: shortRent });
  const canReadTodo = shortRent && hasPermission('short-rent', 'property.read');

  // A link of the panel changed the page: the panel has done its job and leaves the page to the person.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <Sheet open onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md" data-testid="guide-panel">
        <SheetHeader className="space-y-1 border-b px-6 pb-4 pr-14 pt-6 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Compass aria-hidden="true" className="size-5 text-primary-text" />
            {t('guide.title')}
          </SheetTitle>
          <SheetDescription>{t('guide.description')}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 pb-8 pt-2">
          {shortRent && journey ? <SetupSection journey={journey} /> : null}
          {canReadTodo ? <TodoSection /> : null}
          <HelpSection contextKey={contextKey} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface GuideButtonViewProps {
  urgent: number;
}

/** The button itself: the compass, «Guida» from a laptop up, and the number of the urgent things on its corner. */
function GuideButtonView({ urgent }: GuideButtonViewProps) {
  const { t } = useTranslation();
  const setOpen = useUiStore((state) => state.setGuideOpen);
  const open = useUiStore((state) => state.guideOpen);
  const label = urgent > 0 ? t('guide.openWithCount', { count: urgent }) : t('guide.open');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="relative h-10 gap-2 px-2.5"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={() => setOpen(true)}
      data-testid="guide-button"
    >
      <Compass aria-hidden="true" className="size-5" />
      <span className="hidden text-sm font-medium lg:inline">{t('guide.button')}</span>
      {urgent > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
          data-testid="guide-button-count"
        >
          {urgent > 99 ? '99+' : urgent}
        </span>
      ) : null}
    </Button>
  );
}

/** The button with the number of the urgent things to do of Affitti brevi (the one the tab «Da fare» shows), read from the query the tab reads. */
function CountedGuideButton() {
  const urgent = useActivityCount().data?.count ?? 0;
  return <GuideButtonView urgent={urgent} />;
}

/**
 * The button of the header that opens the guide (it took the place of the book icon, whose guide of the product is now inside the panel). In
 * Affitti brevi it carries the number of the urgent things to do, the one the tab «Da fare» shows: the guide is where they are told in order.
 * The panel is mounted only while it is open, so a closed guide asks nothing of the server. Like the tabs of a section, it can be rendered where
 * there is no query client (an isolated test of the shell): there is then no number to show and no panel to read.
 */
export function GuideButton({ contextKey }: GuidePanelProps) {
  const open = useUiStore((state) => state.guideOpen);
  const { hasPermission } = useWorkspace();
  const hasQueryClient = useContext(QueryClientContext) !== undefined;
  const counted = hasQueryClient && contextKey === 'short-rent' && hasPermission('short-rent', 'property.read');

  return (
    <>
      {counted ? <CountedGuideButton /> : <GuideButtonView urgent={0} />}
      {open && hasQueryClient ? <GuidePanel contextKey={contextKey} /> : null}
    </>
  );
}
