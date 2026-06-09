interface AiContentNoticeProps {
  visible?: boolean;
}

/** EU AI Act transparency note for guest-facing AI-generated content (US-003 AC9). */
export function AiContentNotice({ visible = false }: AiContentNoticeProps) {
  if (!visible) return null;

  return (
    <p className="text-xs text-muted-foreground italic" data-testid="ai-content-notice">
      Descrizione generata con AI
    </p>
  );
}
