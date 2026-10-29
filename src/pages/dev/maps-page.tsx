/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Segmented } from '@/components/ui/segmented';
import {
  LOCAL_KINDS,
  VIEW_PUGLIA,
  fitView,
  loadRegionData,
  localMapSvg,
  localPlace,
  makeView,
  panView,
  projectPoint,
  publicPoint,
  regionMapSvg,
  resetMapIds,
  snapToLand,
  unprojectPoint,
  zoomView,
  type LocalKind,
  type LocalSpec,
  type MapLabel,
} from '@/features/site-maps';
import { PUGLIA } from '@/features/site-maps/data/puglia';
import { HOUSES, RegionSection } from './maps-region-section';
import { HomePin, PoiDot, SvgBox } from './maps-shared';

type Section = 'region' | 'local' | 'checks';
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'region', label: 'Mappe regionali' },
  { value: 'local', label: 'Mappe locali' },
  { value: 'checks', label: 'Dimensioni e controlli' },
];

const KIND_NAME: Record<LocalKind, string> = { country: 'Campagna', coast: 'Costa', historic: 'Centro storico' };

/** Points of interest of the review: a letter, the bearing (0 = north, 90 = east) and the distance in metres. */
const POIS = [
  { l: 'A', b: 90, d: 400 },
  { l: 'B', b: 270, d: 500 },
  { l: 'C', b: 0, d: 350 },
  { l: 'D', b: 180, d: 450 },
  { l: 'E', b: 45, d: 650 },
  { l: 'F', b: 225, d: 300 },
  { l: 'G', b: 135, d: 700 },
  { l: 'H', b: 315, d: 550 },
];
const LABELS: Record<LocalKind, MapLabel[]> = {
  country: [{ text: 'Ostuni', x: 82, y: 12 }, { text: 'Contrada Lamacoppa', x: 30, y: 78 }],
  coast: [{ text: 'Centro storico', x: 36, y: 30 }, { text: 'Mare Adriatico', x: 84, y: 82 }],
  historic: [{ text: 'Piazza Duomo', x: 30, y: 22 }, { text: 'Castello', x: 80, y: 16 }],
};
const NO_LABELS: MapLabel[] = [];
const SEA_BEARINGS = [90, 0, 180, 270, 45, 200];

interface LocalCardProps {
  kind: LocalKind;
  seed: string;
  width: number;
  title: string;
  pois?: boolean;
  seaBearingDeg?: number;
}
function LocalCard({ kind, seed, width, title, pois = false, seaBearingDeg }: LocalCardProps) {
  const spec: LocalSpec = { kind, seed, spanM: 1500, seaBearingDeg };
  const labels = pois ? LABELS[kind] : NO_LABELS;
  const svg = useMemo(() => localMapSvg({ kind, seed, spanM: 1500, seaBearingDeg, width, labels }), [kind, seed, width, labels, seaBearingDeg]);
  const places = pois ? POIS.map((p) => ({ ...p, ...localPlace(spec, { bearingDeg: p.b, distM: p.d }) })) : [];
  const beach = seaBearingDeg == null ? null : localPlace(spec, { bearingDeg: seaBearingDeg, distM: 600 });
  return (
    <figure className="rounded-2xl border bg-card p-3 shadow-sm" style={{ width: width + 26, maxWidth: '100%' }}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#efe7d8]">
        <SvgBox svg={svg} />
        {places.map((p) => (
          <PoiDot key={p.l} letter={p.l} x={p.x} y={p.y} />
        ))}
        {beach ? <PoiDot letter="S" x={beach.x} y={beach.y} /> : null}
        <HomePin />
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        <b className="text-foreground">{title}</b> · {(svg.length / 1024).toFixed(1)} kB
        {places.length ? ` · punti A-H = localPlace (N 350 m, E 400 m, S 450 m, O 500 m, NE 650 m, SO 300 m, SE 700 m, NO 550 m)` : ''}
        {beach ? ` · S = spiaggia a ${seaBearingDeg}° (600 m, riportata a terra)` : ''}
      </figcaption>
    </figure>
  );
}

function LocalSection() {
  const [seed, setSeed] = useState('casa-bianca');
  return (
    <section aria-labelledby="maps-local" className="grid gap-6">
      <div>
        <h2 id="maps-local" className="text-lg font-semibold">Mappe locali: campagna, costa, centro storico</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Schemi generati dal seme (lo slug della casa), non le strade vere. La casa sta sempre al centro; i punti A-H sono posizionati da <code>localPlace</code>.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          Seme
          <input value={seed} onChange={(e) => setSeed(e.target.value)} className="h-9 rounded-md border bg-background px-2" />
        </label>
      </div>
      {LOCAL_KINDS.map((kind) => (
        <div key={kind} className="flex flex-wrap items-start gap-4">
          {['1', '2', '3', '4'].map((s) => (
            <LocalCard key={s} kind={kind} seed={s} width={360} title={`${KIND_NAME[kind]} · seme ${s}`} />
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-start gap-4">
        {LOCAL_KINDS.map((kind) => (
          <LocalCard key={kind} kind={kind} seed={seed} width={560} title={`${KIND_NAME[kind]} · seme «${seed}»`} pois />
        ))}
      </div>
      <div>
        <h3 className="text-base font-semibold">Direzione del mare (mappa «costa»)</h3>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          <code>seaBearingDeg</code>: 90 è l&apos;est dell&apos;approvato, gli altri valori girano il disegno. Il punto S cade a terra anche se la spiaggia è nel mare.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        {SEA_BEARINGS.map((b) => (
          <LocalCard key={b} kind="coast" seed={seed} width={360} title={`Mare a ${b}°`} seaBearingDeg={b} />
        ))}
      </div>
    </section>
  );
}

interface Check {
  name: string;
  pass: boolean;
  info: string;
}
interface Measure {
  name: string;
  kb: string;
  ms: number;
}

const near = (a: number, b: number, e = 1e-9): boolean => Math.abs(a - b) < e;

function ChecksSection() {
  const [result, setResult] = useState<{ rows: Measure[]; checks: Check[] } | null>(null);
  const run = async () => {
    await Promise.all([loadRegionData('italia'), loadRegionData('puglia')]);
    const rows: Measure[] = [];
    const time = (name: string, fn: () => string) => {
      const t0 = performance.now();
      const svg = fn();
      rows.push({ name, kb: (svg.length / 1024).toFixed(1), ms: Math.round(performance.now() - t0) });
      return svg;
    };
    for (const span of [1050, 360, 150, 80, 40, 20, 10, 4]) {
      time(`regione · larghezza ${span} km · 1000 px`, () => regionMapSvg(makeView({ lat: 40.9, lon: 17.3, spanKm: span }), { width: 1000 }));
    }
    time('regione · tutta l’Italia · 700 px', () => regionMapSvg({ lat: 41.5, lon: 12.5, spanKm: 1400, aspect: 0.8 }, { width: 700 }));
    for (const kind of LOCAL_KINDS) for (const seed of [1, 2, 3]) time(`locale ${kind} · seme ${seed} · 800 px`, () => localMapSvg({ kind, seed, width: 800 }));

    const checks: Check[] = [];
    const idless = (svg: string) => svg.replace(/sm[0-9]+/g, 'smX');
    const v = VIEW_PUGLIA;
    const p0 = projectPoint(v.lat, v.lon, v);
    checks.push({ name: 'projectPoint del centro della vista = 50 %, 50 %', pass: near(p0.x, 50) && near(p0.y, 50), info: '' });
    const pp = projectPoint(40.9, 17.1, v);
    const q = unprojectPoint(pp.x, pp.y, v);
    checks.push({ name: 'unprojectPoint(projectPoint(p)) = p', pass: near(q.lat, 40.9) && near(q.lon, 17.1), info: '' });
    const a = { lat: 40.8, lon: 17.3 };
    const z0 = projectPoint(a.lat, a.lon, v);
    const z1 = projectPoint(a.lat, a.lon, zoomView(v, 4, a));
    checks.push({ name: 'zoomView con ancora: il punto resta fermo', pass: near(z0.x, z1.x) && near(z0.y, z1.y), info: '' });
    const pn = projectPoint(v.lat, v.lon, panView(v, 0.25, 0.25));
    checks.push({ name: 'panView(0,25; 0,25): il vecchio centro finisce a 25 % e 25 %', pass: near(pn.x, 25) && near(pn.y, 25), info: '' });
    const fv = fitView(HOUSES.slice(0, 3));
    checks.push({
      name: 'fitView contiene le case con il margine del 20 %',
      pass: HOUSES.slice(0, 3).every((h) => {
        const p = projectPoint(h.lat, h.lon, fv);
        return p.x >= 10 - 1e-6 && p.x <= 90 + 1e-6 && p.y >= 10 - 1e-6 && p.y <= 90 + 1e-6;
      }),
      info: '',
    });
    let refused = false;
    try {
      publicPoint({ lat: 40.9965, lon: 17.2195 });
    } catch {
      refused = true;
    }
    checks.push({ name: 'una posizione con più di due decimali è rifiutata (in sviluppo)', pass: refused, info: '' });
    const view = makeView({ lat: 40.9, lon: 17.3, spanKm: 40 });
    checks.push({
      name: 'stessi input, stesso disegno (a meno del contatore degli id)',
      pass: idless(regionMapSvg(view)) === idless(regionMapSvg(view)) && LOCAL_KINDS.every((kind) => idless(localMapSvg({ kind, seed: 'x' })) === idless(localMapSvg({ kind, seed: 'x' }))),
      info: '',
    });
    resetMapIds();
    checks.push({ name: 'dopo resetMapIds il primo id è sm1', pass: localMapSvg({ kind: 'country', seed: 1 }).includes('id="sm1'), info: '' });
    let max = 0;
    for (const span of [1050, 360, 150, 60, 30, 12, 5, 3]) {
      for (const [la, lo] of [[40.9, 17.3], [40.35, 18.17], [41.12, 16.87], [43.4, 11.2], [37.9, 14.0], [45.9, 9.3]]) {
        max = Math.max(max, regionMapSvg(makeView({ lat: la, lon: lo, spanKm: span }), { width: 1000, highlight: ['ostuni', 'lecce'] }).length);
      }
    }
    checks.push({ name: 'regione: massimo 60 kB a ogni zoom (48 combinazioni)', pass: max < 60 * 1024, info: `massimo ${(max / 1024).toFixed(1)} kB` });
    let maxLocal = 0;
    for (const kind of LOCAL_KINDS) for (let seed = 1; seed <= 12; seed++) maxLocal = Math.max(maxLocal, localMapSvg({ kind, seed, width: 800 }).length);
    checks.push({ name: 'locali: massimo 25 kB (3 tipi × 12 semi)', pass: maxLocal < 25 * 1024, info: `massimo ${(maxLocal / 1024).toFixed(1)} kB` });
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    let outside = 0;
    for (const kind of LOCAL_KINDS) {
      for (let i = 0; i < 400; i++) {
        const p = localPlace({ kind, seed: 1 + (i % 9), spanM: 1500, seaBearingDeg: kind === 'coast' ? rnd() * 360 : undefined }, { bearingDeg: rnd() * 360, distM: rnd() * 2000 });
        if (!(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)) outside++;
      }
    }
    checks.push({ name: 'localPlace: sempre dentro il riquadro (1200 punti casuali, mare in ogni direzione)', pass: outside === 0, info: `${outside} fuori` });
    // the detail of Puglia against the base: every town, airport and station of the pack must be on land (or at most 1.5 km from it)
    const places = [...PUGLIA.towns, ...PUGLIA.airports, ...PUGLIA.stations];
    let moved = 0;
    let far = 0;
    for (const place of places) {
      const rounded = { lat: Math.round(place.lat * 100) / 100, lon: Math.round(place.lon * 100) / 100 };
      const s = snapToLand(rounded);
      const km = Math.hypot((s.lat - rounded.lat) * 111.19, (s.lon - rounded.lon) * 84.3);
      if (km > 0.01) moved++;
      if (km > far) far = km;
    }
    checks.push({ name: 'il dettaglio della Puglia combacia con la base: luoghi (arrotondati a 2 decimali) in mare', pass: moved <= 3, info: `${moved} su ${places.length} spostati a terra, al massimo di ${far.toFixed(2)} km` });
    setResult({ rows, checks });
  };
  return (
    <section aria-labelledby="maps-checks" className="grid gap-4">
      <h2 id="maps-checks" className="text-lg font-semibold">Dimensioni, tempi e controlli</h2>
      <button type="button" onClick={() => void run()} className="h-10 w-fit rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
        Misura e controlla
      </button>
      {result ? (
        <div className="grid gap-6">
          <table className="w-fit border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="pr-6">Mappa</th>
                <th className="pr-6">SVG</th>
                <th>Tempo</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="py-1 pr-6">{r.name}</td>
                  <td className="pr-6">{r.kb} kB</td>
                  <td>{r.ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-fit border-collapse text-sm">
            <tbody>
              {result.checks.map((c) => (
                <tr key={c.name} className="border-t">
                  <td className={`py-1 pr-3 font-bold ${c.pass ? 'text-green-700' : 'text-red-700'}`}>{c.pass ? 'OK' : 'NO'}</td>
                  <td className="pr-6">{c.name}</td>
                  <td className="text-muted-foreground">{c.info}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** The schematic maps of the public site (DB-19a), to look at them and to approve them by image: `/dev/maps?s=region|local|checks`. */
export default function MapsPage() {
  const [params, setParams] = useSearchParams();
  const section: Section = SECTIONS.find((s) => s.value === params.get('s'))?.value ?? 'region';
  return (
    <main className="mx-auto grid max-w-[1500px] gap-6 p-6">
      <header className="grid gap-3">
        <h1 className="text-2xl font-semibold">Mappe schematiche del sito</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Mappe disegnate da noi: nessuna tessera di terzi, nessuna posizione esatta. Pagina per chi sviluppa; non è nel build di produzione.
        </p>
        <Segmented label="Sezione" options={SECTIONS} value={section} onValueChange={(value) => setParams({ s: value })} />
      </header>
      {section === 'region' ? <RegionSection /> : section === 'local' ? <LocalSection /> : <ChecksSection />}
    </main>
  );
}
