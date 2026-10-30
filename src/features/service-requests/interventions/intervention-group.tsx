import { useTranslation } from 'react-i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { ServiceRequestGroup } from '@/types/service-request';
import { chosenSupplierOf, groupDueAt, groupStageOf, KNOWN_ROLES, memberStateOf, takerOf, type MemberState } from './intervention-group-model';

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** The states that say something went well get the quiet green; the ones that ended without the job stay as plain text. */
const GOOD_STATES: ReadonlySet<MemberState> = new Set(['tookTheJob', 'accepted']);

/**
 * The group of backup suppliers of a request (SP-BKP), for its host: one sentence that says where it stands and whose turn it is, then
 * the suppliers contacted, the one the host chose first, each with what it is doing. The host chose one supplier and the others are
 * backups: they take the job only if the chosen one does not, so the page never shows them as requests of their own.
 */
export function InterventionGroup({ group }: { group: ServiceRequestGroup }) {
  const { t, i18n } = useTranslation();
  const stage = groupStageOf(group);
  const fallback = t('longRentRequests.detail.supplierFallback');
  const chosen = chosenSupplierOf(group)?.supplierName?.trim() || fallback;
  const taker = takerOf(group)?.supplierName?.trim() || fallback;
  const due = groupDueAt(group);
  const time = due ? formatRomeDateTime(due, i18n.language, TIME) : '';

  return (
    <div className="space-y-3" data-testid="intervention-group" data-stage={stage}>
      <p className="break-words" data-testid="intervention-group-summary">
        {t(`interventions.group.stage.${stage}`, { supplier: chosen, taker, time })}
      </p>
      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-inset ring-border" data-testid="intervention-group-members">
        {group.members.map((member) => {
          const state = memberStateOf(member);
          return (
            <li
              key={member.requestId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              data-testid={`intervention-group-member-${member.requestId}`}
              data-state={state}
            >
              <span className="min-w-0 break-words font-medium">
                {member.supplierName?.trim() || fallback}
                {KNOWN_ROLES.has(member.role) ? <span className="ml-2 text-sm font-normal text-foreground/70">{t(`interventions.group.role.${member.role}`)}</span> : null}
              </span>
              <span className={cn('text-sm', GOOD_STATES.has(state) ? 'font-medium text-success-foreground' : 'text-foreground/70')}>
                {t(`interventions.group.state.${state}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
