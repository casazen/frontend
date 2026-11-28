interface SectionJumpsProps {
  label: string;
  sections: { id: string; label: string }[];
}

export function SectionJumps({ label, sections }: SectionJumpsProps) {
  return (
    <nav aria-label={label} className="flex min-w-0 flex-wrap gap-2 rounded-2xl border bg-card p-2">
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          {section.label}
        </a>
      ))}
    </nav>
  );
}
