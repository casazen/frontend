/**
 * Manuale utente di CasaZen: genera le pagine HTML (public/guida) dai file Markdown di guida/contenuti.
 *
 * Uso (dalla radice del frontend):
 *   node scripts/build-guida.mjs                scrive public/guida/*.html e i file per il chatbot
 *   node scripts/build-guida.mjs --check        non scrive: esce con errore se i file generati non sono aggiornati
 *   node scripts/build-guida.mjs --notes f.md   scrive anche le «Note per la revisione» di tutte le pagine
 *
 * Nessuna dipendenza esterna. Il formato dei file sorgente e le regole editoriali sono in guida/README.md.
 * Le risorse statiche (assets/guida.css, assets/guida.js, assets/guida-ricerca.js, logo, font) stanno già in public/guida/assets e non sono generate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// GUIDA_SRC e GUIDA_OUT servono solo per le prove (anteprima di una cartella di contenuti diversa).
const SRC_DIR = process.env.GUIDA_SRC ? path.resolve(process.env.GUIDA_SRC) : path.join(ROOT, 'guida', 'contenuti');
const META_FILE = path.join(ROOT, 'guida', 'meta.json');
const ASSETS_DIR = path.join(ROOT, 'public', 'guida');
const OUT_DIR = process.env.GUIDA_OUT ? path.resolve(process.env.GUIDA_OUT) : ASSETS_DIR;
const MANIFEST_FILE = path.join(ROOT, 'src', 'config', 'route-manifest.ts');

/** `noindex` finché il manuale non viene pubblicato di proposito (decisione del prodotto). */
const ROBOTS = 'noindex, follow';
const BASE_URL_PATH = '/guida/';

/* ------------------------------------------------------------------------------------------------------------------
 * Tassonomia
 * ---------------------------------------------------------------------------------------------------------------- */

/** Sezioni del manuale, nell'ordine in cui appaiono nell'indice. */
export const SECTIONS = [
  { name: 'Per iniziare', icon: 'compass', accent: 'ink', blurb: 'Accesso, aree di lavoro, cruscotto e primi passi.' },
  { name: 'Affitti brevi', icon: 'sun', accent: 'terra', blurb: 'Immobili, prenotazioni, ospiti e messaggi.' },
  { name: 'Adempimenti', icon: 'shield', accent: 'terra', blurb: 'Alloggiati, CIN, imposta di soggiorno e documenti.' },
  { name: 'Incassi e fisco', icon: 'wallet', accent: 'terra', blurb: 'Pagamenti, documenti fiscali e report.' },
  { name: 'Affitti lunghi', icon: 'home', accent: 'savoia', blurb: 'Contratti, canoni, scadenze e inquilini.' },
  { name: 'Agenzie e proprietari', icon: 'users', accent: 'ametista', blurb: 'Rendiconti, fatture e portale dei proprietari.' },
  { name: 'Fornitori e marketplace', icon: 'wrench', accent: 'salvia', blurb: 'Richiedere servizi e lavorare come fornitore.' },
  { name: 'Sito e portali', icon: 'globe', accent: 'ink', blurb: 'Sito di prenotazione, portale ospite, area inquilino.' },
  { name: 'App mobile', icon: 'phone', accent: 'ink', blurb: 'CasaZen sul telefono.' },
  { name: 'Account e piano', icon: 'settings', accent: 'ametista', blurb: 'Persone, ruoli, piano e fatturazione.' },
];

export const PERSONAS = {
  gestore: { label: 'Gestore', hint: 'Gestisco uno o più immobili', desc: 'gestisci case e prenotazioni (anche se le case sono tue)' },
  amministratore: { label: 'Amministratore', hint: "Amministro l'organizzazione", desc: "sei il titolare o un amministratore dell'organizzazione: persone, piano e impostazioni" },
  proprietario: { label: 'Proprietario', hint: 'Ho un immobile gestito da un’agenzia', desc: 'la casa è tua ma la gestisce un’agenzia' },
  commercialista: { label: 'Commercialista', hint: 'Seguo la contabilità di un cliente', desc: 'segui la contabilità di un cliente' },
  fornitore: { label: 'Fornitore', hint: 'Offro servizi (pulizie, manutenzione…)', desc: 'offri servizi (pulizie, manutenzione…) ai gestori' },
  ospite: { label: 'Ospite', hint: 'Soggiorno in un alloggio', desc: 'prenoti o soggiorni in una casa' },
  inquilino: { label: 'Inquilino', hint: 'Ho un contratto di affitto', desc: 'hai un contratto di affitto (nel contratto si chiama «conduttore»)' },
};

const AVAILABILITY = {
  disponibile: { label: 'Disponibile', cls: 'ok' },
  'su attivazione': { label: 'Su attivazione', cls: 'req' },
  'in arrivo': { label: 'In arrivo', cls: 'soon' },
};

/** Titoli di sezione riconosciuti (confronto senza accenti, in minuscolo). */
const SECTION_KEYS = [
  ['in breve', 'breve'],
  ['funzionalita', 'funzionalita'],
  ['come funziona', 'funziona'],
  ['come fare', 'comefare'],
  ['flussi completi', 'flussi'],
  ['regole e limiti', 'regole'],
  ['domande frequenti', 'faq'],
  ['glossario', 'glossario'],
  ['vedi anche', 'vedi'],
  ['note per la revisione', 'note'],
];

/** Parole che non devono comparire nel testo pubblicato (regole del prodotto): errore. */
const FORBIDDEN = [
  [/concordato\s*facile/i, 'nome del fornitore del contratto guidato (mai nominarlo)'],
  [/quokka|kross|helix/i, 'nome di cliente pilota o strumento interno'],
  [/\b(?:SR|LR|PO|AM|SP|DB|UI|BK|MO|FT|NL|LT|E\d{2})-\d{1,3}[a-z]?\b/, 'codice di ticket interno'],
  [/\bPR\s*#?\d{3,4}\b|#\d{3,4}\b/, 'numero di pull request o issue'],
  [/\bsrc\/|\.tsx?\b|\.cs\b|\/api\/[a-z]/i, 'percorso di file o endpoint'],
];
/** Termini da rivedere ma non bloccanti. */
const WARN_TERMS = [
  [/\bpartner\b/i, '«partner»: va bene solo se è un termine della UI e non si riferisce al contratto guidato'],
  [/\bCF\b/, '«CF»: va bene solo come codice fiscale, mai come nome del fornitore del contratto guidato'],
];

/* ------------------------------------------------------------------------------------------------------------------
 * Utilità
 * ---------------------------------------------------------------------------------------------------------------- */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fold = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
export const slugify = (s) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sezione';
const sectionSlug = (name) => slugify(name);
const sectionOf = (name) => SECTIONS.find((s) => s.name === name);

function splitList(s) {
  return s
    .split(',')
    .map((x) => x.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function parseFrontMatter(text, file) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: front-matter mancante`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) val = splitList(val.slice(1, -1));
    else val = val.replace(/^["']|["']$/g, '');
    meta[key] = val;
  }
  return { meta, body: m[2] };
}

/* ------------------------------------------------------------------------------------------------------------------
 * Markdown (sottoinsieme) -> blocchi
 * ---------------------------------------------------------------------------------------------------------------- */

const LIST_ITEM = /^(\s*)(\d+[.)]|[-*•])\s+(.*)$/;

function dedent(lines) {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^(\s*)/)[1].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(Math.min(min, l.length)));
}

function parseTable(rows) {
  const cells = (r) =>
    r
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  const parsed = rows.map(cells);
  const hasSep = parsed[1] && parsed[1].every((c) => /^:?-{2,}:?$/.test(c));
  return { type: 'table', header: parsed[0], rows: parsed.slice(hasSep ? 2 : 1) };
}

function parseList(lines, start) {
  const first = lines[start].match(LIST_ITEM);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      if (j >= lines.length) break;
      const nm = lines[j].match(LIST_ITEM);
      const ind = lines[j].match(/^(\s*)/)[1].length;
      if ((nm && nm[1].length > baseIndent) || (!nm && ind > baseIndent)) {
        i = j;
        continue;
      }
      if (nm && nm[1].length === baseIndent && /\d/.test(nm[2]) === ordered) {
        i = j;
        continue;
      }
      break;
    }
    const m = line.match(LIST_ITEM);
    const indent = line.match(/^(\s*)/)[1].length;
    if (m && indent === baseIndent && /\d/.test(m[2]) === ordered) {
      items.push({ text: m[3].trim(), children: [] });
      i += 1;
      continue;
    }
    if (m && indent > baseIndent && items.length) {
      const sub = [];
      while (i < lines.length && (lines[i].trim() === '' || lines[i].match(/^(\s*)/)[1].length > baseIndent)) {
        sub.push(lines[i]);
        i += 1;
      }
      items[items.length - 1].children.push(...parseBlocks(dedent(sub).join('\n')));
      continue;
    }
    if (!m && indent > baseIndent && items.length) {
      items[items.length - 1].text += ` ${line.trim()}`;
      i += 1;
      continue;
    }
    break;
  }
  return { block: { type: 'list', ordered, items }, next: i };
}

export function parseBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const startsBlock = (l) =>
    /^#{1,4}\s/.test(l) || /^\s*>/.test(l) || /^\s*\|/.test(l) || LIST_ITEM.test(l) || /^---+\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      blocks.push({ type: 'h', level: m[1].length, text: m[2].trim() });
      i += 1;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', lines: q });
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      blocks.push(parseTable(rows));
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      p.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', text: p.join(' ') });
  }
  return blocks;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Struttura di una pagina
 * ---------------------------------------------------------------------------------------------------------------- */

function keyOfTitle(title) {
  const f = fold(title).replace(/\(.*\)/, '').trim();
  for (const [prefix, key] of SECTION_KEYS) if (f.startsWith(prefix)) return key;
  return 'altro';
}

function buildStructure(blocks) {
  const seen = new Map();
  const uniq = (text) => {
    const base = slugify(text);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  const sections = [];
  const pre = [];
  let cur = null;
  let sub = null;
  for (const b of blocks) {
    if (b.type === 'h' && b.level === 1) continue;
    if (b.type === 'h' && b.level === 2) {
      cur = { title: b.text, slug: uniq(b.text), key: keyOfTitle(b.text), blocks: [], subs: [] };
      sections.push(cur);
      sub = null;
      continue;
    }
    if (b.type === 'h' && b.level === 3 && cur) {
      sub = { title: b.text, slug: uniq(b.text), blocks: [] };
      cur.subs.push(sub);
      continue;
    }
    if (!cur) {
      pre.push(b);
      continue;
    }
    (sub ? sub.blocks : cur.blocks).push(b);
  }
  return { pre, sections };
}

/** Elementi di un elenco di glossario: «**Termine**: definizione». */
function glossaryItems(section) {
  const out = [];
  for (const b of section.blocks) {
    if (b.type !== 'list') continue;
    for (const it of b.items) {
      const m = it.text.match(/^\*\*(.+?)\*\*\s*[:：-]\s*(.*)$/);
      if (m) out.push({ term: m[1].trim(), def: m[2].trim() });
    }
  }
  return out;
}

/** Righe della tabella «Funzionalità». */
function featureRows(section, page) {
  const tbl = section.blocks.find((b) => b.type === 'table');
  if (!tbl) return [];
  const idx = {};
  tbl.header.forEach((h, i) => {
    idx[fold(h)] = i;
  });
  const col = (row, ...names) => {
    for (const n of names) if (idx[n] !== undefined) return row[idx[n]] || '';
    return '';
  };
  return tbl.rows.map((row) => {
    const avRaw = fold(col(row, 'disponibilita')).replace(/-/g, ' ').trim();
    const av = AVAILABILITY[avRaw] ? avRaw : page.meta.stato ? String(page.meta.stato).replace(/-/g, ' ') : 'disponibile';
    return {
      nome: col(row, 'funzionalita'),
      cosa: col(row, 'cosa fa'),
      dove: col(row, 'dove si trova'),
      chi: splitList(col(row, 'chi puo usarla').replace(/[;/]/g, ',')).map((c) => fold(c)),
      disponibilita: AVAILABILITY[av] ? av : 'disponibile',
      uso: col(row, 'come si usa'),
    };
  });
}

/* ------------------------------------------------------------------------------------------------------------------
 * Testo semplice (per ricerca e chatbot)
 * ---------------------------------------------------------------------------------------------------------------- */

function stripInline(text, titleOf) {
  return text
    .replace(/\[\[([a-z0-9-]+)(?:#([a-z0-9-]+))?(?:\|([^\]]+))?\]\]/g, (m, id, slug, label) => label || titleOf(id, slug))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1');
}

function blocksToText(blocks, titleOf, indent = '') {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'p') out.push(stripInline(b.text, titleOf));
    else if (b.type === 'h') out.push(stripInline(b.text, titleOf));
    else if (b.type === 'quote') out.push(stripInline(b.lines.join(' '), titleOf).replace(/\s+/g, ' '));
    else if (b.type === 'list') {
      b.items.forEach((it, n) => {
        out.push(`${indent}${b.ordered ? `${n + 1}.` : '-'} ${stripInline(it.text, titleOf)}`);
        if (it.children.length) out.push(blocksToText(it.children, titleOf, `${indent}   `));
      });
    } else if (b.type === 'table') {
      for (const r of b.rows) {
        out.push(b.header.map((h, i) => `${h}: ${stripInline(r[i] || '', titleOf)}`).join('; '));
      }
    }
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------------------------------------------------------
 * Icone
 * ---------------------------------------------------------------------------------------------------------------- */

const ICONS = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  wallet: '<path d="M4 7a2 2 0 012-2h11v4"/><rect x="4" y="7" width="16" height="12" rx="2"/><circle cx="16" cy="13" r="1.2"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14.5c2.4.2 4 2.2 4 5"/>',
  wrench: '<path d="M21 7.5a5 5 0 01-6.6 4.7L7 19.6a2 2 0 11-2.6-2.6l7.4-7.4A5 5 0 0116.5 3l-3 3 .9 3.1 3.1.9z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  book: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  flow: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5c4 0 6 1.5 8 3.5M8 16.5c4 0 6-1.5 8-3.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  glossary: '<path d="M5 5h14v14H5z"/><path d="M9 9h6M9 13h6"/>',
};
const icon = (name, cls = 'gd-i') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

/* ------------------------------------------------------------------------------------------------------------------
 * Caricamento dei contenuti
 * ---------------------------------------------------------------------------------------------------------------- */

function loadPages(errors) {
  if (!fs.existsSync(SRC_DIR)) throw new Error(`Cartella dei contenuti assente: ${SRC_DIR}`);
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md')
    .sort();
  const pages = [];
  for (const file of files) {
    try {
      const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'), file);
      const idFromFile = file.replace(/^\d+-/, '').replace(/\.md$/, '');
      if (!meta.id) errors.push(`${file}: manca «id» nel front-matter`);
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.id)) errors.push(`${file}: «id» (${meta.id}) deve essere in minuscolo con i trattini`);
      for (const k of ['titolo', 'sezione', 'riassunto']) if (!meta[k]) errors.push(`${file}: manca «${k}»`);
      if (meta.sezione && !sectionOf(meta.sezione)) errors.push(`${file}: sezione sconosciuta «${meta.sezione}»`);
      const chi = Array.isArray(meta.chi) ? meta.chi : meta.chi ? splitList(meta.chi) : [];
      for (const c of chi) if (!PERSONAS[c]) errors.push(`${file}: «chi» sconosciuto «${c}»`);
      const blocks = parseBlocks(body);
      const struct = buildStructure(blocks);
      pages.push({
        file,
        id: meta.id || idFromFile,
        meta: { ...meta, chi },
        order: Number(meta.ordine) || Number((file.match(/^(\d+)-/) || [])[1]) || 999,
        struct,
        body,
      });
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }
  const ids = new Set();
  for (const p of pages) {
    if (ids.has(p.id)) errors.push(`${p.file}: id duplicato «${p.id}»`);
    ids.add(p.id);
  }
  pages.sort((a, b) => {
    const sa = SECTIONS.findIndex((s) => s.name === a.meta.sezione);
    const sb = SECTIONS.findIndex((s) => s.name === b.meta.sezione);
    return sa - sb || a.order - b.order || a.id.localeCompare(b.id);
  });
  return pages;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Rendering HTML
 * ---------------------------------------------------------------------------------------------------------------- */

function makeContext(pages, errors, warnings) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const slugsOf = (p) => {
    const s = new Set();
    for (const sec of p.struct.sections) {
      s.add(sec.slug);
      for (const sub of sec.subs) s.add(sub.slug);
    }
    return s;
  };
  const slugCache = new Map(pages.map((p) => [p.id, slugsOf(p)]));
  const titleOf = (id, slug) => {
    const p = byId.get(id);
    if (!p) return id;
    if (slug) {
      for (const sec of p.struct.sections) for (const sub of sec.subs) if (sub.slug === slug) return sub.title.replace(/^Flusso:\s*/i, '');
    }
    return p.meta.titolo;
  };
  const ctx = {
    byId,
    titleOf,
    where: '',
    link(id, slug, label) {
      const p = byId.get(id);
      if (!p) {
        errors.push(`${ctx.where}: rimando a pagina inesistente [[${id}]]`);
        return esc(label || id);
      }
      if (slug && !slugCache.get(id).has(slug)) {
        errors.push(`${ctx.where}: rimando a paragrafo inesistente [[${id}#${slug}]]`);
        slug = '';
      }
      return `<a href="${id}.html${slug ? `#${slug}` : ''}">${label ? label : esc(titleOf(id, slug))}</a>`;
    },
    warn: (m) => warnings.push(`${ctx.where}: ${m}`),
  };
  return ctx;
}

function inline(text, ctx) {
  return text
    .split(/(`[^`]+`)/g)
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${esc(part.slice(1, -1))}</code>`;
      let h = esc(part);
      h = h.replace(/\[\[([a-z0-9-]+)(?:#([a-z0-9-]+))?(?:\|([^\]]+))?\]\]/g, (m, id, slug, label) => ctx.link(id, slug, label));
      h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
      return h;
    })
    .join('');
}

const CALLOUT = {
  nota: { cls: 'note', icon: 'info', label: 'Nota' },
  attenzione: { cls: 'warn', icon: 'alert', label: 'Attenzione' },
  importante: { cls: 'warn', icon: 'alert', label: 'Importante' },
  suggerimento: { cls: 'tip', icon: 'bulb', label: 'Suggerimento' },
};

function renderBlocks(blocks, ctx, opts = {}) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'p':
          return `<p>${inline(b.text, ctx)}</p>`;
        case 'h':
          return `<h${b.level + 1} class="gd-sub">${inline(b.text, ctx)}</h${b.level + 1}>`;
        case 'hr':
          return '<hr>';
        case 'quote': {
          const text = b.lines.join(' ').trim();
          const m = text.match(/^\*\*(Nota|Attenzione|Importante|Suggerimento)\s*:?\*\*\s*:?\s*(.*)$/i);
          const kind = CALLOUT[m ? fold(m[1]) : 'nota'];
          const body = m ? m[2] : text;
          return `<aside class="gd-callout gd-callout--${kind.cls}">${icon(kind.icon, 'gd-i gd-callout__i')}<div><strong>${kind.label}</strong><p>${inline(body, ctx)}</p></div></aside>`;
        }
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          const cls = b.ordered && opts.steps ? ' class="gd-steps"' : '';
          const items = b.items
            .map((it) => `<li>${inline(it.text, ctx)}${it.children.length ? renderBlocks(it.children, ctx, opts) : ''}</li>`)
            .join('');
          return `<${tag}${cls}>${items}</${tag}>`;
        }
        case 'table': {
          const head = b.header.map((h) => `<th scope="col">${inline(h, ctx)}</th>`).join('');
          const rows = b.rows
            .map((r) => `<tr>${b.header.map((_, i) => `<td data-label="${esc(b.header[i])}">${inline(r[i] || '', ctx)}</td>`).join('')}</tr>`)
            .join('');
          return `<div class="gd-tablewrap"><table class="gd-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
        }
        default:
          return '';
      }
    })
    .join('\n');
}

function chipsChi(chi) {
  return chi.map((c) => `<span class="gd-chip">${esc(PERSONAS[c]?.label || c)}</span>`).join('');
}

function badge(av) {
  const a = AVAILABILITY[av] || AVAILABILITY.disponibile;
  return `<span class="gd-badge gd-badge--${a.cls}">${a.label}</span>`;
}

/** Rimando alla pagina «Inizia qui» (solo se esiste: il generatore non deve mai collegare una pagina assente). */
const START_ID = 'inizia-qui';
function startLink(pages, label) {
  return pages.some((p) => p.id === START_ID) ? `<a href="${START_ID}.html">${label}</a>` : label;
}

/** Legenda dei tre stati di disponibilità, con il rimando a come si accende una funzione «su attivazione». */
function availabilityLegend(ctx) {
  const how = ctx.link('per-iniziare', 'cosa-significa-su-attivazione', 'come si attiva');
  return `<p class="gd-legend"><span class="gd-legend__i">${badge('disponibile')} lo usi subito, se hai il ruolo e i permessi giusti</span><span class="gd-legend__i">${badge('su attivazione')} non è accesa di partenza (${how})</span><span class="gd-legend__i">${badge('in arrivo')} non c'è ancora</span></p>`;
}

/** «Chi è chi»: le persone dei filtri spiegate in una riga, per chi non conosce i nomi dell'app. */
function personasLegend(pages) {
  const items = Object.entries(PERSONAS)
    .filter(([k]) => pages.some((p) => p.meta.chi.includes(k)))
    .map(([, v]) => `<li><strong>${esc(v.label)}</strong>: ${esc(v.desc)}</li>`)
    .join('');
  return `<details class="gd-persone"><summary>Chi è chi? Cosa vuol dire Gestore, Amministratore, Proprietario…</summary><ul>${items}</ul></details>`;
}

function renderFeatureTable(rows, page, ctx) {
  const howtoSlugs = new Map();
  for (const sec of page.struct.sections) if (sec.key === 'comefare') for (const sub of sec.subs) howtoSlugs.set(slugify(sub.title), sub.slug);
  const body = rows
    .map((r) => {
      let uso = inline(r.uso, ctx);
      if (r.uso && !/\[\[|<a /.test(uso)) {
        const target = howtoSlugs.get(slugify(r.uso.replace(/\*+/g, '')));
        if (target) uso = `<a href="#${target}">${esc(r.uso.replace(/\*+/g, ''))}</a>`;
      }
      const dove = r.dove ? `<span class="gd-fn__where">${icon('chevron', 'gd-i gd-i--xs')}${inline(r.dove, ctx)}</span>` : '';
      const chi = r.chi.length ? `<span class="gd-fn__who">${r.chi.map((c) => `<span class="gd-chip">${esc(PERSONAS[c]?.label || c)}</span>`).join(' ')}</span>` : '';
      return `<tr data-chi="${esc(r.chi.join(' '))}" data-av="${esc(r.disponibilita.replace(/ /g, '-'))}"><th scope="row" data-label="Funzionalità"><span class="gd-fn__name">${inline(r.nome, ctx)}</span>${dove}${chi}</th><td data-label="Cosa fa">${inline(r.cosa, ctx)}</td><td data-label="Disponibilità">${badge(r.disponibilita)}</td><td data-label="Come si usa">${uso}</td></tr>`;
    })
    .join('');
  return `<div class="gd-tablewrap"><table class="gd-table gd-table--features"><thead><tr><th scope="col">Funzionalità, dove e per chi</th><th scope="col">Cosa fa</th><th scope="col">Disponibilità</th><th scope="col">Come si usa</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderSection(sec, page, ctx) {
  const id = ` id="${sec.slug}"`;
  const heading = (txt) => `<h2${id} class="gd-h2"><a class="gd-anchor" href="#${sec.slug}" aria-label="Link a questa sezione">${icon('hash', 'gd-i gd-i--sm')}</a>${inline(txt, ctx)}</h2>`;
  switch (sec.key) {
    case 'note':
      return '';
    case 'breve':
      return `<section class="gd-lead"${id}><h2 class="gd-visually-hidden">${inline(sec.title, ctx)}</h2>${renderBlocks(sec.blocks, ctx)}</section>`;
    case 'funzionalita': {
      const rows = featureRows(sec, page);
      const legend = rows.some((r) => r.disponibilita !== 'disponibile') ? availabilityLegend(ctx) : '';
      return `<section class="gd-sec"${id}>${heading(sec.title)}${renderBlocks(sec.blocks.filter((b) => b.type !== 'table'), ctx)}${legend}${rows.length ? renderFeatureTable(rows, page, ctx) : ''}</section>`;
    }
    case 'comefare': {
      const subs = sec.subs
        .map(
          (s) =>
            `<article class="gd-howto" id="${s.slug}" data-howto><h3 class="gd-h3"><a class="gd-anchor" href="#${s.slug}" aria-label="Link a questa guida">${icon('hash', 'gd-i gd-i--sm')}</a>${inline(s.title, ctx)}</h3>${renderBlocks(s.blocks, ctx, { steps: true })}</article>`,
        )
        .join('\n');
      return `<section class="gd-sec"${id}>${heading(sec.title)}${renderBlocks(sec.blocks, ctx)}${subs}</section>`;
    }
    case 'flussi': {
      const subs = sec.subs
        .map(
          (s) =>
            `<article class="gd-flow" id="${s.slug}"><h3 class="gd-h3">${icon('flow', 'gd-i gd-i--sm')} ${inline(s.title.replace(/^Flusso:\s*/i, ''), ctx)}</h3>${renderBlocks(s.blocks, ctx, { steps: true })}</article>`,
        )
        .join('\n');
      return `<section class="gd-sec"${id}>${heading(sec.title)}${renderBlocks(sec.blocks, ctx)}${subs}</section>`;
    }
    case 'faq': {
      const subs = sec.subs
        .map((s) => `<details class="gd-faq" id="${s.slug}"><summary>${inline(s.title, ctx)}</summary><div class="gd-faq__a">${renderBlocks(s.blocks, ctx)}</div></details>`)
        .join('\n');
      return `<section class="gd-sec"${id}>${heading(sec.title)}${renderBlocks(sec.blocks, ctx)}${subs}</section>`;
    }
    case 'glossario': {
      const items = glossaryItems(sec);
      const dl = items.map((g) => `<dt>${inline(g.term, ctx)}</dt><dd>${inline(g.def, ctx)}</dd>`).join('');
      return `<section class="gd-sec"${id}>${heading(sec.title)}<dl class="gd-gloss">${dl}</dl></section>`;
    }
    case 'vedi': {
      const links = [];
      for (const b of sec.blocks) if (b.type === 'list') for (const it of b.items) links.push(it.text);
      const cards = links
        .map((t) => {
          const m = t.match(/^\[\[([a-z0-9-]+)(?:#([a-z0-9-]+))?(?:\|([^\]]+))?\]\]\s*[:：—–-]?\s*(.*)$/);
          if (!m) return `<li class="gd-see__item">${inline(t, ctx)}</li>`;
          const [, pid, slug, label, why] = m;
          const target = ctx.byId.get(pid);
          if (!target) {
            ctx.link(pid, slug, label);
            return '';
          }
          const href = `${pid}.html${slug ? `#${slug}` : ''}`;
          return `<li class="gd-see__item"><a class="gd-see__link" href="${href}"><span class="gd-see__t">${esc(label || ctx.titleOf(pid, slug))}</span>${why ? `<span class="gd-see__d">${inline(why, ctx)}</span>` : ''}</a></li>`;
        })
        .join('');
      return `<section class="gd-sec"${id}>${heading(sec.title)}<ul class="gd-see">${cards}</ul></section>`;
    }
    default:
      return `<section class="gd-sec"${id}>${heading(sec.title)}${renderBlocks(sec.blocks, ctx)}${sec.subs.map((s) => `<h3 class="gd-h3" id="${s.slug}">${inline(s.title, ctx)}</h3>${renderBlocks(s.blocks, ctx)}`).join('\n')}</section>`;
  }
}

/* ------------------------------------------------------------------------------------------------------------------
 * Struttura comune delle pagine
 * ---------------------------------------------------------------------------------------------------------------- */

function renderNav(pages, current) {
  const aggregates = [
    ['funzionalita.html', 'Elenco funzionalità', 'list'],
    ['come-fare.html', 'Come fare: tutti i compiti', 'book'],
    ['flussi.html', 'Percorsi completi', 'flow'],
    ['domande-frequenti.html', 'Domande frequenti', 'help'],
    ['glossario.html', 'Glossario', 'glossary'],
  ];
  const agg = aggregates
    .map(([href, label, ic]) => `<li><a class="gd-nav__link${current === href ? ' is-current' : ''}" href="${href}"${current === href ? ' aria-current="page"' : ''}>${icon(ic, 'gd-i gd-i--sm')}<span>${esc(label)}</span></a></li>`)
    .join('');
  const secs = SECTIONS.map((s) => {
    const list = pages.filter((p) => p.meta.sezione === s.name);
    if (!list.length) return '';
    const open = list.some((p) => `${p.id}.html` === current);
    const items = list
      .map((p) => `<li><a class="gd-nav__link${current === `${p.id}.html` ? ' is-current' : ''}" href="${p.id}.html"${current === `${p.id}.html` ? ' aria-current="page"' : ''}><span>${esc(p.meta.menu || p.meta.titolo)}</span></a></li>`)
      .join('');
    return `<details class="gd-nav__sec gd-accent--${s.accent}"${open ? ' open' : ''}><summary>${icon(s.icon, 'gd-i gd-i--sm')}<span>${esc(s.name)}</span>${icon('chevron', 'gd-i gd-i--sm gd-nav__chev')}</summary><ul>${items}</ul></details>`;
  }).join('');
  return `<nav class="gd-nav" id="gd-nav" aria-label="Indice della guida"><a class="gd-nav__home${current === 'index.html' ? ' is-current' : ''}" href="index.html">${icon('book', 'gd-i gd-i--sm')}<span>Tutta la guida</span></a><div class="gd-nav__group"><p class="gd-nav__label">Per cercare</p><ul>${agg}</ul></div><div class="gd-nav__group"><p class="gd-nav__label">Per argomento</p>${secs}</div></nav>`;
}

function layout({ title, description, current, pages, main, toc = '', bodyClass = '', meta }) {
  const fullTitle = title === 'Guida CasaZen' ? title : `${title} · Guida CasaZen`;
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${ROBOTS}">
<meta name="theme-color" content="#1f3a3d">
<link rel="icon" type="image/svg+xml" href="assets/marchio.svg">
<link rel="stylesheet" href="assets/guida.css">
<script src="assets/guida-ricerca.js" defer></script>
<script src="assets/guida.js" defer></script>
</head>
<body class="${bodyClass}" data-page="${esc(current)}">
<a class="gd-skip" href="#contenuto">Vai al contenuto</a>
<header class="gd-top">
  <button class="gd-iconbtn gd-menubtn" type="button" aria-controls="gd-nav" aria-expanded="false" aria-label="Apri l'indice">${icon('menu')}</button>
  <a class="gd-brand" href="index.html" aria-label="Guida CasaZen, home"><img src="assets/marchio.svg" width="30" height="30" alt=""><span class="gd-brand__word">casazen</span><span class="gd-brand__tag">Guida</span></a>
  <form class="gd-search" role="search" action="cerca.html" method="get" autocomplete="off">
    ${icon('search', 'gd-i gd-search__i')}
    <input type="search" name="q" placeholder="Cosa vuoi fare? Cerca nella guida" aria-label="Cerca nella guida" data-search-input>
    <div class="gd-suggest" data-suggest hidden></div>
  </form>
  <a class="gd-btn gd-btn--ghost gd-top__app" href="/app">Torna a CasaZen</a>
</header>
<div class="gd-shell">
${renderNav(pages, current)}
<div class="gd-scrim" data-scrim hidden></div>
<main id="contenuto" class="gd-main" tabindex="-1">
${main}
</main>
${toc ? `<aside class="gd-toc" aria-label="In questa pagina">${toc}</aside>` : ''}
</div>
<footer class="gd-foot">
  <p>Guida di CasaZen · aggiornata il ${esc(meta.aggiornatoLungo)}. Le funzioni visibili nell'app dipendono dall'area, dal ruolo, dal piano e dalle attivazioni del tuo account.</p>
  <p>Non trovi la risposta? Parti da ${startLink(pages, 'Inizia qui')} oppure apri la <strong>Guida</strong> nell'app: se la tua installazione ha un indirizzo di assistenza, lì trovi «Scrivi all'assistenza».</p>
</footer>
</body>
</html>
`;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function renderTocFor(page) {
  const items = [];
  for (const sec of page.struct.sections) {
    if (sec.key === 'note' || sec.key === 'breve') continue;
    const sub =
      (sec.key === 'comefare' || sec.key === 'flussi') && sec.subs.length
        ? `<ul>${sec.subs.map((s) => `<li><a href="#${s.slug}">${esc(s.title.replace(/^Flusso:\s*/i, ''))}</a></li>`).join('')}</ul>`
        : '';
    items.push(`<li><a href="#${sec.slug}">${esc(sec.title)}</a>${sub}</li>`);
  }
  return `<p class="gd-toc__label">In questa pagina</p><ul>${items.join('')}</ul>`;
}

function renderPage(page, ctx, pages, meta) {
  ctx.where = page.file;
  const s = sectionOf(page.meta.sezione);
  const sec = page.struct.sections.filter((x) => x.key !== 'note');
  const main = `
<nav class="gd-crumbs" aria-label="Percorso"><a href="index.html">Guida</a><span aria-hidden="true">›</span><a href="index.html#${sectionSlug(page.meta.sezione)}">${esc(page.meta.sezione)}</a></nav>
<article class="gd-article gd-accent--${s ? s.accent : 'ink'}">
<header class="gd-article__head">
  <p class="gd-kicker">${icon(s ? s.icon : 'book', 'gd-i gd-i--sm')} ${esc(page.meta.sezione)}</p>
  <h1>${esc(page.meta.titolo)}</h1>
  <p class="gd-summary">${inline(page.meta.riassunto, ctx)}</p>
  <dl class="gd-meta">
    ${page.meta.dove ? `<div><dt>Dove si trova</dt><dd>${inline(page.meta.dove, ctx)}</dd></div>` : ''}
    ${page.meta.chi.length ? `<div><dt>Per chi</dt><dd>${chipsChi(page.meta.chi)}</dd></div>` : ''}
    ${page.meta.stato && page.meta.stato !== 'disponibile' ? `<div><dt>Disponibilità</dt><dd>${badge(String(page.meta.stato).replace(/-/g, ' '))}</dd></div>` : ''}
  </dl>
</header>
${renderBlocks(page.struct.pre, ctx)}
${sec.map((x) => renderSection(x, page, ctx)).join('\n')}
</article>
${prevNext(page, pages)}`;
  return layout({
    title: page.meta.titolo,
    description: page.meta.riassunto,
    current: `${page.id}.html`,
    pages,
    main,
    toc: renderTocFor(page),
    bodyClass: 'gd-page',
    meta,
  });
}

function prevNext(page, pages) {
  const i = pages.findIndex((p) => p.id === page.id);
  const prev = pages[i - 1];
  const next = pages[i + 1];
  const card = (p, dir) =>
    p
      ? `<a class="gd-pn gd-pn--${dir}" href="${p.id}.html"><span class="gd-pn__l">${dir === 'prev' ? 'Pagina precedente' : 'Pagina successiva'}</span><span class="gd-pn__t">${esc(p.meta.titolo)}</span></a>`
      : '<span></span>';
  return `<nav class="gd-pnav" aria-label="Pagine vicine">${card(prev, 'prev')}${card(next, 'next')}</nav>`;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Pagine aggregate
 * ---------------------------------------------------------------------------------------------------------------- */

/** «Per chi: ospite, inquilino.» dentro un compito: sostituisce le persone della pagina nei filtri («Chi sei»). */
function taskChi(blocks, fallback) {
  for (const b of blocks) {
    if (b.type !== 'p') continue;
    const m = b.text.match(/^(?:\*\*)?Per chi:?(?:\*\*)?:?\s*(.+?)\.?$/i);
    if (!m) continue;
    const found = Object.keys(PERSONAS).filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(m[1]));
    if (found.length) return found;
  }
  return fallback;
}

function collect(pages, ctx) {
  const features = [];
  const howtos = [];
  const flows = [];
  const faqs = [];
  const terms = [];
  const chunks = [];
  const titleOf = ctx.titleOf;
  for (const page of pages) {
    ctx.where = page.file;
    const base = { pagina: page.id, titolo_pagina: page.meta.titolo, sezione: page.meta.sezione, chi: page.meta.chi, dove: page.meta.dove || '' };
    const ctxText = (extra) =>
      `${page.meta.titolo} (${page.meta.sezione}${page.meta.dove ? `; si trova in: ${page.meta.dove}` : ''}${page.meta.chi.length ? `; per: ${page.meta.chi.map((c) => PERSONAS[c].label).join(', ')}` : ''})${extra ? ` — ${extra}` : ''}`;
    // Riassunto della pagina
    chunks.push({
      id: page.id,
      tipo: 'pagina',
      ...base,
      titolo: page.meta.titolo,
      url: `${page.id}.html`,
      stato: page.meta.stato || 'disponibile',
      testo: `${ctxText('')}\n\n${stripInline(page.meta.riassunto, titleOf)}\n\n${blocksToText(page.struct.pre, titleOf)}`.trim(),
    });
    for (const sec of page.struct.sections) {
      if (sec.key === 'note') continue;
      const keyType = { breve: 'concetto', funziona: 'concetto', regole: 'regole', altro: 'concetto' }[sec.key];
      if (sec.key === 'funzionalita') {
        const rows = featureRows(sec, page);
        for (const r of rows) {
          const item = { ...base, ...r, uso: stripInline(r.uso, titleOf), nome: stripInline(r.nome, titleOf), cosa: stripInline(r.cosa, titleOf), dove_funzione: stripInline(r.dove, titleOf), chi: r.chi };
          features.push(item);
        }
        chunks.push({
          id: `${page.id}#${sec.slug}`,
          tipo: 'funzionalita',
          ...base,
          titolo: `Funzionalità: ${page.meta.titolo}`,
          url: `${page.id}.html#${sec.slug}`,
          stato: page.meta.stato || 'disponibile',
          testo: `${ctxText('elenco delle funzionalità')}\n\n${rows.map((r) => `- ${stripInline(r.nome, titleOf)}: ${stripInline(r.cosa, titleOf)} (dove: ${stripInline(r.dove, titleOf)}; disponibilità: ${AVAILABILITY[r.disponibilita].label})`).join('\n')}`,
        });
      } else if (sec.key === 'comefare') {
        for (const s of sec.subs) {
          const text = blocksToText(s.blocks, titleOf);
          const chi = taskChi(s.blocks, page.meta.chi);
          howtos.push({ ...base, chi, id: `${page.id}#${s.slug}`, titolo: s.title, slug: s.slug, testo: text });
          chunks.push({ id: `${page.id}#${s.slug}`, tipo: 'howto', ...base, chi, titolo: s.title, url: `${page.id}.html#${s.slug}`, stato: page.meta.stato || 'disponibile', testo: `${ctxText(`come fare: ${stripInline(s.title, titleOf)}`)}\n\n${text}` });
        }
      } else if (sec.key === 'flussi') {
        for (const s of sec.subs) {
          const text = blocksToText(s.blocks, titleOf);
          flows.push({ ...base, id: `${page.id}#${s.slug}`, titolo: s.title.replace(/^Flusso:\s*/i, ''), slug: s.slug, blocks: s.blocks, testo: text });
          chunks.push({ id: `${page.id}#${s.slug}`, tipo: 'flusso', ...base, titolo: s.title.replace(/^Flusso:\s*/i, ''), url: `${page.id}.html#${s.slug}`, stato: page.meta.stato || 'disponibile', testo: `${ctxText(`flusso: ${s.title.replace(/^Flusso:\s*/i, '')}`)}\n\n${text}` });
        }
      } else if (sec.key === 'faq') {
        for (const s of sec.subs) {
          const text = blocksToText(s.blocks, titleOf);
          faqs.push({ ...base, id: `${page.id}#${s.slug}`, domanda: s.title, slug: s.slug, blocks: s.blocks, testo: text });
          chunks.push({ id: `${page.id}#${s.slug}`, tipo: 'faq', ...base, titolo: s.title, url: `${page.id}.html#${s.slug}`, stato: page.meta.stato || 'disponibile', testo: `${ctxText('domanda frequente')}\n\nDomanda: ${stripInline(s.title, titleOf)}\nRisposta: ${text}` });
        }
      } else if (sec.key === 'glossario') {
        for (const g of glossaryItems(sec)) terms.push({ ...base, termine: g.term, definizione: g.def });
      } else if (keyType) {
        const text = [blocksToText(sec.blocks, titleOf), ...sec.subs.map((s) => `${s.title}\n${blocksToText(s.blocks, titleOf)}`)].filter(Boolean).join('\n\n');
        if (text.trim()) chunks.push({ id: `${page.id}#${sec.slug}`, tipo: keyType, ...base, titolo: `${sec.title}: ${page.meta.titolo}`, url: `${page.id}.html#${sec.slug}`, stato: page.meta.stato || 'disponibile', testo: `${ctxText(sec.title.toLowerCase())}\n\n${text}` });
      }
    }
  }
  return { features, howtos, flows, faqs, terms, chunks };
}

function sectionTabs(items, kindAttr) {
  const used = SECTIONS.filter((s) => items.some((x) => x.sezione === s.name));
  const personas = Object.keys(PERSONAS).filter((p) => items.some((x) => (x.chi || []).includes(p)));
  return `<div class="gd-filters" role="group" aria-label="Filtri">
  <div class="gd-filter"><span class="gd-filter__l">Per chi</span><button type="button" class="gd-pill is-on" data-filter-chi="">Tutti</button>${personas.map((p) => `<button type="button" class="gd-pill" data-filter-chi="${p}">${esc(PERSONAS[p].label)}</button>`).join('')}</div>
  <div class="gd-filter"><span class="gd-filter__l">Sezione</span><button type="button" class="gd-pill is-on" data-filter-sec="">Tutte</button>${used.map((s) => `<button type="button" class="gd-pill" data-filter-sec="${sectionSlug(s.name)}">${esc(s.name)}</button>`).join('')}</div>
  <label class="gd-filter gd-filter--text"><span class="gd-filter__l">Cerca nell'elenco</span><input type="search" data-filter-text placeholder="Scrivi una parola…" aria-label="Filtra l'elenco"></label>
  <p class="gd-filter__count" data-filter-count aria-live="polite"></p>
</div>`;
}

function renderFeaturesPage(pages, ctx, data, meta) {
  const rows = data.features
    .map((f) => {
      const page = ctx.byId.get(f.pagina);
      let link = `${f.pagina}.html`;
      const how = page.struct.sections.find((s) => s.key === 'comefare');
      const target = how && how.subs.find((s) => slugify(s.title) === slugify(f.uso.replace(/\*+/g, '')));
      if (target) link += `#${target.slug}`;
      else {
        const fs_ = page.struct.sections.find((s) => s.key === 'funzionalita');
        if (fs_) link += `#${fs_.slug}`;
      }
      return `<tr data-chi="${esc(f.chi.join(' '))}" data-sec="${sectionSlug(f.sezione)}" data-av="${esc(f.disponibilita.replace(/ /g, '-'))}" data-filterable><th scope="row" data-label="Funzionalità"><a href="${link}">${esc(f.nome)}</a></th><td data-label="Cosa fa">${esc(f.cosa)}</td><td data-label="Dove si trova">${esc(f.dove_funzione)}</td><td data-label="Chi può usarla">${f.chi.map((c) => `<span class="gd-chip">${esc(PERSONAS[c]?.label || c)}</span>`).join(' ')}</td><td data-label="Disponibilità">${badge(f.disponibilita)}</td><td data-label="Sezione"><a href="${f.pagina}.html">${esc(f.sezione)}</a></td></tr>`;
    })
    .join('');
  ctx.where = 'Elenco delle funzionalità';
  const main = `
<article class="gd-article gd-accent--ink">
<header class="gd-article__head"><p class="gd-kicker">${icon('list', 'gd-i gd-i--sm')} Per cercare</p><h1>Elenco delle funzionalità</h1><p class="gd-summary">Tutto ciò che CasaZen sa fare, con dove trovarlo e chi può usarlo. Seleziona una funzionalità per aprire la guida passo passo.</p></header>
${availabilityLegend(ctx)}
${personasLegend(pages)}
${sectionTabs(data.features, 'features')}
<div class="gd-tablewrap"><table class="gd-table gd-table--features"><thead><tr><th scope="col">Funzionalità</th><th scope="col">Cosa fa</th><th scope="col">Dove si trova</th><th scope="col">Chi può usarla</th><th scope="col">Disponibilità</th><th scope="col">Sezione</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="gd-empty" data-empty hidden>Nessuna funzionalità corrisponde ai filtri.</p>
</article>`;
  return layout({ title: 'Elenco delle funzionalità', description: 'Tutte le funzionalità di CasaZen, dove si trovano e chi può usarle.', current: 'funzionalita.html', pages, main, bodyClass: 'gd-page gd-page--list', meta });
}

function renderHowtoPage(pages, ctx, data, meta) {
  const bySection = SECTIONS.map((s) => ({ s, list: data.howtos.filter((h) => h.sezione === s.name) })).filter((x) => x.list.length);
  const groups = bySection
    .map(
      ({ s, list }) => `<section class="gd-sec" id="${sectionSlug(s.name)}" data-group="${sectionSlug(s.name)}"><h2 class="gd-h2">${icon(s.icon, 'gd-i gd-i--sm')} ${esc(s.name)}</h2><ul class="gd-cards gd-cards--tasks">${list
        .map((h) => `<li data-filterable data-chi="${esc(h.chi.join(' '))}" data-sec="${sectionSlug(s.name)}"><a class="gd-card gd-card--task" href="${h.pagina}.html#${h.slug}"><span class="gd-card__t">${esc(h.titolo)}</span><span class="gd-card__d">${esc(h.titolo_pagina)}</span></a></li>`)
        .join('')}</ul></section>`,
    )
    .join('\n');
  const main = `
<article class="gd-article gd-accent--ink">
<header class="gd-article__head"><p class="gd-kicker">${icon('book', 'gd-i gd-i--sm')} Per cercare</p><h1>Come fare: tutti i compiti</h1><p class="gd-summary">Ogni compito ha la sua guida passo passo. Scegli quello che ti serve.</p><p class="gd-summary">Prima volta in CasaZen? Non partire da qui: apri ${startLink(pages, 'Inizia qui')}, che ti dice in che ordine fare le cose.</p></header>
${personasLegend(pages)}
${sectionTabs(data.howtos, 'howtos')}
${groups}
<p class="gd-empty" data-empty hidden>Nessun compito corrisponde ai filtri.</p>
</article>`;
  return layout({ title: 'Come fare: tutti i compiti', description: 'Tutte le guide passo passo di CasaZen, per compito.', current: 'come-fare.html', pages, main, bodyClass: 'gd-page gd-page--list', meta });
}

function renderFlowsPage(pages, ctx, data, meta) {
  const cards = data.flows
    .map((f) => `<li data-filterable data-chi="${esc(f.chi.join(' '))}" data-sec="${sectionSlug(f.sezione)}"><a class="gd-card gd-card--task" href="${f.pagina}.html#${f.slug}"><span class="gd-card__t">${esc(f.titolo)}</span><span class="gd-card__d">${esc(f.sezione)} · ${esc(f.titolo_pagina)}</span></a></li>`)
    .join('');
  const articles = data.flows
    .map((f) => {
      ctx.where = `${f.pagina} (flusso)`;
      return `<article class="gd-flow" id="${f.pagina}-${f.slug}" data-filterable data-chi="${esc(f.chi.join(' '))}" data-sec="${sectionSlug(f.sezione)}"><h3 class="gd-h3">${icon('flow', 'gd-i gd-i--sm')} ${esc(f.titolo)}</h3><p class="gd-flow__from">${esc(f.sezione)} · <a href="${f.pagina}.html#${f.slug}">${esc(f.titolo_pagina)}</a></p>${renderBlocks(f.blocks, ctx, { steps: true })}</article>`;
    })
    .join('\n');
  const main = `
<article class="gd-article gd-accent--ink">
<header class="gd-article__head"><p class="gd-kicker">${icon('flow', 'gd-i gd-i--sm')} Per cercare</p><h1>Percorsi completi</h1><p class="gd-summary">I percorsi che attraversano più schermate o più persone, dall'inizio alla fine: chi fa cosa e cosa fa CasaZen da solo.</p></header>
${data.flows.length ? `${personasLegend(pages)}${sectionTabs(data.flows, 'flows')}<ul class="gd-cards gd-cards--tasks" aria-label="Elenco dei percorsi">${cards}</ul><hr>${articles}<p class="gd-empty" data-empty hidden>Nessun percorso corrisponde ai filtri.</p>` : '<p>I percorsi completi saranno aggiunti a breve.</p>'}
</article>`;
  return layout({ title: 'Percorsi completi', description: 'I percorsi di CasaZen dall’inizio alla fine.', current: 'flussi.html', pages, main, bodyClass: 'gd-page gd-page--list', meta });
}

function renderFaqPage(pages, ctx, data, meta) {
  const groups = SECTIONS.map((s) => ({ s, list: data.faqs.filter((f) => f.sezione === s.name) }))
    .filter((x) => x.list.length)
    .map(({ s, list }) => `<section class="gd-sec" id="${sectionSlug(s.name)}" data-group="${sectionSlug(s.name)}"><h2 class="gd-h2">${icon(s.icon, 'gd-i gd-i--sm')} ${esc(s.name)}</h2>${list
      .map((f) => {
        ctx.where = `${f.pagina} (faq)`;
        return `<details class="gd-faq" data-filterable data-chi="${esc(f.chi.join(' '))}" data-sec="${sectionSlug(f.sezione)}"><summary>${esc(f.domanda)}</summary><div class="gd-faq__a">${renderBlocks(f.blocks, ctx)}<p class="gd-faq__from"><a href="${f.pagina}.html#${f.slug}">${esc(f.titolo_pagina)}</a></p></div></details>`;
      })
      .join('')}</section>`)
    .join('\n');
  const main = `
<article class="gd-article gd-accent--ink">
<header class="gd-article__head"><p class="gd-kicker">${icon('help', 'gd-i gd-i--sm')} Per cercare</p><h1>Domande frequenti</h1><p class="gd-summary">Le risposte rapide alle domande più comuni. Se cominci adesso, le prime sono quelle di «Per iniziare».</p></header>
${data.faqs.length ? `${personasLegend(pages)}${sectionTabs(data.faqs, 'faqs')}${groups}<p class="gd-empty" data-empty hidden>Nessuna domanda corrisponde ai filtri.</p>` : '<p>Le domande frequenti saranno aggiunte a breve.</p>'}
</article>`;
  return layout({ title: 'Domande frequenti', description: 'Le risposte rapide alle domande più comuni su CasaZen.', current: 'domande-frequenti.html', pages, main, bodyClass: 'gd-page gd-page--list', meta });
}

function renderGlossaryPage(pages, ctx, data, meta) {
  const terms = [...data.terms].sort((a, b) => fold(a.termine).localeCompare(fold(b.termine), 'it'));
  // Un termine può avere più significati nelle varie pagine («Bozza», «Richiesta»…): si mostrano tutte le definizioni diverse, ciascuna con la sua pagina.
  const byTerm = new Map();
  for (const t of terms) {
    const k = fold(t.termine);
    if (!byTerm.has(k)) byTerm.set(k, []);
    byTerm.get(k).push(t);
  }
  const uniq = [...byTerm.values()].map((list) => {
    const seenDefs = new Set();
    const defs = list.filter((t) => {
      const dk = fold(t.definizione).replace(/[^a-z0-9]+/g, ' ').trim();
      if (seenDefs.has(dk)) return false;
      seenDefs.add(dk);
      return true;
    });
    return { termine: list[0].termine, defs };
  });
  const letters = [...new Set(uniq.map((t) => fold(t.termine)[0].toUpperCase()))];
  const body = letters
    .map((L) => {
      const list = uniq.filter((t) => fold(t.termine)[0].toUpperCase() === L);
      const entries = list
        .map((g) => {
          ctx.where = `${g.defs[0].pagina} (glossario)`;
          const dds = g.defs.map((t) => { ctx.where = `${t.pagina} (glossario)`; return `<dd>${inline(t.definizione, ctx)} <a class="gd-gloss__from" href="${t.pagina}.html">${esc(t.titolo_pagina)}</a></dd>`; }).join('');
          return `<dt>${inline(g.termine, ctx)}</dt>${dds}`;
        })
        .join('');
      return `<section class="gd-sec" id="lettera-${L.toLowerCase()}"><h2 class="gd-h2">${L}</h2><dl class="gd-gloss">${entries}</dl></section>`;
    })
    .join('\n');
  const main = `
<article class="gd-article gd-accent--ink">
<header class="gd-article__head"><p class="gd-kicker">${icon('glossary', 'gd-i gd-i--sm')} Per cercare</p><h1>Glossario</h1><p class="gd-summary">Le parole di CasaZen, spiegate in una riga.</p></header>
${uniq.length ? `<nav class="gd-az" aria-label="Lettere">${letters.map((L) => `<a href="#lettera-${L.toLowerCase()}">${L}</a>`).join('')}</nav>${body}` : '<p>Il glossario sarà aggiunto a breve.</p>'}
</article>`;
  return layout({ title: 'Glossario', description: 'Le parole di CasaZen spiegate in una riga.', current: 'glossario.html', pages, main, bodyClass: 'gd-page', meta });
}

function renderSearchPage(pages, meta) {
  const main = `
<article class="gd-article gd-accent--ink">
<header class="gd-article__head"><p class="gd-kicker">${icon('search', 'gd-i gd-i--sm')} Ricerca</p><h1 data-search-title>Risultati della ricerca</h1><p class="gd-summary" data-search-sub>Scrivi cosa vuoi fare: ad esempio «registrare un pagamento» o «collegare un calendario».</p></header>
<div data-search-results aria-live="polite"></div>
<noscript><p>La ricerca richiede JavaScript. Puoi sfogliare l'<a href="funzionalita.html">elenco delle funzionalità</a> o l'<a href="come-fare.html">elenco dei compiti</a>.</p></noscript>
</article>`;
  return layout({ title: 'Ricerca', description: 'Cerca nella guida di CasaZen.', current: 'cerca.html', pages, main, bodyClass: 'gd-page gd-page--search', meta });
}

function renderHome(pages, data, meta) {
  const sectionCards = SECTIONS.map((s) => {
    const list = pages.filter((p) => p.meta.sezione === s.name);
    if (!list.length) return '';
    const nHow = data.howtos.filter((h) => h.sezione === s.name).length;
    const links = list.map((p) => `<li><a href="${p.id}.html">${esc(p.meta.menu || p.meta.titolo)}</a></li>`).join('');
    return `<li id="${sectionSlug(s.name)}" class="gd-secard gd-accent--${s.accent}"><div class="gd-secard__head"><span class="gd-secard__ic">${icon(s.icon)}</span><div><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p></div></div><ul>${links}</ul><p class="gd-secard__n">${nHow ? `${nHow} guide passo passo` : `${list.length} pagine`}</p></li>`;
  }).join('');
  const personaChips = Object.entries(PERSONAS)
    .filter(([k]) => pages.some((p) => p.meta.chi.includes(k)))
    .map(([k, v]) => `<button type="button" class="gd-pill" data-filter-chi="${k}" title="${esc(v.hint)}">${esc(v.label)}</button>`)
    .join('');
  // «Cosa vuoi fare?»: i compiti scelti in guida/meta.json (campo «evidenza»), altrimenti i primi dell'indice.
  const byHowtoId = new Map(data.howtos.map((h) => [h.id, h]));
  const chosen = (Array.isArray(meta.evidenza) ? meta.evidenza : []).map((id) => byHowtoId.get(id)).filter(Boolean);
  const popular = chosen.length ? chosen : data.howtos.slice(0, 24);
  const popCards = popular
    .map((h) => `<li data-filterable data-chi="${esc(h.chi.join(' '))}" data-sec="${sectionSlug(h.sezione)}"><a class="gd-card gd-card--task" href="${h.pagina}.html#${h.slug}"><span class="gd-card__t">${esc(h.titolo)}</span><span class="gd-card__d">${esc(h.titolo_pagina)}</span></a></li>`)
    .join('');
  const main = `
<section class="gd-hero" aria-labelledby="gd-hero-t">
  <p class="gd-kicker">Guida CasaZen</p>
  <h1 id="gd-hero-t">Come possiamo aiutarti?</h1>
  <p class="gd-hero__sub"><strong>CasaZen</strong> è il gestionale per chi affitta case a breve o a lungo termine: un calendario solo, un sito di prenotazione diretta e le regole italiane sotto controllo, insieme ai canali che già usi. Qui trovi come si fa ogni cosa: cerca per compito, scorri gli argomenti o apri l'elenco di tutte le funzionalità.</p>
  <p class="gd-hero__start">${pages.some((p) => p.id === START_ID) ? `<a class="gd-btn gd-btn--primary" href="${START_ID}.html">${icon('compass', 'gd-i gd-i--sm')} Prima volta qui? Inizia qui</a>` : ''}<a href="per-iniziare.html#come-si-entra-invito-o-registrazione">Come si entra in CasaZen</a></p>
  <form class="gd-search gd-search--hero" role="search" action="cerca.html" method="get" autocomplete="off">
    ${icon('search', 'gd-i gd-search__i')}
    <input type="search" name="q" placeholder="Es. registrare un pagamento, collegare un calendario…" aria-label="Cerca nella guida" data-search-input>
    <button class="gd-btn gd-btn--primary" type="submit">Cerca</button>
    <div class="gd-suggest" data-suggest hidden></div>
  </form>
  <div class="gd-hero__quick"><a href="funzionalita.html">${icon('list', 'gd-i gd-i--sm')} Elenco delle funzionalità</a><a href="come-fare.html">${icon('book', 'gd-i gd-i--sm')} Tutti i compiti</a><a href="flussi.html">${icon('flow', 'gd-i gd-i--sm')} Percorsi completi</a><a href="domande-frequenti.html">${icon('help', 'gd-i gd-i--sm')} Domande frequenti</a></div>
</section>
<section class="gd-sec" aria-labelledby="gd-sec-t">
  <h2 class="gd-h2" id="gd-sec-t">Esplora per argomento</h2>
  <ul class="gd-secards">${sectionCards}</ul>
</section>
<section class="gd-sec" aria-labelledby="gd-task-t">
  <h2 class="gd-h2" id="gd-task-t">Cosa vuoi fare?</h2>
  <div class="gd-filters"><div class="gd-filter"><span class="gd-filter__l">Chi sei</span><button type="button" class="gd-pill is-on" data-filter-chi="">Tutti</button>${personaChips}</div></div>
  ${personasLegend(pages)}
  <ul class="gd-cards gd-cards--tasks">${popCards}</ul>
  <p><a class="gd-btn gd-btn--ghost" href="come-fare.html">Vedi tutti i compiti ${icon('arrow', 'gd-i gd-i--sm')}</a></p>
</section>`;
  return layout({ title: 'Guida CasaZen', description: "Il manuale d'uso di CasaZen: come fare, passo passo, e l'elenco di tutte le funzionalità.", current: 'index.html', pages, main, bodyClass: 'gd-home', meta });
}

/* ------------------------------------------------------------------------------------------------------------------
 * Controlli di qualità
 * ---------------------------------------------------------------------------------------------------------------- */

function lintContent(pages, errors, warnings) {
  for (const p of pages) {
    const published = p.struct.sections.filter((s) => s.key !== 'note');
    const texts = [p.meta.titolo, p.meta.riassunto, p.meta.dove || '', ...p.struct.pre.map((b) => JSON.stringify(b))];
    for (const s of published) {
      texts.push(s.title);
      texts.push(JSON.stringify(s.blocks));
      for (const sub of s.subs) texts.push(sub.title, JSON.stringify(sub.blocks));
    }
    const all = texts.join('\n');
    for (const [re, why] of FORBIDDEN) {
      const m = all.match(re);
      if (m) errors.push(`${p.file}: contiene «${m[0]}» (${why})`);
    }
    for (const [re, why] of WARN_TERMS) {
      const m = all.match(re);
      if (m) warnings.push(`${p.file}: «${m[0]}»: ${why}`);
    }
    const keys = new Set(p.struct.sections.map((s) => s.key));
    for (const need of ['breve', 'funzionalita', 'comefare']) if (!keys.has(need)) warnings.push(`${p.file}: manca la sezione «${need}»`);
    const how = p.struct.sections.find((s) => s.key === 'comefare');
    if (how) for (const sub of how.subs) if (!sub.blocks.some((b) => b.type === 'list' && b.ordered)) warnings.push(`${p.file}: il compito «${sub.title}» non ha passi numerati`);
  }
}

function manifestRoutes() {
  if (!fs.existsSync(MANIFEST_FILE)) return [];
  const src = fs.readFileSync(MANIFEST_FILE, 'utf8');
  const start = src.indexOf('ROUTE_MANIFEST: RouteManifestEntry[] = [');
  if (start < 0) return [];
  const routes = [];
  const re = /path:\s*'([^']+)'[\s\S]*?context:\s*'([^']+)'/g;
  const body = src.slice(start);
  let m;
  while ((m = re.exec(body))) routes.push({ path: m[1], context: m[2] });
  return routes;
}

function coverageReport(pages) {
  const covered = new Set();
  for (const p of pages) for (const c of Array.isArray(p.meta.copre) ? p.meta.copre : []) covered.add(c.replace(/\s*\(non-utente\)\s*$/i, '').trim());
  const routes = manifestRoutes();
  const missing = routes.filter((r) => !covered.has(r.path));
  return { total: routes.length, covered: routes.length - missing.length, missing };
}

/* ------------------------------------------------------------------------------------------------------------------
 * Orchestrazione
 * ---------------------------------------------------------------------------------------------------------------- */

export function buildGuida() {
  const errors = [];
  const warnings = [];
  const files = new Map();
  if (!fs.existsSync(META_FILE)) throw new Error(`File assente: ${META_FILE}`);
  const rawMeta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  const meta = { ...rawMeta, aggiornatoLungo: longDate(rawMeta.aggiornato) };
  const pages = loadPages(errors);
  const ctx = makeContext(pages, errors, warnings);
  lintContent(pages, errors, warnings);
  const data = collect(pages, ctx);
  const howtoIds = new Set(data.howtos.map((h) => h.id));
  for (const id of Array.isArray(meta.evidenza) ? meta.evidenza : []) if (!howtoIds.has(id)) errors.push(`guida/meta.json: «evidenza» cita un compito inesistente (${id})`);

  for (const p of pages) files.set(`${p.id}.html`, renderPage(p, ctx, pages, meta));
  files.set('index.html', renderHome(pages, data, meta));
  files.set('funzionalita.html', renderFeaturesPage(pages, ctx, data, meta));
  files.set('come-fare.html', renderHowtoPage(pages, ctx, data, meta));
  files.set('flussi.html', renderFlowsPage(pages, ctx, data, meta));
  files.set('domande-frequenti.html', renderFaqPage(pages, ctx, data, meta));
  files.set('glossario.html', renderGlossaryPage(pages, ctx, data, meta));
  files.set('cerca.html', renderSearchPage(pages, meta));

  // Controllo finale dei rimandi interni delle pagine generate (home, elenchi e legende comprese).
  {
    const idsOf = new Map();
    for (const [name, content] of files) if (name.endsWith('.html')) idsOf.set(name, new Set([...content.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    const seenBad = new Set();
    for (const [name, content] of files) {
      if (!name.endsWith('.html')) continue;
      for (const m of content.matchAll(/href="([a-z0-9-]+\.html)(?:#([^"]*))?"/g)) {
        const [, target, hash] = m;
        const key = `${name}→${target}#${hash || ''}`;
        if (seenBad.has(key)) continue;
        if (!idsOf.has(target)) {
          seenBad.add(key);
          errors.push(`${name}: rimando a una pagina che non esiste (${target})`);
        } else if (hash && !idsOf.get(target).has(hash)) {
          seenBad.add(key);
          errors.push(`${name}: rimando a un punto che non esiste (${target}#${hash})`);
        }
      }
    }
  }

  // Indice di ricerca (letto da assets/guida.js)
  const idx = [];
  for (const p of pages) {
    ctx.where = p.file;
    idx.push({ t: 'pagina', titolo: p.meta.titolo, sezione: p.meta.sezione, ctx: 'Pagina', url: `${p.id}.html`, chi: p.meta.chi, testo: stripInline(p.meta.riassunto, ctx.titleOf).slice(0, 300), kw: [...(Array.isArray(p.meta.parole_chiave) ? p.meta.parole_chiave : []), p.meta.dove || ''].join(' ') });
  }
  for (const h of data.howtos) idx.push({ t: 'howto', pg: h.pagina, titolo: stripInline(h.titolo, ctx.titleOf), sezione: h.sezione, ctx: h.titolo_pagina, url: `${h.pagina}.html#${h.slug}`, chi: h.chi, testo: h.testo.slice(0, 420), kw: '' });
  for (const f of data.features) idx.push({ t: 'funzione', pg: f.pagina, titolo: f.nome, sezione: f.sezione, ctx: f.titolo_pagina, url: `${f.pagina}.html#funzionalita`, chi: f.chi, testo: `${f.cosa} ${f.dove_funzione}`.slice(0, 260), kw: '' });
  for (const f of data.faqs) idx.push({ t: 'faq', pg: f.pagina, titolo: stripInline(f.domanda, ctx.titleOf), sezione: f.sezione, ctx: f.titolo_pagina, url: `${f.pagina}.html#${f.slug}`, chi: f.chi, testo: f.testo.slice(0, 320), kw: '' });
  for (const f of data.flows) idx.push({ t: 'flusso', pg: f.pagina, titolo: stripInline(f.titolo, ctx.titleOf), sezione: f.sezione, ctx: f.titolo_pagina, url: `${f.pagina}.html#${f.slug}`, chi: f.chi, testo: f.testo.slice(0, 320), kw: '' });
  for (const g of data.terms) idx.push({ t: 'termine', pg: g.pagina, titolo: stripInline(g.termine, ctx.titleOf), sezione: g.sezione, ctx: 'Glossario', url: `glossario.html`, chi: [], testo: stripInline(g.definizione, ctx.titleOf), kw: '' });
  const pagineKw = {};
  for (const p of pages) pagineKw[p.id] = [...(Array.isArray(p.meta.parole_chiave) ? p.meta.parole_chiave : []), p.meta.dove || ''].join(' ');
  files.set('guida-indice.js', `window.GUIDA_INDICE=${JSON.stringify({ versione: 2, aggiornato: meta.aggiornato, pagine: pagineKw, voci: idx })};\n`);

  // Base di conoscenza per il chatbot: un blocco autosufficiente per compito, domanda, flusso, regola…
  const chunks = data.chunks.map((c) => ({ ...c, url: `${BASE_URL_PATH}${c.url}` }));
  files.set('guida-chunks.json', `${JSON.stringify({ versione: 1, aggiornato: meta.aggiornato, lingua: 'it', base: BASE_URL_PATH, note: 'Ogni chunk è autosufficiente. «testo» è in italiano semplice. Usa «url» per citare la fonte.', chunks }, null, 1)}\n`);

  // Testo completo e indice per LLM
  const full = [`# Guida CasaZen (aggiornata il ${meta.aggiornatoLungo})`, ''];
  for (const p of pages) {
    full.push(`## ${p.meta.titolo}`, '', `Sezione: ${p.meta.sezione}${p.meta.dove ? ` · Si trova in: ${p.meta.dove}` : ''}${p.meta.chi.length ? ` · Per: ${p.meta.chi.map((c) => PERSONAS[c].label).join(', ')}` : ''}`, '');
    for (const s of p.struct.sections) {
      if (s.key === 'note') continue;
      full.push(`### ${s.title}`, '', blocksToText(s.blocks, ctx.titleOf), '');
      for (const sub of s.subs) full.push(`#### ${sub.title}`, '', blocksToText(sub.blocks, ctx.titleOf), '');
    }
  }
  files.set('guida-completa.md', `${full.join('\n').replace(/\n{3,}/g, '\n\n')}\n`);
  const llms = ['# Guida CasaZen', '', `> Manuale d'uso di CasaZen in italiano: guide passo passo, elenco delle funzionalità, flussi completi e domande frequenti. Aggiornato il ${meta.aggiornatoLungo}.`, ''];
  for (const s of SECTIONS) {
    const list = pages.filter((p) => p.meta.sezione === s.name);
    if (!list.length) continue;
    llms.push(`## ${s.name}`, '', ...list.map((p) => `- [${p.meta.titolo}](${BASE_URL_PATH}${p.id}.html): ${stripInline(p.meta.riassunto, ctx.titleOf)}`), '');
  }
  llms.push('## Per i sistemi automatici', '', `- [Blocchi di conoscenza (JSON)](${BASE_URL_PATH}guida-chunks.json): un blocco autosufficiente per compito, domanda, flusso e regola`, `- [Testo completo](${BASE_URL_PATH}guida-completa.md)`, '');
  files.set('llms.txt', llms.join('\n'));

  const notes = pages
    .map((p) => {
      const n = p.struct.sections.find((s) => s.key === 'note');
      return n ? `## ${p.meta.titolo} (${p.file})\n\n${blocksToText(n.blocks, ctx.titleOf)}\n` : '';
    })
    .filter(Boolean)
    .join('\n');

  for (const f of ['assets/guida.css', 'assets/guida-ricerca.js', 'assets/guida.js', 'assets/marchio.svg']) {
    if (!fs.existsSync(path.join(ASSETS_DIR, f))) errors.push(`risorsa mancante: public/guida/${f}`);
  }
  const riepilogo = pages.map((p) => {
    const feats = data.features.filter((f) => f.pagina === p.id);
    const count = (av) => feats.filter((f) => f.disponibilita === av).length;
    return {
      id: p.id,
      titolo: p.meta.titolo,
      sezione: p.meta.sezione,
      stato: p.meta.stato || 'disponibile',
      funzioni: feats.length,
      disponibili: count('disponibile'),
      suAttivazione: count('su attivazione'),
      inArrivo: count('in arrivo'),
      compiti: data.howtos.filter((h) => h.pagina === p.id).length,
      faq: data.faqs.filter((h) => h.pagina === p.id).length,
      flussi: data.flows.filter((h) => h.pagina === p.id).length,
    };
  });
  return { files, errors, warnings, notes, riepilogo, coverage: coverageReport(pages), stats: { pagine: pages.length, compiti: data.howtos.length, funzioni: data.features.length, faq: data.faqs.length, flussi: data.flows.length, termini: data.terms.length, chunks: chunks.length } };
}

/** Confronta i file generati con quelli su disco. */
export function diffGenerated(files) {
  const stale = [];
  for (const [name, content] of files) {
    const p = path.join(OUT_DIR, name);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') !== content) stale.push(name);
  }
  if (fs.existsSync(OUT_DIR)) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (/\.(html|json|js|md|txt)$/.test(f) && !files.has(f)) stale.push(`${f} (non più generato)`);
    }
  }
  return stale;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const notesIdx = args.indexOf('--notes');
  const result = buildGuida();
  const { files, errors, warnings } = result;
  if (notesIdx >= 0 && args[notesIdx + 1]) fs.writeFileSync(args[notesIdx + 1], `# Note per la revisione della guida\n\n${result.notes}`, 'utf8');
  for (const w of warnings) console.warn(`avviso: ${w}`);
  for (const e of errors) console.error(`ERRORE: ${e}`);
  const cov = result.coverage;
  console.log(`rotte del manifest: ${cov.covered}/${cov.total} coperte${cov.missing.length ? ` (${cov.missing.length} senza spiegazione)` : ''}`);
  if (cov.missing.length && args.includes('--coverage')) for (const r of cov.missing) console.log(`  non coperta: ${r.path} [${r.context}]`);
  console.log(`pagine: ${result.stats.pagine}, compiti: ${result.stats.compiti}, funzioni: ${result.stats.funzioni}, faq: ${result.stats.faq}, flussi: ${result.stats.flussi}, termini: ${result.stats.termini}, chunk: ${result.stats.chunks}`);
  if (errors.length && !args.includes('--force')) process.exit(1);
  if (check) {
    const stale = diffGenerated(files);
    if (stale.length) {
      console.error(`I file generati non sono aggiornati: ${stale.join(', ')}. Esegui: npm run guida:build`);
      process.exit(1);
    }
    console.log('ok: file generati aggiornati');
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) if (/\.(html|json|js|md|txt)$/.test(f) && !files.has(f)) fs.rmSync(path.join(OUT_DIR, f));
  for (const [name, content] of files) fs.writeFileSync(path.join(OUT_DIR, name), content, 'utf8');
  console.log(`scritti ${files.size} file in public/guida`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
