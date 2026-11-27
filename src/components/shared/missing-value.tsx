/** A figure the server did not give: a dash for the eye and the words for a screen reader, never a 0 (a real 0 is a figure and is drawn as one). */
export function MissingValue({ label, testId }: { label: string; testId?: string }) {
  return (
    <span data-missing="true" data-testid={testId}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
