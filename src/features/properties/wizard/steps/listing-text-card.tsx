import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { listingTextApi, type ListingTextBasis } from '@/api/listing-text.api';
import { getHttpStatus } from '@/lib/api-errors';
import { useAmenityLabels } from '@/queries/use-amenity-catalog';
import { describeBasis } from '../listing-text-basis';
import { reducePhotosForAi } from '../photos/reduce-photo';
import type { PropertyWizardValues } from '../property-wizard-model';
import { LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX, suggestListingText } from '../suggest-listing-text';

/** Fewer photos than this and the AI sees too little of the house: the card says so. */
const FEW_PHOTOS = 3;

/** How the text on screen came: written by the AI (and from what), or composed from the data because the AI could not write it. */
type Outcome =
  | { kind: 'ai'; basedOn: ListingTextBasis; photosSent: number }
  | { kind: 'composed'; aiAvailable: boolean };

interface ListingTextCardProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
  /** The photos of the gallery as the host sees them, cover first: the AI looks at the first six. */
  photos: readonly string[];
}

/**
 * «Il tuo annuncio» (the Italian tab of the descriptions step of «Aggiungi immobile»): the headline and the description, and «Suggerisci con
 * l'AI», which asks the AI for a text written from the photos of the gallery (reduced here, cover first), the comune and the data of the
 * property. The text is the host's: it replaces what is in the fields, «Annulla» brings back what was there before the first suggestion,
 * «Rigenera» asks for another one. When the AI cannot write it the text is composed from the data, as before, and the card says why. A tip
 * says what makes the text better (photos first) and the «?» what the AI uses. Both fields are required: the channels take no listing
 * without them.
 */
export function ListingTextCard({ form, propertyId, photos }: ListingTextCardProps) {
  const { t } = useTranslation();
  const amenityLabel = useAmenityLabels();
  const [previous, setPrevious] = useState<{ listingTitle: string; description: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const { register, setValue, getValues, watch, formState } = form;
  const titleLength = watch('listingTitle').length;
  const descriptionLength = watch('description').length;

  const apply = (title: string, description: string) => {
    setValue('listingTitle', title, { shouldDirty: true, shouldValidate: true });
    setValue('description', description, { shouldDirty: true, shouldValidate: true });
  };

  const suggest = async (regenerate: boolean) => {
    setBusy(true);
    setRateLimited(false);
    const values = getValues();
    // «Annulla» goes back to the text the host had before the first suggestion, however many came after it.
    const before = previous ?? { listingTitle: values.listingTitle, description: values.description };
    try {
      const reduced = await reducePhotosForAi(photos);
      const answer = await listingTextApi.suggest(propertyId, { photos: reduced, regenerate });
      if (answer.aiUsed && answer.title && answer.description) {
        apply(answer.title, answer.description.slice(0, LISTING_DESCRIPTION_MAX));
        setOutcome({ kind: 'ai', basedOn: answer.basedOn, photosSent: reduced.length });
      } else {
        const text = suggestListingText(values, t, amenityLabel);
        apply(text.title, text.description);
        setOutcome({ kind: 'composed', aiAvailable: answer.reason !== 'ai_not_configured' });
      }
      setPrevious(before);
    } catch (error) {
      if (getHttpStatus(error) === 429) {
        setRateLimited(true);
      } else {
        const text = suggestListingText(values, t, amenityLabel);
        apply(text.title, text.description);
        setOutcome({ kind: 'composed', aiAvailable: true });
        setPrevious(before);
      }
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (!previous) return;
    apply(previous.listingTitle, previous.description);
    setPrevious(null);
    setOutcome(null);
  };

  const tip =
    photos.length === 0
      ? t('propertyWizard.photos.listing.tips.noPhotos')
      : photos.length < FEW_PHOTOS
        ? t('propertyWizard.photos.listing.tips.fewPhotos', { count: FEW_PHOTOS })
        : null;

  return (
    <section aria-labelledby="property-wizard-listing-title" className="min-w-0 space-y-4 rounded-lg bg-muted p-4">
      <div className="space-y-1">
        <h3 id="property-wizard-listing-title" className="text-base font-semibold">
          {t('propertyWizard.photos.listing.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('propertyWizard.photos.listing.description')}</p>
      </div>

      <Field
        label={t('propertyWizard.photos.listing.headline.label')}
        hint={t('propertyWizard.photos.listing.headline.hint')}
        counter={`${titleLength}/${LISTING_TITLE_MAX}`}
        error={formState.errors.listingTitle}
      >
        <Input autoComplete="off" maxLength={LISTING_TITLE_MAX} {...register('listingTitle')} />
      </Field>

      <Field
        label={t('propertyWizard.photos.listing.text.label')}
        counter={`${descriptionLength}/${LISTING_DESCRIPTION_MAX}`}
        error={formState.errors.description}
      >
        <Textarea rows={8} {...register('description')} />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          loading={busy}
          onClick={() => void suggest(outcome?.kind === 'ai')}
          data-testid="property-wizard-suggest"
        >
          {outcome?.kind === 'ai' ? (
            <RefreshCw aria-hidden="true" className="size-4" />
          ) : (
            <Sparkles aria-hidden="true" className="size-4" />
          )}
          {busy
            ? t('propertyWizard.photos.listing.writing')
            : outcome?.kind === 'ai'
              ? t('propertyWizard.photos.listing.regenerate')
              : t('propertyWizard.photos.listing.suggest')}
        </Button>
        {previous && !busy ? (
          <Button type="button" variant="ghost" onClick={undo} data-testid="property-wizard-suggest-undo">
            {t('propertyWizard.photos.listing.undo')}
          </Button>
        ) : null}
        <HelpTip title={t('propertyWizard.photos.listing.help.title')} label={t('propertyWizard.photos.listing.help.title')}>
          {t('propertyWizard.photos.listing.help.text')}
        </HelpTip>
      </div>

      <div role="status" aria-live="polite" className="space-y-1 text-sm text-foreground/70" data-testid="property-wizard-suggest-status">
        {busy ? <p>{t('propertyWizard.photos.listing.writingStatus')}</p> : null}
        {!busy && rateLimited ? <p>{t('propertyWizard.photos.listing.rateLimited')}</p> : null}
        {!busy && outcome?.kind === 'ai' ? (
          <>
            <p>{t('propertyWizard.photos.listing.aiWritten', { basis: describeBasis(outcome.basedOn, t) })}</p>
            {outcome.photosSent > 0 && outcome.basedOn.photos === 0 ? <p>{t('propertyWizard.photos.listing.photosNotRead')}</p> : null}
          </>
        ) : null}
        {!busy && outcome?.kind === 'composed' ? (
          <p>{outcome.aiAvailable ? t('propertyWizard.photos.listing.aiUnavailable') : t('propertyWizard.photos.listing.suggested')}</p>
        ) : null}
      </div>

      {tip && outcome?.kind !== 'ai' ? (
        <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="property-wizard-suggest-tip">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{tip}</span>
        </p>
      ) : null}
    </section>
  );
}
