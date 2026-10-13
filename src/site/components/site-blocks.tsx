import type { ReactNode } from 'react';

/** Small layout blocks shared by the pages of the public site (SEO-VETRINA). */

export function Section({ title, intro, children, muted }: { title: string; intro?: string; children?: ReactNode; muted?: boolean }) {
  return (
    <section className={muted ? 'bg-slate-50' : undefined}>
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {intro && <p className="mt-3 max-w-3xl text-slate-600">{intro}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function FeatureCard({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>}
      {children}
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-block rounded-md bg-indigo-700 px-5 py-3 font-medium text-white hover:bg-indigo-800">
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-block rounded-md border border-slate-300 px-5 py-3 font-medium text-slate-800 hover:border-indigo-700 hover:text-indigo-700">
      {children}
    </a>
  );
}

export function PageHeader({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-indigo-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">{intro}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
