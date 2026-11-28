import type { ReactNode } from 'react';
import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { CasaZenRing } from '@/components/brand/casazen-mark';

/**
 * Small layout blocks shared by the pages of the public site (SEO-VETRINA): the look of the brand in one place. Every class
 * is written out in full (no string built from parts), so that Tailwind finds it when it scans this folder.
 */

export type Tint = 'terra' | 'ink' | 'salvia' | 'savoia' | 'ametista';

const TILE: Record<Tint, string> = {
  terra: 'bg-terra-100 text-terra-800',
  ink: 'bg-ink-100 text-ink-700',
  salvia: 'bg-salvia-100 text-salvia-800',
  savoia: 'bg-savoia-100 text-savoia-800',
  ametista: 'bg-ametista-100 text-ametista-800',
};

export function IconTile({
  icon: Icon,
  tint = 'terra',
  large = false,
  className = '',
}: {
  icon: LucideIcon;
  tint?: Tint;
  large?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`cz-icon-tile ${large ? '[--cz-icon-tile-size:3.5rem] [--cz-icon-size:1.75rem]' : ''} ${TILE[tint]} ${className}`}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="inline-flex items-center gap-3 text-sm font-semibold tracking-wide text-terra-800 before:h-px before:w-8 before:bg-current">{children}</p>;
}

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
      <div className="relative mx-auto max-w-6xl px-5 py-[var(--cz-section-gap)] sm:py-16">
        {icon ? (
          <div className="mb-6">
            <IconTile icon={icon} tint={tint} large />
          </div>
        ) : null}
        <h2 className={`max-w-4xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl ${style.title}`}>{title}</h2>
        {intro && <p className={`mt-4 max-w-[var(--cz-reading-width)] text-base leading-relaxed sm:text-lg ${style.intro}`}>{intro}</p>}
        {children && <div className="mt-6 sm:mt-9">{children}</div>}
      </div>
    </section>
  );
}

interface FeatureCardProps {
  title: string;
  text?: string;
  icon?: LucideIcon;
  tint?: Tint;
  heading?: 'h2' | 'h3';
  extra?: boolean;
  children?: ReactNode;
}

// The card is a subgrid of the grid it is in (it has to be a direct child of it) from the second column on, `sm`: a row for each
// part, as tall as the tallest one among the cards of the row, so that a title on two lines or a longer text moves the title, the
// text and the list of the cards of the row alike. In a single column there is nothing to line up with: a plain column.
const FEATURE_ROW_SPANS: Record<number, string> = {
  2: 'sm:row-span-2',
  3: 'sm:row-span-3',
  4: 'sm:row-span-4',
};

export function FeatureCard({ title, text, icon, tint = 'terra', heading: Heading = 'h3', extra = false, children }: FeatureCardProps) {
  const hasExtra = extra || (children !== undefined && children !== null && children !== false);
  const rows = 1 + (icon ? 1 : 0) + (text ? 1 : 0) + (hasExtra ? 1 : 0);
  return (
    <div className={`flex flex-col rounded-[var(--cz-radius-panel)] border border-ink-700/15 bg-white p-[var(--cz-panel-padding)] sm:grid sm:grid-rows-subgrid sm:gap-y-0 ${FEATURE_ROW_SPANS[rows]}`}>
      {icon ? <IconTile icon={icon} tint={tint} className="mb-5" /> : null}
      <Heading className="text-lg font-semibold text-ink-800">{title}</Heading>
      {text && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-500">{text}</p>}
      {hasExtra ? <div>{children}</div> : null}
    </div>
  );
}

/**
 * The grid of the cards. When the number of cards is fixed, `count` says it and the columns are the ones that divide it, so that no
 * line is left with empty cells (three cards are three across from `md`, five are five across from `lg`, and one under the other
 * below). Without it, the grid is two across from `sm` and three from `lg`, for a list of any length.
 */
export function CardGrid({ children, count }: { children: ReactNode; count?: 3 | 5 }) {
  const columns = count === 3 ? 'md:grid-cols-3' : count === 5 ? 'lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3';
  return <div className={`grid gap-5 ${columns}`}>{children}</div>;
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

export function PrimaryLink({ href, children, inverse = false, onClick }: { href: string; children: ReactNode; inverse?: boolean; onClick?: () => void }) {
  const colors = inverse
    ? 'bg-terra-400 text-ink-800 hover:bg-terra-300 focus-visible:outline-white'
    : 'bg-terra-600 text-white hover:bg-terra-800 focus-visible:outline-terra-700';
  return (
    <a href={href} onClick={onClick} className={`${BUTTON} ${colors} shadow-sm`}>
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children, inverse = false, onClick }: { href: string; children: ReactNode; inverse?: boolean; onClick?: () => void }) {
  const colors = inverse
    ? 'border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white'
    : 'border border-ink-700/25 bg-white/70 text-ink-800 hover:border-ink-700/60 hover:bg-white focus-visible:outline-terra-700';
  return (
    <a href={href} onClick={onClick} className={`${BUTTON} ${colors}`}>
      {children}
    </a>
  );
}

export function PageHeader({ title, intro, children, preview }: { title: string; intro: string; children?: ReactNode; preview?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-ink-700/10 bg-gradient-to-b from-terra-50 to-cream-50">
      <CasaZenRing size={360} className="pointer-events-none absolute -right-20 -top-24 opacity-[0.09]" />
      <div className={`relative mx-auto max-w-6xl px-5 py-8 sm:py-20 ${preview ? 'grid gap-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] lg:items-start lg:gap-12' : ''}`}>
        <div className="min-w-0">
          <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink-800 sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-500">{intro}</p>
          {children && <div className="mt-5 flex flex-wrap gap-3 sm:mt-8">{children}</div>}
        </div>
        {preview}
      </div>
    </section>
  );
}

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

export function Steps({ items }: { items: { title?: string; text: string }[] }) {
  const titled = items.some((item) => item.title);
  return (
    <ol className="grid gap-5 md:grid-cols-3">
      {items.map((item, index) => (
        <li
          key={item.text}
          className={`flex flex-col rounded-2xl border border-ink-700/15 bg-white p-5 sm:p-6 md:grid md:grid-rows-subgrid md:gap-y-0 ${titled ? 'md:row-span-3' : 'md:row-span-2'}`}
        >
          <span className="grid size-10 place-items-center rounded-full bg-terra-100 font-display text-lg font-semibold text-terra-800 lining-nums">
            {index + 1}
          </span>
          {titled ? (
            item.title ? <h3 className="mt-4 text-lg font-semibold text-ink-800">{item.title}</h3> : <div />
          ) : null}
          <p className={`leading-relaxed ${item.title ? 'mt-2 text-[0.95rem] text-ink-500' : 'mt-4 text-ink-600'}`}>{item.text}</p>
        </li>
      ))}
    </ol>
  );
}

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
