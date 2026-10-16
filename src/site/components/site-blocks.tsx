import type { ReactNode } from 'react';
import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { CasaZenRing } from '@/components/brand/casazen-mark';

/**
 * Small layout blocks shared by the pages of the public site (SEO-VETRINA): the look of the brand in one place. Every class
 * is written out in full (no string built from parts), so that Tailwind finds it when it scans this folder.
 */

/** The accents a tile can take: terracotta and ink of the brand, and the colors of the areas of the app. */
export type Tint = 'terra' | 'ink' | 'salvia' | 'savoia' | 'ametista';

const TILE: Record<Tint, string> = {
  terra: 'bg-terra-100 text-terra-800',
  ink: 'bg-ink-100 text-ink-700',
  salvia: 'bg-salvia-100 text-salvia-800',
  savoia: 'bg-savoia-100 text-savoia-800',
  ametista: 'bg-ametista-100 text-ametista-800',
};

/** The tinted square that carries the icon of a card. Decoration: the title next to it says what it is. */
export function IconTile({ icon: Icon, tint = 'terra', large = false }: { icon: LucideIcon; tint?: Tint; large?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-2xl ${large ? 'size-14' : 'size-11'} ${TILE[tint]}`}>
      <Icon className={large ? 'size-7' : 'size-5'} strokeWidth={1.9} />
    </span>
  );
}

/** The small colored label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="inline-flex rounded-full bg-terra-100 px-3.5 py-1 text-sm font-semibold text-terra-800">{children}</p>;
}

/** The band a section sits on: the page alternates paper tones, and one dark band gives it a center of gravity. */
export type SectionTone = 'plain' | 'cream' | 'terra' | 'salvia' | 'ink';

const SECTION: Record<SectionTone, { band: string; title: string; intro: string }> = {
  plain: { band: 'bg-white', title: 'text-ink-800', intro: 'text-ink-500' },
  cream: { band: 'bg-cream-100', title: 'text-ink-800', intro: 'text-ink-500' },
  terra: { band: 'bg-terra-100', title: 'text-ink-800', intro: 'text-ink-600' },
  salvia: { band: 'bg-salvia-100', title: 'text-ink-800', intro: 'text-ink-600' },
  ink: { band: 'bg-ink-700', title: 'text-white', intro: 'text-ink-100' },
};

interface SectionProps {
  title: string;
  intro?: string;
  children?: ReactNode;
  tone?: SectionTone;
  /** A large tile above the title, for the sections that are a single call to action. */
  icon?: LucideIcon;
  tint?: Tint;
}

export function Section({ title, intro, children, tone = 'plain', icon, tint = 'terra' }: SectionProps) {
  const style = SECTION[tone];
  return (
    <section className={`relative overflow-hidden ${style.band}`}>
      {tone === 'ink' ? (
        <CasaZenRing size={420} color="#ff9b6b" className="pointer-events-none absolute -right-24 -top-28 opacity-[0.12]" />
      ) : null}
      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
        {icon ? (
          <div className="mb-6">
            <IconTile icon={icon} tint={tint} large />
          </div>
        ) : null}
        <h2 className={`font-display text-3xl font-semibold tracking-tight sm:text-4xl ${style.title}`}>{title}</h2>
        {intro && <p className={`mt-4 max-w-3xl text-base leading-relaxed sm:text-lg ${style.intro}`}>{intro}</p>}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

interface FeatureCardProps {
  title: string;
  text?: string;
  icon?: LucideIcon;
  tint?: Tint;
  /** The level of the title: a card right under the `h1` of the page is an `h2`, one under a section an `h3`. */
  heading?: 'h2' | 'h3';
  children?: ReactNode;
}

export function FeatureCard({ title, text, icon, tint = 'terra', heading: Heading = 'h3', children }: FeatureCardProps) {
  return (
    <div className="flex flex-col rounded-3xl border border-ink-700/10 bg-white p-6 shadow-soft">
      {icon ? <IconTile icon={icon} tint={tint} /> : null}
      <Heading className={`${icon ? 'mt-5 ' : ''}text-lg font-semibold text-ink-800`}>{title}</Heading>
      {text && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-500">{text}</p>}
      {children}
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed text-ink-500">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-terra-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const BUTTON = 'inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';

/** The call to action. `inverse` is the same button on a dark band. */
export function PrimaryLink({ href, children, inverse = false }: { href: string; children: ReactNode; inverse?: boolean }) {
  const colors = inverse
    ? 'bg-terra-400 text-ink-800 hover:bg-terra-300 focus-visible:outline-white'
    : 'bg-terra-600 text-white hover:bg-terra-800 focus-visible:outline-terra-700';
  return (
    <a href={href} className={`${BUTTON} ${colors} shadow-sm`}>
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children, inverse = false }: { href: string; children: ReactNode; inverse?: boolean }) {
  const colors = inverse
    ? 'border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white'
    : 'border border-ink-700/25 bg-white/70 text-ink-800 hover:border-ink-700/60 hover:bg-white focus-visible:outline-terra-700';
  return (
    <a href={href} className={`${BUTTON} ${colors}`}>
      {children}
    </a>
  );
}

/** The top of a page that is not the home page: the title (the `h1`), a line under it and, optionally, the call to action. */
export function PageHeader({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-ink-700/10 bg-gradient-to-b from-terra-50 to-cream-50">
      <CasaZenRing size={360} className="pointer-events-none absolute -right-20 -top-24 opacity-[0.09]" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink-800 sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-500">{intro}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

/** A row of figures under the hero: facts about the product, each with the sentence that says what it counts. */
export function FactsStrip({ items }: { items: { value: string; label: string }[] }) {
  return (
    <section className="border-y border-ink-700/10 bg-white">
      <dl className="mx-auto grid max-w-6xl gap-x-8 gap-y-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.value}>
            <dt className="font-display text-3xl font-semibold tracking-tight text-terra-700 lining-nums sm:text-4xl">{item.value}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-ink-500">{item.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A list of short points with a check mark: the points of a feature, on a light or on the dark band. */
export function CheckList({ items, onDark = false }: { items: string[]; onDark?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden="true"
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${onDark ? 'bg-terra-400 text-ink-800' : 'bg-terra-100 text-terra-800'}`}
          >
            <Check className="size-3" strokeWidth={3.5} />
          </span>
          <span className={onDark ? 'text-ink-100' : 'text-ink-600'}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface CompareProps {
  beforeTitle: string;
  before: string[];
  afterTitle: string;
  after: string[];
}

/** The usual way against the way with CasaZen, two columns: the plain one first, the dark one that carries the answer. */
export function Compare({ beforeTitle, before, afterTitle, after }: CompareProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-3xl border border-ink-700/10 bg-white p-7">
        <h3 className="text-lg font-semibold text-ink-500">{beforeTitle}</h3>
        <ul className="mt-5 space-y-4">
          {before.map((item) => (
            <li key={item} className="flex gap-3 text-ink-500">
              <X aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-3xl bg-ink-700 p-7 shadow-xl shadow-ink-900/15">
        <h3 className="text-lg font-semibold text-white">{afterTitle}</h3>
        <div className="mt-5">
          <CheckList items={after} onDark />
        </div>
      </div>
    </div>
  );
}

/** Numbered cards, one per step. A step with a title has a text under it; one without is a sentence on its own. */
export function Steps({ items }: { items: { title?: string; text: string }[] }) {
  return (
    <ol className="grid gap-5 md:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.text} className="rounded-3xl border border-ink-700/10 bg-white p-6 shadow-soft">
          <span className="grid size-10 place-items-center rounded-full bg-terra-100 font-display text-lg font-semibold text-terra-800 lining-nums">
            {index + 1}
          </span>
          {item.title ? <h3 className="mt-4 text-lg font-semibold text-ink-800">{item.title}</h3> : null}
          <p className={`leading-relaxed ${item.title ? 'mt-2 text-[0.95rem] text-ink-500' : 'mt-4 text-ink-600'}`}>{item.text}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Questions and answers that open on a click: native `<details>`, so they work in the static page without a script and with
 * the keyboard. All closed when the page loads (the same HTML on the server and in the browser).
 */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="max-w-3xl divide-y divide-ink-700/10 rounded-3xl border border-ink-700/10 bg-white shadow-soft">
      {items.map((item) => (
        <details key={item.question} className="group px-6 py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-ink-800 marker:content-none [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 text-ink-500 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="mt-3 leading-relaxed text-ink-500">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
