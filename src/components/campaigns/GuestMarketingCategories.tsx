import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { MarketingError } from './MarketingInputs';

interface Categories {
  tripType: string[];
  tripTypeOverride: string[] | null;
  loyalty: string;
  spend: number;
  spendBand: string | null;
  dismissedInterests: string[];
  daysSinceLastStay: number | null;
  period: string[];
  channels: string[];
  averageStayNights: number | null;
  averageLeadDays: number | null;
  interests: string[];
  suggestedInterests: string[];
}

export function GuestMarketingCategories({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const path = '/marketing/guests/' + profileId + '/categories';
  const query = useQuery({
    queryKey: ['marketing-categories', profileId],
    queryFn: () => ApiClient.get<Categories>(path),
  });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{t('marketingStudio.categories')}</h2>
      <MarketingError error={query.error} />
      {query.data && (
        <CategoriesEditor
          key={profileId + '-' + query.dataUpdatedAt}
          path={path}
          profileId={profileId}
          categories={query.data}
        />
      )}
    </section>
  );
}

function CategoriesEditor({
  categories: c,
  path,
  profileId,
}: {
  categories: Categories;
  path: string;
  profileId: string;
}) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const client = useQueryClient();
  const [interests, setInterests] = useState(c.interests.join(', '));
  const [dismissed, setDismissed] = useState<string[]>(c.dismissedInterests);
  const [trip, setTrip] = useState<string[] | null>(c.tripTypeOverride);
  const [suggestions, setSuggestions] = useState(c.suggestedInterests);
  const suggest = useMutation({
    mutationFn: () => ApiClient.post<{ suggestedInterests: string[] }>(path + '/suggest', {}),
    onSuccess: (data) => setSuggestions(data.suggestedInterests),
  });
  const interestList = interests
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const save = useMutation({
    mutationFn: () =>
      ApiClient.put<void>(path, {
        interests: interestList,
        dismissedInterests: dismissed,
        tripType: trip,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['marketing-categories', profileId] }),
  });
  return (
    <div className="space-y-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        {[
          [t('marketingStudio.fields.stage'), t('marketingStudio.category.' + c.loyalty)],
          [
            t('marketingStudio.fields.season'),
            c.period.map((s) => t('marketingStudio.category.' + s, { defaultValue: s })).join(', '),
          ],
          [t('marketingStudio.spendBand'), c.spendBand ? t('marketingStudio.category.'+c.spendBand) : null],
          [t('marketingStudio.channel'), c.channels.join(', ')],
          [t('marketingStudio.recency'), c.daysSinceLastStay],
          [t('marketingStudio.stayLength'), c.averageStayNights],
          [t('marketingStudio.leadTime'), c.averageLeadDays],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd>{value || (value === 0 ? '0' : '—')}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>
          {t('marketingStudio.trip')}:{' '}
          {c.tripType.map((s) => t('marketingStudio.category.' + s, { defaultValue: s })).join(', ') || '—'}
        </summary>
        <div className="mt-2 flex flex-wrap gap-3">
          {trip !== null && <Button variant="ghost" size="sm" onClick={() => setTrip(null)}>{t('marketingStudio.automatic')}</Button>}
          {['family', 'couple', 'group', 'business', 'withPets'].map((kind) => (
            <label className="flex items-center gap-1" key={kind}>
              <input
                type="checkbox"
                checked={(trip ?? c.tripType).includes(kind)}
                onChange={(e) =>
                  setTrip(
                    e.target.checked ? [...(trip ?? c.tripType), kind] : (trip ?? c.tripType).filter((s) => s !== kind),
                  )
                }
              />
              {t('marketingStudio.category.' + kind)}
            </label>
          ))}
        </div>
      </details>
      <label className="block">
        {t('marketingStudio.fields.interests')}
        <Input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder={t('marketingStudio.commaValues')}
        />
      </label>
      {flags.marketingGuestInterestAi && <Button variant="outline" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
        {t('marketingStudio.suggestInterests')}
      </Button>}
      {suggestions
        .filter((s) => !dismissed.includes(s) && !interestList.includes(s))
        .map((s) => (
          <div key={s} className="flex flex-wrap items-center gap-2">
            <span>{t('marketingStudio.category.'+s,{defaultValue:s})}</span>
            <Button size="sm" variant="outline" onClick={() => setInterests([...interestList, s].join(', '))}>
              {t('marketingStudio.accept')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed((old) => [...old, s])}>
              {t('marketingStudio.dismiss')}
            </Button>
          </div>
        ))}
      <MarketingError error={suggest.error ?? save.error} />
      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {t('shared.save')}
      </Button>
    </div>
  );
}
