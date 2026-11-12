import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useAmenityLabels } from '@/queries/use-amenity-catalog';
import { useCancellationPolicies } from '@/queries/use-properties';
import { useSiteProfile } from '@/queries/use-site-profile';
import type { Property } from '@/types';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import type { WizardStepId } from '../property-wizard-model';
import { ChannelsSummary } from './channels-summary';

interface SummarySectionProps {
  /** The property as the server has it: what was saved at each step, not what the form shows. */
  property: Property | undefined;
  /** Steps of the activation, for the state of the safety sheet. */
  steps: ComplianceWizardStep[] | undefined;
  /** The channel manager is connected to this CasaZen (its flag is on): the summary says what happens on each channel. */
  showChannels?: boolean;
  /** The channels the host chose not to publish to. */
  leftOutChannels?: readonly string[];
}

interface Row {
  label: string;
  value: string;
}

interface Block {
  id: WizardStepId;
  title: string;
  rows: Row[];
}

const hourMinute = (time: string | null | undefined) => (time ? time.slice(0, 5) : null);

/**
 * «Riepilogo» (SR-07c): what the property has, section by section, with «Modifica» to the step that holds it. It reads the property from
 * the server — so a step that was skipped shows «Non indicato» instead of the default its form started from.
 */
export function SummarySection({ property, steps, showChannels = false, leftOutChannels = [] }: SummarySectionProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const policies = useCancellationPolicies(Boolean(property?.cancellationPolicyId));
  const amenityLabel = useAmenityLabels();
  // The English headline lives in the site profile, not in the property (NF-31).
  const profile = useSiteProfile(property?.id);
  const englishTitle = profile.data?.translations?.en?.title?.trim();
  if (!property) return null;

  const notSaid = t('propertyWizard.last.summary.notSaid');
  const labels = (key: string) => t(`propertyWizard.last.summary.labels.${key}`);
  const safety = steps?.find((step) => step.id === 'safety');
  const policyName = property.cancellationPolicyId ? (policies.data?.find((policy) => policy.id === property.cancellationPolicyId)?.name ?? notSaid) : null;
  const optionOf = (group: string, value: string | null | undefined) => (value ? t(`propertyWizard.rules.${group}.${value}`) : notSaid);
  const checkIn = hourMinute(property.checkInFrom);
  const checkOut = hourMinute(property.checkOutBy);
  const quietFrom = hourMinute(property.quietHoursFrom);
  const quietTo = hourMinute(property.quietHoursTo);

  const blocks: Block[] = [
    {
      id: 'base',
      title: t('propertyWizard.last.summary.base'),
      rows: [
        { label: labels('name'), value: property.name },
        { label: labels('where'), value: [property.address, property.city].filter(Boolean).join(', ') },
        {
          label: labels('spaces'),
          value: [
            t('property.list.guestsCount', { count: property.maxGuests }),
            t('property.table.bedroomsCount', { count: property.bedrooms }),
            t('property.table.bathroomsCount', { count: property.bathrooms }),
          ].join(' · '),
        },
      ],
    },
    {
      id: 'photos',
      title: t('propertyWizard.last.summary.photos'),
      rows: [
        {
          label: labels('photos'),
          value: property.photoUrls.length > 0 ? t('propertyWizard.last.summary.photosCount', { count: property.photoUrls.length }) : t('propertyWizard.last.summary.photosNone'),
        },
      ],
    },
    {
      id: 'amenities',
      title: t('propertyWizard.last.summary.amenities'),
      rows: [
        { label: labels('amenities'), value: property.amenities.length > 0 ? property.amenities.map(amenityLabel).join(', ') : notSaid },
        {
          label: labels('safety'),
          value: !steps ? '…' : safety?.status === 'complete' ? t('propertyWizard.last.summary.safetyDone') : t('propertyWizard.last.summary.safetyOpen'),
        },
      ],
    },
    {
      id: 'descriptions',
      title: t('propertyWizard.last.summary.descriptions'),
      rows: [
        { label: labels('headline'), value: property.listingTitle?.trim() || notSaid },
        { label: labels('headlineEn'), value: englishTitle || notSaid },
      ],
    },
    {
      id: 'rules',
      title: t('propertyWizard.last.summary.rules'),
      rows: [
        {
          label: labels('times'),
          value: checkIn || checkOut ? [checkIn ? t('propertyWizard.last.summary.from', { time: checkIn }) : null, checkOut ? t('propertyWizard.last.summary.by', { time: checkOut }) : null].filter(Boolean).join(' · ') : notSaid,
        },
        {
          label: labels('house'),
          value:
            property.smokingPolicy || property.petsPolicy || property.partiesPolicy || property.childrenPolicy
              ? [
                  optionOf('smokingOptions', property.smokingPolicy),
                  optionOf('petsOptions', property.petsPolicy),
                  optionOf('partiesOptions', property.partiesPolicy),
                  optionOf('childrenOptions', property.childrenPolicy),
                ].join(' · ')
              : notSaid,
        },
        { label: labels('quiet'), value: quietFrom && quietTo ? t('propertyWizard.last.summary.range', { from: quietFrom, to: quietTo }) : notSaid },
        { label: labels('policy'), value: policyName ?? notSaid },
      ],
    },
    {
      id: 'prices',
      title: t('propertyWizard.last.summary.prices'),
      rows: [
        { label: labels('rate'), value: property.nightlyRate > 0 ? formatCurrency(property.nightlyRate, property.currency) : t('propertyWizard.last.summary.rateMissing') },
        { label: labels('weekend'), value: (property.weekendSurchargePercent ?? 0) > 0 ? `+${property.weekendSurchargePercent}%` : notSaid },
        { label: labels('cleaning'), value: property.cleaningFee > 0 ? formatCurrency(property.cleaningFee, property.currency) : notSaid },
        { label: labels('minNights'), value: t('propertyWizard.last.summary.nights', { count: property.minNights ?? 1 }) },
      ],
    },
  ];

  const edit = (step: WizardStepId) => {
    const next = new URLSearchParams(searchParams);
    next.set('step', step);
    return { search: next.toString() };
  };

  return (
    <section aria-labelledby="property-wizard-summary-title" className="min-w-0 space-y-3" data-testid="property-wizard-summary">
      <h3 id="property-wizard-summary-title" className="text-base font-semibold">
        {t('propertyWizard.last.summary.title')}
      </h3>
      <div className="space-y-4">
        {blocks.map((block) => (
          <div key={block.id} className="min-w-0 space-y-1" data-testid={`property-wizard-summary-${block.id}`}>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h4 className="text-sm font-medium">{block.title}</h4>
              <Button asChild variant="ghost" size="sm">
                <Link to={edit(block.id)} aria-label={`${t('propertyWizard.last.summary.edit')}: ${block.title}`}>
                  {t('propertyWizard.last.summary.edit')}
                </Link>
              </Button>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              {block.rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-foreground/70">{row.label}</dt>
                  <dd className="break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {showChannels ? <ChannelsSummary propertyId={property.id} leftOut={leftOutChannels} /> : null}
      </div>
    </section>
  );
}
