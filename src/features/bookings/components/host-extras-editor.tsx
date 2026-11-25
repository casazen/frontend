import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { formatExtraPrice, hostExtraStatus, type HostExtraOrder, type HostExtraStatus } from '@/features/guest-portal/guest-host-extra-model';

interface Extra {
  id: string;
  name: string;
  description: string;
  price: number;
  pricing: typeof priceModes[number];
  inventory: number | null;
  cutoffHours: number;
  duringStay: boolean;
  requiresApproval: boolean;
  calendar: typeof calendars[number];
  published: boolean;
  hasTranslations?: boolean;
}
const priceModes = ['Fixed', 'PerNight', 'PerGuest', 'PerUnit'] as const;
const calendars = ['None', 'EarlyCheckIn', 'LateCheckOut'] as const;
const initial: Extra = {
  id: '00000000-0000-0000-0000-000000000000', name: '', description: '', price: 10, pricing: 'Fixed', inventory: null,
  cutoffHours: 0, duringStay: false, requiresApproval: false, calendar: 'None', published: false,
};
const labels = {
  it: ['Extra della casa', 'Nuovo extra', 'Nome', 'Descrizione', 'Prezzo', 'Prezzo calcolato', 'Fisso', 'Per notte', 'Per persona', 'Per pezzo',
    'Inventario', 'Ore di anticipo', 'Disponibile durante il soggiorno', 'Approvazione richiesta', 'Vincolo calendario', 'Nessuno',
    'Early check-in', 'Late check-out', 'Pubblica per questa struttura', 'Salva', 'Ordini del soggiorno', 'Approva', 'Rifiuta', 'Segna erogato',
    'Caricamento…', 'Operazione non riuscita', 'Pubblicato', 'Bozza', 'Genera traduzioni con AI', 'Traduzioni disponibili'],
  en: ['Host extras', 'New extra', 'Name', 'Description', 'Price', 'Pricing basis', 'Fixed', 'Per night', 'Per guest', 'Per unit',
    'Inventory', 'Hours before check-in', 'Available during the stay', 'Approval required', 'Calendar restriction', 'None',
    'Early check-in', 'Late check-out', 'Publish for this property', 'Save', 'Orders for this stay', 'Approve', 'Decline', 'Mark fulfilled',
    'Loading…', 'Something went wrong', 'Published', 'Draft', 'Generate AI translations', 'Translations available'],
} as const;

export function HostExtrasEditor({ propertyId, bookingId, suggestions }: {
  propertyId: string;
  bookingId?: string;
  suggestions?: ReadonlyArray<{ name: string; price: number }>;
}) {
  const { i18n } = useTranslation();
  const language = i18n.language?.startsWith('it') ? 'it' : 'en';
  const l = labels[language];
  const catalogPath = `/properties/${propertyId}/guest-host-extras`;
  const orderPath = `/bookings/${bookingId}/guest-host-extras`;
  const catalog = useQuery({ queryKey: ['host-extras', propertyId], enabled: !bookingId, queryFn: () => ApiClient.get<Extra[]>(catalogPath) });
  const orders = useQuery({
    queryKey: ['booking-extras', bookingId],
    queryFn: () => ApiClient.get<HostExtraOrder[]>(orderPath),
    enabled: Boolean(bookingId),
  });
  const [draft, setDraft] = useState<Extra>();
  const save = useMutation({
    mutationFn: (item: Extra) => ApiClient.put(`${catalogPath}/${item.id}`, item),
    onSuccess: () => { setDraft(undefined); return catalog.refetch(); },
  });
  const translate = useMutation({
    mutationFn: (id: string) => ApiClient.post(`${catalogPath}/${id}/translate`),
    onSuccess: () => catalog.refetch(),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HostExtraStatus }) => ApiClient.put(`${orderPath}/${id}`, { status }),
    onSuccess: () => orders.refetch(),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft) save.mutate(draft);
  }

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4">
      {!bookingId && <>
      <h2 className="font-medium">{l[0]}</h2>
      {catalog.isPending && <p role="status">{l[24]}</p>}
      {(catalog.isError || orders.isError || save.isError || update.isError || translate.isError) && <p role="alert">{l[25]}</p>}
      <div className="flex flex-wrap gap-2">
        {catalog.data?.map((extra) => <Button variant="outline" type="button" key={extra.id}
          onClick={() => setDraft(extra)}>{extra.name} · {extra.published ? l[26] : l[27]}</Button>)}
        <Button type="button" onClick={() => setDraft(initial)}>{l[1]}</Button>
        {suggestions?.map((item) => (
          <Button variant="outline" type="button" key={item.name}
            onClick={() => setDraft({ ...initial, name: item.name, price: item.price })}>
            {l[1]} · {item.name}
          </Button>
        ))}
      </div>
      {draft && catalog.data?.some((item) => item.id === draft.id && item.name === draft.name &&
        item.description === draft.description) && (
        <div className="flex items-center gap-3">
          <Button variant="outline" type="button" disabled={translate.isPending || save.isPending}
            onClick={() => translate.mutate(draft.id)}>{l[28]}</Button>
          {catalog.data.find((item) => item.id === draft.id)?.hasTranslations && <p role="status">{l[29]}</p>}
        </div>
      )}
      {draft && (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1">{l[2]}<input required maxLength={120} value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="grid gap-1">{l[3]}<textarea maxLength={2000} value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="grid gap-1">{l[4]}<input required type="number" min="0.50" max="10000" step="0.01"
            value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.valueAsNumber || 0 })} /></label>
          <label className="grid gap-1">{l[5]}<select value={draft.pricing}
            onChange={(event) => setDraft({ ...draft, pricing: event.target.value as Extra['pricing'] })}>
            {priceModes.map((value, index) => <option key={value} value={value}>{l[6 + index]}</option>)}
          </select></label>
          <label className="grid gap-1">{l[10]}<input type="number" min="1" max="10000" value={draft.inventory ?? ''}
            onChange={(event) => setDraft({ ...draft, inventory: event.target.valueAsNumber || null })} /></label>
          <label className="grid gap-1">{l[11]}<input required type="number" min="0" max="720" value={draft.cutoffHours}
            onChange={(event) => setDraft({ ...draft, cutoffHours: event.target.valueAsNumber || 0 })} /></label>
          <label className="grid gap-1">{l[14]}<select value={draft.calendar} onChange={(event) => {
            const calendar = event.target.value as Extra['calendar'];
            setDraft({ ...draft, calendar, duringStay: calendar === 'EarlyCheckIn' ? false : draft.duringStay });
          }}>
            {calendars.map((value, index) => <option key={value} value={value}>{l[15 + index]}</option>)}
          </select></label>
          <div className="grid gap-2">
            <label><input type="checkbox" checked={draft.duringStay} disabled={draft.calendar === 'EarlyCheckIn'}
              onChange={(event) => setDraft({ ...draft, duringStay: event.target.checked })} /> {l[12]}</label>
            <label><input type="checkbox" checked={draft.requiresApproval}
              onChange={(event) => setDraft({ ...draft, requiresApproval: event.target.checked })} /> {l[13]}</label>
            <label><input type="checkbox" checked={draft.published}
              onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> {l[18]}</label>
          </div>
          <Button type="submit" disabled={save.isPending}>{l[19]}</Button>
        </form>
      )}
      </>}
      {bookingId && (
        <div className="grid gap-2">
          <h3>{l[20]}</h3>
          {orders.isPending && <p role="status">{l[24]}</p>}
          {(orders.isError || update.isError) && <p role="alert">{l[25]}</p>}
          {orders.data?.map((order) => (
            <div className="grid gap-2 rounded-md border p-3" key={order.id}>
              <p>{order.name} · {order.quantity} · {formatExtraPrice(language, order.amount, order.currency)} · {hostExtraStatus(language, order.status)}</p>
              {(order.status === 'Requested' || order.status === 'Paid') && (
                <div className="flex gap-2">
                  <Button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, status: order.status === 'Requested' ? 'CapturePending' : 'Fulfilled' })}>
                    {order.status === 'Requested' ? l[21] : l[23]}
                  </Button>
                  {order.status === 'Requested' && <Button variant="outline" type="button" disabled={update.isPending}
                    onClick={() => update.mutate({ id: order.id, status: 'Declined' })}>{l[22]}</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
