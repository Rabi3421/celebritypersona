/**
 * A small strict validator for JSON written by AI tools or edited by hand.
 *
 * Strict means: unknown keys are errors (so `__proto__`, `constructor` and
 * misspelt fields never slip through), every string has a length cap, every
 * array a size cap, enums are closed, and links must be plain https
 * addresses. It reports every problem with its path rather than stopping at
 * the first, so the person can hand the list back to the tool that wrote it.
 */

export type Schema =
  | { k: "str"; max: number; min?: number; re?: RegExp; enum?: readonly string[]; opt?: boolean }
  | { k: "num"; min: number; max: number; int?: boolean; opt?: boolean }
  | { k: "bool"; opt?: boolean }
  | { k: "url"; opt?: boolean }
  | { k: "date"; opt?: boolean }
  | { k: "obj"; props: Record<string, Schema>; opt?: boolean }
  | { k: "arr"; of: Schema; max: number; opt?: boolean }
  | { k: "lit"; value: string | number | boolean; opt?: boolean };

export const str = (max: number, more: Partial<Extract<Schema, { k: "str" }>> = {}): Schema => ({ k: "str", max, ...more });
export const num = (min: number, max: number, more: { int?: boolean; opt?: boolean } = {}): Schema => ({ k: "num", min, max, ...more });
export const bool = (opt = false): Schema => ({ k: "bool", opt });
export const url = (opt = false): Schema => ({ k: "url", opt });
export const date = (opt = false): Schema => ({ k: "date", opt });
export const obj = (props: Record<string, Schema>, opt = false): Schema => ({ k: "obj", props, opt });
export const arr = (of: Schema, max: number, opt = false): Schema => ({ k: "arr", of, max, opt });
export const lit = (value: string | number | boolean): Schema => ({ k: "lit", value });
export const optional = <S extends Schema>(schema: S): S => ({ ...schema, opt: true });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A source link: https, a real hostname, no credentials, no spaces, at most 500 characters. */
export function httpsProblem(value: string): string | null {
  if (value.length > 500) return "is longer than 500 characters";
  if (/\s/.test(value)) return "contains spaces";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "is not a valid address";
  }
  if (parsed.protocol !== "https:") return "must start with https://";
  if (parsed.username || parsed.password) return "must not contain a username or password";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.hostname)) return "must name a website";
  return null;
}

export function validate(value: unknown, schema: Schema, path = "$", errors: string[] = []): string[] {
  if (value === undefined || value === null) {
    if (!schema.opt) errors.push(`${path}: required`);
    return errors;
  }
  switch (schema.k) {
    case "lit":
      if (value !== schema.value) errors.push(`${path}: must be ${JSON.stringify(schema.value)}`);
      break;
    case "str":
      if (typeof value !== "string") errors.push(`${path}: must be text`);
      else if (value.length > schema.max) errors.push(`${path}: longer than ${schema.max} characters`);
      else if (schema.min !== undefined && value.trim().length < schema.min) errors.push(`${path}: must not be empty`);
      else if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of ${schema.enum.join(", ")}`);
      else if (schema.re && !schema.re.test(value)) errors.push(`${path}: has the wrong format`);
      break;
    case "num":
      if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`${path}: must be a number`);
      else if (schema.int && !Number.isInteger(value)) errors.push(`${path}: must be a whole number`);
      else if (value < schema.min || value > schema.max) errors.push(`${path}: must be between ${schema.min} and ${schema.max}`);
      break;
    case "bool":
      if (typeof value !== "boolean") errors.push(`${path}: must be true or false`);
      break;
    case "date":
      if (typeof value !== "string" || !DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) errors.push(`${path}: must be a date, YYYY-MM-DD`);
      break;
    case "url": {
      const problem = typeof value === "string" ? httpsProblem(value) : "must be text";
      if (problem) errors.push(`${path}: ${problem}`);
      break;
    }
    case "arr":
      if (!Array.isArray(value)) errors.push(`${path}: must be a list`);
      else if (value.length > schema.max) errors.push(`${path}: at most ${schema.max} entries`);
      else value.forEach((item, i) => validate(item, schema.of, `${path}[${i}]`, errors));
      break;
    case "obj": {
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path}: must be an object`);
        break;
      }
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (!Object.prototype.hasOwnProperty.call(schema.props, key)) errors.push(`${path}: unexpected field “${key.slice(0, 40)}”`);
      }
      for (const [key, sub] of Object.entries(schema.props)) validate(record[key], sub, `${path}.${key}`, errors);
      break;
    }
  }
  return errors;
}

export const MAX_FILE_BYTES = 512 * 1024;

/** Text → JSON, refusing oversized input before parsing it. */
export function parseJsonText(text: string, maxBytes = MAX_FILE_BYTES): { ok: true; value: unknown } | { ok: false; error: string } {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxBytes) return { ok: false, error: `The file is ${Math.round(bytes / 1024)} KB; the limit is ${Math.round(maxBytes / 1024)} KB.` };
  try {
    return { ok: true, value: JSON.parse(text.replace(/^﻿/, "")) };
  } catch (error) {
    return { ok: false, error: `Not valid JSON: ${(error as Error).message.slice(0, 160)}` };
  }
}
