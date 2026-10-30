import { useTranslation } from 'react-i18next';
import { Baby, Cigarette, CigaretteOff, KeyRound, LogOut, Moon, PartyPopper, PawPrint, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isItalianFallback, pickText, policyStages, shortTime, type PolicyWindow } from '@/features/public-booking/lib/property-profile';
import type { PublicCancellationPolicy, PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

interface RuleRow {
  key: string;
  icon: LucideIcon;
  text: string;
  /** The house does not allow it: the icon is struck through (and the words say so). */
  no?: boolean;
}

/** How one window of the policy is said: in days when the hours are whole days, else in hours; `Start` for a window with no notice at all. */
function windowCount(window: PolicyWindow): { unit: 'Days' | 'Hours' | 'Start'; count: number } {
  if (window.count === 0) return { unit: 'Start', count: 0 };
  return { unit: window.unit === 'day' ? 'Days' : 'Hours', count: window.count };
}

/** What the policy gives back, as the stages of a short list. Nothing is promised that the numbers of the policy do not say. */
function CancellationBlock({ policy, summary }: { policy: PublicCancellationPolicy | null | undefined; summary: string }) {
  const { t } = useTranslation();

  if (!policy) {
    if (!summary) return null;
    return (
      <div className="pp-cancel space-y-2" data-testid="property-cancellation">
        <h3 className="public-display text-lg font-semibold">{t('publicProperty.rules.cancellationTitle')}</h3>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[var(--cz-public-muted)]">{summary}</p>
      </div>
    );
  }

  const { full, partial } = policyStages(policy);
  const stages: Array<{ share: 'full' | 'partial' | 'none'; text: string }> = [];
  if (full) {
    const { unit, count } = windowCount(full);
    stages.push({ share: 'full', text: t(`publicProperty.rules.stage.full${unit}`, { count }) });
  }
  if (partial) {
    const { unit, count } = windowCount(partial.window);
    stages.push({ share: 'partial', text: t(`publicProperty.rules.stage.partial${unit}`, { count, percent: partial.percent }) });
  }
  stages.push({ share: 'none', text: t(full || partial ? 'publicProperty.rules.stage.noneAfter' : 'publicProperty.rules.stage.noneAtAll') });

  return (
    <div className="pp-cancel" data-testid="property-cancellation">
      <h3 className="public-display flex flex-wrap items-center gap-2.5 text-lg font-semibold">
        {t('publicProperty.rules.cancellationTitle')}
        {/* The name is the catalog's: once the host changed the windows it no longer describes them. */}
        {!policy.hostOverrideApplies && policy.name ? <span className="pp-cancel__badge">{policy.name}</span> : null}
      </h3>
      <ul className="pp-cancel__stages" aria-label={t('publicProperty.rules.stagesLabel')}>
        {stages.map((stage) => (
          <li key={stage.share}>
            <span className="pp-cancel__dot" data-share={stage.share} aria-hidden="true" />
            <span>{stage.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * «Da sapere» (DB-04a): arrival and departure, the rules of the house with icons, safety, and what a cancellation gives back. Each
 * column is there only when the host gave it something; the section is not there at all when nothing is known. The structured
 * policy is read from the numbers of the policy (DB-03b), in the language of the visitor, never from a text of the catalog.
 */
export function PropertyRules({ property }: { property: PublicPropertyDetailDto }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const from = shortTime(property.checkInFrom);
  const to = shortTime(property.checkInTo);
  const out = shortTime(property.checkOutBy);
  const method = pickText(property.checkInMethod, language);

  const arrival: Array<{ key: string; icon: LucideIcon; strong: string; small?: string }> = [];
  if (from || to) {
    const strong = from && to ? t('publicProperty.rules.arrivalBetween', { from, to }) : from ? t('publicProperty.rules.arrivalFrom', { from }) : t('publicProperty.rules.arrivalUntil', { to });
    arrival.push({ key: 'arrival', icon: KeyRound, strong, small: method || undefined });
  } else if (method) {
    arrival.push({ key: 'arrival', icon: KeyRound, strong: method });
  }
  if (out) arrival.push({ key: 'departure', icon: LogOut, strong: t('publicProperty.rules.departureBy', { time: out }) });

  const rows: RuleRow[] = [];
  if (property.petsPolicy) {
    rows.push(
      property.petsPolicy === 'No'
        ? { key: 'pets', icon: PawPrint, text: t('publicProperty.rules.petsNo'), no: true }
        : { key: 'pets', icon: PawPrint, text: t(property.petsPolicy === 'Yes' ? 'publicProperty.rules.petsYes' : 'publicProperty.rules.petsOnRequest') },
    );
  }
  if (property.smokingPolicy) {
    rows.push(
      property.smokingPolicy === 'No'
        ? { key: 'smoking', icon: CigaretteOff, text: t('publicProperty.rules.smokingNo'), no: false }
        : {
            key: 'smoking',
            icon: Cigarette,
            text: t(property.smokingPolicy === 'Yes' ? 'publicProperty.rules.smokingYes' : 'publicProperty.rules.smokingOutdoors'),
          },
    );
  }
  if (property.partiesPolicy) {
    rows.push(
      property.partiesPolicy === 'No'
        ? { key: 'parties', icon: PartyPopper, text: t('publicProperty.rules.partiesNo'), no: true }
        : { key: 'parties', icon: PartyPopper, text: t('publicProperty.rules.partiesOnRequest') },
    );
  }
  const quietFrom = shortTime(property.quietHoursFrom);
  const quietTo = shortTime(property.quietHoursTo);
  if (quietFrom && quietTo) rows.push({ key: 'quiet', icon: Moon, text: t('publicProperty.rules.quiet', { from: quietFrom, to: quietTo }) });
  if (typeof property.childrenWelcome === 'boolean') {
    rows.push(
      property.childrenWelcome
        ? { key: 'children', icon: Baby, text: t('publicProperty.rules.childrenYes') }
        : { key: 'children', icon: Baby, text: t('publicProperty.rules.childrenNo'), no: true },
    );
  }

  const houseRules = property.houseRules?.trim() ?? '';
  const rulesNote = pickText(property.rulesNote, language);
  const safety = (property.safetyNotes ?? []).map((note) => ({ note, text: pickText(note, language) })).filter((item) => item.text !== '');
  const summary = property.cancellationPolicySummary?.trim() ?? '';
  const hasCancellation = Boolean(property.cancellationPolicy) || summary !== '';
  const hasColumns = arrival.length > 0 || rows.length > 0 || houseRules !== '' || rulesNote !== '' || safety.length > 0;
  if (!hasColumns && !hasCancellation) return null;

  return (
    <section id="regole" aria-labelledby="property-know-title" className="scroll-mt-20 space-y-6" data-testid="property-rules">
      <h2 id="property-know-title" className="public-display text-2xl font-semibold">
        {t('publicProperty.know.title')}
      </h2>

      {hasColumns ? (
        <div className="pp-rules">
          {arrival.length > 0 ? (
            <section aria-labelledby="property-arrival-title">
              <h3 id="property-arrival-title" className="public-display mb-3.5 text-lg font-semibold">
                {t('publicProperty.rules.arrivalTitle')}
              </h3>
              <ul className="pp-rules__list">
                {arrival.map(({ key, icon: Icon, strong, small }) => (
                  <li key={key}>
                    <span className="pp-rule-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span>
                      <strong>{strong}</strong>
                      {small ? <small>{small}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {rows.length > 0 || houseRules || rulesNote ? (
            <section aria-labelledby="property-house-title">
              <h3 id="property-house-title" className="public-display mb-3.5 text-lg font-semibold">
                {t('publicProperty.rules.houseTitle')}
              </h3>
              {rows.length > 0 ? (
                <ul className="pp-rules__list">
                  {rows.map(({ key, icon: Icon, text, no }) => (
                    <li key={key} className={cn(no && 'is-no')}>
                      <span className="pp-rule-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {houseRules ? (
                <p className={cn('whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-[var(--cz-public-muted)]', rows.length > 0 && 'mt-4')} data-testid="property-house-rules">
                  {houseRules}
                </p>
              ) : null}
              {rulesNote ? (
                <p className="pp-rules__note whitespace-pre-line break-words" lang={isItalianFallback(property.rulesNote, language) ? 'it' : undefined}>
                  {rulesNote}
                </p>
              ) : null}
            </section>
          ) : null}

          {safety.length > 0 ? (
            <section aria-labelledby="property-safety-title">
              <h3 id="property-safety-title" className="public-display mb-3.5 text-lg font-semibold">
                {t('publicProperty.rules.safetyTitle')}
              </h3>
              <ul className="pp-rules__list">
                {safety.map(({ note, text }) => (
                  <li key={`${note.it}-${text}`} lang={isItalianFallback(note, language) ? 'it' : undefined}>
                    <span className="pp-rule-icon" aria-hidden="true">
                      <ShieldCheck />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <CancellationBlock policy={property.cancellationPolicy} summary={summary} />
    </section>
  );
}
