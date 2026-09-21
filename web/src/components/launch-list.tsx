"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { getSaleStatus, type SaleStatus } from "@/lib/config";
import type { SaleRecord } from "@/lib/types";
import { LaunchCard } from "./launch-card";

export function LaunchGrid({ sales, empty = "No sales in this view yet." }: { sales: SaleRecord[]; empty?: string }) {
  if (!sales.length) return <div className="border border-dashed border-line p-10 text-center text-sm text-moss">{empty}</div>;
  return <div className="overflow-hidden border border-line bg-white/30"><div className="hidden grid-cols-[1.5fr_0.7fr_0.9fr_0.75fr_auto] gap-6 border-b border-line px-7 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-moss sm:grid"><span>Sale</span><span>Status</span><span>Contributed / cap</span><span>Participants</span><span/></div><div className="divide-y divide-line">{sales.map((sale) => <LaunchCard key={sale.address.toBase58()} sale={sale}/>)}</div></div>;
}

export function LaunchTableSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="overflow-hidden border border-line bg-white/30" aria-label="Loading sales" aria-busy="true"><div className="hidden grid-cols-[1.5fr_0.7fr_0.9fr_0.75fr_auto] gap-6 border-b border-line px-7 py-3 sm:grid"><span className="skeleton h-2 w-14"/><span className="skeleton h-2 w-14"/><span className="skeleton h-2 w-12"/><span className="skeleton h-2 w-20"/><span/></div><div className="divide-y divide-line">{Array.from({ length: rows }, (_, index) => <div key={index} className="grid gap-4 px-3 py-4 sm:grid-cols-[1.5fr_0.7fr_0.9fr_0.75fr_auto] sm:items-center sm:gap-6 sm:px-4"><div className="flex items-center gap-3"><span className="skeleton h-9 w-9 shrink-0 rounded-lg"/><span className="grid gap-2"><span className="skeleton h-3 w-32"/><span className="skeleton h-2.5 w-24"/></span></div><span className="skeleton h-3 w-20"/><span className="grid gap-2"><span className="skeleton h-3 w-28"/><span className="skeleton h-1 w-24"/></span><span className="skeleton h-3 w-14"/><span className="skeleton h-4 w-4"/></div>)}</div></div>;
}

export function ChainState({ isLoading, error, onRetry }: { isLoading: boolean; error: unknown; onRetry?: () => void }) {
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-moss"><LoaderCircle size={16} className="animate-spin"/> Connecting to Cookie Chain...</div>;
  if (error) { const detail = error instanceof Error ? error.message : String(error); return <div className="flex items-start gap-3 border border-orange/30 bg-orange/5 p-4 text-sm text-orange"><AlertCircle size={17} className="mt-0.5 shrink-0"/><div className="min-w-0"><p>Could not read sale data from Cookie Chain.</p><p className="mt-1 text-xs text-orange/80">We are not showing unverified results.</p><p className="mt-2 break-words font-mono text-[10px] leading-4 opacity-80">{detail}</p>{onRetry && <button className="mt-3 border-b border-orange text-xs font-semibold" onClick={onRetry}>Retry</button>}</div></div>; }
  return null;
}

export function groupSales(sales: SaleRecord[], now?: number) {
  const grouped: Record<SaleStatus, SaleRecord[]> = { LIVE: [], UPCOMING: [], ENDED_AWAITING_FINALIZATION: [], SUCCESS: [], FAILED: [] };
  for (const sale of sales) grouped[getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime, now === undefined ? undefined : BigInt(now))].push(sale);
  grouped.LIVE.sort((a, b) => Number(a.data.endTime - b.data.endTime));
  grouped.UPCOMING.sort((a, b) => Number(a.data.startTime - b.data.startTime));
  grouped.SUCCESS.sort((a, b) => Number(b.data.endTime - a.data.endTime));
  grouped.FAILED.sort((a, b) => Number(b.data.endTime - a.data.endTime));
  return grouped;
}
