import { useContext, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass, Footprints, PauseCircle } from 'lucide-react';
import { GuidePath, type GuidePathStep } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import { useWizardOpenFlag } from '@/store/use-wizard-open-flag';
import { useSetupJourney, type SetupJourney } from './use-setup-journey';

/** The welcome has been seen (or put off) on this device by this person: it opens by itself only once. */
const SEEN_PREFIX = 'casazen:welcome-seen:';

/** The Home of Affitti brevi, the one page where the welcome opens. */
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
    // Storage refused (private mode): the welcome would come back at every page; better not to insist.
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

/** While the dialog is on screen it counts as a wizard: the popup alerts wait for it (ADR-025-R7). */
function WizardFlag() {
  useWizardOpenFlag();
  return null;
}

interface WelcomeBodyProps {
  journey: SetupJourney;
  firstName: string | null;
  onStart: () => void;
  onLater: () => void;
}

function WelcomeBody({ journey, firstName, onStart, onLater }: WelcomeBodyProps) {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>('welcome');
  const total = journey.total;
  const left = Math.max(1, journey.total - journey.done);

  if (screen === 'welcome') {
    const promises = [
      { icon: Footprints, text: t('guide.welcome.promise.steps') },
      { icon: PauseCircle, text: t('guide.welcome.promise.pause') },
      { icon: Compass, text: t('guide.welcome.promise.guide') },
    ];
    return (
      <div className="space-y-6" data-testid="first-run-welcome">
        <DialogHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{t('guide.welcome.kicker')}</p>
          <DialogTitle className="text-2xl leading-tight">
            {firstName ? t('guide.welcome.title', { name: firstName }) : t('guide.welcome.titleNoName')}
          </DialogTitle>
          <DialogDescription className="text-base">{t('guide.welcome.intro', { count: left })}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {promises.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                <Icon className="size-4" />
              </span>
              <span className="pt-1.5 text-sm">{text}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className={TOUCH_TARGET} onClick={onLater} data-testid="first-run-later">
            {t('guide.welcome.later')}
          </Button>
          <Button type="button" className={TOUCH_TARGET} iconRight={<ArrowRight />} onClick={() => setScreen('path')} data-testid="first-run-next">
            {t('guide.welcome.next')}
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
        <DialogTitle className="text-2xl leading-tight">{t('guide.welcome.pathTitle', { count: total })}</DialogTitle>
        <DialogDescription className="text-base">{t('guide.welcome.pathIntro')}</DialogDescription>
      </DialogHeader>
      <GuidePath label={t('guide.setup.label')} steps={steps} density="compact" className="max-h-[45dvh] overflow-y-auto pr-1" />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className={TOUCH_TARGET} onClick={onLater} data-testid="first-run-later">
          {t('guide.welcome.later')}
        </Button>
        {journey.current?.href ? (
          <Button type="button" className={TOUCH_TARGET} iconRight={<ArrowRight />} onClick={onStart} data-testid="first-run-start">
            {t('guide.welcome.start', { step: journey.current.title })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The first wizard of a new host, «Inizia con CasaZen» as a layer over the app (the wizard rules: it opens on its own layer, never sends the
 * person away, always has a way out). It opens by itself on the Home of Affitti brevi the first time the organization administrator arrives there
 * with the setup still to complete (a step to do now), once per person on this device: a welcome in one screen, the road of the setup in a
 * second, and «Inizia» that opens the step to do now. «Più tardi» closes it for good: the same road waits in the «Guida» of the header,
 * and the welcome says where it is.
 *
 * It replaces the entry «Inizia con CasaZen» of the menu: after the first access the road is in the guide and on the home.
 */
export function FirstRunWizard() {
  const { user } = useCurrentUser();
  const { contexts } = useWorkspace();
  const { pathname } = useLocation();
  // Like the guide, it can be rendered where there is no query client (an isolated test of the shell): there is then no setup to read.
  const hasQueryClient = useContext(QueryClientContext) !== undefined;
  const userId = user?.id ? String(user.id) : null;
  // Only on the Home: never over a form or a wizard (a new host is first sent to the short form of the first property, and arrives here after it).
  const onHome = pathname.replace(/\/+$/, '') === SHORT_RENT_HOME;
  if (!hasQueryClient || !userId || !onHome || !isOrgBillingAdmin(contexts)) return null;
  // Keyed by the person: another account on the same device starts from what that person has seen.
  return <FirstRunWelcome key={userId} userId={userId} firstName={user?.firstName?.trim() || null} />;
}

function FirstRunWelcome({ userId, firstName }: { userId: string; firstName: string | null }) {
  const navigate = useNavigate();
  const [seen, setSeen] = useState(() => hasSeen(userId));
  const { journey } = useSetupJourney({ enabled: !seen });

  // Open while the setup has a step to do now and the welcome was not seen: closing it marks it seen, which closes it.
  const open = !seen && journey !== null && journey.current?.href !== undefined;
  if (!journey || !open) return null;

  // «Più tardi», Esc or a tap outside: it does not come back by itself, and the same road waits in the «Guida» of the header (the welcome says so).
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
          onLater={close}
          onStart={() => {
            const target = journey.current;
            close();
            if (target?.href) navigate(target.href, { state: target.linkState });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
