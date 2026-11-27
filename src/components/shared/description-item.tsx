export function DescriptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
