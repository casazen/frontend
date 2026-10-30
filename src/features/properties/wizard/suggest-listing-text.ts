import { getAmenityLabel } from '@/lib/i18n-labels';
import type { PropertyWizardValues } from './property-wizard-model';

/** Limits of the listing headline and description in the wizard (the API takes longer descriptions; the wizard asks for a short pitch). */
export const LISTING_TITLE_MAX = 60;
export const LISTING_DESCRIPTION_MAX = 600;

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type ListingTextInput = Pick<
  PropertyWizardValues,
  'accommodationType' | 'name' | 'city' | 'maxGuests' | 'bedrooms' | 'beds' | 'bathrooms' | 'areaSqm' | 'amenities'
>;

/** How many of the amenities the person chose are named in the text. */
const NAMED_AMENITIES = 3;

/** «a», «a e b», «a, b e c». */
function joinList(parts: readonly string[], and: string): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}

const capitalise = (text: string) => (text.length > 0 ? text[0]!.toUpperCase() + text.slice(1) : text);

/** A text cut at the last whole word that fits, so that a long name never ends a sentence in the middle of a word. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const space = head.lastIndexOf(' ');
  return (space > max / 2 ? head.slice(0, space) : head).trim();
}

/**
 * «Suggerisci un testo» (SR-07b, SR-D34): a headline and a description made **only of what the person already entered** — the kind of
 * accommodation, the name, the comune, the spaces and the first three amenities they chose. No AI and no copy that the data does not
 * carry (nothing about the check-in being simple, the quiet or the view): a sentence whose data is missing is left out, and the
 * result always fits the limits of the fields.
 */
export function suggestListingText(input: ListingTextInput, t: Translate): { title: string; description: string } {
  const type = input.accommodationType
    ? t(`propertyWizard.base.type.options.${input.accommodationType}`)
    : t('propertyWizard.suggest.typeFallback');
  const city = input.city.trim();
  const name = input.name.trim();
  const and = t('propertyWizard.suggest.and');

  // The longest headline that fits: with the guests when there is room, otherwise just the kind and the place.
  const withGuests = t('propertyWizard.suggest.titleGuests', { type, city, count: input.maxGuests });
  const plain = t('propertyWizard.suggest.title', { type, city });
  const title = cut(withGuests.length <= LISTING_TITLE_MAX ? withGuests : plain, LISTING_TITLE_MAX);

  const sentences: string[] = [];
  sentences.push(name ? t('propertyWizard.suggest.intro', { type, name, city }) : t('propertyWizard.suggest.introNoName', { type, city }));
  sentences.push(t('propertyWizard.suggest.guests', { count: input.maxGuests }));

  const spaces = [
    input.bedrooms > 0 ? t('propertyWizard.suggest.bedrooms', { count: input.bedrooms }) : t('propertyWizard.suggest.studio'),
    t('propertyWizard.suggest.beds', { count: input.beds }),
    t('propertyWizard.suggest.bathrooms', { count: input.bathrooms }),
  ];
  sentences.push(`${capitalise(joinList(spaces, and))}.`);

  const area = input.areaSqm.trim();
  if (area !== '') sentences.push(t('propertyWizard.suggest.area', { area }));

  const named = input.amenities.slice(0, NAMED_AMENITIES).map((amenity) => getAmenityLabel(amenity, t));
  if (named.length > 0) sentences.push(t('propertyWizard.suggest.amenities', { list: joinList(named, and) }));

  // Whole sentences only: if the text is too long the last sentences go, none is cut in the middle.
  let description = '';
  for (const sentence of sentences) {
    const next = description === '' ? sentence : `${description} ${sentence}`;
    if (next.length > LISTING_DESCRIPTION_MAX) break;
    description = next;
  }
  return { title, description: description === '' ? cut(sentences[0]!, LISTING_DESCRIPTION_MAX) : description };
}
