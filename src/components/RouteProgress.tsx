"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/**
 * A bar across the top while a navigation is in flight.
 *
 * Every route here is dynamic — each one awaits the indexer — so a click can
 * sit for a second with nothing on screen acknowledging it. The obvious answer
 * is `loading.tsx`, and it is the one that cost us a day: its Suspense boundary
 * left the whole page subtree as inert SSR HTML in production, so the composer
 * never hydrated. `next dev` was fine, which is why it took so long to find.
 *
 * `useLinkStatus` gets the same feedback with no boundary at all. It has to
 * live inside the `<Link>` that is pending, but the bar itself is `fixed`, so
 * it reads as a property of the page rather than of the link, and being out of
 * flow it cannot shift the layout it was dropped into.
 */
function Bar() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`route-bar${pending ? " is-pending" : ""}`} />;
}

/**
 * A `<Link>` that reports its own pending state.
 *
 * Drop-in for `next/link` on any navigation worth acknowledging.
 */
export function NavLink({ children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Bar />
    </Link>
  );
}
