import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { labelLanguage, useAmenityCatalog } from '@/queries/use-amenity-catalog';
import { matchesAmenity } from '../amenity-search';
import { RULE_AMENITIES, type PropertyWizardValues } from '../property-wizard-model';
import { SafetyCard } from './safety-card';

interface AmenitiesStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
}

/**
 * Step 3 · «Cosa trovano gli ospiti?» (SR-07b, NF-33): the amenities the property really has, in the groups and with the labels of the
 * catalog (`GET /api/public/amenities`: the one source of both), a search by word over the Italian and English labels, and the safety
 * sheet. The step may be left out («Salta questo passo» where it is not the last): the property then stays «Da completare». Pets and
 * smoking are not asked here: the house rules decide them, so the same thing is never asked twice.
 *
 * The cards are controlled by the list in the form, not registered one by one: a search hides cards, and a hidden card must not take
 * its amenity away from the list.
 */
export function AmenitiesStep({ form, propertyId }: AmenitiesStepProps) {
  const { t, i18n } = useTranslation();
  const catalog = useAmenityCatalog();
  const language = labelLanguage(i18n.language);
  const [query, setQuery] = useState('');
  const amenities = form.watch('amenities');
  const chosen = amenities.length;
  // The area of the first step: with one floor it gives the minimum of extinguishers (one every 200 m²).
  const area = Number(form.watch('areaSqm'));

  const toggle = (name: string) => {
    const current = form.getValues('amenities');
    form.setValue('amenities', current.includes(name) ? current.filter((amenity) => amenity !== name) : [...current, name], { shouldDirty: true });
  };

  const choosable = (catalog.data?.amenities ?? []).filter((entry) => !RULE_AMENITIES.includes(entry.name));
  const groups = (catalog.data?.groups ?? [])
    .map((group) => ({ group, entries: choosable.filter((entry) => entry.group === group.id && matchesAmenity(entry, query)) }))
    .filter(({ entries }) => entries.length > 0);
  const found = groups.reduce((sum, { entries }) => sum + entries.length, 0);

  return (
    <>
      <Field label={t('propertyWizard.amenities.search.label')} hint={t('propertyWizard.amenities.search.hint')}>
        <Input
          type="search"
          autoComplete="off"
          value={query}
          placeholder={t('propertyWizard.amenities.search.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
          // «Invio» in the search must not move the wizard on.
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          data-testid="property-wizard-amenity-search"
        />
      </Field>

      {catalog.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-busy="true" aria-label={t('propertyWizard.amenities.loading')}>
          {[0, 1, 2, 3, 4, 5].map((slot) => (
            <Skeleton key={slot} className="h-16 w-full" />
          ))}
        </div>
      ) : catalog.isError ? (
        <Alert
          variant="danger"
          data-testid="property-wizard-amenities-error"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void catalog.refetch()}>
              {t('propertyWizard.page.retry')}
            </Button>
          }
        >
          {getProblemMessage(catalog.error, t) ?? t('propertyWizard.amenities.loadFailed')}
        </Alert>
      ) : (
        <>
          {groups.map(({ group, entries }) => (
            <ChoiceGroup key={group.id} legend={group.label[language]} legendVisible minCardWidth={9}>
              {entries.map((entry) => (
                <ChoiceCard
                  key={entry.name}
                  type="checkbox"
                  value={entry.name}
                  title={entry.label[language]}
                  checked={amenities.includes(entry.name)}
                  onChange={() => toggle(entry.name)}
                />
              ))}
            </ChoiceGroup>
          ))}
          <p role="status" className="text-sm text-foreground/70" data-testid="property-wizard-amenities-found">
            {query.trim() === '' ? null : found > 0 ? t('propertyWizard.amenities.search.found', { count: found }) : t('propertyWizard.amenities.search.none', { query: query.trim() })}
          </p>
        </>
      )}

      <p role="status" className="text-sm text-foreground/70" data-testid="property-wizard-amenities-count">
        {chosen > 0 ? t('propertyWizard.amenities.count', { count: chosen }) : t('propertyWizard.amenities.none')}
      </p>

      <SafetyCard propertyId={propertyId} amenities={amenities} areaSqm={area > 0 ? area : null} />
    </>
  );
}
