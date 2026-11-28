export function MissingValue({ label, testId }: { label: string; testId?: string }) {
  return (
    <span data-missing="true" data-testid={testId}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
