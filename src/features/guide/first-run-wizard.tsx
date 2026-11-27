import { useContext, useEffect, useRef, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass } from 'lucide-react';
import { GuidePath, type GuidePathStep } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePlanResume } from '@/features/onboarding/use-plan-resume';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import { useWizardOpenFlag } from '@/store/use-wizard-open-flag';
import { useSetupJourney, type SetupJourney } from './use-setup-journey';

const SEEN_PREFIX = 'casazen:welcome-seen:';

const SHORT_RENT_HOME = '/app/short-rent';

/** At least 44 px high on every device, and a long label wraps instead of pushing the dialog sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

function seenKey(userId: string): string {
  return `${SEEN_PREFIX}${userId}`;
}

function hasSeen(userId: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(userId)) === '1';
  } catch {
    return true;
  }
}

function markSeen(userId: string): void {
  try {
    window.localStorage.setItem(seenKey(userId), '1');
  } catch {
    // Nothing to keep: see `hasSeen`.
  }
}

type Screen = 'welcome' | 'path';

function WizardFlag() {
  useWizardOpenFlag();
  return null;
}

interface WelcomeBodyProps {
  journey: SetupJourney;
  firstName: string | null;
  organization: string | null;
  onOpen: (href: string, state?: unknown) => void;
  onLater: () => void;
}

function WelcomeBody({ journey, firstName, organization, onOpen, onLater }: WelcomeBodyProps) {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>('welcome');
  const pathTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (screen === 'path') pathTitle.current?.focus();
  }, [screen]);
  const total = journey.total;
  const left = Math.max(1, journey.total - journey.done);
  const planHref = journey.source === 'path' ? journey.allHref : null;
  const task = journey.current;
  const openTask = () => { if (task?.href) onOpen(task.href, task.linkState); };

  if (screen === 'welcome') {
    return (
      <div className="space-y-6" data-testid="first-run-welcome">
        <DialogHeader className="space-y-2">
          <p className="break-words text-sm font-medium text-muted-foreground">{[organization, t('areas.shortRent.name')].filter(Boolean).join(' · ')}</p>
          <DialogTitle className="text-2xl leading-tight">
            {firstName ? t('guide.welcome.title', { name: firstName }) : t('guide.welcome.titleNoName')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {planHref ? t('guide.welcome.promise.steps') : t('guide.welcome.intro', { count: left })}
          </DialogDescription>
        </DialogHeader>
        {planHref ? (
          <Button type="button" className={TOUCH_TARGET} iconRight={<ArrowRight />} onClick={() => onOpen(planHref)} data-testid="first-run-start">
            {t('onboardingPlan.title')}
          </Button>
        ) : task?.href && <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t('guide.setup.now')}</h2>
          <p className="break-words text-lg font-semibold">{task.title}</p>
          <Button type="button" className={TOUCH_TARGET} iconRight={<ArrowRight />} onClick={openTask} data-testid="first-run-start">
            {task.cta || t('guide.welcome.start', { step: task.title })}
          </Button>
        </section>}
        <p className="flex gap-2 text-sm text-muted-foreground"><Compass aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{t('guide.welcome.promise.guide')}</p>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={() => setScreen('path')} data-testid="first-run-next">
            {t('guide.welcome.next')}
          </Button>
          <Button type="button" variant="ghost" className={TOUCH_TARGET} onClick={onLater} data-testid="first-run-later">
            {t('guide.welcome.later')}
          </Button>
        </div>
      </div>
    );
  }

  const steps: GuidePathStep[] = journey.steps.map((step) => ({ id: step.id, title: step.title, state: step.state }));
  return (
    <div className="space-y-6" data-testid="first-run-path">
      <DialogHeader className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{t('guide.welcome.pathKicker')}</p>
        <DialogTitle ref={pathTitle} tabIndex={-1} className="text-2xl leading-tight outline-none">{t('guide.welcome.pathTitle', { count: total })}</DialogTitle>
        <DialogDescription className="text-base">{t('guide.welcome.pathIntro')}</DialogDescription>
      </DialogHeader>
      <GuidePath label={t('guide.setup.label')} steps={steps} density="compact" className="max-h-[45dvh] overflow-y-auto pr-1" />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className={TOUCH_TARGET} onClick={onLater} data-testid="first-run-later">
          {t('guide.welcome.later')}
        </Button>
        {task?.href ? (
          <Button type="button" className={TOUCH_TARGET} iconRight={<ArrowRight />} onClick={openTask} data-testid="first-run-start">
            {t('guide.welcome.start', { step: task.title })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The first wizard of a new host, «Inizia con CasaZen» as a layer over the app (the wizard rules: it opens on its own layer, never sends the
 * person away, always has a way out). It opens by itself on the Home of Affitti brevi the first time the organization administrator arrives there
 * with the setup still to complete, once per person on this device. The primary action opens the setup plan when the host has one,
 * otherwise their next permitted checklist task. The steps and their current task are also available inside the dialog. «Più tardi» closes it for good: the same road waits in the «Guida» of the header,
 * and the welcome says where it is.
 *
 * It replaces the entry «Inizia con CasaZen» of the menu: after the first access the road is in the guide and on the home.
 */
export function FirstRunWizard() {
  const { user, org } = useCurrentUser();
  const { contexts } = useWorkspace();
  const { pathname } = useLocation();
  const hasQueryClient = useContext(QueryClientContext) !== undefined;
  const userId = user?.id ? String(user.id) : null;
  const onHome = pathname.replace(/\/+$/, '') === SHORT_RENT_HOME;
  if (!hasQueryClient || !userId || !onHome || !isOrgBillingAdmin(contexts)) return null;
  return <FirstRunWelcome key={userId} userId={userId} orgId={org?.id} organization={org?.name ?? null} firstName={user?.firstName?.trim() || null} />;
}

function FirstRunWelcome({ userId, orgId, firstName, organization }: { userId: string; orgId?: string; firstName: string | null; organization: string | null }) {
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const [seen, setSeen] = useState(() => hasSeen(userId));
  const resume = usePlanResume(userId, orgId, !seen);
  const showWelcome = !seen && !resume.pending && !resume.step;
  const { journey } = useSetupJourney({ enabled: showWelcome });

  if (!showWelcome || !journey?.current || (!journey.current.href && !journey.allHref)) return null;
  if (journey.source === 'path' && !hasPermission('short-rent', 'property.read')) return null;

  const close = () => {
    markSeen(userId);
    setSeen(true);
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-xl" data-testid="first-run-wizard">
        <WizardFlag />
        <WelcomeBody
          journey={journey}
          firstName={firstName}
          organization={organization}
          onLater={close}
          onOpen={(href, state) => {
            close();
            navigate(href, { state });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
