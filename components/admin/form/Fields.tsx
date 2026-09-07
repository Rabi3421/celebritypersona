"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import styles from "@/app/admin/panel.module.css";

export type FieldErrors = Record<string, string>;

function Wrapper({
  name,
  label,
  hint,
  errors,
  wide,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: FieldErrors;
  wide?: boolean;
  children: ReactNode;
}) {
  const message = errors?.[name];
  return (
    <div className={wide ? `${styles.field} ${styles.wide}` : styles.field}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint ? <small>{hint}</small> : null}
      {message ? <p className={styles.bad}>{message}</p> : null}
    </div>
  );
}

type Base = {
  name: string;
  label: string;
  hint?: string;
  errors?: FieldErrors;
  wide?: boolean;
  defaultValue?: string | number;
  required?: boolean;
  placeholder?: string;
};

export function TextField({ type = "text", ...p }: Base & { type?: string }) {
  return (
    <Wrapper {...p}>
      <input
        id={p.name}
        name={p.name}
        type={type}
        defaultValue={p.defaultValue}
        placeholder={p.placeholder}
        required={p.required}
        aria-invalid={p.errors?.[p.name] ? true : undefined}
      />
    </Wrapper>
  );
}

export function NumberField(p: Base) {
  return <TextField {...p} type="number" />;
}

export function TextAreaField(p: Base & { rows?: number }) {
  return (
    <Wrapper {...p} wide={p.wide ?? true}>
      <textarea
        id={p.name}
        name={p.name}
        rows={p.rows}
        defaultValue={p.defaultValue}
        placeholder={p.placeholder}
        aria-invalid={p.errors?.[p.name] ? true : undefined}
      />
    </Wrapper>
  );
}

export function SelectField({
  options,
  ...p
}: Base & { options: readonly string[] }) {
  return (
    <Wrapper {...p}>
      <select id={p.name} name={p.name} defaultValue={p.defaultValue}>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

/**
 * A text field that suggests what already exists without confining you to it.
 *
 * Occasion and celebrity are open lists: the archive grows a new one whenever
 * a look is published under a name nothing else uses yet. A <select> could
 * only ever offer what has already been written down, which meant an outfit
 * could not be filed under anything new. The datalist offers the known names
 * so the common case is two keystrokes and no typo, while anything typed is
 * accepted as it stands.
 */
export function ComboField({
  options,
  ...p
}: Base & { options: readonly string[] }) {
  const listId = `${p.name}-options`;
  return (
    <Wrapper {...p}>
      <input
        id={p.name}
        name={p.name}
        list={listId}
        defaultValue={p.defaultValue}
        placeholder={p.placeholder}
        required={p.required}
        // The browser's own history would bury the list this field offers.
        autoComplete="off"
        aria-invalid={p.errors?.[p.name] ? true : undefined}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </Wrapper>
  );
}

export function CheckField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className={styles.check} htmlFor={name}>
      <input id={name} name={name} type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function SaveButton({ children = "Save" }: { children?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className={styles.saveButton} type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.formError} role="alert">
      {message}
    </p>
  );
}

/**
 * Lists everything that stopped the save. Without this a rejected form just
 * sits there and looks like nothing happened.
 */
export function ErrorSummary({ errors }: { errors?: FieldErrors }) {
  const messages = Object.entries(errors ?? {}).filter(([key]) => key !== "form");
  if (messages.length === 0) return null;

  return (
    <div className={styles.formError} role="alert">
      <strong>
        {messages.length === 1
          ? "One field needs attention"
          : `${messages.length} fields need attention`}
      </strong>
      <ul>
        {messages.map(([key, message]) => (
          <li key={key}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
