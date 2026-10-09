import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { translateValidationMessage } from "@/i18n/validation-message";
import { cn } from "@/lib/utils";

/** What a form library hands over as an error: a message, or an object that has one (react-hook-form's `FieldError`). */
export type FieldErrorInput = string | { message?: string } | null | undefined;

/** What a control needs to be wired to its `Field`: spread it on the control when the child is a function. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps {
  /** Text of the label. It is tied to the control with `htmlFor`, so a click on it focuses the control. */
  label: React.ReactNode;
  /** A hint under the control. */
  hint?: React.ReactNode;
  /** A sample value, written after the hint ("Example: ..."). */
  example?: React.ReactNode;
  /**
   * The error of the field, with an icon: a message, an i18n key (the schemas of the forms use keys, translated here as
   * `FormFieldError` does) or the `FieldError` of react-hook-form. While there is one the control is `aria-invalid`.
   */
  error?: FieldErrorInput;
  /** A confirmation under the control ("This address is free"), with an icon. */
  success?: React.ReactNode;
  /** Adds "(optional)" to the label: the product marks what may be left out, not what is required. */
  optional?: boolean;
  /** A small text on the right of the label (characters left). */
  counter?: React.ReactNode;
  /** Id of the control (and prefix of the ids of the messages). The `id` of the child wins, then this one, then a generated one. */
  id?: string;
  className?: string;
  /**
   * The control: one element (an `Input`, a `Select`, anything that takes `id` and `aria-*`; `register(...)` and
   * `Controller` render props go on the element as always), or a function that receives the props to spread.
   */
  children: React.ReactElement | ((control: FieldControlProps) => React.ReactNode);
}

// Text of the messages: foreground tones of the semantic tokens, with a fallback that meets AA (6.5:1 and 7.1:1 on white).
const ERROR_TEXT = "text-[color:var(--color-danger-foreground,#b4232a)]";
const SUCCESS_TEXT = "text-[color:var(--color-success-foreground,#166534)]";

// A field in error gets a red 1 px outline over its border. The border color of the controls is overridden by a global
// rule today (the `border-*` utilities do nothing), so the border alone would not show the state.
const INVALID_CONTROL =
  "[&_[aria-invalid=true]]:outline [&_[aria-invalid=true]]:outline-1 [&_[aria-invalid=true]]:-outline-offset-1 [&_[aria-invalid=true]]:outline-destructive";

/**
 * A form field: label, control, hint/example, error or confirmation. It gives the control the `id`, the
 * `aria-describedby` that points at the messages and the `aria-invalid` of the error, so none of them is written by hand.
 *
 *     <Field label={t('...')} error={errors.name}><Input {...register('name')} /></Field>
 */
export function Field({ label, hint, example, error, success, optional, counter, id, className, children }: FieldProps) {
  const { t, i18n } = useTranslation();
  const generatedId = React.useId();

  const element = React.isValidElement<Record<string, unknown>>(children) ? children : null;
  const controlId = (element?.props.id as string | undefined) ?? id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const successId = `${controlId}-success`;

  const errorText = translateValidationMessage(typeof error === "string" ? error : error?.message, t, i18n);
  const hasHint = Boolean(hint) || Boolean(example);

  const describedBy =
    [element?.props["aria-describedby"] as string | undefined, hasHint ? hintId : undefined, errorText ? errorId : undefined, success ? successId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  const control: FieldControlProps = {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": errorText ? true : undefined,
  };

  let controlNode: React.ReactNode = null;
  if (typeof children === "function") {
    controlNode = children(control);
  } else if (element) {
    controlNode = React.cloneElement(element, {
      id: controlId,
      "aria-describedby": describedBy,
      ...(errorText ? { "aria-invalid": true } : {}),
    });
  } else {
    controlNode = children;
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", INVALID_CONTROL, className)}>
      <div className="flex items-baseline gap-1.5">
        <Label htmlFor={controlId} className="leading-snug">
          {label}
        </Label>
        {optional && <span className="text-xs text-muted-foreground">{t("ui.field.optional")}</span>}
        {counter && <span className="ml-auto text-xs text-muted-foreground">{counter}</span>}
      </div>
      {controlNode}
      {hasHint && (
        <p id={hintId} className="break-words text-sm text-muted-foreground">
          {hint}
          {example && (
            <>
              {hint ? " " : null}
              {t("ui.field.example")} <code className="rounded-sm bg-muted px-1 py-px font-mono text-[0.85em]">{example}</code>
            </>
          )}
        </p>
      )}
      {errorText && (
        <p id={errorId} role="alert" className={cn("flex items-start gap-1.5 break-words text-sm", ERROR_TEXT)}>
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{errorText}</span>
        </p>
      )}
      {success && (
        <p id={successId} role="status" className={cn("flex items-start gap-1.5 break-words text-sm", SUCCESS_TEXT)}>
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{success}</span>
        </p>
      )}
    </div>
  );
}
