export const guideFields = ['arrival', 'checkInHours', 'house', 'departure', 'checkOutHours', 'parking', 'contacts', 'localTips', 'access', 'wifi'] as const;

export const autoReplyTopics = ['checkIn', 'checkOut', 'parking', 'wifi'] as const;
export type AutoReplyTopic = typeof autoReplyTopics[number];
export type GuideAutoReplies = Record<AutoReplyTopic | 'enabled', boolean>;

export type HouseGuide = Partial<Record<typeof guideFields[number], string | null>> & {
  autoReplies?: GuideAutoReplies | null;
};
