/**
 * The values of the reading that the person has already looked at and changed (NL-DOCS-FU9), by lease and by contract document. The mark
 * «letto dal contratto — controlla» is for a value nobody checked; a value the person changed is not that any more, also when the draft is
 * read again (the person left and came back, or reloaded after a conflict) and the saved value has become the starting point of the
 * form, where «changed» can no longer be seen.
 *
 * Only the names of the fields and the id of the contract document are kept, never a value of the contract or of a person, and only for
 * the tab (`sessionStorage`): when the tab is closed the memory goes. It is best effort: where the storage cannot be used the mark simply
 * behaves as before.
 */
const PREFIX = 'lease-read-seen:';

export function seenStoreKey(leaseId: string, contractDocumentId: string | null | undefined): string {
  return `${PREFIX}${leaseId}:${contractDocumentId ?? ''}`;
}

export function seenReads(storeKey: string): ReadonlySet<string> {
  try {
    const raw = sessionStorage.getItem(storeKey);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markReadSeen(storeKey: string, id: string): void {
  try {
    const seen = new Set(seenReads(storeKey));
    if (seen.has(id)) return;
    seen.add(id);
    sessionStorage.setItem(storeKey, JSON.stringify([...seen]));
  } catch {
    // Best effort: a storage that is full or forbidden only means the mark may come back after a reload.
  }
}

export function readSeenId(partyId: string | undefined, fields: readonly string[]): string {
  return `${partyId ?? ''}|${fields.join(',')}`;
}
