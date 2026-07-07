interface HeroProps {
  imageUrl?: string | null;
  title: string;
  tagline?: string | null;
  ctaLabel?: string;
  onCta?: () => void;
}

export function Hero({ imageUrl, title, tagline, ctaLabel, onCta }: HeroProps) {
  return (
    <section className="relative -mx-4 mb-[var(--cz-public-section-y)] overflow-hidden sm:mx-0 sm:rounded-[var(--cz-public-radius)]">
      <div className="relative aspect-[16/9] max-h-[420px] w-full">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--cz-public-primary)]/30 to-[var(--cz-public-bg)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-10">
          <h1 className="public-display text-3xl font-semibold md:text-5xl">{title}</h1>
          {tagline ? <p className="mt-2 max-w-2xl text-base text-white/90 md:text-lg">{tagline}</p> : null}
          {ctaLabel && onCta ? (
            <button type="button" onClick={onCta} className="public-site-cta mt-4 rounded-[var(--cz-public-radius)] px-5 py-2.5 text-sm font-medium">
              {ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
