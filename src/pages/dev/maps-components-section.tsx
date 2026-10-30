/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useState } from 'react';
import { LocalMap, RegionMap, useMapLink, type LocalPoi, type MapPinData } from '@/features/site-maps';

/** Houses of the review: positions with two decimals, prices written by the page. */
const HOUSES: MapPinData[] = [
  { id: 'casa-bianca', name: 'Casa Bianca', lat: 41.0, lon: 17.23, label: '145 €', href: '/dev/maps?s=components&casa=casa-bianca', card: { zone: 'Polignano a Mare', rating: 4.9, priceLabel: '145 € a notte' } },
  { id: 'trullo', name: 'Trullo tra gli ulivi', lat: 40.76, lon: 17.54, label: '120 €', href: '/dev/maps?s=components&casa=trullo', card: { zone: 'Ostuni', rating: 4.8, priceLabel: '120 € a notte' } },
  { id: 'masseria', name: 'Masseria Ulivi', lat: 40.8, lon: 17.34, label: '210 €', href: '/dev/maps?s=components&casa=masseria', available: false, unavailableNote: 'Non libera dal 12 ottobre', card: { zone: 'Locorotondo', priceLabel: '210 € a notte' } },
  { id: 'attico', name: 'Attico nel centro', lat: 40.35, lon: 18.17, label: '98 €', href: '/dev/maps?s=components&casa=attico', card: { zone: 'Lecce', rating: 4.7, priceLabel: '98 € a notte' } },
  { id: 'faro', name: 'Villa del Faro', lat: 41.88, lon: 16.18, label: '260 €', href: '/dev/maps?s=components&casa=faro', card: { zone: 'Vieste', rating: 5, priceLabel: '260 € a notte' } },
  // two houses in the same village: the pins must not hide each other
  { id: 'vicolo-1', name: 'Casa del Vicolo', lat: 40.95, lon: 17.3, label: '110 €', href: '/dev/maps?s=components&casa=vicolo-1', card: { zone: 'Monopoli', priceLabel: '110 € a notte' } },
  { id: 'vicolo-2', name: 'Casa della Torre', lat: 40.95, lon: 17.31, label: '135 €', href: '/dev/maps?s=components&casa=vicolo-2', card: { zone: 'Monopoli', rating: 4.6, priceLabel: '135 € a notte' } },
];
const ABROAD: MapPinData[] = [{ id: 'abroad', name: 'Una casa fuori dall’Italia', lat: 48.85, lon: 2.35, label: '99 €' }];

const POIS: LocalPoi[] = [
  { id: 'spiaggia', type: 'beach', name: 'Cala Paura', mode: 'walk', minutes: 8, bearingDeg: 90, distM: 600 },
  { id: 'centro', type: 'sight', name: 'Centro storico', mode: 'walk', minutes: 5, bearingDeg: 350, distM: 350 },
  { id: 'trattoria', type: 'food', name: 'Trattoria da Gino', mode: 'walk', minutes: 4, bearingDeg: 225, distM: 300 },
  { id: 'spesa', type: 'shop', name: 'Supermercato', mode: 'walk', minutes: 9, bearingDeg: 180, distM: 700 },
  { id: 'stazione', type: 'transport', name: 'Stazione', mode: 'car', minutes: 5, bearingDeg: 250, distM: 2600 },
  { id: 'farmacia', type: 'health', name: 'Farmacia', mode: 'walk', minutes: 6, bearingDeg: 45, distM: 450 },
  { id: 'parcheggio', type: 'parking', name: 'Parcheggio pubblico', mode: 'walk', minutes: 3, bearingDeg: 120, distM: 220 },
  { id: 'aeroporto', type: 'transport', name: 'Aeroporto di Bari', mode: 'car', minutes: 40, bearingDeg: 300, distM: 45000 },
];

function HouseList({ link, selected, onPick }: { link: ReturnType<typeof useMapLink>; selected: string | null; onPick: (id: string) => void }) {
  return (
    <ul className="grid gap-2" aria-label="Le case">
      {HOUSES.map((h) => (
        <li key={h.id}>
          <button
            type="button"
            {...link.bind(h.id)}
            onClick={() => onPick(h.id)}
            aria-pressed={selected === h.id}
            className="flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left data-[map-active=true]:border-foreground data-[map-active=true]:bg-muted"
          >
            <span>
              <b className="block">{h.name}</b>
              <small className="text-muted-foreground">{h.card?.zone}{h.available === false ? ' · non libera' : ''}</small>
            </span>
            <b>{h.card?.priceLabel}</b>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The components of DB-19b on made-up data: the list and the map lit together, a phone-sized map, the empty case, the map of a zone. */
export function ComponentsSection() {
  const link = useMapLink();
  const zoneLink = useMapLink();
  const [selected, setSelected] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  return (
    <section aria-labelledby="maps-components" className="grid gap-8">
      <div>
        <h2 id="maps-components" className="text-lg font-semibold">Componenti: RegionMap e LocalMap</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          I pin sono pulsanti con il loro nome (Tab, Invio o Spazio per scegliere, Esc per lasciare); la mappa si sposta con il mouse o con le frecce e si ingrandisce con i pulsanti, con + e - o con Ctrl e rotella.
        </p>
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold">Elenco e mappa insieme</h3>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <HouseList link={link} selected={selected} onPick={(id) => setSelected((s) => (s === id ? null : id))} />
          <RegionMap pins={HOUSES} aspect={4 / 3} selectedId={selected} onSelect={setSelected} activeId={link.activeId} onActiveChange={link.setActiveId} highlightTowns={['ostuni']} />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold">Telefono (360 px, la mappa riempie la sua scatola)</h3>
        <div className="h-[560px] w-[360px] max-w-full">
          <RegionMap pins={HOUSES} className="h-full w-full" />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold">Nessuna posizione utilizzabile (fuori dall’Italia)</h3>
        <div className="max-w-xl">
          <RegionMap pins={ABROAD} aspect={4 / 3} />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold">Mappa della zona e punti di interesse</h3>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={unlocked} onChange={(e) => setUnlocked(e.target.checked)} />
          indirizzo sbloccato (il giorno prima dell’arrivo)
        </label>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <ul className="grid gap-2" aria-label="Punti di interesse">
            {POIS.map((p) => (
              <li key={p.id} {...zoneLink.bind(p.id)} className="flex items-center justify-between rounded-xl border bg-card p-3 data-[map-active=true]:border-foreground data-[map-active=true]:bg-muted">
                <span>{p.name}</span>
                <small className="text-muted-foreground">{p.minutes} min {p.mode === 'walk' ? 'a piedi' : 'in auto'}{p.distM > 20000 ? ' · solo nell’elenco' : ''}</small>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <LocalMap kind="coast" seed="casa-bianca" seaBearingDeg={90} pois={POIS} activeId={zoneLink.activeId} onActiveChange={zoneLink.setActiveId} addressUnlocked={unlocked} />
            <LocalMap kind="coast" seed="casa-tirrenica" seaBearingDeg={270} pois={POIS.map((p) => (p.id === 'spiaggia' ? { ...p, bearingDeg: 270 } : p))} activeId={zoneLink.activeId} onActiveChange={zoneLink.setActiveId} addressUnlocked={unlocked} />
            <LocalMap kind="country" seed="trullo" pois={POIS} activeId={zoneLink.activeId} onActiveChange={zoneLink.setActiveId} addressUnlocked={unlocked} />
            <LocalMap kind="historic" seed="attico" pois={POIS} activeId={zoneLink.activeId} onActiveChange={zoneLink.setActiveId} addressUnlocked={unlocked} />
          </div>
        </div>
      </div>
    </section>
  );
}
