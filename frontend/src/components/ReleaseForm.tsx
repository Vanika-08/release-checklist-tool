import { useState, type FormEvent } from "react";

export interface ReleaseFormValues { name: string; date: string; additionalInfo: string }
const NAME_MAX = 200;

/** Shared by create and edit. `date` is a datetime-local string. */
export function ReleaseForm({
  initial,
  submitLabel,
  busyLabel,
  busy,
  showInfo = true,
  onSubmit,
  onCancel,
}: {
  initial: ReleaseFormValues;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  showInfo?: boolean;
  onSubmit: (v: ReleaseFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ReleaseFormValues, string>>>({});
  const set = (k: keyof ReleaseFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = "Enter a release name.";
    else if (values.name.trim().length > NAME_MAX) next.name = `Keep it under ${NAME_MAX} characters.`;
    if (!values.date || Number.isNaN(new Date(values.date).getTime())) next.date = "Pick a due date and time.";
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit(values);
  }

  return (
    <form onSubmit={submit} noValidate className="form">
      <label className="field">
        <span className="field__label">Name</span>
        <input
          autoFocus
          value={values.name}
          onChange={set("name")}
          placeholder="Version 2.4.0"
          aria-invalid={!!errors.name}
          maxLength={NAME_MAX + 20}
        />
        {errors.name && <span className="field__error">{errors.name}</span>}
      </label>
      <label className="field">
        <span className="field__label">Due date</span>
        <input type="datetime-local" value={values.date} onChange={set("date")} aria-invalid={!!errors.date} />
        {errors.date && <span className="field__error">{errors.date}</span>}
      </label>
      {showInfo && (
        <label className="field">
          <span className="field__label">Additional information <span className="muted">(optional)</span></span>
          <textarea
            rows={4}
            value={values.additionalInfo}
            onChange={set("additionalInfo")}
            placeholder="Rollback plan, dependencies, owners…"
          />
        </label>
      )}
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
      </div>
    </form>
  );
}
