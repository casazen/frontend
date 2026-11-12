import { useId, useState } from 'react';
import { GitMerge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { formatDay } from '@/features/crm/lib/crm-format';
import { contactChannelLabel, originLabel } from '@/features/crm/lib/contact-labels';
import { cn } from '@/lib/utils';
import { useDismissMergeCandidate, useMergeProfiles } from '@/queries/crm-merge';
import type { CrmMergeCandidate, CrmMergeProfile } from '@/types/crm-merge.types';
import { likelihoodLabel, likelihoodOf, reasonLabel } from './merge-labels';

interface ProfileSummaryProps {
  profile: CrmMergeProfile;
  /** 1 or 2: the order the two profiles are shown in. */
  position: number;
}

/** One of the two profiles of a proposal: name, country, stays, last stay, properties and contacts (the values masked). No birth date, no document. */
function ProfileSummary({ profile, position }: ProfileSummaryProps) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const lastStay = formatDay(profile.lastStayAt, i18n.language);

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2" data-testid="crm-merge-profile">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{t('crm.merge.profile.position', { position })}</p>
      <h3 id={headingId} className="break-words text-base font-semibold">
        {profile.displayName || t('crm.merge.profile.noName')}
      </h3>
      <dl className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-foreground/70">{t('crm.merge.profile.country')}</dt>
        <dd>{profile.country || '—'}</dd>
        <dt className="text-foreground/70">{t('crm.merge.profile.stays')}</dt>
        <dd>{profile.stays}</dd>
        <dt className="text-foreground/70">{t('crm.merge.profile.lastStay')}</dt>
        <dd>{lastStay ?? t('crm.merge.profile.noStay')}</dd>
        <dt className="text-foreground/70">{t('crm.merge.profile.properties')}</dt>
        <dd className="break-words">{profile.propertyNames.length > 0 ? profile.propertyNames.join(', ') : '—'}</dd>
        <dt className="text-foreground/70">{t('crm.merge.profile.contacts')}</dt>
        <dd>
          {profile.contacts.length === 0 ? (
            t('crm.merge.profile.noContacts')
          ) : (
            <ul role="list" className="space-y-1">
              {profile.contacts.map((contact, index) => (
                <li key={`${contact.channel}-${contact.valueMasked}-${index}`} className="break-words">
                  {contactChannelLabel(t, contact.channel)} · {originLabel(t, contact.origin)} · <span className="break-all">{contact.valueMasked}</span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
    </section>
  );
}

interface MergeCandidateCardProps {
  candidate: CrmMergeCandidate;
}

/**
 * One merge proposal (E07/F01/US04/T03, NF-88): the two profiles side by side, how likely it is that they are one guest and why, in
 * words (never a date or a document), and the two decisions. "Merge" asks which profile to keep (none is chosen for the host) and says
 * plainly that the history and the contacts of the other move to it, that no consent changes and that it cannot be undone. "They are not
 * the same person" asks once and the pair never comes back. A proposal already decided, or out of reach, is told in plain words.
 */
export function MergeCandidateCard({ candidate }: MergeCandidateCardProps) {
  const { t } = useTranslation();
  const merge = useMergeProfiles();
  const dismiss = useDismissMergeCandidate();
  const radioName = useId();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [survivor, setSurvivor] = useState<string | null>(null);

  const { profileA, profileB } = candidate;
  const nameOf = (profile: CrmMergeProfile) => profile.displayName || t('crm.merge.profile.noName');
  const likelihood = likelihoodOf(candidate.score);

  /** What tells the two profiles apart in the choice of the one to keep: where they are from, how many stays, and one address. */
  const describe = (profile: CrmMergeProfile) =>
    [profile.country, t('crm.merge.dialog.stays', { count: profile.stays }), profile.contacts[0]?.valueMasked].filter(Boolean).join(' · ');

  const closeMerge = (open: boolean) => {
    setMergeOpen(open);
    // Nothing stays chosen from one time to the next: the host chooses every time.
    if (!open) setSurvivor(null);
  };

  return (
    <article
      aria-label={t('crm.merge.card.label', { a: nameOf(profileA), b: nameOf(profileB) })}
      className="min-w-0 space-y-5 rounded-xl border p-4 sm:p-6"
      data-testid="crm-merge-card"
      data-candidate-id={candidate.id}
      data-likelihood={likelihood}
    >
      <header className="space-y-2">
        <h2
          data-testid="crm-merge-likelihood"
          className={cn(
            'inline-flex max-w-full items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset',
            STATUS_TONE_CLASSES[likelihood === 'possible' ? 'neutral' : 'info'],
          )}
        >
          {likelihoodLabel(t, candidate.score)}
        </h2>
        <ul role="list" aria-label={t('crm.merge.reasons.title')} className="space-y-0.5 text-sm text-foreground/70" data-testid="crm-merge-reasons">
          {candidate.reasons.map((reason) => (
            <li key={reason}>{reasonLabel(t, reason)}</li>
          ))}
        </ul>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-0 md:divide-x">
        <div className="min-w-0 md:pr-6">
          <ProfileSummary profile={profileA} position={1} />
        </div>
        <div className="min-w-0 md:pl-6">
          <ProfileSummary profile={profileB} position={2} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setMergeOpen(true)}
          aria-label={t('crm.merge.card.mergeAria', { a: nameOf(profileA), b: nameOf(profileB) })}
          data-testid="crm-merge-open"
        >
          <GitMerge className="size-4" aria-hidden="true" />
          {t('crm.merge.card.merge')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDismissOpen(true)}
          aria-label={t('crm.merge.card.notSameAria', { a: nameOf(profileA), b: nameOf(profileB) })}
          data-testid="crm-merge-dismiss-open"
        >
          {t('crm.merge.card.notSame')}
        </Button>
      </div>

      <ConfirmationDialog
        open={mergeOpen}
        onOpenChange={closeMerge}
        title={t('crm.merge.dialog.title')}
        description={t('crm.merge.dialog.description')}
        confirmLabel={t('crm.merge.dialog.confirm')}
        consequences={[t('crm.merge.dialog.history'), t('crm.merge.dialog.consent'), t('crm.merge.dialog.final')]}
        confirmDisabled={survivor === null}
        isLoading={merge.isPending}
        onConfirm={async () => {
          if (survivor !== null) await merge.mutateAsync({ candidateId: candidate.id, survivorProfileId: survivor });
        }}
      >
        <ChoiceGroup legend={t('crm.merge.dialog.legend')} legendVisible minCardWidth={14}>
          {[profileA, profileB].map((profile) => (
            <ChoiceCard
              key={profile.id}
              name={radioName}
              value={profile.id}
              checked={survivor === profile.id}
              onChange={() => setSurvivor(profile.id)}
              title={nameOf(profile)}
              description={describe(profile)}
              data-testid={`crm-merge-survivor-${profile.id}`}
            />
          ))}
        </ChoiceGroup>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title={t('crm.merge.dismiss.title')}
        description={t('crm.merge.dismiss.description')}
        confirmLabel={t('crm.merge.dismiss.confirm')}
        isLoading={dismiss.isPending}
        onConfirm={async () => {
          await dismiss.mutateAsync(candidate.id);
        }}
      />
    </article>
  );
}
