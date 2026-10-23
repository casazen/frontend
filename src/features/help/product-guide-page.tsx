import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';

interface GuideSection {
  title: string;
  keywords: string;
  steps: string[];
}

/** Static editorial content only: visiting the guide never fetches guest or organisation data. */
export function ProductGuidePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const sections = t('productGuide.sections', { returnObjects: true }) as Record<string, GuideSection>;
  const search = query.trim().toLocaleLowerCase();
  const matches = Object.entries(sections).filter(([, section]) =>
    [section.title, section.keywords, ...section.steps].join(' ').toLocaleLowerCase().includes(search),
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title={t('productGuide.title')} description={t('productGuide.description')} />
      <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t('productGuide.availability')}
      </p>
      <div className="space-y-2">
        <label htmlFor="guide-search" className="text-sm font-medium">{t('productGuide.search')}</label>
        <Input id="guide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <nav aria-label={t('productGuide.contents')} className="flex flex-wrap gap-2">
        {matches.map(([id, section]) => (
          <a key={id} href={`#guide-${id}`} className="rounded-md border px-3 py-2 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
            {section.title}
          </a>
        ))}
      </nav>
      {matches.length === 0 ? <p role="status">{t('productGuide.empty')}</p> : null}
      {matches.map(([id, section]) => (
        <section key={id} id={`guide-${id}`} aria-labelledby={`guide-${id}-title`} className="space-y-4 rounded-xl border bg-card p-5 md:p-6">
          <h2 id={`guide-${id}-title`} className="text-xl font-semibold">{section.title}</h2>
          <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
            {section.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
      ))}
    </div>
  );
}
