import { ContextSidebar } from './context-sidebar';

export function AdminSidebar() {
  return (
    <ContextSidebar
      contextKey="admin"
      subtitle="Admin Panel"
      iconClassName="bg-destructive text-destructive-foreground"
      footerLabel="v1.0.0 · Admin"
    />
  );
}
