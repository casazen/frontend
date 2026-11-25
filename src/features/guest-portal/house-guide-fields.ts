export const guideFields = ['arrival', 'house', 'departure', 'contacts', 'localTips', 'access', 'wifi'] as const;
export type HouseGuide = Partial<Record<typeof guideFields[number], string | null>>;
