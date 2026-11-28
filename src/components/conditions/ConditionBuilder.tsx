import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FieldSelect } from './FieldSelect';
import { Plus, Trash2 } from 'lucide-react';
import type { ConditionGroup, ConditionRule, FieldDefinition, GroupOperator } from '@/types/condition';

export interface ConditionBuilderProps {
  fields: FieldDefinition[];
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  previewCount?: number;
  previewLoading?: boolean;
  level?: number;
  onRemove?: () => void;
}

export function ConditionBuilder({
  fields,
  group,
  onChange,
  previewCount,
  previewLoading,
  level = 0,
  onRemove,
}: ConditionBuilderProps) {
  const { t } = useTranslation();

  const handleOperatorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...group,
      operator: event.target.value as GroupOperator,
    });
  };

  const handleAddRule = () => {
    const newRule: ConditionRule = {
      field: '',
      operator: 'Equals',
      value: '',
    };

    onChange({
      ...group,
      conditions: [...group.conditions, newRule],
    });
  };

  const handleRemoveRule = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const handleRuleChange = (index: number, rule: ConditionRule) => {
    const newConditions = [...group.conditions];
    newConditions[index] = rule;

    onChange({
      ...group,
      conditions: newConditions,
    });
  };

  const handleAddGroup = () => {
    const newGroup: ConditionGroup = {
      operator: 'AND',
      conditions: [],
    };

    onChange({
      ...group,
      groups: [...(group.groups || []), newGroup],
    });
  };

  const handleRemoveGroup = (index: number) => {
    onChange({
      ...group,
      groups: (group.groups || []).filter((_, i) => i !== index),
    });
  };

  const handleGroupChange = (index: number, updatedGroup: ConditionGroup) => {
    const newGroups = [...(group.groups || [])];
    newGroups[index] = updatedGroup;

    onChange({
      ...group,
      groups: newGroups,
    });
  };

  const canAddNestedGroup = level < 2;

  return (
    <div
      className={`space-y-3 ${level > 0 ? 'rounded-md border border-input bg-muted/30 p-4' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Select
          value={group.operator}
          onChange={handleOperatorChange}
          wrapperClassName="w-24"
          size="sm"
        >
          <option value="AND">{t('condition.group.and')}</option>
          <option value="OR">{t('condition.group.or')}</option>
        </Select>

        {level > 0 && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            type="button"
            className="ml-auto"
          >
            <Trash2 className="mr-2 size-4" />
            {t('condition.remove_group')}
          </Button>
        )}

        {level === 0 && previewCount !== undefined && (
          <div className="ml-auto text-sm text-muted-foreground">
            {previewLoading
              ? t('condition.preview_loading')
              : t('condition.preview_count', { count: previewCount })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {group.conditions.map((rule, index) => (
          <FieldSelect
            key={index}
            fields={fields}
            rule={rule}
            onChange={(updatedRule) => handleRuleChange(index, updatedRule)}
            onRemove={() => handleRemoveRule(index)}
          />
        ))}
      </div>

      {group.groups && group.groups.length > 0 && (
        <div className="space-y-2">
          {group.groups.map((nestedGroup, index) => (
            <ConditionBuilder
              key={index}
              fields={fields}
              group={nestedGroup}
              onChange={(updatedGroup) => handleGroupChange(index, updatedGroup)}
              level={level + 1}
              onRemove={() => handleRemoveGroup(index)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleAddRule} type="button">
          <Plus className="mr-2 size-4" />
          {t('condition.add_rule')}
        </Button>

        {canAddNestedGroup && (
          <Button variant="outline" size="sm" onClick={handleAddGroup} type="button">
            <Plus className="mr-2 size-4" />
            {t('condition.add_group')}
          </Button>
        )}
      </div>
    </div>
  );
}
