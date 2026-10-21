import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { isDocumentPhoto as isPhoto, type DocumentPage, type DocumentSelection } from '@/lib/document-pdf';

function PagePreview({ page }: { page: DocumentPage }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(page.file);
    if (image.current) image.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [page.file]);
  return <img ref={image} alt={page.file.name} className="h-24 w-24 object-contain" style={{ transform: `rotate(${page.rotation}deg)` }} />;
}

/** Images are kept in browser memory only. A single PDF is sent to the existing document API. */
export function DocumentPages({ value, onChange, disabled, allowOffice = false, maxPdfMb = 20 }: {
  value: DocumentSelection; onChange: (value: DocumentSelection) => void; disabled?: boolean; allowOffice?: boolean; maxPdfMb?: number;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const photos = value.pages.length > 0 && isPhoto(value.pages[0].file);
  const add = (files: File[]) => {
    if (!files.length || disabled) return;
    const allPhotos = files.every(isPhoto);
    if (files.some(file => file.size === 0 || file.size > 20 * 1024 * 1024) ||
      files.reduce((total, file) => total + file.size, value.pages.reduce((total, page) => total + page.file.size, 0)) > 40 * 1024 * 1024 ||
      (allPhotos && (value.pages.length + files.length > 12 || (value.pages.length > 0 && !photos))) ||
      (!allPhotos && (files.length !== 1 || value.pages.length > 0 || !new RegExp(allowOffice ? '\\.(pdf|docx?)$' : '\\.pdf$', 'i').test(files[0].name)))) {
      setError(t('documentPages.invalid')); return;
    }
    setError('');
    onChange({ pages: [...value.pages, ...files.map(file => ({ id: crypto.randomUUID(), file, rotation: 0 }))], confirmed: false });
  };
  const move = (index: number, offset: number) => {
    const pages = [...value.pages]; [pages[index], pages[index + offset]] = [pages[index + offset], pages[index]];
    onChange({ pages, confirmed: false });
  };
  return <div className="space-y-3">
    <label htmlFor={inputId} className="block text-sm font-medium">{t('documentPages.select')}</label>
    <input ref={input} id={inputId} type="file" multiple accept={allowOffice ? '.pdf,.jpg,.jpeg,.png,.doc,.docx' : '.pdf,.jpg,.jpeg,.png'} disabled={disabled}
      onChange={event => { add(Array.from(event.target.files ?? [])); event.target.value = ''; }} className="block max-w-full" />
    <p className="text-sm text-muted-foreground">{t('documentPages.help', { maxPdfMb })}</p>
    {error ? <p role="alert">{error}</p> : null}
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

