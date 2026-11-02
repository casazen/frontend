import { useState, useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { addDays, todayInRome } from '@/lib/stay-dates';

/**
 * «Cerca una casa» on the home of CasaZen (SEARCH-GLOBAL): a quiet second way in for the people who come to find a home to stay in
 * and not to manage one (the message of the page is for hosts). A native form that goes to the public search of the app
 * (`GET /search?where=&checkin=&checkout=&guests=`), so it works without JavaScript and in the static page; the rich pickers
 * (calendar with prices, guests, map) are in the app, where the search opens with what was typed here. The names of the fields
 * are those of the address of the search.
 *
 * The page is built once for everyone, so «today» is not known when it is: the earliest day the date fields offer comes once the
 * page is in the browser (the static HTML has none, and hydration starts from that); the app sets aside a day in the past anyway.
 */

const MAX_GUESTS = 12;

const subscribeNever = () => () => {};
const noToday = () => '';

const FIELD =
  'h-11 w-full rounded-xl border border-ink-700/25 bg-white px-3.5 text-base text-ink-800 placeholder:text-ink-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terra-700';
const LABEL = 'mb-1.5 block text-sm font-semibold text-ink-700';

export function HomeSearch() {
  const { t } = useTranslation();
  // '' on the server and while the browser hydrates, then the day in Rome (a store that never changes: no effect, no second render path).
  const today = useSyncExternalStore(subscribeNever, () => todayInRome(), noToday);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');

  const changeArrival = (value: string) => {
    setArrival(value);
    // A departure that is not after the new arrival means nothing: it is chosen again.
    if (departure && value && departure <= value) setDeparture('');
  };
  const firstDeparture = arrival ? addDays(arrival, 1) : today ? addDays(today, 1) : undefined;

  return (
    <section aria-labelledby="home-search-title" className="bg-cream-50" data-testid="home-search">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:py-14 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
        <div>
          <h2 id="home-search-title" className="font-display text-2xl font-semibold tracking-tight text-ink-800 sm:text-3xl">
            {t('site.home.search.title')}
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-ink-500">{t('site.home.search.text')}</p>
        </div>

        <form action="/search" method="get" role="search" className="rounded-3xl border border-ink-700/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr]">
            <div>
              <label htmlFor="home-search-where" className={LABEL}>
                {t('site.home.search.where')}
              </label>
              <input
                id="home-search-where"
                name="where"
                type="text"
                maxLength={100}
                autoComplete="off"
                enterKeyHint="search"
                placeholder={t('site.home.search.wherePlaceholder')}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="home-search-checkin" className={LABEL}>
                {t('site.home.search.checkin')}
              </label>
              <input
                id="home-search-checkin"
                name="checkin"
                type="date"
                min={today || undefined}
                value={arrival}
                onChange={(event) => changeArrival(event.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="home-search-checkout" className={LABEL}>
                {t('site.home.search.checkout')}
              </label>
              <input
                id="home-search-checkout"
                name="checkout"
                type="date"
                min={firstDeparture}
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="home-search-guests" className={LABEL}>
                {t('site.home.search.guests')}
              </label>
              <select id="home-search-guests" name="guests" defaultValue="2" className={FIELD}>
                {Array.from({ length: MAX_GUESTS }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {t('site.home.search.guestsCount', { count })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink-700 px-7 text-base font-semibold text-white transition-colors hover:bg-ink-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-700 sm:w-auto"
            >
              <Search aria-hidden="true" className="size-5" />
              {t('site.home.search.submit')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
