"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { wagmiConfig } from "@/lib/chain";
import { getExchange } from "@/lib/trade";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  // One client per browser session, created lazily so it is never shared across
  // requests on the server.
  const [queryClient] = useState(() => new QueryClient());
  // Built lazily and once: the exchange opens a WebSocket to the chain, and the
  // SDK's realtime hooks ref-count their watches off this single client.
  const [marketsClient] = useState(() => getExchange().client);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SomniaMarketsProvider client={marketsClient}>{children}</SomniaMarketsProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
