import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown } from 'lucide-react';
import type { SiteWork } from '@/lib/supplier-site/site-model';
import { Reveal } from './reveal';

/**
 * A job with its before and after: the "after" below, the "before" on top and cut at the position of the handle. The handle is
 * a native range input (a slider for the keyboard and for the screen readers: arrows, Home, End; a finger drags it), drawn
 * invisible over the picture. Both photos are the supplier's own: the "before" is never made up.
 */
export function BeforeAfterSlider({ work, index }: { work: SiteWork; index: number }) {
  const { t } = useTranslation();
  const [position, setPosition] = useState(50);
  if (!work.beforeUrl) return null;
  const label = work.caption || work.alt;

  return (
    <Reveal as="figure" className="vz-ba" index={index}>
      <div className="vz-ba__stage" style={{ '--pos': `${position}%` } as CSSProperties}>
        <img className="vz-ba__after" src={work.photoUrl} alt={t('supplierSite.works.afterAlt', { caption: work.alt })} loading="lazy" decoding="async" />
        <img className="vz-ba__before" src={work.beforeUrl} alt={t('supplierSite.works.beforeAlt', { caption: work.alt })} loading="lazy" decoding="async" />
        <span className="vz-ba__tag vz-ba__tag--b" aria-hidden="true">
          {t('supplierSite.works.before')}
        </span>
        <span className="vz-ba__tag vz-ba__tag--a" aria-hidden="true">
          {t('supplierSite.works.after')}
        </span>
        <i className="vz-ba__handle" aria-hidden="true">
          <ChevronsUpDown />
        </i>
        <input
          className="vz-ba__range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={t('supplierSite.works.compare', { caption: label })}
          aria-valuetext={t('supplierSite.works.position', { before: position, after: 100 - position })}
        />
      </div>
      {label || work.place ? (
        <figcaption>
          {label ? <strong>{label}</strong> : null}
          {work.place ? <span>{work.place}</span> : null}
        </figcaption>
      ) : null}
    </Reveal>
  );
}
