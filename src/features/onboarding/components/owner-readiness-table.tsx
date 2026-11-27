import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, CircleDashed, type LucideIcon } from 'lucide-react';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import {
  normalizePortalState,
  ownerFieldKey,
  ownerFinancialPath,
  ownerIssueKey,
  ownerPortalStateKey,
  ownerReasonKey,
} from '@/lib/owner-onboarding';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import type { OwnerOnboardingProperty, OwnerOnboardingReason, OwnershipIssue } from '@/types/owner-accounting.types';
import type { OwnerPortalState, OwnerReadinessFlags, OwnerReadinessOwner } from '@/types/owner-onboarding.types';

const TOUCH_LINK = 'inline-flex min-h-11 items-center underline underline-offset-4';

export type OwnerDimension = keyof OwnerReadinessFlags;

const DIMENSION_TITLE_KEYS: Record<OwnerDimension, string> = {
  registry: 'ownerOnboarding.dimensions.registry',
  ownership: 'ownerOnboarding.dimensions.ownership',
  mandate: 'ownerOnboarding.dimensions.mandate',
  fiscalProfile: 'ownerOnboarding.dimensions.fiscalProfile',
  payment: 'ownerOnboarding.dimensions.payment',
  portal: 'ownerOnboarding.dimensions.portal',
};

const PORTAL_TONES: Record<OwnerPortalState, { tone: StatusTone; Icon: LucideIcon }> = {
  notReady: { tone: 'neutral', Icon: CircleDashed },
  ready: { tone: 'info', Icon: CircleDashed },
  invited: { tone: 'info', Icon: CircleDashed },
  accepted: { tone: 'success', Icon: CheckCircle2 },
  expired: { tone: 'warning', Icon: Ban },
  revoked: { tone: 'neutral', Icon: Ban },
};

interface MarkProps {
  tone: StatusTone;
  Icon: LucideIcon;
  label: string;
  testId?: string;
}

export function Mark({ tone, Icon, label, testId }: MarkProps) {
  return (
    <span
      data-testid={testId}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[tone])}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

export function ReadyMark({ ready, testId }: { ready: boolean; testId?: string }) {
  const { t } = useTranslation();
  return ready ? (
    <Mark tone="success" Icon={CheckCircle2} label={t('ownerOnboarding.ready')} testId={testId} />
  ) : (
    <Mark tone="warning" Icon={CircleDashed} label={t('ownerOnboarding.toComplete')} testId={testId} />
  );
}

export function PortalStateMark({ state, testId }: { state: unknown; testId?: string }) {
  const { t } = useTranslation();
  const known = normalizePortalState(state);
  const { tone, Icon } = PORTAL_TONES[known];
  return <Mark tone={tone} Icon={Icon} label={t(ownerPortalStateKey(known))} testId={testId} />;
}

export function ReasonLine({ reason, propertyName }: { reason: OwnerOnboardingReason; propertyName?: string | null }) {
  const { t } = useTranslation();
  const textKey = ownerReasonKey(reason.code);
  const fieldKey = ownerFieldKey(reason.field);
  return (
    <span className="break-words">
      {textKey ? t(textKey) : t('ownerOnboarding.reasons.unknown')}
      {fieldKey ? ` (${t(fieldKey)})` : ''}
      {propertyName ? ` - ${propertyName}` : ''}
    </span>
  );
}

function IssueLine({ issue }: { issue: OwnershipIssue }) {
  const { t } = useTranslation();
  return (
    <span className="break-words">
      {t(ownerIssueKey(issue.kind), { total: issue.totalPercent })} {issue.to ? t('ownerOnboarding.issues.range', { from: issue.from, to: issue.to }) : t('ownerOnboarding.issues.openRange', { from: issue.from })}
    </span>
  );
}

interface OwnerReadinessTableProps {
  owners: readonly OwnerReadinessOwner[];
  dimensions: readonly OwnerDimension[];
  properties: readonly OwnerOnboardingProperty[];
  canComplete?: boolean | readonly OwnerDimension[];
  allReadyLabel: string;
  testId: string;
}

function hasCompleteLink(canComplete: OwnerReadinessTableProps['canComplete'], owner: OwnerReadinessOwner): boolean {
  if (canComplete === undefined || canComplete === false) return false;
  if (canComplete === true) return true;
  return canComplete.some((dimension) => !owner.ready[dimension]);
}

export function OwnerReadinessTable({ owners, dimensions, properties, canComplete, allReadyLabel, testId }: OwnerReadinessTableProps) {
  const { t } = useTranslation();
  const names = new Map(properties.map((property) => [property.propertyId, property.name] as const));
  const incomplete = owners.filter((owner) => dimensions.some((dimension) => !owner.ready[dimension]));

  if (incomplete.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid={`${testId}-all-ready`}>
        {allReadyLabel}
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto" data-testid={testId}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">{t('ownerOnboarding.table.caption')}</caption>
        <thead>
          <tr className="border-b text-foreground/70">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('ownerOnboarding.table.owner')}
            </th>
            {dimensions.map((dimension) => (
              <th key={dimension} scope="col" className="px-3 py-2 font-medium">
                {t(DIMENSION_TITLE_KEYS[dimension])}
              </th>
            ))}
            <th scope="col" className="py-2 pl-3 font-medium">
              {t('ownerOnboarding.table.missing')}
            </th>
          </tr>
        </thead>
        <tbody>
          {incomplete.map((owner) => {
            const reasons = owner.reasons.filter((reason) => dimensions.includes(reason.dimension as OwnerDimension));
            return (
              <tr key={owner.ownerId} className="border-b align-top" data-testid={`${testId}-row`}>
                <th scope="row" className="py-3 pr-3 font-medium">
                  <span className="break-words">{owner.displayName}</span>
                  {hasCompleteLink(canComplete, owner) ? (
                    <Link to={ownerFinancialPath(owner.ownerId)} className={cn(TOUCH_LINK, 'mt-1 block text-sm font-normal')} data-testid={`${testId}-complete`}>
                      {t('ownerOnboarding.table.complete')}
                      <span className="sr-only">{` - ${owner.displayName}`}</span>
                    </Link>
                  ) : null}
                </th>
                {dimensions.map((dimension) => (
                  <td key={dimension} className="px-3 py-3">
                    <ReadyMark ready={owner.ready[dimension]} />
                  </td>
                ))}
                <td className="py-3 pl-3">
                  {reasons.length > 0 ? (
                    <ul role="list" className="list-disc space-y-1 pl-5">
                      {reasons.map((reason, index) => (
                        <li key={`${reason.dimension}-${reason.code}-${reason.field ?? ''}-${reason.propertyId ?? ''}-${index}`}>
                          <ReasonLine reason={reason} propertyName={reason.propertyId ? (names.get(reason.propertyId) ?? t('ownerOnboarding.table.aProperty')) : null} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-foreground/70">{t('ownerOnboarding.table.nothingMissing')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PropertyShareListProps {
  properties: readonly OwnerOnboardingProperty[];
  allReadyLabel: string;
  testId: string;
}

export function PropertyShareList({ properties, allReadyLabel, testId }: PropertyShareListProps): ReactNode {
  const { t } = useTranslation();
  if (properties.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid={`${testId}-all-ready`}>
        {allReadyLabel}
      </p>
    );
  }

  return (
    <ul role="list" className="space-y-3" data-testid={testId}>
      {properties.map((property) => (
        <li key={property.propertyId} className="min-w-0 rounded-lg border p-3" data-testid={`${testId}-item`}>
          <p className="break-words text-sm font-semibold">{property.name}</p>
          <ul role="list" className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {property.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>
                <ReasonLine reason={reason} />
              </li>
            ))}
            {property.issues.map((issue, index) => (
              <li key={`${issue.kind}-${issue.from}-${index}`}>
                <IssueLine issue={issue} />
              </li>
            ))}
            {property.reasons.length === 0 && property.issues.length === 0 ? <li>{t('ownerOnboarding.table.nothingMissing')}</li> : null}
          </ul>
        </li>
      ))}
    </ul>
  );
}
