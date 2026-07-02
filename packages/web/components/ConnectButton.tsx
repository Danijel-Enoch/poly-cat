"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="text-sm font-medium px-3 py-2 rounded-full border border-gray-700 text-gray-300 hover:bg-gray-800"
      >
        {shortenAddress(address)}
      </button>
    );
  }

  const connector = connectors[0];

  return (
    <button
      onClick={() => connector && connect({ connector })}
      disabled={!connector || isPending}
      className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-700 text-gray-100 hover:bg-gray-800 disabled:opacity-50"
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
