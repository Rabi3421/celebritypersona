export class CatalogSaveError extends Error {
  readonly field: string;
  constructor(message: string, field = "form") { super(message); this.name = "CatalogSaveError"; this.field = field; }
}

/** Never turn an arbitrary duplicate key into reuse of a different record. */
export function catalogFailure(error: unknown): Error {
  if (error instanceof CatalogSaveError) return error;
  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    const pattern = "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object" ? error.keyPattern as Record<string, unknown> : {};
    if (Object.keys(pattern).join() === "slug") return new CatalogSaveError("Another look already uses this slug. Choose a different slug and retry.", "slug");
    if (Object.keys(pattern).join() === "name") return new CatalogSaveError("A related name conflicts with the name index. Reload and verify the exact identity; nothing in this transaction was saved.");
    return new CatalogSaveError("A database uniqueness constraint conflicted with another writer. Reload and check existing records before retrying; this transaction was rolled back.");
  }
  if (error && typeof error === "object" && "code" in error && error.code === 121) return new CatalogSaveError("Database validation rejected a record. This transaction was rolled back; correct the details before retrying.");
  return new CatalogSaveError("The save could not be confirmed. Check the outfit list before retrying. Do not create a second request to work around an uncertain save.");
}
