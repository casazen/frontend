import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import { caseText } from './guest-supplier-case-copy';
import type { GuestSupplierOrder } from './guest-supplier-order-model';

type Role = 'guest' | 'supplier' | 'host' | 'admin';
interface CaseView {
  assigned: boolean;
  photos: { id: string; side: 'guest' | 'supplier' }[];
  reviews: { id: string; side: 'guest' | 'supplier'; request: string; finding: string | null }[];
}

function CasePhoto({ path, label, isGuest, error }: { path: string; label: string; isGuest: boolean; error: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  const read = useMutation({
    mutationFn: async () => (await axios.get<Blob>(path, { responseType: 'blob', public: isGuest })).data,
    onSuccess: (image) => setSrc(URL.createObjectURL(image)),
  });
  return <div>{src ? <img className="max-h-72 max-w-full rounded" src={src} alt={label} /> :
    <button type="button" disabled={read.isPending} onClick={() => read.mutate()}>{label}</button>}
    {read.isError && <p role="alert">{error}</p>}</div>;
}

export function GuestSupplierCasePanel({ endpoint, role, language, order }: {
  endpoint: string; role: Role; language: string; order: GuestSupplierOrder;
}) {
  const t = caseText(language);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ file: File; id: string } | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const cache = useQueryClient();
  const path = `${endpoint}/${order.id}/case`;
  const isGuest = role === 'guest';
  const options = { public: isGuest };
  const key = ['guest-supplier-case', role, path];
  const details = useQuery({ queryKey: key, enabled: open, retry: false, gcTime: 0,
    queryFn: ({ signal }) => ApiClient.get<CaseView>(path, undefined, { ...options, signal }) });
  const action = useMutation({
    mutationFn: (input: { suffix: string; text?: string } | { upload: File; id: string }) =>
      'upload' in input ? ApiClient.put<CaseView>(`${path}/photos/${input.id}`, input.upload,
        { ...options, headers: { 'Content-Type': input.upload.type || 'application/octet-stream' } }) :
        ApiClient.post<CaseView>(path + input.suffix, input.text === undefined ? {} : { text: input.text }, options),
    onSuccess: (data) => { cache.setQueryData(key, data); setSelected(null); },
  });
  if (!order.complaint || (role === 'host' && !order.hostOrigin) || (role === 'admin' && order.hostOrigin)) return null;
  const view = details.data;
  const participant = role === 'guest' || role === 'supplier';
  const own = view?.reviews.find(r => r.side === role);
  const canUpload = participant && (!!own && !own.finding || order.state === 'Disputed' && !order.decision);
  const reviewed = ['Released', 'Resolved'].includes(order.state) && !!order.decision;
  return <section className="grid gap-2">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{t('open')}</button>
    {open && <div className="grid gap-3 rounded border p-3">
      {details.isLoading && <p role="status">{t('loading')}</p>}
      {details.isError && <p role="alert"><button type="button" onClick={() => void details.refetch()}>{t('error')}</button></p>}
      {view && <>
        {!order.hostOrigin && <p>{t(view.assigned ? 'claimed' : 'staff')}</p>}
        {role === 'admin' && !view.assigned && (order.state === 'Disputed' || view.reviews.some(r => !r.finding)) &&
          <button type="button" disabled={action.isPending} onClick={() => action.mutate({ suffix: '/claim' })}>{t('claim')}</button>}
        {view.photos.map((photo, i) => <CasePhoto key={photo.id} path={path + '/photos/' + photo.id}
          label={`${t('photo')} ${i + 1} · ${t(photo.side)}`} isGuest={isGuest} error={t('error')} />)}
        {canUpload && view.photos.filter(p => p.side === role).length < 3 && <form onSubmit={e => {
          e.preventDefault();
          if (selected) action.mutate({ upload: selected.file, id: selected.id });
        }}>
          <label>{t('add')}<input key={view.photos.length} type="file" accept="image/png,image/jpeg,image/webp"
            onChange={e => {
              const file = e.target.files?.[0];
              setSizeError(!!file && file.size > 4 * 1024 * 1024);
              setSelected(file && file.size <= 4 * 1024 * 1024 ? { file, id: crypto.randomUUID() } : null);
            }} /></label>
          <p>{t('help')}</p>{sizeError && <p role="alert">{t('tooLarge')}</p>}
          <button type="submit" disabled={!selected || action.isPending}>{t('upload')}</button>
        </form>}
        {participant && !order.hostOrigin && reviewed && !own && <Statement label={t('why')} button={t('review')}
          busy={action.isPending} submit={text => action.mutate({ suffix: '/reviews', text })} />}
        {view.reviews.map(review => <div key={review.id} className="grid gap-2">
          <p>{t(review.side)} · {review.request}</p>
          {review.finding ? <p>{t('finding')} · {review.finding}</p> : <p>{t('pending')}</p>}
          {role === 'admin' && !review.finding && <Statement label={t('finding')} button={t('close')}
            busy={action.isPending} submit={text => action.mutate({ suffix: `/reviews/${review.id}/close`, text })} />}
        </div>)}
      </>}
      {action.isError && <p role="alert">{t('error')}</p>}
    </div>}
  </section>;
}

function Statement({ label, button, busy, submit }: { label: string; button: string; busy: boolean; submit: (text: string) => void }) {
  const [text, setText] = useState('');
  return <form className="grid gap-2" onSubmit={e => { e.preventDefault(); if (text.trim()) submit(text.trim()); }}>
    <label>{label}<textarea value={text} maxLength={2000} required onChange={e => setText(e.target.value)} /></label>
    <button disabled={busy || !text.trim()} type="submit">{button}</button>
  </form>;
}
