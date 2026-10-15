"use client";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "./ui/button";
import { toast } from "sonner";
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "date"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "multiselect";
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  disabled?: boolean;
  wide?: boolean;
  min?: number;
  max?: number;
};
export function RecordForm({
  fields,
  defaults,
  onSubmit,
  submitLabel = "Save changes",
  children,
  readOnly = false,
}: {
  fields: Field[];
  defaults: Record<string, string>;
  onSubmit: (v: Record<string, string>) => void;
  submitLabel?: string;
  children?: React.ReactNode;
  readOnly?: boolean;
}) {
  const schema = z.record(z.string(), z.string()).superRefine((v, ctx) => {
    for (const f of fields) {
      const value = v[f.name] ?? "";
      const err =
        f.required && !value.trim()
          ? `${f.label} is required.`
          : f.type === "email" && value && !z.email().safeParse(value).success
            ? "Enter a valid email address."
            : f.type === "number" &&
                value &&
                (Number.isNaN(Number(value)) ||
                  (f.min !== undefined && Number(value) < f.min) ||
                  (f.max !== undefined && Number(value) > f.max))
              ? `Enter a number${f.min !== undefined ? ` of at least ${f.min}` : ""}${f.max !== undefined ? ` and at most ${f.max}` : ""}.`
              : undefined;
      if (err) ctx.addIssue({ code: "custom", path: [f.name], message: err });
    }
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });
  return (
    <form
      onSubmit={handleSubmit((v) => {
        try {
          if (readOnly) return;
          onSubmit(v);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Unable to save.");
        }
      })}
      className="record-form"
    >
      <div className="form-grid">
        {fields.map((f) => (
          <div
            key={f.name}
            className={`field ${f.wide || f.type === "textarea" ? "field-wide" : ""}`}
          >
            <label htmlFor={`field-${f.name}`}>
              {f.label}
              {f.required && <span className="required"> *</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                id={`field-${f.name}`}
                rows={3}
                disabled={readOnly || f.disabled}
                {...register(f.name)}
              />
            ) : f.type === "select" ? (
              <select
                id={`field-${f.name}`}
                disabled={readOnly || f.disabled}
                {...register(f.name)}
              >
                {!f.required && <option value="">None</option>}
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "multiselect" ? (
              <Controller
                control={control}
                name={f.name}
                render={({ field }) => (
                  <select
                    id={`field-${f.name}`}
                    multiple
                    disabled={readOnly || f.disabled}
                    value={(field.value ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)}
                    onChange={(e) =>
                      field.onChange(
                        Array.from(e.target.selectedOptions)
                          .map((o) => o.value)
                          .join(", "),
                      )
                    }
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            ) : f.type === "checkbox" ? (
              <Controller
                control={control}
                name={f.name}
                render={({ field }) => (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      id={`field-${f.name}`}
                      disabled={readOnly || f.disabled}
                      checked={field.value === "true"}
                      onChange={(e) => field.onChange(String(e.target.checked))}
                    />
                    {f.hint ?? "Enabled"}
                  </label>
                )}
              />
            ) : (
              <input
                id={`field-${f.name}`}
                type={f.type ?? "text"}
                disabled={readOnly || f.disabled}
                min={f.min}
                max={f.max}
                {...register(f.name)}
              />
            )}{" "}
            {f.hint && f.type !== "checkbox" && (
              <p className="field-hint">{f.hint}</p>
            )}
            {errors[f.name] && (
              <p className="field-error" role="alert">
                {errors[f.name]?.message}
              </p>
            )}
          </div>
        ))}
      </div>
      {children}
      <div className="form-footer">
        <span>
          {readOnly ? "Viewing a shared record" : "Saved in this browser"}
        </span>
        {!readOnly && (
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
