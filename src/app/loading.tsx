/**
 * Shown while the feed's server component waits on the indexer.
 *
 * Shaped like the page it replaces rather than a spinner, so arriving content
 * does not shove the layout around.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-28 rounded-xl border border-border bg-surface" />
      <div className="mt-4 h-72 rounded-xl border border-border bg-surface" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
