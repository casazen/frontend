export type ConditionFieldType = 'Text' | 'Number' | 'Date' | 'Boolean' | 'Enum' | 'Set';

export type ConditionOperator =
  | 'Equals'
  | 'NotEquals'
  | 'GreaterThan'
  | 'LessThan'
  | 'Between'
  | 'Contains'
  | 'NotContains'
  | 'Before'
  | 'After'
  | 'InLast'
  | 'In'
  | 'NotIn'
  | 'Is'
  | 'IsNot';

export interface FieldDefinition {
  field: string;
  type: ConditionFieldType;
  operators: ConditionOperator[];
  label?: string;
}

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[] | number[];
}

export type GroupOperator = 'AND' | 'OR';

export interface ConditionGroup {
  operator: GroupOperator;
  conditions: ConditionRule[];
  groups?: ConditionGroup[];
}

export interface Condition {
  version: number;
  groups: ConditionGroup[];
}
