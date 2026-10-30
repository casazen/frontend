import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import type { PublicShowcaseWork } from '@/api/public-supplier.api';
import { ReorderableList } from '@/components/shared/reorderable-list';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import { useSupplierProfile } from '@/queries/supplier/use-profile';
import { useSupplierServices } from '@/queries/use-supplier-services';
import { SHOWCASE_LIMITS } from '../showcase-limits';
import { PROFILE_PATH, SERVICES_PATH } from '../showcase-model';
import { ADVISED_WORKS, buildPhotoPool, worksWithPhoto } from '../showcase-photos';
import { CountedField } from './counted-field';
import { isRefused, type PanelProps } from './panel-types';
import { PhotoPicker } from './photo-picker';

const L = SHOWCASE_LIMITS.gallery;

/** `list` with the item at `index` replaced. */
const replaceAt = <T,>(list: readonly T[], index: number, item: T): T[] => list.map((current, position) => (position === index ? item : current));

/** What goes into `cover`: nothing when there is neither a photo nor a description. */
function coverOf(url: string | null | undefined, alt: string | null | undefined) {
  const photo = (url ?? '').trim();
  const description = alt ?? '';
  return photo === '' && description === '' ? null : { url: photo === '' ? null : photo, alt: description === '' ? null : description };
}

/** The photo drawn small, or a neutral box that says there is none. */
function PhotoThumb({ url, className }: { url: string | null | undefined; className: string }) {
  const { t } = useTranslation();
  if (isDisplayableMediaUrl(url)) {
    return <img src={url} alt="" loading="lazy" decoding="async" className={cn('shrink-0 rounded-lg object-cover ring-1 ring-border', className)} />;
  }
  return (
    <span className={cn('inline-flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-muted text-xs text-foreground/70 ring-1 ring-border', className)}>
      <ImageOff className="size-5" aria-hidden="true" />
      {t('supplier.showcase.editor.works.noPhoto')}
    </span>
  );
}

/** What the photo being chosen is for: the cover, or the photo (or the "before" photo) of a job. */
type Picking = { kind: 'cover' } | { kind: 'work'; index: number; field: 'photoUrl' | 'beforeUrl' };

/**
 * "Foto e lavori" (SP-13d): the cover and the jobs of the gallery, with photos **chosen among the ones the supplier already has** on its
 * profile and its services (they sit in its own folder of the storage, the only place the server accepts; the upload from here is
 * SP-13b). A job has a caption, a place and, if the supplier wants, a "before" photo for the before and after. Jobs are moved with
 * buttons and taken out with an "Annulla".
 */
export function WorksPanel({ doc, change, invalid }: PanelProps) {
  const { t } = useTranslation();
  const profile = useSupplierProfile();
  const services = useSupplierServices();
  const [picking, setPicking] = useState<Picking | null>(null);

  const pool = buildPhotoPool(profile.data?.photoUrls, services.data?.items);
  const loading = profile.isLoading || services.isLoading;
  const gallery = doc.gallery ?? [];
  const cover = doc.cover ?? {};
  const withPhoto = worksWithPhoto(gallery);

  const selected =
    picking === null ? null : picking.kind === 'cover' ? cover.url : gallery[picking.index]?.[picking.field];
  const pickerTitle =
    picking === null
      ? ''
      : picking.kind === 'cover'
        ? t('supplier.showcase.editor.works.coverTitle')
        : t(picking.field === 'photoUrl' ? 'supplier.showcase.editor.works.pickPhoto' : 'supplier.showcase.editor.works.pickBefore', { n: picking.index + 1 });

  const choose = (url: string) => {
    if (picking === null) return;
    if (picking.kind === 'cover') {
      change({ cover: coverOf(url, cover.alt) });
      return;
    }
    const work = gallery[picking.index];
    if (work) change({ gallery: replaceAt(gallery, picking.index, { ...work, [picking.field]: url }) });
  };

  return (
    <div className="space-y-8" data-testid="supplier-showcase-panel-works">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.works.coverTitle')}</h2>
          <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.works.coverHint')}</p>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <PhotoThumb url={cover.url} className="h-28 w-40" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setPicking({ kind: 'cover' })} data-testid="supplier-showcase-cover-pick">
              {cover.url ? t('supplier.showcase.editor.works.changePhoto') : t('supplier.showcase.editor.works.choosePhoto')}
            </Button>
            {cover.url ? (
              <Button type="button" variant="ghost" onClick={() => change({ cover: coverOf(null, cover.alt) })}>
                {t('supplier.showcase.editor.works.removePhoto')}
              </Button>
            ) : null}
          </div>
        </div>
        {cover.url ? (
          <CountedField
            label={t('supplier.showcase.editor.works.alt')}
            hint={t('supplier.showcase.editor.works.altHint')}
            value={cover.alt ?? ''}
            max={L.alt}
            optional
            invalid={isRefused(invalid, 'cover')}
            onChange={(value) => change({ cover: coverOf(cover.url, value) })}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.works.title')}</h2>
          <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.works.hint')}</p>
          <p className="text-sm text-foreground/70" data-testid="supplier-showcase-works-count">
            {t('supplier.showcase.editor.works.count', { count: withPhoto, advised: ADVISED_WORKS })}
          </p>
          {!loading && pool.length === 0 ? (
            <div className="mt-2 space-y-2 rounded-lg border border-dashed p-3 text-sm" data-testid="supplier-showcase-works-nophotos">
              <p>{t('supplier.showcase.editor.photos.none')}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={PROFILE_PATH}>{t('supplier.showcase.editor.photos.addToProfile')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={SERVICES_PATH}>{t('supplier.showcase.editor.photos.addToService')}</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <ReorderableList<PublicShowcaseWork>
          items={gallery}
          onChange={(next) => change({ gallery: next })}
          label={t('supplier.showcase.editor.works.title')}
          itemLabel={(index) => t('supplier.showcase.editor.works.work', { n: index + 1 })}
          newItem={() => ({ photoUrl: '', caption: '', place: '' })}
          addLabel={t('supplier.showcase.editor.works.add')}
          removedMessage={t('supplier.showcase.editor.works.removed')}
          max={SHOWCASE_LIMITS.gallery.items}
          renderItem={(work, index) => {
            // "Before and after" is on while the member `beforeUrl` exists (an empty one is on with no photo yet): nothing local to lose when rows move.
            const compare = work.beforeUrl !== undefined && work.beforeUrl !== null;
            const compareId = `showcase-work-${index}-compare`;
            return (
              <>
                <div className="flex flex-wrap items-start gap-3">
                  <PhotoThumb url={work.photoUrl} className="h-24 w-32" />
                  <Button type="button" variant="outline" onClick={() => setPicking({ kind: 'work', index, field: 'photoUrl' })} data-testid={`supplier-showcase-work-${index}-pick`}>
                    {work.photoUrl ? t('supplier.showcase.editor.works.changePhoto') : t('supplier.showcase.editor.works.choosePhoto')}
                    <span className="sr-only"> {t('supplier.showcase.editor.works.work', { n: index + 1 })}</span>
                  </Button>
                </div>
                {isRefused(invalid, `gallery[${index}].photoUrl`) ? <p className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">{t('supplier.showcase.editor.invalidField')}</p> : null}
                <CountedField
                  label={t('supplier.showcase.editor.works.caption')}
                  value={work.caption ?? ''}
                  max={L.caption}
                  invalid={isRefused(invalid, `gallery[${index}].caption`)}
                  onChange={(value) => change({ gallery: replaceAt(gallery, index, { ...work, caption: value }) })}
                />
                <CountedField
                  label={t('supplier.showcase.editor.works.place')}
                  value={work.place ?? ''}
                  max={L.place}
                  optional
                  invalid={isRefused(invalid, `gallery[${index}].place`)}
                  onChange={(value) => change({ gallery: replaceAt(gallery, index, { ...work, place: value }) })}
                />
                <div className="flex min-h-11 items-center gap-3">
                  <Switch
                    id={compareId}
                    checked={compare}
                    onCheckedChange={(on) => change({ gallery: replaceAt(gallery, index, { ...work, beforeUrl: on ? '' : null }) })}
                  />
                  <Label htmlFor={compareId} className="cursor-pointer text-base leading-snug">
                    {t('supplier.showcase.editor.works.compare')}
                  </Label>
                </div>
                {compare ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <PhotoThumb url={work.beforeUrl} className="h-24 w-32" />
                    <div className="space-y-1">
                      <Button type="button" variant="outline" onClick={() => setPicking({ kind: 'work', index, field: 'beforeUrl' })} data-testid={`supplier-showcase-work-${index}-pick-before`}>
                        {work.beforeUrl ? t('supplier.showcase.editor.works.changeBefore') : t('supplier.showcase.editor.works.chooseBefore')}
                        <span className="sr-only"> {t('supplier.showcase.editor.works.work', { n: index + 1 })}</span>
                      </Button>
                      <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.works.compareHint')}</p>
                    </div>
                  </div>
                ) : null}
                <CountedField
                  label={t('supplier.showcase.editor.works.alt')}
                  hint={t('supplier.showcase.editor.works.altHintWork')}
                  value={work.alt ?? ''}
                  max={L.alt}
                  optional
                  invalid={isRefused(invalid, `gallery[${index}].alt`)}
                  onChange={(value) => change({ gallery: replaceAt(gallery, index, { ...work, alt: value }) })}
                />
              </>
            );
          }}
        />
      </section>

      <PhotoPicker
        open={picking !== null}
        onOpenChange={(open) => {
          if (!open) setPicking(null);
        }}
        title={pickerTitle}
        photos={pool}
        loading={loading}
        selected={selected}
        onSelect={choose}
      />
    </div>
  );
}
