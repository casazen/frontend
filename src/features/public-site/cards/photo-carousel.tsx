import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { displayableMediaUrls } from '@/lib/media-url';

/** Photos a card shows at most: the first ones are the ones a guest looks at, the rest is on the page of the home. */
const MAX_PHOTOS = 6;

/**
 * The photos of a home on its card (DB-07b): a strip that snaps photo by photo, with arrows and the keyboard. It is the plain
 * scrolling of the browser, so a finger swipes it and nothing is drawn twice; the photos after the first load when they come
 * near. The photo is decoration (the name of the home is the link next to it), and a home with none shows a quiet placeholder.
 */
export function PhotoCarousel({ photos, label, eager = false }: { photos: readonly string[]; label: string; eager?: boolean }) {
  const { t } = useTranslation();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const urls = displayableMediaUrls(photos).slice(0, MAX_PHOTOS);

  if (urls.length === 0) {
    return (
      <div className="hcard__nophoto" data-testid="house-card-no-photo">
        <Home aria-hidden="true" />
      </div>
    );
  }

  const move = (direction: -1 | 1) => {
    const element = track.current;
    if (!element) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * element.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onScroll = () => {
    const element = track.current;
    if (!element || element.clientWidth === 0) return;
    const next = Math.round(element.scrollLeft / element.clientWidth);
    if (next !== index) setIndex(next);
  };

  const several = urls.length > 1;
  return (
    <div className="hcar">
      <div ref={track} className="hcar__track" role="group" aria-roledescription="carousel" tabIndex={0} aria-label={label} onScroll={onScroll}>
        {urls.map((url, position) => (
          <div key={url} className="hcar__slide" role="group" aria-roledescription="slide" aria-label={`${position + 1} / ${urls.length}`}>
            <img src={url} alt="" loading={eager && position === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
          </div>
        ))}
      </div>
      {several ? (
        <>
          <button type="button" className="hcar__nav hcar__nav--prev" onClick={() => move(-1)} disabled={index === 0} aria-label={t('siteHome.card.previousPhoto')}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="hcar__nav hcar__nav--next" onClick={() => move(1)} disabled={index >= urls.length - 1} aria-label={t('siteHome.card.nextPhoto')}>
            <ChevronRight aria-hidden="true" />
          </button>
          <div className="hcar__dots" aria-hidden="true">
            {urls.map((url, position) => (
              <i key={url} className={position === index ? 'is-on' : undefined} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
