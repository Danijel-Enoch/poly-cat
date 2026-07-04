"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keccak256, maxUint256, toHex } from "viem";
import { useAccount, useReadContract, useSignMessage, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, usdcContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { encodeMetadataURI, type Category } from "@/lib/category";
import { formatUsdc, formatDate } from "@/lib/format";
import { importRequestMessage } from "@/lib/adminImportMessage";
import { currentTimestamp } from "@/lib/adminVerifyMessage";

type ImportCandidate = {
  question: string;
  category: Category;
  closeTimeSeconds: number;
  polymarketId: string;
  sourceUrl: string;
};

type ImportPlanResponse = {
  candidates: ImportCandidate[];
  maxAffordable: number;
  liquidityPerMarket: string;
  collateralToken: `0x${string}`;
  usdcBalance: string;
  ethBalance: string;
  lowEthWarning: boolean;
};

type CandidateStatus = "pending" | "success" | "failed";

export function PolymarketImportPanel() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [countInput, setCountInput] = useState("");
  const [plan, setPlan] = useState<ImportPlanResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    ...usdcContract,
    functionName: "allowance",
    args: address ? [address, marketFactoryContract.address] : undefined,
    query: { enabled: !!address },
  });

  const selectedCandidates = useMemo(
    () => (plan?.candidates ?? []).filter((c) => selectedIds.has(c.polymarketId)),
    [plan, selectedIds],
  );

  async function handleFetch() {
    if (!address) return;
    setFetching(true);
    setStatus(null);
    setPlan(null);
    setStatuses({});
    try {
      const trimmed = countInput.trim();
      const count = trimmed === "" ? null : Number(trimmed);
      const timestamp = currentTimestamp();
      const message = importRequestMessage(count, timestamp);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/admin/import-polymarket-markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, timestamp, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch candidates");
      setPlan(data);
      setSelectedIds(new Set((data.candidates as ImportCandidate[]).map((c) => c.polymarketId)));
      if (data.candidates.length === 0) {
        setStatus("No new major markets to propose right now.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to fetch candidates");
    } finally {
      setFetching(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateSelected() {
    if (!plan || selectedCandidates.length === 0) return;
    setCreating(true);
    setStatus(null);

    const liquidityPerMarket = BigInt(plan.liquidityPerMarket);
    const totalNeeded = liquidityPerMarket * BigInt(selectedCandidates.length);

    try {
      if (!allowance || allowance < totalNeeded) {
        setStatus(`Approving ${COLLATERAL_SYMBOL}...`);
        const approveHash = await writeContractAsync({
          ...usdcContract,
          functionName: "approve",
          args: [marketFactoryContract.address, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        await refetchAllowance();
      }

      let succeeded = 0;
      let failed = 0;
      for (const candidate of selectedCandidates) {
        setStatuses((prev) => ({ ...prev, [candidate.polymarketId]: "pending" }));
        setStatus(`Creating "${candidate.question}"...`);
        try {
          const hash = await writeContractAsync({
            ...marketFactoryContract,
            functionName: "createMarket",
            args: [
              {
                collateralToken: plan.collateralToken,
                questionHash: keccak256(toHex(candidate.question)),
                metadataURI: encodeMetadataURI(candidate.category, candidate.question),
                closeTime: BigInt(candidate.closeTimeSeconds),
                initialLiquidity: liquidityPerMarket,
              },
            ],
            value: 0n,
          });
          await waitForTransactionReceipt(wagmiConfig, { hash });
          setStatuses((prev) => ({ ...prev, [candidate.polymarketId]: "success" }));
          succeeded += 1;
        } catch {
          // Keep going — one failed tx (e.g. a rejected signature) shouldn't
          // abort the rest of the batch.
          setStatuses((prev) => ({ ...prev, [candidate.polymarketId]: "failed" }));
          failed += 1;
        }
      }

      setStatus(`Created ${succeeded} market${succeeded === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}.`);
      await queryClient.invalidateQueries({ queryKey: ["adminMarkets"] });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="number"
          min={1}
          value={countInput}
          onChange={(e) => setCountInput(e.target.value)}
          placeholder="Number of markets (blank = as many as balance affords)"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
        <button
          type="button"
          disabled={fetching || !address}
          onClick={handleFetch}
          className="rounded-lg bg-accent hover:bg-accent-dark text-gray-900 text-sm font-semibold px-4 py-2 disabled:opacity-50 whitespace-nowrap"
        >
          {fetching ? "Fetching..." : "Fetch candidates"}
        </button>
      </div>

      {plan && (
        <>
          <p className="text-xs text-gray-500">
            Balance: {formatUsdc(plan.usdcBalance)} {COLLATERAL_SYMBOL} — seeding each market with{" "}
            {formatUsdc(plan.liquidityPerMarket)} {COLLATERAL_SYMBOL} (up to {plan.maxAffordable} affordable).
            {plan.lowEthWarning && " Low ETH balance — you may not have enough for gas."}
          </p>

          {plan.candidates.length > 0 && (
            <div className="flex flex-col gap-2">
              {plan.candidates.map((c) => {
                const candidateStatus = statuses[c.polymarketId];
                return (
                  <label
                    key={c.polymarketId}
                    className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.polymarketId)}
                      onChange={() => toggleSelected(c.polymarketId)}
                      disabled={creating}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-100">{c.question}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.category} · Closes {formatDate(BigInt(c.closeTimeSeconds))} ·{" "}
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                          Source
                        </a>
                      </p>
                    </div>
                    {candidateStatus && (
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          candidateStatus === "success"
                            ? "text-emerald-400"
                            : candidateStatus === "failed"
                              ? "text-rose-400"
                              : "text-gray-400"
                        }`}
                      >
                        {candidateStatus === "pending" ? "Creating..." : candidateStatus === "success" ? "Created" : "Failed"}
                      </span>
                    )}
                  </label>
                );
              })}

              <button
                type="button"
                disabled={creating || selectedCandidates.length === 0}
                onClick={handleCreateSelected}
                className="self-start rounded-lg bg-accent hover:bg-accent-dark text-gray-900 text-sm font-semibold px-4 py-2 disabled:opacity-50"
              >
                {creating ? "Creating..." : `Create selected (${selectedCandidates.length})`}
              </button>
            </div>
          )}
        </>
      )}

      {status && <p className="text-sm text-gray-400">{status}</p>}
    </div>
  );
}
