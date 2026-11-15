/** Shared, conservative identity rules; no accent, punctuation or alias folding. */
export const archiveName = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ");
export const archiveIdentity = (value: string) => archiveName(value).toLowerCase();
