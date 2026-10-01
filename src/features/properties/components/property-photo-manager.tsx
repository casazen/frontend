import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ImageIcon, ImageOff, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { getProblemMessage } from '@/lib/api-errors';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import {
  useDeletePropertyPhoto,
  usePropertyPhotos,
  useReorderPropertyPhotos,
  useSetPropertyCoverPhoto,
  useUploadPropertyPhotos,
} from '@/queries/use-property-photos';

interface PropertyPhotoManagerProps {
  propertyId: string;
  propertyName: string;
  /** Upload, order, cover and delete. Without it the gallery is read only (the API checks the same permission). */
  canEdit: boolean;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Same rules as the API when the gallery has not answered yet (they come from `GET /properties/{id}/images`). */
const FALLBACK_RULES = {
  maxPhotos: 20,
  maxFilesPerRequest: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const toMegabytes = (bytes: number) => Math.floor(bytes / (1024 * 1024));

/**
 * First problem of a selection of files, in the user's language, or null when it can be uploaded. The API checks the
 * same rules (and the content of each file); checking here too only spares a round trip and names the file. A
 * selection is uploaded whole or not at all, like the API does.
 */
export function validatePhotoSelection(
  files: File[],
  current: number,
  rules: typeof FALLBACK_RULES,
  t: TranslateFn,
): string | null {
  if (files.length > rules.maxFilesPerRequest) {
    return t('property.photos.selectionTooMany', { max: rules.maxFilesPerRequest });
  }
  const remaining = rules.maxPhotos - current;
  if (files.length > remaining) {
    return t('property.photos.selectionOverLimit', { remaining: Math.max(remaining, 0), max: rules.maxPhotos });
  }
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type = file.type.toLowerCase();
    const knownType = rules.allowedContentTypes.includes(type) && EXTENSION_TYPES[extension] === type;
    if (!knownType) return t('property.photos.selectionInvalidType', { name: file.name });
    if (file.size === 0 || file.size > rules.maxFileSizeBytes) {
      return t('property.photos.selectionTooLarge', { name: file.name, size: toMegabytes(rules.maxFileSizeBytes) });
    }
  }
  return null;
}

/**
 * Photo gallery of a property for the host (PC-04, A2-26): upload (several files at once), order, cover and deletion.
 * The first displayable photo is the cover: it is the one the public pages, the search results and the org site show
 * first. States: loading, error with retry (never shown as an empty gallery), empty, and the grid. Every action shows its
 * error as a toast and inline.
 */
export function PropertyPhotoManager({ propertyId, propertyName, canEdit }: PropertyPhotoManagerProps) {
  const { t } = useTranslation();
  const gallery = usePropertyPhotos(propertyId);
  const upload = useUploadPropertyPhotos(propertyId);
  const remove = useDeletePropertyPhoto(propertyId);
  const reorder = useReorderPropertyPhotos(propertyId);
  const setCover = useSetPropertyCoverPhoto(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  const photos = gallery.data?.photoUrls ?? [];
  const rules = gallery.data ?? FALLBACK_RULES;
  const busy = upload.isPending || remove.isPending || reorder.isPending || setCover.isPending;
  const full = photos.length >= rules.maxPhotos;
  const coverUrl = photos.find(isDisplayableMediaUrl);
  const actionError = [upload, reorder, setCover].find((mutation) => mutation.isError)?.error;

  const openFilePicker = () => {
    setSelectionError(null);
    upload.reset();
    inputRef.current?.click();
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // The same file can be chosen again after a failure.
    event.target.value = '';
    if (files.length === 0) return;
    const problem = validatePhotoSelection(files, photos.length, rules, t);
    setSelectionError(problem);
    if (problem === null) upload.mutate(files);
  };

  const move = (index: number, offset: -1 | 1) => {
    const next = [...photos];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.reset();
    reorder.mutate(next);
  };

  const confirmDelete = () => {
    if (photoToDelete === null) return;
    remove.mutate(photoToDelete, { onSuccess: () => setPhotoToDelete(null) });
  };

  const closeDelete = () => {
    setPhotoToDelete(null);
    remove.reset();
  };

  return (
    <Card data-testid="property-photo-manager">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {t('property.photos.title')}
          </CardTitle>
          <CardDescription>{t('property.photos.description')}</CardDescription>
          <p className="text-xs text-muted-foreground">
            {t('property.photos.rules', {
              max: rules.maxPhotos,
              size: toMegabytes(rules.maxFileSizeBytes),
            })}
          </p>
        </div>
        {canEdit && gallery.isSuccess && photos.length > 0 && (
          <Button type="button" variant="outline" onClick={openFilePicker} disabled={busy || full} className="shrink-0">
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {upload.isPending ? t('property.photos.uploading') : t('property.photos.upload')}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept={rules.allowedContentTypes.join(',')}
          multiple
          className="hidden"
          onChange={handleFiles}
          data-testid="property-photo-input"
          aria-label={t('property.photos.upload')}
        />

        {selectionError && (
          <p className="text-sm text-destructive" role="alert" data-testid="property-photo-selection-error">
            {selectionError}
          </p>
        )}
        {actionError !== undefined && (
          <p className="text-sm text-destructive" role="alert" data-testid="property-photo-action-error">
            {getProblemMessage(actionError, t) ?? t('property.photos.actionFailed')}
          </p>
        )}

        {gallery.isLoading ? (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            role="status"
            aria-busy="true"
            aria-label={t('property.photos.loading')}
            data-testid="property-photos-loading"
          >
            {[0, 1, 2, 3].map((slot) => (
              <Skeleton key={slot} className="aspect-[4/3] w-full" />
            ))}
          </div>
        ) : gallery.isError ? (
          <div className="space-y-2 rounded-md border border-destructive/40 p-4" role="alert" data-testid="property-photos-error">
            <p className="text-sm text-destructive">
              {getProblemMessage(gallery.error, t) ?? t('property.photos.loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void gallery.refetch()}>
              {t('property.photos.retry')}
            </Button>
          </div>
        ) : photos.length === 0 ? (
          <div data-testid="property-photos-empty">
            <EmptyState
              icon={ImageIcon}
              title={t('property.photos.emptyTitle')}
              description={t(canEdit ? 'property.photos.emptyDescription' : 'property.photos.emptyReadOnly')}
              action={
                canEdit
                  ? {
                      label: upload.isPending ? t('property.photos.uploading') : t('property.photos.emptyAction'),
                      onClick: openFilePicker,
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground" data-testid="property-photo-counter">
              {t('property.photos.counter', { count: photos.length, max: rules.maxPhotos })}
              {full && canEdit ? ` · ${t('property.photos.limitReached', { max: rules.maxPhotos })}` : ''}
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy={busy}>
              {photos.map((url, index) => (
                <PhotoTile
                  key={url}
                  url={url}
                  index={index}
                  total={photos.length}
                  propertyName={propertyName}
                  isCover={url === coverUrl}
                  canEdit={canEdit}
                  busy={busy}
                  onMove={(offset) => move(index, offset)}
                  onSetCover={() => {
                    setCover.reset();
                    setCover.mutate(url);
                  }}
                  onDelete={() => {
                    remove.reset();
                    setPhotoToDelete(url);
                  }}
                />
              ))}
            </ul>
          </>
        )}
      </CardContent>

      <Dialog open={photoToDelete !== null} onOpenChange={(open) => !open && closeDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('property.photos.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('property.photos.deleteDescription')}</DialogDescription>
          </DialogHeader>
          {remove.isError && (
            <p className="text-sm text-destructive" role="alert">
              {getProblemMessage(remove.error, t) ?? t('property.photos.deleteFailed')}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDelete} disabled={remove.isPending}>
              {t('property.photos.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('property.photos.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface PhotoTileProps {
  url: string;
  index: number;
  total: number;
  propertyName: string;
  isCover: boolean;
  canEdit: boolean;
  busy: boolean;
  onMove: (offset: -1 | 1) => void;
  onSetCover: () => void;
  onDelete: () => void;
}

function PhotoTile({
  url,
  index,
  total,
  propertyName,
  isCover,
  canEdit,
  busy,
  onMove,
  onSetCover,
  onDelete,
}: PhotoTileProps) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  // A relative path (the old container storage) cannot be shown: on the web host it would load the app's index.html.
  const displayable = isDisplayableMediaUrl(url);
  const position = index + 1;

  return (
    <li className="space-y-2" data-testid="property-photo">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        {displayable && !failed ? (
          <img
            src={url}
            alt={t('property.photos.alt', { name: propertyName, index: position })}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <p className="text-xs">{displayable ? t('property.photos.unavailable') : t('property.photos.legacy')}</p>
          </div>
        )}
        {isCover && (
          <Badge className="absolute left-2 top-2" data-testid="property-photo-cover-badge">
            <Star className="mr-1 h-3 w-3" />
            {t('property.photos.cover')}
          </Badge>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMove(-1)}
            disabled={busy || index === 0}
            aria-label={t('property.photos.moveEarlier', { index: position })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMove(1)}
            disabled={busy || index === total - 1}
            aria-label={t('property.photos.moveLater', { index: position })}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          {displayable && !isCover && (
            <Button type="button" variant="outline" size="sm" onClick={onSetCover} disabled={busy}>
              {t('property.photos.setCover')}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8"
            onClick={onDelete}
            disabled={busy}
            aria-label={t('property.photos.delete', { index: position })}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    </li>
  );
}
