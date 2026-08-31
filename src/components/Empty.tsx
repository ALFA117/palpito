/**
 * Nothing here yet, said properly.
 *
 * A bare grey sentence on a solid card reads like the page failed to load. The
 * dashed edge says "this frame is waiting to be filled" instead, and the title
 * carries the state while the body says what would put something in it.
 */
export function Empty({
  title,
  body,
  tone = "quiet",
}: {
  title: string;
  body?: string;
  tone?: "quiet" | "gold";
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed px-6 py-8 text-center ${
        tone === "gold" ? "tint-gold border-gold/30" : "border-border-bright bg-surface"
      }`}
    >
      <span
        aria-hidden
        className={`mx-auto mb-3 block h-8 w-8 rounded-full border border-dashed ${
          tone === "gold" ? "border-gold/50" : "border-border-bright"
        }`}
      />
      <p className="text-[14px] font-semibold text-text">{title}</p>
      {body && (
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">{body}</p>
      )}
    </div>
  );
}
