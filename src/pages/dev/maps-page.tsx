/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Segmented } from '@/components/ui/segmented';
import { LOCAL_KINDS, localMapSvg, localPlace, resetMapIds, type LocalKind, type LocalSpec, type MapLabel } from '@/features/site-maps';
import { mountMapSvg } from '@/features/site-maps/mount-svg';

type Section = 'local' | 'checks';
const SECTIONS: { value: Section; label: string }[] = [
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

/** The SVG text of the engine as real nodes, filling a box with the aspect ratio of the map. */
function SvgBox({ svg, className = '' }: { svg: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (host.current) mountMapSvg(host.current, svg);
  }, [svg]);
  return <div ref={host} className={`absolute inset-0 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full ${className}`} />;
}

function HomePin() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" aria-hidden="true">
      <svg viewBox="0 0 26 34" width="26" height="34" className="drop-shadow">
        <path d="M13 1C6.4 1 1.5 6 1.5 12.4c0 8.4 11.5 20.6 11.5 20.6s11.5-12.2 11.5-20.6C24.5 6 19.6 1 13 1z" fill="#a3431f" stroke="#fff" strokeWidth="2" />
        <path d="M7.6 13 13 8l5.4 5v5.4H7.6z" fill="#fff" />
      </svg>
    </div>
  );
}

function PoiDot({ letter, x, y }: { letter: string; x: number; y: number }) {
  return (
    <div
      className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#27506b] text-[11px] font-bold leading-none text-white shadow"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

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

function ChecksSection() {
  const [result, setResult] = useState<{ rows: Measure[]; checks: Check[] } | null>(null);
  const run = () => {
    const rows: Measure[] = [];
    for (const kind of LOCAL_KINDS) {
      for (const seed of [1, 2, 3]) {
        const t0 = performance.now();
        const svg = localMapSvg({ kind, seed, width: 800 });
        rows.push({ name: `locale ${kind} · seme ${seed} · 800 px`, kb: (svg.length / 1024).toFixed(1), ms: Math.round(performance.now() - t0) });
      }
    }
    const checks: Check[] = [];
    const idless = (svg: string) => svg.replace(/sm[0-9]+/g, 'smX');
    checks.push({
      name: 'stessi input, stesso disegno (a meno del contatore degli id)',
      pass: LOCAL_KINDS.every((kind) => idless(localMapSvg({ kind, seed: 'x' })) === idless(localMapSvg({ kind, seed: 'x' }))),
      info: '',
    });
    resetMapIds();
    checks.push({ name: 'dopo resetMapIds il primo id è sm1', pass: localMapSvg({ kind: 'country', seed: 1 }).includes('id="sm1'), info: '' });
    let max = 0;
    for (const kind of LOCAL_KINDS) for (let seed = 1; seed <= 12; seed++) max = Math.max(max, localMapSvg({ kind, seed, width: 800 }).length);
    checks.push({ name: 'locali: massimo 25 kB (3 tipi × 12 semi)', pass: max < 25 * 1024, info: `massimo ${(max / 1024).toFixed(1)} kB` });
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
    setResult({ rows, checks });
  };
  return (
    <section aria-labelledby="maps-checks" className="grid gap-4">
      <h2 id="maps-checks" className="text-lg font-semibold">Dimensioni, tempi e controlli</h2>
      <button type="button" onClick={run} className="h-10 w-fit rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
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

/** The schematic maps of the public site (DB-19a), to look at them and to approve them by image: `/dev/maps?s=local|checks`. */
export default function MapsPage() {
  const [params, setParams] = useSearchParams();
  const section: Section = SECTIONS.find((s) => s.value === params.get('s'))?.value ?? 'local';
  return (
    <main className="mx-auto grid max-w-[1500px] gap-6 p-6">
      <header className="grid gap-3">
        <h1 className="text-2xl font-semibold">Mappe schematiche del sito</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Mappe disegnate da noi: nessuna tessera di terzi, nessuna posizione esatta. Pagina per chi sviluppa; non è nel build di produzione.
        </p>
        <Segmented label="Sezione" options={SECTIONS} value={section} onValueChange={(value) => setParams({ s: value })} />
      </header>
      {section === 'local' ? <LocalSection /> : <ChecksSection />}
    </main>
  );
}
