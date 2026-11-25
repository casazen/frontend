export function readSupplierInviteIdentity(form: HTMLFormElement) {
  const data = new FormData(form);
  const value = (field: string) => String(data.get(field) ?? '').trim();
  const vatNumber = value('vatNumber');
  const fiscalCode = value('fiscalCode');
  const phone = value('phone');
  return { ...(vatNumber && { vatNumber }), ...(fiscalCode && { fiscalCode }), ...(phone && { phone }) };
}
