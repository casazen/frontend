import { cn } from '@/lib/utils';

interface HeroProps {
  imageUrl?: string | null;
  title: string;
  tagline?: string | null;
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * Cover of the public site. With a photo the caption sits on a dark band (white text, at least 5.7:1 even on a white
 * photo); without one the hero is the primary color with the text color chosen for it (BK-13: AA for any host color).
 * Both variants have the same size, so the page does not jump when a fallback photo arrives.
 */
export function Hero({ imageUrl, title, tagline, ctaLabel, onCta }: HeroProps) {
  const hasImage = Boolean(imageUrl);

  return (
    <section
      className="relative -mx-3 mb-[var(--cz-public-section-y)] overflow-hidden sm:mx-0 sm:rounded-[var(--cz-public-radius)]"
      data-testid="public-hero"
      data-hero-variant={hasImage ? 'image' : 'plain'}
    >
      <div className="public-hero-frame relative aspect-[16/9] max-h-[420px] min-h-[220px] w-full">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
        ) : null}
        <div className="absolute inset-x-0 bottom-0">
          {hasImage ? <div className="public-hero-fade h-10" aria-hidden /> : null}
          <div className={cn('px-6 pb-6 md:px-10 md:pb-10', hasImage ? 'public-hero-caption pt-2' : 'pt-10')}>
            <h1 className="public-display text-3xl md:text-5xl">{title}</h1>
            {tagline ? <p className="mt-2 max-w-2xl text-base md:text-lg">{tagline}</p> : null}
            {ctaLabel && onCta ? (
              <button
                type="button"
                onClick={onCta}
                className={cn(
                  'mt-4 px-5 py-2.5 text-sm',
                  hasImage ? 'public-site-cta' : 'public-site-cta-inverse',
                )}
              >
                {ctaLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
