/** A web address's site name, for a short link label. */
export const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Research text with each long address shown as a short link named by its site. */
export function LinkedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+[^\s).,;:'"])/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 ? (
          <a key={index} href={part} target="_blank" rel="noreferrer" className={className} title={part}>
            {siteOf(part)} ↗
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
