"use client";

import { createPublicClient, http } from "viem";
import { somniaTestnet } from "./chain";
import { RPC_URL } from "./somnia";

/**
 * One HTTP client for every chain read the app makes.
 *
 * Deliberately not the SDK's: that one routes all chain access over a WebSocket
 * (it throws `NotConfiguredError` without `wsRpcUrl`, and an HTTP rpcUrl on the
 * chain config is not accepted), and that path hangs indefinitely in a browser
 * while working fine from Node. Everything read here is an `eth_call`.
 */
export const rpc = createPublicClient({ chain: somniaTestnet, transport: http(RPC_URL) });
