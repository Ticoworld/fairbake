"use client";

import {
  ArrowUpRight,
  Check,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { getSaleStatus, STATUS } from "@/lib/config";
import {
  formatCountdown,
  formatDate,
  formatTokenAmount,
  formatUnits,
  shorten,
  parseUnits,
} from "@/lib/format";
import { useBuyerPosition, useChainTime, useSale } from "@/lib/queries";
import { connection } from "@/lib/rpc";
import { useWallet, useWalletSigner } from "@/lib/wallet";
import {
  buy,
  claim,
  finalizeSale,
  withdrawInventory,
  withdrawProceeds,
  readableTransactionError,
} from "@/lib/transactions";
import { explorer } from "@/lib/explorer";
import { settlementWithPrefix } from "@/lib/settlement";
import { StatusLabel, StatusPill } from "./status-pill";

export function LaunchPage({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const saleQuery = useSale(address);
  const { publicKey, state } = useWallet();
  const signer = useWalletSigner();
  const positionQuery = useBuyerPosition(address, publicKey);
  const chainTimeQuery = useChainTime();
  const [contribution, setContribution] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const mintQuery = useQuery({
    queryKey: ["mint-info", saleQuery.data?.data.mint.toBase58()],
    queryFn: async () => {
      const mint = await getMint(
        connection,
        saleQuery.data!.data.mint,
        "confirmed",
      );
      return { decimals: mint.decimals };
    },
    enabled: Boolean(saleQuery.data),
    staleTime: 300_000,
  });
  const sale = saleQuery.data;
  const decimals = mintQuery.data?.decimals ?? 0;
  const status = sale
    ? getSaleStatus(
        sale.data.status,
        sale.data.startTime,
        sale.data.endTime,
        chainTimeQuery.data === undefined
          ? undefined
          : BigInt(chainTimeQuery.data),
      )
    : null;
  const now = useNow();
  const countdown =
    sale && status
      ? status === "UPCOMING"
        ? Number(sale.data.startTime) - now
        : status === "LIVE"
          ? Number(sale.data.endTime) - now
          : 0
      : 0;
  const progress = sale
    ? Math.min(
        100,
        Number(
          (sale.data.totalCommitted * 10000n) / (sale.data.hardCap || 1n),
        ) / 100,
      )
    : 0;
  const subscriptionPercent = sale?.data.hardCap
    ? Number((sale.data.totalCommitted * 10000n) / sale.data.hardCap) / 100
    : 0;
  const oversubscribed = Boolean(sale && sale.data.totalCommitted > sale.data.hardCap);
  const estimated = useMemo(() => {
    if (!sale || !contribution) return null;
    try {
      const value = parseUnits(contribution, 9);
      if (value <= 0n) return null;
      const result = settlementWithPrefix(
        value,
        sale.data.saleSupply,
        sale.data.hardCap,
        sale.data.totalCommitted + value,
        sale.data.totalCommitted,
      );
      return { ...result, value };
    } catch {
      return null;
    }
  }, [contribution, sale]);

  async function act(
    kind: string,
    action: () => Promise<{ signature: string }>,
  ) {
    setBusy(kind);
    setError(null);
    setTxSignature(null);
    try {
      const result = await action();
      setTxSignature(result.signature);
      await Promise.all([
        saleQuery.refetch(),
        positionQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["created-sales"] }),
      ]);
    } catch (cause) {
      setError(readableTransactionError(cause));
    } finally {
      setBusy(null);
    }
  }

  if (saleQuery.isLoading) return <LaunchSkeleton />;
  if (saleQuery.error || !sale || !status)
    return (
      <main className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="panel p-10">
          <p className="eyebrow">Launch unavailable</p>
          <h1 className="mt-3 text-3xl font-semibold">
            This sale could not be read.
          </h1>
          <p className="mt-3 text-sm leading-6 text-moss">
            No mock data is shown when the RPC cannot verify the address.
          </p>
        </div>
      </main>
    );
  const isCreator = Boolean(publicKey && publicKey.equals(sale.data.creator));
  const canTransact = state === "CONNECTED_COOKIE" && Boolean(signer);
  const buyerPosition = positionQuery.data?.data;
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_390px]">
        <div className="order-2 lg:order-1">
          <section className="surface-dark relative min-h-[270px] overflow-hidden border border-[#354333] p-6 sm:p-8">
            <div className="absolute -bottom-16 -right-4 select-none text-[19rem] font-black leading-none tracking-[-0.16em] text-white/[0.045]">
              {(sale.metadata?.symbol?.trim() || sale.metadata?.name?.trim() || "M").slice(0, 1)}
            </div>
            <div className="relative z-10 flex h-full min-h-[206px] flex-col justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={status} />
                {oversubscribed && <StatusLabel label="OVERSUBSCRIBED" tone="orange" />}
                <span className="font-mono text-xs text-[#a6b29e]">
                  Sale {shorten(sale.address.toBase58(), 8, 6)}
                </span>
              </div>
              <div className="relative z-10 mt-14 flex items-end gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-white/15 bg-white/10 text-xl font-bold text-[#c7f36d]">
                  {sale.metadata?.image ? (
                    <img
                      src={sale.metadata.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (sale.metadata?.symbol?.trim() || sale.metadata?.name?.trim() || "M").slice(0, 1)
                  )}
                </div>
                <div>
                  <h1 className="text-4xl font-semibold tracking-[-0.055em] text-paper sm:text-5xl">
                    {sale.metadata?.name?.trim() ||
                      (sale.metadata?.symbol?.trim()
                        ? `$${sale.metadata.symbol.trim()}`
                        : `Mint ${shorten(sale.data.mint.toBase58(), 6, 4)}`)}
                  </h1>
                  <p className="mt-2 font-mono text-sm text-[#a6b29e]">
                    {sale.metadata?.symbol?.trim() ? `$${sale.metadata.symbol.trim()} · ` : ""}
                    <a
                      className="underline decoration-white/25 underline-offset-4"
                      href={explorer.mint(sale.data.mint.toBase58())}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shorten(sale.data.mint.toBase58(), 8, 6)}
                    </a>
                  </p>
                </div>
              </div>
              <p className="hidden">
                Fixed price · pro-rata settlement at close · excess demand is
                refunded.
              </p>
            </div>
          </section>
          <div className="mt-8 panel p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Demand</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                  {formatUnits(sale.data.totalCommitted, 9)}{" "}
                  <span className="text-base font-medium text-moss">COOK</span>
                </p>
              </div>
              <p className="text-sm text-moss">
                {formatUnits(sale.data.hardCap, 9)} COOK hard cap
              </p>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-cream">
              <div
                className={`h-full rounded-full transition-all ${status === "SUCCESS" ? "bg-[#4f7547]" : status === "FAILED" ? "bg-[#c34d35]" : "bg-ink"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-moss sm:grid-cols-4">
              <Fact label="Total contributed" value={`${formatUnits(sale.data.totalCommitted, 9)} COOK`} />
              <Fact label="Hard cap" value={`${formatUnits(sale.data.hardCap, 9)} COOK`} />
              <Fact label="Participants" value={sale.data.buyerCount.toString()} />
              <Fact label="Subscription" value={`${subscriptionPercent.toFixed(1)}%`} />
            </div>
            {oversubscribed && <p className="mt-5 text-sm text-[#a34c38]">Contributions will settle pro-rata and excess COOK will be refunded.</p>}
            <div className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
              <Fact
                label="Sale allocation"
                value={`${formatTokenAmount(sale.data.saleSupply, decimals)} ${sale.metadata?.symbol ?? "tokens"}`}
              />
              <Fact
                label="Minimum raise"
                value={`${formatUnits(sale.data.minimumRaise, 9)} COOK`}
              />
              <Fact
                label="Per wallet"
                value={`${formatUnits(sale.data.maxPerWallet, 9)} COOK`}
              />
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="panel p-5">
              <p className="eyebrow">Sale timing</p>
              <p className="mt-3 text-sm font-semibold">
                {formatDate(sale.data.startTime)}
              </p>
              <p className="mt-1 text-sm text-moss">
                to {formatDate(sale.data.endTime)}
              </p>
              {countdown > 0 && (
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
                  <Clock3 size={16} className="text-orange" />
                  {status === "UPCOMING" ? "Starts in" : "Ends in"}{" "}
                  {formatCountdown(countdown)}
                </div>
              )}
            </div>
            <div className="panel p-5">
              <p className="eyebrow">Supply integrity</p>
              <div className="mt-4 grid gap-3 text-sm">
                <Integrity label="Minting" />
                <Integrity label="Freezing" />
                <Integrity label="Terms" />
              </div>
            </div>
          </div>
          <Activity sale={sale} />
        </div>
        <aside className="order-1 space-y-4 lg:order-2">
          <ParticipationCard
            status={status}
            sale={sale}
            decimals={decimals}
            position={buyerPosition}
            contribution={contribution}
            setContribution={setContribution}
            estimated={estimated}
            canTransact={canTransact}
            busy={busy}
            onBuy={() => {
              if (!estimated) return;
              void act("buy", async () =>
                buy(signer!, sale.address, sale.data.mint, estimated.value),
              );
            }}
            onFinalize={() =>
              void act("finalize", () => finalizeSale(signer!, sale.address))
            }
            onClaim={() =>
              void act("claim", () =>
                claim(signer!, sale.address, buyerPosition!, sale.data.mint),
              )
            }
          />
          {isCreator && (
            <CreatorCard
              sale={sale}
              canTransact={canTransact}
              busy={busy}
              onProceeds={() =>
                void act("proceeds", () =>
                  withdrawProceeds(signer!, sale.address),
                )
              }
              onInventory={() =>
                void act("inventory", () =>
                  withdrawInventory(
                    signer!,
                    sale.address,
                    sale.data.mint,
                    sale.data.creatorTokenAccount,
                  ),
                )
              }
            />
          )}{" "}
          {!canTransact && (
            <div className="rounded-xl border border-line bg-cream p-4 text-xs leading-5 text-moss">
              <WalletCards size={15} className="mb-2 text-ink" />
              Connect Nightly or another compatible wallet on Cookie to sign.
              Read-only launch data remains available without a wallet.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-orange/30 bg-orange/5 p-4 text-sm leading-6 text-orange">
              {error}
            </div>
          )}
          {txSignature && (
            <a
              className="block rounded-xl border border-[#b8d1af] bg-sage/70 p-4 text-sm text-[#506448]"
              href={explorer.transaction(txSignature)}
              target="_blank"
              rel="noreferrer"
            >
              <Check size={15} className="mb-2" />
              Confirmed on Cookie · View transaction →
            </a>
          )}
        </aside>
      </div>
    </main>
  );
}

function LaunchSkeleton() {
  return (
    <main
      className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16"
      aria-label="Loading launch"
      aria-busy="true"
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_390px]">
        <div>
          <div className="flex gap-3">
            <span className="skeleton h-4 w-16" />
            <span className="skeleton h-4 w-32" />
          </div>
          <div className="mt-7 flex items-start gap-4">
            <span className="skeleton h-16 w-16 shrink-0 rounded-2xl" />
            <div className="grid gap-3">
              <span className="skeleton h-10 w-64 sm:w-96" />
              <span className="skeleton h-3 w-40" />
            </div>
          </div>
          <span className="skeleton mt-7 block h-12 max-w-2xl" />
          <div className="panel mt-10 p-6 sm:p-8">
            <span className="skeleton block h-4 w-32" />
            <span className="skeleton mt-3 block h-10 w-52" />
            <span className="skeleton mt-6 block h-3 w-full" />
            <div className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
              <span className="skeleton h-8" />
              <span className="skeleton h-8" />
              <span className="skeleton h-8" />
            </div>
          </div>
        </div>
        <aside className="panel min-h-[360px] p-6">
          <span className="skeleton block h-3 w-24" />
          <span className="skeleton mt-5 block h-8 w-44" />
          <span className="skeleton mt-4 block h-20 w-full" />
          <span className="skeleton mt-6 block h-12 w-full" />
        </aside>
      </div>
    </main>
  );
}

function ParticipationCard({
  status,
  sale,
  decimals,
  position,
  contribution,
  setContribution,
  estimated,
  canTransact,
  busy,
  onBuy,
  onFinalize,
  onClaim,
}: any) {
  const settled = status === "SUCCESS" || status === "FAILED";
  return (
    <div
      className={`panel p-6 ${status === "SUCCESS" ? "border-[#b8d1af]" : status === "FAILED" ? "border-[#e6b6a8]" : ""}`}
    >
      <p className="eyebrow">
        {position
          ? "My position"
          : status === "LIVE"
            ? "Participate"
            : "Settlement"}
      </p>
      {position ? (
        <PositionView
          status={status}
          position={position}
          sale={sale}
          decimals={decimals}
          onClaim={onClaim}
          busy={busy}
        />
      ) : status === "LIVE" ? (
        <>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            Contribute during the sale.
          </h2>
          <p className="mt-2 text-sm leading-6 text-moss">
            Contribute once per wallet. Your accepted amount and refund are
            estimated before you sign.
          </p>
          <div className="mt-6">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-moss">
                Contribution in COOK
              </span>
              <input
                className="field text-lg"
                inputMode="decimal"
                placeholder="0.00"
                value={contribution}
                onChange={(event) => setContribution(event.target.value)}
              />
            </label>
            {estimated && (
              <div className="mt-4 rounded-xl bg-cream p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-moss">Estimated accepted</span>
                  <span className="font-semibold">
                    {formatUnits(estimated.accepted, 9)} COOK
                  </span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-moss">Estimated refund</span>
                  <span className="font-semibold">
                    {formatUnits(estimated.refund, 9)} COOK
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            className="button-primary mt-6 w-full"
            disabled={!canTransact || !estimated || Boolean(busy)}
            onClick={onBuy}
          >
            {busy === "buy" ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Confirming…
              </>
            ) : (
              "Contribute COOK"
            )}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-moss">
            You will sign with your wallet. The final allocation is calculated
            after the sale closes.
          </p>
        </>
      ) : status === "ENDED_AWAITING_FINALIZATION" ? (
        <>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            ENDED — AWAITING SETTLEMENT
          </h2>
          <p className="mt-2 text-sm leading-6 text-moss">
            The contribution window has closed. Any Cookie wallet can close and settle the sale.
          </p>
          <button
            className="button-primary mt-6 w-full"
            disabled={!canTransact || Boolean(busy)}
            onClick={onFinalize}
          >
            {busy === "finalize" ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Settling…
              </>
            ) : (
              "Close and settle sale"
            )}
          </button>
        </>
      ) : settled ? (
        <>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{status}</h2>
          <p className="mt-2 text-sm leading-6 text-moss">
            {status === "SUCCESS" ? "Minimum raise met. Final claims are ready." : "Minimum raise not met. Contributors can reclaim their full COOK contribution."} {sale && !position ? "Connect the contributing wallet to view its position." : ""}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            Sale has not started.
          </h2>
          <p className="mt-2 text-sm leading-6 text-moss">
            Contributions open at the start time shown above.
          </p>
        </>
      )}
    </div>
  );
}

function PositionView({
  status,
  position,
  sale,
  decimals,
  onClaim,
  busy,
}: {
  status: string;
  position: any;
  sale: any;
  decimals: number;
  onClaim: () => void;
  busy: string | null;
}) {
  const isPreFinalization = status !== "SUCCESS" && status !== "FAILED" && status !== "LIVE" && status !== "UPCOMING";
  const settled = status === "SUCCESS" || status === "FAILED"
    ? settlementWithPrefix(position.contributed, sale.data.saleSupply, sale.data.hardCap, sale.data.totalCommitted, position.committedBefore)
    : null;

  return (
    <div className="mt-5 grid gap-4">
      <div className="grid gap-3 border-y border-line py-4 text-sm">
        <Fact label="Contribution" value={`${formatUnits(position.contributed, 9)} COOK`} />
        {isPreFinalization ? (
          <>
            <Fact label="Accepted" value="Pending" />
            <Fact label="COOK refund" value="Pending" />
            <Fact label="Tokens to claim" value="Pending" />
          </>
        ) : (
          <>
            <Fact label="Accepted" value={`${formatUnits(settled?.accepted ?? 0n, 9)} COOK`} />
            <Fact label="COOK refund" value={`${formatUnits(settled?.refund ?? 0n, 9)} COOK`} />
            <Fact label="Tokens to claim" value={`${formatTokenAmount(settled?.allocation ?? 0n, decimals)} ${sale.metadata?.symbol ?? "tokens"}`} />
          </>
        )}
      </div>
      {isPreFinalization && (
        <div className="rounded-xl border border-line p-4 text-sm text-moss">
          Final amounts are calculated after the sale closes.
        </div>
      )}
      {(status === "LIVE" || status === "UPCOMING") && (
        <div className="rounded-xl border border-line p-4 text-sm text-moss">
          Final amounts will be calculated after the sale closes.
        </div>
      )}
      {status === "SUCCESS" || status === "FAILED" ? (
        <>
          <p className="text-sm text-moss">{position.claimed ? "Claimed." : "Claim available."}</p>
          {!position.claimed && (
            <button
              className="button-primary w-full"
              onClick={onClaim}
              disabled={Boolean(busy)}
            >
              {busy === "claim" ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" /> Settling…
                </>
              ) : (
                status === "FAILED" ? "Claim full COOK refund" : "Claim tokens & any refund"
              )}
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

function CreatorCard({
  sale,
  canTransact,
  busy,
  onProceeds,
  onInventory,
}: any) {
  const success = sale.data.status === STATUS.FINALIZED_SUCCESS;
  const inventoryReady = success
    ? sale.data.claimedBuyerCount === sale.data.buyerCount
    : sale.data.status === STATUS.FINALIZED_FAILED;
  return (
    <div className="panel p-6">
      <p className="eyebrow">Creator view</p>
      <div className="mt-4 grid gap-3 text-sm">
        <Fact
          label="Sale proceeds"
          value={`${formatUnits(sale.data.creatorProceeds, 9)} COOK`}
        />
        <Fact
          label="Claims"
          value={`${sale.data.claimedBuyerCount.toString()} / ${sale.data.buyerCount.toString()}`}
        />
      </div>
      {success && !sale.data.proceedsWithdrawn && (
        <button
          className="button-primary mt-6 w-full"
          disabled={!canTransact || Boolean(busy)}
          onClick={onProceeds}
        >
          {busy === "proceeds" ? "Withdrawing…" : "Withdraw sale proceeds"}
        </button>
      )}
      {sale.data.proceedsWithdrawn && (
        <p className="mt-5 text-sm text-[#506448]">Proceeds withdrawn.</p>
      )}
      {inventoryReady && !sale.data.inventoryWithdrawn && (
        <button
          className="button-secondary mt-3 w-full"
          disabled={!canTransact || Boolean(busy)}
          onClick={onInventory}
        >
          {busy === "inventory"
            ? "Cleaning up…"
            : "Withdraw remaining sale tokens"}
        </button>
      )}
      {sale.data.inventoryWithdrawn && (
        <p className="mt-3 text-sm text-moss">Remaining inventory withdrawn.</p>
      )}
    </div>
  );
}

function Activity({ sale }: { sale: any }) {
  return (
    <section className="mt-10 border-t border-line pt-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Activity</p>
          <h2 className="mt-2 text-xl font-semibold">On-chain activity</h2>
        </div>
        <a
          className="inline-flex items-center gap-1 text-xs font-semibold text-moss"
          href={explorer.address(sale.address.toBase58())}
          target="_blank"
          rel="noreferrer"
        >
          Open account <ArrowUpRight size={13} />
        </a>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="flex items-center justify-between rounded-xl border border-line p-4 text-sm">
            <span>Sale created</span>
          <span className="font-mono text-xs text-moss">
            {shorten(sale.address.toBase58(), 8, 6)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line p-4 text-sm">
          <span>Contributions tracked</span>
          <span className="text-xs text-moss">
            {sale.data.buyerCount.toString()} positions
          </span>
        </div>
        {sale.data.status !== STATUS.ACTIVE && (
          <div className="flex items-center justify-between rounded-xl border border-line p-4 text-sm">
            <span>Finalized</span>
            <span className="text-xs text-moss">
              {sale.data.status === STATUS.FINALIZED_SUCCESS
                ? "SUCCESS"
                : "FAILED"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-moss">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
function Integrity({ label }: { label: string }) {
  const displayLabel = label === "Terms" ? "Sale terms" : label;
  return (
    <div className="flex items-center gap-2">
      <Check size={14} className="text-[#66815c]" />
      <span>
        {displayLabel}: <strong>{label === "Terms" ? "LOCKED" : "DISABLED"}</strong>
      </span>
    </div>
  );
}
function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  return now;
}
