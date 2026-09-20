"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSaleStatus } from "@/lib/config";
import { useChainTime, useSales } from "@/lib/queries";
import { ChainState, LaunchGrid, LaunchTableSkeleton } from "./launch-list";

type Filter = "ALL" | "LIVE" | "UPCOMING" | "COMPLETED";
type Sort = "ENDING" | "NEWEST" | "COMMITTED" | "PARTICIPANTS";

export function ExplorePage() {
  const query = useSales();
  const chainTime = useChainTime();
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>(() => params.get("status") === "COMPLETED" ? "COMPLETED" : "ALL");
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [sort, setSort] = useState<Sort>("ENDING");
  const now = chainTime.data === undefined ? undefined : BigInt(chainTime.data);
  const sales = useMemo(() => (query.data ?? []).filter((sale) => {
    const status = getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime, now);
    const matchesFilter = filter === "ALL" || (filter === "COMPLETED" ? status === "SUCCESS" || status === "FAILED" || status === "ENDED_AWAITING_FINALIZATION" : status === filter);
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || (sale.metadata?.name ?? "").toLowerCase().includes(needle) || (sale.metadata?.symbol ?? "").toLowerCase().includes(needle) || sale.address.toBase58().toLowerCase().includes(needle) || sale.data.mint.toBase58().toLowerCase().includes(needle) || sale.data.creator.toBase58().toLowerCase().includes(needle);
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    if (sort === "COMMITTED") return Number(b.data.totalCommitted - a.data.totalCommitted);
    if (sort === "PARTICIPANTS") return Number(b.data.buyerCount - a.data.buyerCount);
    if (sort === "NEWEST") return Number(b.data.startTime - a.data.startTime);
    return Number(a.data.endTime - b.data.endTime);
  }), [filter, now, query.data, search, sort]);

  return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"><div className="flex items-center justify-between gap-5 border-b border-line pb-5"><h1 className="text-2xl font-semibold tracking-[-0.04em]">Explore</h1><Link href="/create" className="button-secondary rounded-lg">Create launch</Link></div><div className="mt-6 flex flex-col gap-4 border-b border-line pb-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap gap-1">{(["ALL", "LIVE", "UPCOMING", "COMPLETED"] as Filter[]).map((value) => <button key={value} className={`border-b-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition ${filter === value ? "border-ink text-ink" : "border-transparent text-moss hover:border-line hover:text-ink"}`} onClick={() => setFilter(value)}>{value}</button>)}</div><div className="flex flex-col gap-3 sm:flex-row"><label className="relative block w-full sm:w-80"><Search size={16} className="absolute left-3 top-3 text-moss"/><input className="field h-10 pl-9" placeholder="Search name, mint, creator..." value={search} onChange={(event) => setSearch(event.target.value)}/></label><label className="flex h-10 items-center gap-2 border-b border-line px-2 text-xs text-moss"><span>Sort</span><select className="bg-transparent py-2 font-semibold text-ink outline-none" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="ENDING">Ending soon</option><option value="NEWEST">Newest</option><option value="COMMITTED">Most committed</option><option value="PARTICIPANTS">Most participants</option></select></label></div></div><div className="mt-6">{query.isLoading ? <LaunchTableSkeleton rows={6}/> : query.error ? <ChainState isLoading={false} error={query.error} onRetry={() => void query.refetch()}/> : <><div className="mb-5 flex items-center justify-between gap-3 text-sm text-moss"><span>{sales.length} {sales.length === 1 ? "launch" : "launches"}</span></div><LaunchGrid sales={sales} empty="No launches match these filters."/></>}</div></main>;
}
