import { matchPath } from 'react-router-dom';

export const MANUAL_BASE = '/guida/';

export type ManualEntryType = 'pagina' | 'howto' | 'funzione' | 'faq' | 'flusso' | 'termine';

export interface ManualHit {
  id: string;
  type: ManualEntryType;
  title: string;
  chapter: string;
  href: string;
}

export interface ManualPageHints {
  chapter: ManualHit;
  tasks: ManualHit[];
}

interface RawEntry {
  t: ManualEntryType;
  pg?: string;
  titolo: string;
  sezione: string;
  ctx: string;
  url: string;
}

interface RawIndex {
  rotte?: Record<string, string[]>;
  voci: RawEntry[];
}

interface Engine {
  prepara(index: RawIndex): number;
  cerca(question: string, limit?: number): RawEntry[];
}

export interface ManualSource {
  engine: Engine;
  index: RawIndex;
}

declare global {
  interface Window {
    GUIDA_INDICE?: RawIndex;
    GuidaRicerca?: Engine;
  }
}

const MIN_QUESTION_CHARS = 2;

function hitOf(entry: RawEntry): ManualHit {
  return {
    id: entry.url,
    type: entry.t,
    title: entry.titolo,
    chapter: entry.t === 'pagina' ? entry.sezione : entry.ctx,
    href: `${MANUAL_BASE}${entry.url}`,
  };
}

const staticSegments = (pattern: string) => pattern.split('/').filter((segment) => segment !== '' && !segment.startsWith(':')).length;

function chaptersFor(routes: Record<string, string[]>, pathname: string): string[] {
  const patterns = Object.keys(routes);
  for (let path = pathname.replace(/\/+$/, ''); path.length > 1; path = path.slice(0, path.lastIndexOf('/'))) {
    const matching = patterns.filter((pattern) => matchPath({ path: pattern, end: true }, path));
    if (matching.length > 0) {
      const mostSpecific = matching.reduce((best, pattern) => (staticSegments(pattern) > staticSegments(best) ? pattern : best));
      return routes[mostSpecific] ?? [];
    }
  }
  return [];
}

export function createManual(load: () => Promise<ManualSource>) {
  let loading: Promise<ManualSource> | null = null;
  const source = () => {
    loading ??= load().catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  };

  return {
    async search(question: string, limit = 6): Promise<ManualHit[]> {
      const text = question.trim();
      if (text.length < MIN_QUESTION_CHARS) return [];
      const { engine } = await source();
      return engine.cerca(text, limit).map(hitOf);
    },

    async hintsFor(pathname: string, taskLimit = 4): Promise<ManualPageHints | null> {
      const { index } = await source();
      const chapterId = chaptersFor(index.rotte ?? {}, pathname)[0];
      const chapter = chapterId ? index.voci.find((entry) => entry.t === 'pagina' && entry.url === `${chapterId}.html`) : undefined;
      if (!chapterId || !chapter) return null;
      const tasks = index.voci.filter((entry) => entry.t === 'howto' && entry.pg === chapterId).slice(0, taskLimit);
      return { chapter: hitOf(chapter), tasks: tasks.map(hitOf) };
    },
  };
}

const SCRIPT_TIMEOUT_MS = 10_000;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error(`The manual could not be loaded from ${src}`));
    };
    const timer = window.setTimeout(fail, SCRIPT_TIMEOUT_MS);
    script.src = src;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = fail;
    document.head.append(script);
  });
}

async function loadFromManualPages(): Promise<ManualSource> {
  await injectScript(`${MANUAL_BASE}assets/guida-ricerca.js`);
  await injectScript(`${MANUAL_BASE}guida-indice.js`);
  const { GuidaRicerca: engine, GUIDA_INDICE: index } = window;
  if (!engine || !index) throw new Error('The manual did not register its search engine');
  engine.prepara(index);
  return { engine, index };
}

const manual = createManual(loadFromManualPages);

export const searchManual = manual.search;
export const manualHintsFor = manual.hintsFor;
