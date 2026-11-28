import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { translateValidationMessage } from "@/i18n/validation-message";
import { cn } from "@/lib/utils";

export type FieldErrorInput = string | { message?: string } | null | undefined;

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  example?: React.ReactNode;
  error?: FieldErrorInput;
  success?: React.ReactNode;
  optional?: boolean;
  counter?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactElement | ((control: FieldControlProps) => React.ReactNode);
}

const ERROR_TEXT = "text-[color:var(--color-danger-foreground,#b4232a)]";
const SUCCESS_TEXT = "text-[color:var(--color-success-foreground,#166534)]";

const INVALID_CONTROL =
  "[&_[aria-invalid=true]]:outline [&_[aria-invalid=true]]:outline-1 [&_[aria-invalid=true]]:-outline-offset-1 [&_[aria-invalid=true]]:outline-destructive";

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
