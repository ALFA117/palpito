"use client";

import { useEffect } from "react";

/**
 * The last line of defence.
 *
 * Everything this app renders comes from a third-party indexer and a testnet
 * RPC, either of which can return a shape nobody planned for. Without this, one
 * such surprise is a white page — indistinguishable, to the person looking at
 * it, from the product being broken.
 *
 * Deliberately not localised: it renders when the tree failed, and the locale
 * context is part of that tree.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("palpito crashed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-[18px] font-semibold">Algo se rompió · Something broke</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        No pudimos dibujar esta página. El dinero está en la cadena, no aquí.
        <br />
        We could not render this page. The money is on-chain, not here.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-[#191014] hover:bg-gold/90"
      >
        Reintentar · Retry
      </button>
      {error.digest && (
        <p className="mt-4 font-mono text-[10px] text-faint">{error.digest}</p>
      )}
    </div>
  );
}
