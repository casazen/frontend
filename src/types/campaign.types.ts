export type CampaignStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Scheduled' | 'Sending' | 'Sent' | 'Failed';

export type ConditionFieldType = 'Text' | 'Number' | 'Date' | 'Boolean' | 'Enum' | 'Set';

export interface ConditionField {
  fieldId: string;
  operator: string;
  value: unknown;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  rules: ConditionField[];
}

export interface ConditionDefinition {
  version: string;
  groups: ConditionGroup[];
}

export interface FieldDefinition {
  fieldId: string;
  fieldType: ConditionFieldType;
  displayNameKey: string;
  operators: string[];
}

export interface Segment {
  id: string;
  name: string;
  condition: ConditionDefinition;
  createdAt: string;
}

export interface CreateSegmentDto {
  name: string;
  condition: ConditionDefinition;
}

export interface SegmentPreviewResult {
  count: number;
}

export interface Campaign {
  id: string;
  segmentId: string;
  segmentName: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  sentCount: number;
  errorCount: number;
  unsubscribeCount: number;
  isAiGenerated: boolean;
}

export interface CreateDraftDto {
  isAiGenerated?: boolean;
  propertyId?: string;
  segmentId: string;
  subject: string;
  body: string;
}

export interface SubmitForApprovalDto {
  campaignId: string;
}

export interface ScheduleCampaignDto {
  campaignId: string;
  scheduledAt: string;
}

export interface CampaignReport {
  id: string;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  sentCount: number;
  errorCount: number;
  unsubscribeCount: number;
}
