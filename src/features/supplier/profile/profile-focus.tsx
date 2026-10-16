import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivationStatus, SupplierProfile } from '@/types/supplier';

const ACTIVATION_PATH = '/app/supplier/activation';
const SHOWCASE_PATH = '/app/supplier/showcase';

/** What is left to do for the profile to be fully active, the one thing at a time. */
type ProfileFocusState =
  | { kind: 'pending'; missing: string[] }
  | { kind: 'terms'; blocking: boolean }
  | { kind: 'hours' }
  | { kind: 'ready' };

interface FocusInput {
  profile: Pick<SupplierProfile, 'status'>;
  /** The activation status of the server: the requirements still missing and the Terms of Service. Unknown while it loads or fails. */
  activation: ActivationStatus | undefined;
  /** Whether at least one day has working hours; `undefined` while that is not known (the hours then decide nothing). */
  hoursConfigured: boolean | undefined;
}

/**
 * The one thing to say about the profile, in the order of what matters: the requirements of an inactive profile, the new Terms of
 * Service, the working hours (without them there are no slots to book), and, when nothing is left, that it is all in order. A suspended
 * supplier gets none: the banner of the console already says it, and a second red block would be two places to look.
 */
function focusStateOf({ profile, activation, hoursConfigured }: FocusInput): ProfileFocusState | null {
  if (profile.status === 'Pending') {
    const missing = (activation?.steps ?? []).flatMap((step) => (step.required && step.blocker ? [step.blocker] : []));
    return { kind: 'pending', missing };
  }
  if (profile.status !== 'Active') return null;
  if (activation?.tos.reacceptanceRequired) return { kind: 'terms', blocking: activation.tos.blocksActions };
  if (hoursConfigured === false) return { kind: 'hours' };
  return { kind: 'ready' };
}

interface ProfileFocusProps extends FocusInput {
  /** The status and the hours are read: until they are, an active profile shows a place holder, so that "all in order" never flashes before "set your hours". */
  settled: boolean;
  onSetHours: () => void;
}

/** The one highlighted block of the page: where the profile stands and what to do about it. */
export function ProfileFocus({ profile, activation, hoursConfigured, settled, onSetHours }: ProfileFocusProps) {
  const { t, i18n } = useTranslation();

  if (profile.status === 'Active' && !settled) return <Skeleton aria-hidden="true" className="h-36 w-full rounded-xl" data-testid="supplier-profile-focus-loading" />;

  const state = focusStateOf({ profile, activation, hoursConfigured });
  if (!state) return null;

  const kicker = t('supplier.profile.focus.kicker');
  const testId = 'supplier-profile-focus';
  const actionId = 'supplier-profile-focus-action';

  switch (state.kind) {
    case 'pending': {
      // A code this version has no words for is left out: the activation page shows the rest, and the list never shows a key.
      const missing = state.missing.filter((code) => i18n.exists(`supplier.activation.blockers.${code}`));
      return (
        <FocusBlock
          data-testid={testId}
          tone="warning"
          kicker={kicker}
          title={t('supplier.completeActivationHint')}
          body={
            <>
              <p>{t('status.supplier.Pending.explain')}</p>
              {missing.length > 0 ? (
                <>
                  <p className="mt-2 font-medium">{t('supplier.activation.summary.missing')}</p>
                  <ul role="list" className="mt-1 list-disc space-y-0.5 pl-5">
                    {missing.map((code) => (
                      <li key={code} data-testid={`supplier-profile-missing-${code}`}>
                        {t(`supplier.activation.blockers.${code}`)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          }
          primary={{ label: t('supplier.goToActivation'), href: ACTIVATION_PATH, testId: actionId }}
        />
      );
    }
    case 'terms':
      return (
        <FocusBlock
          data-testid={testId}
          tone="warning"
          kicker={kicker}
          title={t('supplier.activation.reaccept.banner')}
          body={state.blocking ? t('supplier.activation.reaccept.bannerBlocking') : t('supplier.activation.reaccept.bannerSoft')}
          primary={{ label: t('supplier.activation.reaccept.bannerAction'), href: ACTIVATION_PATH, testId: actionId }}
        />
      );
    case 'hours':
      return (
        <FocusBlock
          data-testid={testId}
          tone="warning"
          kicker={kicker}
          title={t('supplier.profile.focus.hours.title')}
          body={t('supplier.profile.focus.hours.body')}
          primary={{ label: t('supplier.profile.focus.hours.action'), onClick: onSetHours, testId: actionId }}
        />
      );
    case 'ready':
      return (
        <FocusBlock
          data-testid={testId}
          tone="success"
          kicker={kicker}
          title={t('supplier.profile.focus.ready.title')}
          body={t('status.supplier.Active.explain')}
          primary={{ label: t('supplier.profile.focus.ready.action'), href: SHOWCASE_PATH, testId: actionId }}
        />
      );
  }
}
