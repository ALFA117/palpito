import { defineChain, http } from "viem";
import { createConfig, injected } from "wagmi";
import { CHAIN_ID, RPC_URL } from "./somnia";

export const somniaTestnet = defineChain({
  id: CHAIN_ID,
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" },
  },
  testnet: true,
});

/**
 * Injected connectors only.
 *
 * No WalletConnect: it needs a project id and a relay round-trip, and this is a
 * testnet app whose users arrive with an extension already installed. One
 * connector also means the connect button never has to ask a first-time visitor
 * to choose between things they have not heard of.
 */
export const wagmiConfig = createConfig({
  chains: [somniaTestnet],
  connectors: [injected()],
  transports: { [somniaTestnet.id]: http(RPC_URL) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
