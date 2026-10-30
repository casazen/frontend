/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useEffect, useState, type MouseEvent } from 'react';
import {
  VIEW_ITALIA,
  fitView,
  getRegionForPoints,
  loadRegionData,
  makeView,
  panView,
  projectPoint,
  regionMapSvg,
  regionsForView,
  snapToLand,
  unprojectPoint,
  zoomView,
  type LabelMode,
  type LatLon,
  type View,
} from '@/features/site-maps';
import { HOME_IDS, HOUSES, type House } from './maps-data';
import { HomePin, SvgBox } from './maps-shared';

const byId = (...ids: string[]): House[] => HOUSES.filter((h) => ids.includes(h.id));
const PRESETS: { id: string; label: string; view: (aspect: number) => View }[] = [
  { id: 'home', label: 'Lombardia e Svizzera', view: (aspect) => getRegionForPoints(byId(...HOME_IDS), { aspect }).view },
  { id: 'italia', label: 'Italia', view: (aspect) => ({ ...VIEW_ITALIA, aspect, spanKm: Math.max(VIEW_ITALIA.spanKm, 1280 * aspect) }) },
  { id: 'lombardia', label: 'Lombardia', view: (aspect) => makeView({ lat: 45.55, lon: 9.9, spanKm: 230, aspect }) },
  { id: 'svizzera', label: 'Svizzera', view: (aspect) => makeView({ lat: 46.8, lon: 8.2, spanKm: 330, aspect }) },
  { id: 'como', label: 'Lago di Como', view: (aspect) => fitView(byId('bellagio', 'como'), { aspect, minSpanKm: 40 }) },
  { id: 'maggiore', label: 'Lago Maggiore', view: (aspect) => makeView({ lat: 45.95, lon: 8.65, spanKm: 70, aspect }) },
  { id: 'garda', label: 'Lago di Garda', view: (aspect) => fitView(byId('sirmione'), { aspect, minSpanKm: 70 }) },
  { id: 'iseo', label: 'Lago d’Iseo', view: (aspect) => fitView(byId('iseo'), { aspect, minSpanKm: 30 }) },
  { id: 'milano', label: 'Milano', view: (aspect) => fitView(byId('milano'), { aspect, minSpanKm: 50 }) },
  { id: 'lugano', label: 'Lugano e Locarno', view: (aspect) => fitView(byId('lugano', 'locarno'), { aspect, minSpanKm: 40 }) },
  { id: 'zurigo', label: 'Zurigo', view: (aspect) => fitView(byId('zurigo'), { aspect, minSpanKm: 60 }) },
  { id: 'lemano', label: 'Lago Lemano', view: (aspect) => fitView(byId('ginevra', 'montreux'), { aspect, minSpanKm: 70 }) },
  { id: 'lucerna', label: 'Lago dei Quattro Cantoni', view: (aspect) => fitView(byId('lucerna'), { aspect, minSpanKm: 50 }) },
  { id: 'engadina', label: 'Engadina', view: (aspect) => fitView(byId('moritz'), { aspect, minSpanKm: 60 }) },
  { id: 'zermatt', label: 'Zermatt', view: (aspect) => fitView(byId('zermatt'), { aspect, minSpanKm: 30 }) },
  { id: 'toscana', label: 'Toscana', view: (aspect) => fitView(byId('orcia', 'chianti'), { aspect, minSpanKm: 40, padPct: 0.4 }) },
  { id: 'liguria', label: 'Cinque Terre', view: (aspect) => fitView(byId('cinque'), { aspect, minSpanKm: 25 }) },
  { id: 'cortina', label: 'Dolomiti', view: (aspect) => fitView(byId('cortina'), { aspect, minSpanKm: 60 }) },
  { id: 'venezia', label: 'Venezia', view: (aspect) => fitView(byId('venezia'), { aspect, minSpanKm: 40 }) },
  { id: 'amalfi', label: 'Costiera amalfitana', view: (aspect) => fitView(byId('amalfi'), { aspect, minSpanKm: 40 }) },
  { id: 'roma', label: 'Roma', view: (aspect) => fitView(byId('roma'), { aspect, minSpanKm: 60 }) },
  { id: 'sicilia', label: 'Sicilia', view: (aspect) => fitView(byId('taormina', 'trapani'), { aspect, minSpanKm: 40, padPct: 0.3 }) },
  { id: 'sardegna', label: 'Sardegna', view: (aspect) => fitView(byId('smeralda', 'alghero'), { aspect, minSpanKm: 40, padPct: 0.3 }) },
];
const WIDTHS = [360, 700, 1000];
const LABEL_MODES: LabelMode[] = ['auto', 'major', 'all', 'none'];
const LEVELS: (number | 'auto')[] = ['auto', 0, 1, 2];
const ASPECT = 4 / 3;

const btn = 'h-9 rounded-md border bg-background px-3 text-sm hover:bg-muted';
const on = 'border-foreground bg-muted font-semibold';

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/** The regional maps with pins over them: presets, zoom and pan, the three levels of detail, the snapping of the pins to land. */
export function RegionSection() {
  const [view, setView] = useState<View>(() => PRESETS[0].view(ASPECT));
  const [width, setWidth] = useState(1000);
  const [labels, setLabels] = useState<LabelMode>('auto');
  const [level, setLevel] = useState<number | 'auto'>('auto');
  const [pins, setPins] = useState(true);
  const [snap, setSnap] = useState(true);
  const [error, setError] = useState('');
  // the data of a region are loaded the first time a view needs them
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all(regionsForView(view).map(loadRegionData))
      .then(() => {
        if (alive) setLoaded((n) => n + 1);
      })
      .catch((e: unknown) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [view]);

  const highlight = HOUSES.flatMap((h) => h.near);
  const svg = regionMapSvg(view, { width, labels, highlight, ...(level === 'auto' ? {} : { level }) });
  const place = (p: LatLon) => projectPoint(p.lat, p.lon, view);

  const onMapClick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ll = unprojectPoint(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, view);
    setView(zoomView(view, e.shiftKey ? 0.5 : 2, ll));
  };

  return (
    <section aria-labelledby="maps-region" className="grid gap-4">
      <div>
        <h2 id="maps-region" className="text-lg font-semibold">Mappe regionali</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Clic = zoom ×2 sul punto, maiusc+clic = ×0,5. I pin sono le case di esempio (posizioni a due decimali): quello pieno è dove li mette la mappa dopo <code>snapToLand</code>, l&apos;anello vuoto la posizione arrotondata se è diversa.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Viste">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={btn} onClick={() => setView(p.view(ASPECT))}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => setView(zoomView(view, 2))}>Zoom +</button>
        <button type="button" className={btn} onClick={() => setView(zoomView(view, 0.5))}>Zoom −</button>
        <button type="button" className={btn} onClick={() => setView(panView(view, -0.25, 0))}>←</button>
        <button type="button" className={btn} onClick={() => setView(panView(view, 0, -0.25))}>↑</button>
        <button type="button" className={btn} onClick={() => setView(panView(view, 0, 0.25))}>↓</button>
        <button type="button" className={btn} onClick={() => setView(panView(view, 0.25, 0))}>→</button>
        <span className="mx-2 h-6 border-l" />
        {WIDTHS.map((w) => (
          <button key={w} type="button" className={`${btn} ${w === width ? on : ''}`} aria-pressed={w === width} onClick={() => setWidth(w)}>
            {w} px
          </button>
        ))}
        <span className="mx-2 h-6 border-l" />
        {LABEL_MODES.map((m) => (
          <button key={m} type="button" className={`${btn} ${m === labels ? on : ''}`} aria-pressed={m === labels} onClick={() => setLabels(m)}>
            nomi: {m}
          </button>
        ))}
        <span className="mx-2 h-6 border-l" />
        {LEVELS.map((l) => (
          <button key={String(l)} type="button" className={`${btn} ${l === level ? on : ''}`} aria-pressed={l === level} onClick={() => setLevel(l)}>
            dettaglio: {l}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Toggle checked={pins} onChange={setPins}>pin delle case</Toggle>
        <Toggle checked={snap} onChange={setSnap}>pin riportati a terra</Toggle>
      </div>
      <div className="rounded-2xl border bg-card p-3 shadow-sm" style={{ width: width + 26, maxWidth: '100%' }}>
        <div className="relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-xl bg-[#cfe3e6]" onClick={onMapClick} data-testid="region-map" data-loaded={loaded}>
          <SvgBox svg={svg} />
          {pins
            ? HOUSES.map((h) => {
                const s = snap ? snapToLand(h) : h;
                const raw = place(h);
                const p = place(s);
                if (p.x < -2 || p.x > 102 || p.y < -2 || p.y > 102) return null;
                const moved = Math.abs(raw.x - p.x) + Math.abs(raw.y - p.y) > 0.05;
                return (
                  <div key={h.id}>
                    {moved ? <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#a3431f] bg-transparent" style={{ left: `${raw.x}%`, top: `${raw.y}%` }} /> : null}
                    <HomePin x={p.x} y={p.y} />
                  </div>
                );
              })
            : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          vista <code>{JSON.stringify({ lat: +view.lat.toFixed(3), lon: +view.lon.toFixed(3), spanKm: +view.spanKm.toFixed(1) })}</code> · SVG {(svg.length / 1024).toFixed(1)} kB · larghezza {width} px
          {error ? ` · errore: ${error}` : ''}
        </p>
      </div>
    </section>
  );
}
