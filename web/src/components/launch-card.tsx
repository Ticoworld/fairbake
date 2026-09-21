"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSaleStatus } from "@/lib/config";
import { formatUnits, shorten } from "@/lib/format";
import type { SaleRecord } from "@/lib/types";
import { StatusPill, StatusLabel } from "./status-pill";

export function LaunchCard({ sale }: { sale: SaleRecord }) {
  const status = getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime);
  const name = sale.metadata?.name?.trim();
  const symbol = sale.metadata?.symbol?.trim();
  const title = name || (symbol ? `$${symbol}` : `Mint ${shorten(sale.data.mint.toBase58(), 6, 4)}`);
  const progress = sale.data.hardCap ? Math.min(100, Number((sale.data.totalCommitted * 10000n) / sale.data.hardCap) / 100) : 0;
  const oversubscribed = sale.data.totalCommitted > sale.data.hardCap;
  return <Link href={`/launch/${sale.address.toBase58()}`} className="group grid gap-4 bg-paper/45 px-3 py-4 transition hover:bg-paper sm:grid-cols-[1.5fr_0.7fr_0.9fr_0.75fr_auto] sm:items-center sm:gap-6 sm:px-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-cream text-sm font-bold text-moss">{sale.metadata?.image ? <img src={sale.metadata.image} alt="" className="h-full w-full object-cover"/> : (symbol || title).slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-1 font-mono text-[11px] text-moss">{symbol ? `$${symbol} · ` : ""}{shorten(sale.data.mint.toBase58())}</p></div></div><div><p className="eyebrow sm:hidden">Status</p><div className="mt-1 grid gap-1 sm:mt-0"><StatusPill status={status}/>{oversubscribed && <StatusLabel label="OVERSUBSCRIBED" tone="orange"/>}</div></div><div><p className="eyebrow sm:hidden">Total contributed</p><p className="mt-1 text-sm font-semibold sm:mt-0">{formatUnits(sale.data.totalCommitted, 9)} <span className="text-xs font-medium text-moss">/ {formatUnits(sale.data.hardCap, 9)} COOK</span></p><div className="mt-2 h-1 overflow-hidden rounded-full bg-cream"><div className="h-full bg-ink" style={{ width: `${progress}%` }}/></div></div><div><p className="eyebrow sm:hidden">Participants</p><p className="mt-1 text-sm font-semibold sm:mt-0">{sale.data.buyerCount.toString()}</p></div><ArrowUpRight size={17} className="text-moss transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/></Link>;
}
