import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Expand, MapPin } from 'lucide-react';
import { PhotoViewer } from '@/features/public-site/components/PhotoViewer';
import type { SiteModel, SiteWork } from '@/lib/supplier-site/site-model';
import { BeforeAfterSlider } from './before-after-slider';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

/** The comparisons and the photos the home shows; the supplier can have more, the page stays one idea. */
const MAX_COMPARISONS = 2;
const MAX_PHOTOS = 8;

/**
 * "I nostri lavori": the jobs the supplier wrote, as a before/after with a slider where it has both photos and as photos that open
 * in a viewer (arrows, swipe, Esc) where it has one. A supplier that wrote no job shows the photos of its profile instead, said as
 * what they are ("Qualche foto"), never as jobs.
 */
export function WorksSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const [viewer, setViewer] = useState<number | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  const isJobs = model.works.length > 0;
  const all: SiteWork[] = isJobs
    ? model.works
    : model.photos.map((photoUrl) => ({ photoUrl, beforeUrl: null, caption: '', place: '', alt: model.name }));
  const comparisons = all.filter((work) => work.beforeUrl).slice(0, MAX_COMPARISONS);
  const photos = all.filter((work) => !work.beforeUrl).slice(0, MAX_PHOTOS);

  return (
    <section className="vz-section" id="lavori" aria-labelledby="vz-h-works" data-testid="supplier-site-works">
      <div className="vz-container">
        <SectionHead
          id="vz-h-works"
          eyebrow={isJobs ? t('supplierSite.works.eyebrow') : t('supplierSite.works.eyebrowPhotos')}
          title={isJobs ? t('supplierSite.works.title') : t('supplierSite.works.titlePhotos')}
          text={comparisons.length > 0 ? t('supplierSite.works.lead') : undefined}
        />
        {comparisons.length > 0 ? (
          <div className="vh-works__ba">
            {comparisons.map((work, index) => (
              <BeforeAfterSlider key={work.photoUrl} work={work} index={index} />
            ))}
          </div>
        ) : null}
        {photos.length > 0 ? (
          <div className="vh-works__grid">
            {photos.map((work, index) => (
              <Reveal key={work.photoUrl} as="figure" className="vz-work" index={index}>
                <button
                  type="button"
                  className="vz-work__btn"
                  aria-label={t('supplierSite.works.enlarge', { caption: work.caption || work.alt })}
                  onClick={(event) => {
                    setOpener(event.currentTarget);
                    setViewer(index);
                  }}
                >
                  <img src={work.photoUrl} alt={work.alt} loading="lazy" decoding="async" />
                  <span className="vz-work__zoom" aria-hidden="true">
                    <Expand />
                  </span>
                </button>
                {work.caption || work.place ? (
                  <figcaption>
                    {work.caption ? <strong>{work.caption}</strong> : null}
                    {work.place ? (
                      <span>
                        <MapPin aria-hidden="true" />
                        {work.place}
                      </span>
                    ) : null}
                  </figcaption>
                ) : null}
              </Reveal>
            ))}
          </div>
        ) : null}
      </div>
      {viewer !== null ? (
        <PhotoViewer
          photos={photos.map((work) => work.photoUrl)}
          index={viewer}
          name={model.name}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          restoreFocusTo={() => opener}
        />
      ) : null}
    </section>
  );
}
