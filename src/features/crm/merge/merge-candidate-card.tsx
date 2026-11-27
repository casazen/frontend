import { useId, useState, type ReactNode } from 'react';
import { Building2, CalendarCheck, Check, Clock, GitMerge, Link2, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TOUCH_TARGET } from '@/components/shared/calm/calm-styles';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { CrmAvatar } from '@/features/crm/lib/crm-avatar';
import { formatDay } from '@/features/crm/lib/crm-format';
import { contactChannelLabel } from '@/features/crm/lib/contact-labels';
import { cn } from '@/lib/utils';
import { useDismissMergeCandidate, useMergeProfiles } from '@/queries/crm-merge';
import type { CrmContactChannel } from '@/types/crm.types';
import type { CrmMergeCandidate, CrmMergeProfile } from '@/types/crm-merge.types';
import { likelihoodLabel, likelihoodOf, reasonLabel } from './merge-labels';

const CONTACT_ICONS: Record<CrmContactChannel, LucideIcon> = { Email: Mail, Phone, WhatsApp: MessageCircle };

interface FactProps {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}

/** One short line about a guest: an icon, and the name of the fact for a screen reader. */
function Fact({ icon: Icon, label, children }: FactProps) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-foreground/60" aria-hidden="true" />
      <span className="min-w-0 break-words">
        <span className="sr-only">{label}: </span>
        {children}
      </span>
    </li>
  );
}

/** One of the two guests of a proposal: the face, the name and a few facts (the contacts masked). No birth date, no document. */
function ProfileSide({ profile, className }: { profile: CrmMergeProfile; className?: string }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const lastStay = formatDay(profile.lastStayAt, i18n.language);

  return (
    <section aria-labelledby={headingId} className={cn('min-w-0 space-y-3 rounded-xl bg-muted/50 p-4', className)} data-testid="crm-merge-profile">
      <div className="flex items-center gap-3">
        <CrmAvatar name={profile.displayName} />
        <h3 id={headingId} className="min-w-0 break-words text-base font-semibold">
          {profile.displayName || t('crm.merge.profile.noName')}
        </h3>
      </div>
      <ul role="list" className="space-y-1.5 text-sm text-foreground/80">
        <Fact icon={MapPin} label={t('crm.merge.profile.country')}>
          {profile.country || '—'}
        </Fact>
        <Fact icon={CalendarCheck} label={t('crm.merge.profile.stays')}>
          {t('crm.merge.profile.staysCount', { count: profile.stays })}
        </Fact>
        <Fact icon={Clock} label={t('crm.merge.profile.lastStay')}>
          {lastStay ? t('crm.merge.profile.lastStayOn', { date: lastStay }) : t('crm.merge.profile.noStay')}
        </Fact>
        <Fact icon={Building2} label={t('crm.merge.profile.properties')}>
          {profile.propertyNames.length > 0 ? profile.propertyNames.join(', ') : '—'}
        </Fact>
        {profile.contacts.length === 0 ? (
          <Fact icon={Mail} label={t('crm.merge.profile.contacts')}>
            {t('crm.merge.profile.noContacts')}
          </Fact>
        ) : (
          profile.contacts.map((contact, index) => (
            <Fact key={`${contact.channel}-${contact.valueMasked}-${index}`} icon={CONTACT_ICONS[contact.channel]} label={contactChannelLabel(t, contact.channel)}>
              <span className="break-all">{contact.valueMasked}</span>
            </Fact>
          ))
        )}
      </ul>
    </section>
  );
}

interface MergeCandidateCardProps {
  candidate: CrmMergeCandidate;
}

/**
 * One merge proposal (E07/F01/US04/T03, NF-88): the two guests facing each other with the words that say how likely it is that they are
 * one person between them, why, in words (never a date or a document), and the two decisions. "Merge" asks which card to keep (none is
 * chosen for the host) and says plainly that the history and the contacts of the other move to it, that no choice about e-mails changes
 * and that it cannot be undone. "They are different people" asks once and the pair never comes back. A proposal already decided, or
 * out of reach, is told in plain words. On a phone the two guests are stacked, one above the other.
 */
export function MergeCandidateCard({ candidate }: MergeCandidateCardProps) {
  const { t } = useTranslation();
  const merge = useMergeProfiles();
  const dismiss = useDismissMergeCandidate();
  const radioName = useId();
  const reasonsId = useId();
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
      className="min-w-0 space-y-5 rounded-2xl border bg-card p-4 sm:p-6"
      data-testid="crm-merge-card"
      data-candidate-id={candidate.id}
      data-likelihood={likelihood}
    >
      {/* The words come first in the page for a screen reader and sit between the two guests for the eyes. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
        <div className="order-2 flex items-center gap-3 md:order-none md:col-start-2 md:row-start-1 md:flex-col md:justify-center">
          <span aria-hidden="true" className="h-px flex-1 bg-border md:hidden" />
          <h2
            data-testid="crm-merge-likelihood"
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-semibold ring-1 ring-inset md:max-w-44 md:flex-col md:rounded-2xl',
              STATUS_TONE_CLASSES[likelihood === 'possible' ? 'neutral' : 'info'],
            )}
          >
            <Link2 className="size-4 shrink-0" aria-hidden="true" />
            {likelihoodLabel(t, candidate.score)}
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-border md:hidden" />
        </div>
        <ProfileSide profile={profileA} className="order-1 md:order-none md:col-start-1 md:row-start-1" />
        <ProfileSide profile={profileB} className="order-3 md:order-none md:col-start-3 md:row-start-1" />
      </div>

      <div className="space-y-2">
        <p id={reasonsId} className="text-sm font-medium text-foreground/70">
          {t('crm.merge.reasons.title')}
        </p>
        <ul role="list" aria-labelledby={reasonsId} className="flex flex-wrap gap-2" data-testid="crm-merge-reasons">
          {candidate.reasons.map((reason) => (
            <li key={reason} className={cn('inline-flex max-w-full items-start gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium ring-1 ring-inset', STATUS_TONE_CLASSES.success)}>
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{reasonLabel(t, reason)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className={cn(TOUCH_TARGET, 'w-full sm:w-auto')}
          onClick={() => setMergeOpen(true)}
          aria-label={t('crm.merge.card.mergeAria', { a: nameOf(profileA), b: nameOf(profileB) })}
          data-testid="crm-merge-open"
        >
          <GitMerge className="size-4 shrink-0" aria-hidden="true" />
          {t('crm.merge.card.merge')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(TOUCH_TARGET, 'w-full sm:w-auto')}
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
          if (survivor === null) return;
          // The other profile of the pair goes: the page of the profile that goes must not come back from what the app has read.
          const discardedProfileId = survivor === profileA.id ? profileB.id : profileA.id;
          await merge.mutateAsync({ candidateId: candidate.id, survivorProfileId: survivor, discardedProfileId });
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
