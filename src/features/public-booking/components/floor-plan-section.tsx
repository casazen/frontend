import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Expand } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { pickText, positive, usableLevels } from '@/features/public-booking/lib/property-profile';
import { displayableMediaUrls } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type { PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

/** The search parameter that keeps the level in the address: a link to the page can open on the upper floor. */
const LEVEL_PARAM = 'livello';

/**
 * «Planimetria» (DB-04a): the plan the host uploaded, one tab per level (the level is in the address), the area of the level and a
 * button to see the plan big. Only the levels that have an image are shown, and the section is not there without any: the system
 * draws no plan of its own and invents no rooms.
 */
export function FloorPlanSection({ property }: { property: PublicPropertyDetailDto }) {
  const { t, i18n } = useTranslation();
  const portal = usePortalRootProps();
  const [searchParams] = useSearchParams();
  const [zoomed, setZoomed] = useState(false);
  const language = i18n.language;

  const levels = useMemo(
    () =>
      usableLevels(property)
        .map((level, index) => ({
          id: level.id,
          name: pickText(level.name, language) || t('publicProperty.plan.level', { n: index + 1 }),
          src: displayableMediaUrls([level.imageUrl])[0] ?? null,
          alt: pickText(level.alt, language),
          area: positive(level.areaSqm),
        }))
        .filter((level) => level.src !== null),
    [property, language, t],
  );
  if (levels.length === 0) return null;

  const requested = searchParams.get(LEVEL_PARAM);
  const current = levels.find((level) => level.id === requested) ?? levels[0];
  const total = positive(property.areaSqm);
  const number = new Intl.NumberFormat(language);
  const lead = total
    ? t('publicProperty.plan.lead', { count: levels.length, area: number.format(total) })
    : levels.length > 1
      ? t('publicProperty.plan.levels', { count: levels.length })
      : '';
  const items: TabItem[] = levels.map((level) => ({ value: level.id, label: level.name }));

  const figure = (
    <div className="pp-plan" data-testid="property-plan">
      <figure className="pp-plan__figure">
        <img
          src={current.src ?? undefined}
          alt={current.alt || t('publicProperty.plan.alt', { level: current.name, name: property.name })}
          loading="lazy"
          decoding="async"
        />
      </figure>
      <div className="space-y-3">
        {levels.length === 1 ? <p className="pp-eyebrow">{current.name}</p> : null}
        {current.area ? (
          <p className="text-lg">
            <strong className="public-display text-2xl font-semibold">{t('publicProperty.facts.areaValue', { value: number.format(current.area) })}</strong>{' '}
            <span className="text-[var(--cz-public-muted)]">{t('publicProperty.plan.areaOfLevel')}</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4"
          data-testid="property-plan-zoom"
        >
          <Expand className="h-[18px] w-[18px]" aria-hidden />
          {t('publicProperty.plan.zoom')}
        </button>
      </div>
    </div>
  );

  return (
    <section id="planimetria" aria-labelledby="property-plan-title" className="scroll-mt-20 space-y-6" data-testid="property-floor-plan">
      <div>
        <p className="pp-eyebrow">{t('publicProperty.plan.eyebrow')}</p>
        <h2 id="property-plan-title" className="public-display text-2xl font-semibold">
          {t('publicProperty.plan.title')}
        </h2>
        {lead ? <p className="mt-2 text-[var(--cz-public-muted)]">{lead}</p> : null}
      </div>

      {levels.length > 1 ? (
        <Tabs label={t('publicProperty.plan.levelsLabel')} items={items} param={LEVEL_PARAM} value={current.id}>
          {figure}
        </Tabs>
      ) : (
        figure
      )}

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent {...portal} sheetOnPhone={false} className={cn(portal.className, 'max-w-5xl bg-[var(--cz-public-surface)]')}>
          <DialogHeader>
            <DialogTitle>{current.name}</DialogTitle>
            <DialogDescription className="sr-only">{t('publicProperty.plan.zoomDescription', { name: property.name })}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto">
            <img
              src={current.src ?? undefined}
              alt={current.alt || t('publicProperty.plan.alt', { level: current.name, name: property.name })}
              className="mx-auto block h-auto max-w-none min-w-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
