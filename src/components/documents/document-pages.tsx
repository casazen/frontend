import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ArrowUp, ArrowDown, RotateCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { isDocumentPdf, isDocumentPhoto as isPhoto, type DocumentPage, type DocumentSelection } from '@/lib/document-pdf';

const MAX_PHOTOS = 12;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

const hasFiles = (event: { dataTransfer: DataTransfer | null }) => !!event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files');

function PagePreview({ page }: { page: DocumentPage }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(page.file);
    if (image.current) image.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [page.file]);
  return <img ref={image} alt={page.file.name} className="h-24 w-24 object-contain" style={{ transform: `rotate(${page.rotation}deg)` }} />;
}

/** Why the files cannot be added, in words: one reason, the first that applies; `null` when they can. */
function refusal(files: File[], value: DocumentSelection, allowOffice: boolean, t: TFunction): string | null {
  const isOffice = (file: File) => /\.docx?$/i.test(file.name);
  const unsupported = files.find((file) => !isPhoto(file) && !isDocumentPdf(file) && !(allowOffice && isOffice(file)));
  if (unsupported) return t('documentPages.unsupported', { name: unsupported.name });
  const empty = files.find((file) => file.size === 0);
  if (empty) return t('documentPages.emptyFile', { name: empty.name });
  const large = files.find((file) => file.size > MAX_FILE_BYTES);
  if (large) return t('documentPages.fileTooLarge', { name: large.name });
  const total = files.reduce((sum, file) => sum + file.size, value.pages.reduce((sum, page) => sum + page.file.size, 0));
  if (total > MAX_TOTAL_BYTES) return t('documentPages.totalTooLarge');
  const allPhotos = files.every(isPhoto);
  // Photos and a PDF in one go, a PDF added to photos, anything added to a PDF.
  if (files.some(isPhoto) && !allPhotos) return t('documentPages.mixed');
  if (value.pages.length > 0 && (!allPhotos || !isPhoto(value.pages[0].file))) return t('documentPages.mixed');
  if (allPhotos) return value.pages.length + files.length > MAX_PHOTOS ? t('documentPages.tooManyPhotos', { max: MAX_PHOTOS }) : null;
  return files.length !== 1 ? t('documentPages.onePdf') : null;
}

/**
 * The pages of one document: a PDF as it is, or up to 12 photos put in order, turned and joined in one PDF by the browser.
 * Files come from the button or are dropped anywhere on the box. Images are kept in browser memory only. A single PDF is sent
 * to the existing document API.
 */
export function DocumentPages({ value, onChange, disabled, allowOffice = false, maxPdfMb = 20 }: {
  value: DocumentSelection; onChange: (value: DocumentSelection) => void; disabled?: boolean; allowOffice?: boolean; maxPdfMb?: number;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const photos = value.pages.length > 0 && isPhoto(value.pages[0].file);

  // A file dropped beside the box would make the browser open it in place of the app, losing the form (and every page chosen):
  // while the box is on screen such a drop does nothing.
  useEffect(() => {
    const keep = (event: globalThis.DragEvent) => { if (hasFiles(event)) event.preventDefault(); };
    window.addEventListener('dragover', keep);
    window.addEventListener('drop', keep);
    return () => { window.removeEventListener('dragover', keep); window.removeEventListener('drop', keep); };
  }, []);

  const add = (files: File[]) => {
    if (!files.length || disabled) return;
    const reason = refusal(files, value, allowOffice, t);
    if (reason) { setError(reason); return; }
    setError('');
    onChange({ pages: [...value.pages, ...files.map(file => ({ id: crypto.randomUUID(), file, rotation: 0 }))], confirmed: false });
  };
  const move = (index: number, offset: number) => {
    const pages = [...value.pages]; [pages[index], pages[index + offset]] = [pages[index + offset], pages[index]];
    onChange({ pages, confirmed: false });
  };
  const over = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    if (!disabled) setDragging(true);
  };
  const leave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    add(Array.from(event.dataTransfer.files));
  };

  return <div className="space-y-3" onDragEnter={over} onDragOver={over} onDragLeave={leave} onDrop={drop}>
    <div
      data-testid="document-drop-zone"
      data-dragging={dragging || undefined}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
        dragging && 'bg-primary/5 ring-2 ring-primary',
        disabled && 'opacity-60',
      )}
    >
      <Upload aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{t(value.pages.length > 0 ? 'documentPages.dropMore' : 'documentPages.dropHere')}</p>
      <p className="text-sm text-muted-foreground">{t('documentPages.or')}</p>
      <input ref={input} id={inputId} type="file" multiple disabled={disabled} className="peer sr-only"
        accept={allowOffice ? '.pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png' : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'}
        onChange={event => { add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <label htmlFor={inputId} className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed pointer-coarse:min-h-11">{t('documentPages.select')}</label>
      <p className="text-sm text-muted-foreground">{t('documentPages.help', { maxPdfMb })}</p>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <ol className="max-h-80 space-y-3 overflow-auto">
      {value.pages.map((page, index) => <li key={page.id} className="flex flex-wrap items-center gap-3 rounded border p-2">
        {photos ? <PagePreview page={page} /> : null}
        <p className="min-w-0 flex-1 break-all">{index + 1}. {page.file.name}</p>
        <div className="flex flex-wrap gap-1">
          {photos ? <>
            <Button type="button" variant="outline" size="sm" disabled={disabled || index === 0} aria-label={t('documentPages.moveUp', { page: index + 1 })} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled || index === value.pages.length - 1} aria-label={t('documentPages.moveDown', { page: index + 1 })} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled} aria-label={t('documentPages.rotate', { page: index + 1 })} onClick={() => onChange({ pages: value.pages.map((item, i) => i === index ? { ...item, rotation: (item.rotation + 90) % 360 } : item), confirmed: false })}><RotateCw className="h-4 w-4" aria-hidden="true" /></Button>
          </> : null}
          <Button type="button" variant="outline" size="sm" disabled={disabled} aria-label={t('documentPages.remove', { page: index + 1 })} onClick={() => onChange({ pages: value.pages.filter((_, i) => i !== index), confirmed: false })}>{t('documentPages.removeButton')}</Button>
        </div>
      </li>)}
    </ol>
    {photos ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={value.confirmed} disabled={disabled} onChange={event => onChange({ ...value, confirmed: event.target.checked })} />{t('documentPages.confirm')}</label> : null}
  </div>;
}
