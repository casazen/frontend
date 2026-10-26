export type CampaignStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Scheduled' | 'Sending' | 'Sent' | 'Failed';

export type ConditionOperator =
  | 'Equals' | 'NotEquals'
  | 'GreaterThan' | 'LessThan' | 'Between'
  | 'Before' | 'After' | 'InLast'
  | 'In' | 'NotIn'
  | 'Is' | 'IsNot'
  | 'Contains';

export type ConditionFieldType = 'Text' | 'Number' | 'Date' | 'Boolean' | 'Enum' | 'Set';

export interface ConditionField {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: ConditionField[];
}

export interface ConditionDefinition {
  version: number;
  groups: ConditionGroup[];
}

export interface FieldDefinition {
  name: string;
  type: ConditionFieldType;
  label: string;
  operators: ConditionOperator[];
}

export interface Segment {
  id: string;
  orgId: string;
  name: string;
  conditionDefinitionJson: string;
  createdAt: string;
}

export interface CreateSegmentDto {
  name: string;
  conditionDefinitionJson: string;
}

export interface SegmentPreviewResult {
  count: number;
}

export interface Campaign {
  id: string;
  orgId: string;
  segmentId: string;
  segmentName: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  createdBy: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface CreateDraftDto {
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
  campaignId: string;
  sent: number;
  errors: number;
  unsubscribes: number;
}

export interface GenerateContentRequest {
  segmentId: string;
  tone?: string;
  topic?: string;
}

export interface GenerateContentResponse {
  subject: string;
  body: string;
}
