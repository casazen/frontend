import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { FieldDefinition, ConditionRule, ConditionOperator } from '@/types/condition';

export interface FieldSelectProps {
  /** The available fields from the catalog */
  fields: FieldDefinition[];
  /** Current rule value */
  rule: ConditionRule;
  /** Called when the rule changes */
  onChange: (rule: ConditionRule) => void;
  /** Called when remove button is clicked */
  onRemove: () => void;
}

export function FieldSelect({ fields, rule, onChange, onRemove }: FieldSelectProps) {
  const { t } = useTranslation();
  const selectedField = fields.find((f) => f.field === rule.field);
  const availableOperators = selectedField?.operators || [];

  const handleFieldChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newField = event.target.value;
    const field = fields.find((f) => f.field === newField);
    // Reset operator and value when field changes
    onChange({
      field: newField,
      operator: field?.operators[0] || 'Equals',
      value: '',
    });
  };

  const handleOperatorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...rule,
      operator: event.target.value as ConditionOperator,
    });
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    // Convert value based on field type
    let convertedValue: string | number | boolean = value;

    if (selectedField?.type === 'Number') {
      convertedValue = value === '' ? '' : Number(value);
    }

    onChange({
      ...rule,
      value: convertedValue,
    });
  };

  const handleBooleanChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...rule,
      value: event.target.value === 'true',
    });
  };

  const renderValueInput = () => {
    if (!selectedField) return null;

    const { type } = selectedField;

    // Boolean field
    if (type === 'Boolean') {
      return (
        <Select value={String(rule.value)} onChange={handleBooleanChange} className="flex-1">
          <option value="true">{t('condition.value.true')}</option>
          <option value="false">{t('condition.value.false')}</option>
        </Select>
      );
    }

    // Number field
    if (type === 'Number') {
      return (
        <Input
          type="number"
          value={rule.value as number}
          onChange={handleValueChange}
          className="flex-1"
          placeholder={t('condition.placeholder.number')}
        />
      );
    }

    // Date field
    if (type === 'Date') {
      return (
        <Input
          type="date"
          value={rule.value as string}
          onChange={handleValueChange}
          className="flex-1"
        />
      );
    }

    // Text, Enum, Set - default to text input
    // TODO: For Set/Enum types, implement multi-select or dropdown
    return (
      <Input
        type="text"
        value={rule.value as string}
        onChange={handleValueChange}
        className="flex-1"
        placeholder={t('condition.placeholder.value')}
      />
    );
  };

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Select value={rule.field} onChange={handleFieldChange} wrapperClassName="min-w-40 flex-1">
        <option value="">{t('condition.select_field')}</option>
        {fields.map((field) => (
          <option key={field.field} value={field.field}>
            {field.label || field.field}
          </option>
        ))}
      </Select>

      <Select
        value={rule.operator}
        onChange={handleOperatorChange}
        wrapperClassName="min-w-32 flex-1"
        disabled={!selectedField}
      >
        <option value="">{t('condition.select_operator')}</option>
        {availableOperators.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </Select>

      {renderValueInput()}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        type="button"
        aria-label={t('condition.remove_rule')}
        className="shrink-0"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
