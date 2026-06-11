/** Display name for admin lists and dialogs — prefers name, then email, never raw id when email exists. */
export function formatUserDisplayName(user: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const firstName = (user.firstName ?? '').trim();
  const lastName = (user.lastName ?? '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (fullName) return fullName;

  const email = (user.email ?? '').trim();
  if (email) return email;

  return user.id;
}
