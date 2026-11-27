/** One item of a description list: the label and, under it, its value (a `dt` and a `dd` in a `div`, to be put in a `dl`). */
export function DescriptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
