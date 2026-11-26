export const linkedStayPaths = {
  checkin: '/s/action/checkin/:token',
  documents: '/s/action/documents/:documentId',
  review: '/s/action/org/:orgSlug/review/:bookingId',
  cancellation: '/s/action/org/:orgSlug/cancellation/:bookingId',
} as const;

export type LinkedStayAction = keyof typeof linkedStayPaths;
