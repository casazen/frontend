export function FiscalDisclaimer({ text }: { text: string }) {
  return (
    <p
      data-testid="fiscal-disclaimer"
      className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40"
    >
      {text}
    </p>
  );
}
