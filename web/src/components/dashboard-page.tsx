"use client";

import Link from "next/link";
import { ArrowUpRight, WalletCards } from "lucide-react";
import { useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { getSaleStatus } from "@/lib/config";
import { formatUnits, shorten } from "@/lib/format";
import { fetchSale } from "@/lib/rpc";
import { claim, finalizeSale, withdrawInventory, withdrawProceeds } from "@/lib/transactions";
import { useCreatedSales, useMyPositions } from "@/lib/queries";
import { useWallet, useWalletSigner } from "@/lib/wallet";
import { StatusPill } from "./status-pill";
import { WalletButton } from "./wallet-button";

export function DashboardPage() {
  const { publicKey } = useWallet();
  const positionsQuery = useMyPositions(publicKey);
  const createdQuery = useCreatedSales(publicKey);
  const saleQueries = useQueries({ queries: (positionsQuery.data ?? []).map((position) => ({ queryKey: ["sale", position.data.sale.toBase58()], queryFn: () => fetchSale(position.data.sale), staleTime: 15_000 })) });

  if (!publicKey) return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"><div className="flex items-center justify-between gap-5 border-b border-line pb-5"><h1 className="text-2xl font-semibold tracking-[-0.04em]">Dashboard</h1><Link className="button-secondary" href="/explore">Explore launches <ArrowUpRight size={15}/></Link></div><section className="mt-16 max-w-2xl border-y border-line py-9"><div className="flex items-center gap-3 text-moss"><WalletCards size={18}/><span className="font-mono text-[10px] uppercase tracking-[0.16em]">Wallet required</span></div><h2 className="mt-6 text-3xl font-semibold tracking-[-0.05em]">Connect wallet.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-moss">Your positions and creator launches will appear here.</p><div className="mt-7 flex flex-wrap items-center gap-4"><WalletButton/><Link className="text-sm font-semibold text-moss underline underline-offset-4 hover:text-ink" href="/explore">Browse launches</Link></div></section></main>;

  const loading = positionsQuery.isLoading || createdQuery.isLoading;
  return <main className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="text-5xl font-semibold tracking-[-0.06em]">Your positions.</h1><p className="mt-5 font-mono text-xs text-moss">{shorten(publicKey.toBase58(), 10, 8)}</p></div><Link className="button-secondary" href="/explore">Explore launches <ArrowUpRight size={15}/></Link></div>{loading && <DashboardSkeleton/>}{!loading && <div className="mt-12 grid gap-14"><section><div className="mb-5 flex items-baseline gap-3"><h2 className="text-xl font-semibold">Participated</h2><span className="font-mono text-xs text-moss">{positionsQuery.data?.length ?? 0}</span></div>{positionsQuery.error ? <p className="border border-orange/30 bg-orange/5 p-4 text-sm text-orange">Could not read buyer positions from Cookie RPC.</p> : positionsQuery.data?.length ? <div className="grid gap-3">{positionsQuery.data.map((position, index) => <PositionRow key={position.address.toBase58()} position={position} sale={saleQueries[index]?.data}/>)}</div> : <Empty title="No participant positions yet." body="When you commit to a launch, the BuyerPosition account will appear here." href="/explore" label="Explore live launches"/>}</section><section><div className="mb-5 flex items-baseline gap-3"><h2 className="text-xl font-semibold">Created</h2><span className="font-mono text-xs text-moss">{createdQuery.data?.length ?? 0}</span></div>{createdQuery.error ? <p className="border border-orange/30 bg-orange/5 p-4 text-sm text-orange">Could not read creator launches from Cookie RPC.</p> : createdQuery.data?.length ? <div className="grid gap-3">{createdQuery.data.map((sale) => <CreatedRow key={sale.address.toBase58()} sale={sale}/>)}</div> : <Empty title="No launches created yet." body="Build a fixed-window sale and make its terms immutable." href="/create" label="Create a launch"/>}</section></div>}</main>;
}

function DashboardSkeleton() {
  return <div className="mt-12 grid gap-14" aria-label="Loading positions" aria-busy="true"><section><div className="mb-5 flex items-center gap-3"><span className="skeleton h-6 w-28"/><span className="skeleton h-5 w-8"/></div><div className="grid gap-3"><SkeletonRow/><SkeletonRow/></div></section><section><div className="mb-5 flex items-center gap-3"><span className="skeleton h-6 w-20"/><span className="skeleton h-5 w-8"/></div><div className="grid gap-3"><SkeletonRow/></div></section></div>;
}

function SkeletonRow() {
  return <div className="border border-line p-5"><div className="grid gap-3"><span className="skeleton h-4 w-36"/><span className="skeleton h-3 w-52"/></div></div>;
}

function PositionRow({ position, sale }: { position: any; sale: any }) {
  const status = sale ? getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime) : null;
  const title = sale?.metadata?.name?.trim() || (sale?.metadata?.symbol?.trim() ? `$${sale.metadata.symbol.trim()}` : `Sale ${shorten(position.data.sale.toBase58())}`);
  return <div className="border border-line bg-paper p-5 transition hover:border-ink/30"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{title}</h3>{status && <StatusPill status={status}/>}</div><p className="mt-2 text-sm text-moss">Committed {formatUnits(position.data.contributed, 9)} COOK · {position.data.claimed ? "Claimed" : "Unclaimed"}</p></div><div className="flex flex-wrap items-center gap-4 sm:justify-end"><PositionAction position={position} sale={sale}/><Link href={`/launch/${position.data.sale.toBase58()}`} className="inline-flex items-center gap-1 text-xs font-semibold text-moss underline underline-offset-4 hover:text-ink">View launch <ArrowUpRight size={13}/></Link></div></div></div>;
}

function CreatedRow({ sale }: { sale: any }) {
  const status = getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime);
  const title = sale.metadata?.name?.trim() || (sale.metadata?.symbol?.trim() ? `$${sale.metadata.symbol.trim()}` : `Mint ${shorten(sale.data.mint.toBase58())}`);
  return <div className="border border-line bg-paper p-5 transition hover:border-ink/30"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{title}</h3><StatusPill status={status}/></div><p className="mt-2 text-sm text-moss">{formatUnits(sale.data.totalCommitted, 9)} / {formatUnits(sale.data.hardCap, 9)} COOK committed · {sale.data.buyerCount.toString()} participants</p></div><div className="flex flex-wrap items-center gap-4 sm:justify-end"><CreatorActions sale={sale}/><Link href={`/launch/${sale.address.toBase58()}`} className="inline-flex items-center gap-1 text-xs font-semibold text-moss underline underline-offset-4 hover:text-ink">View launch <ArrowUpRight size={13}/></Link></div></div></div>;
}

function PositionAction({ position, sale }: { position: any; sale: any }) {
  const signer = useWalletSigner();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!sale) return null;
  const status = getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime);
  if ((status !== "SUCCESS" && status !== "FAILED") || position.data.claimed) return null;
  const refund = status === "FAILED";
  async function run(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation();
    if (!signer) return;
    setBusy(true); setError(null);
    try { await claim(signer, sale.address, position.data, sale.data.mint); await client.invalidateQueries({ queryKey: ["my-positions"] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Transaction failed"); } finally { setBusy(false); }
  }
  return <div className="flex items-center gap-2">{error && <span className="text-xs text-orange">{error}</span>}<button className="button-primary px-3 py-2 text-xs" disabled={!signer || busy} onClick={run}>{busy ? "Claiming…" : refund ? "Claim refund" : "Claim allocation"}</button></div>;
}

function CreatorActions({ sale }: { sale: any }) {
  const signer = useWalletSigner();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime);
  const inventoryReady = status === "FAILED" || (status === "SUCCESS" && sale.data.claimedBuyerCount === sale.data.buyerCount);
  const run = async (event: React.MouseEvent<HTMLButtonElement>, kind: string, action: () => Promise<unknown>) => {
    event.preventDefault(); event.stopPropagation();
    if (!signer) return;
    setBusy(kind); setError(null);
    try { await action(); await client.invalidateQueries({ queryKey: ["created-sales"] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Transaction failed"); } finally { setBusy(null); }
  };
  return <div className="flex flex-wrap items-center gap-2">{error && <span className="text-xs text-orange">{error}</span>}{status === "ENDED_AWAITING_FINALIZATION" && <button className="button-primary px-3 py-2 text-xs" disabled={!signer || Boolean(busy)} onClick={(event) => void run(event, "finalize", () => finalizeSale(signer!, sale.address))}>{busy === "finalize" ? "Finalizing…" : "Finalize"}</button>}{status === "SUCCESS" && !sale.data.proceedsWithdrawn && <button className="button-primary px-3 py-2 text-xs" disabled={!signer || Boolean(busy)} onClick={(event) => void run(event, "proceeds", () => withdrawProceeds(signer!, sale.address))}>{busy === "proceeds" ? "Withdrawing…" : "Withdraw proceeds"}</button>}{inventoryReady && !sale.data.inventoryWithdrawn && <button className="button-secondary px-3 py-2 text-xs" disabled={!signer || Boolean(busy)} onClick={(event) => void run(event, "inventory", () => withdrawInventory(signer!, sale.address, sale.data.mint, sale.data.creatorTokenAccount))}>{busy === "inventory" ? "Withdrawing…" : "Withdraw inventory"}</button>}</div>;
}

function Empty({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return <div className="border border-dashed border-line p-8"><p className="font-semibold">{title}</p><p className="mt-2 max-w-xl text-sm leading-6 text-moss">{body}</p><Link href={href} className="button-secondary mt-5">{label}</Link></div>;
}
