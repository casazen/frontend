import type { TFunction } from 'i18next';
import type { PublicOrgDto } from '@/types';
import type { PublicStayCard } from '@/types/public-stays.types';
import { comuniOf, listOfPlaces } from './home-model';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * The questions a booking site starts with (DB-07b) while the host has none of their own (the editor of the site is not here yet):
 * a short set that every site can answer truthfully, with the blanks filled from the real data (who the host is, which homes take
 * pets, where the homes are). What a guest wants to know that depends on a number (how many days before the arrival the
 * cancellation is free, how much the tax is per night) is not answered here with a number: it is on the page of the home and in the
 * price before paying, from the server (D24: a sentence on the page is true or it is not there). A question that the data cannot
 * answer (pets, where) is not asked.
 */
export function buildFaq({
  t,
  locale,
  org,
  cards,
}: {
  t: TFunction;
  locale: string;
  org: Pick<PublicOrgDto, 'displayName' | 'hostName' | 'acceptsBookings'>;
  cards: readonly PublicStayCard[];
}): FaqItem[] {
  const host = org.hostName?.trim() || org.displayName;
  const items: FaqItem[] = [{ id: 'why', question: t('siteHome.faq.why.q'), answer: t('siteHome.faq.why.a', { host }) }];

  if (org.acceptsBookings) items.push({ id: 'payment', question: t('siteHome.faq.payment.q'), answer: t('siteHome.faq.payment.a') });
  items.push(
    { id: 'cancel', question: t('siteHome.faq.cancel.q'), answer: t('siteHome.faq.cancel.a') },
    { id: 'tax', question: t('siteHome.faq.tax.q'), answer: t('siteHome.faq.tax.a') },
    { id: 'checkin', question: t('siteHome.faq.checkin.q'), answer: t('siteHome.faq.checkin.a') },
  );

  const petHomes = cards.filter((card) => card.tags.includes('pet')).map((card) => card.name);
  if (petHomes.length > 0) {
    items.push({ id: 'pets', question: t('siteHome.faq.pets.q'), answer: t('siteHome.faq.pets.a', { homes: listOfPlaces(petHomes, locale) }) });
  }

  const places = listOfPlaces(comuniOf(cards), locale);
  if (places) items.push({ id: 'where', question: t('siteHome.faq.where.q'), answer: t('siteHome.faq.where.a', { places }) });

  return items;
}
