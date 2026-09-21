"use client";
 
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import { COOKIE_LOGO_URL, FAIRBAKE_PROGRAM_ID, getSaleStatus, STATUS, type SaleStatus } from "@/lib/config";
import { formatCountdown, formatUnits, shorten } from "@/lib/format";
import { useChainTime, useSales } from "@/lib/queries";
import { ChainState, LaunchGrid, LaunchTableSkeleton } from "./launch-list";
import type { SaleRecord } from "@/lib/types";
 
const PREVIEW_ADDRESS = new PublicKey("9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2");
const PREVIEW_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const PREVIEW_TREASURY = new PublicKey("11111111111111111111111111111111");
 
export function HomePage() {
  const query = useSales();
  const chainTime = useChainTime();
  const [preview, setPreview] = useState(false);
 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreview(process.env.NODE_ENV !== "production" && params.get("preview") === "live");
  }, []);
 
  const chainNow = chainTime.data === undefined ? BigInt(Math.floor(Date.now() / 1000)) : BigInt(chainTime.data);
  const previewSale = preview ? getPreviewSale() : null;
  const sales = previewSale ? [previewSale] : query.data ?? [];
  const { open, settled } = useMemo(() => {
    const openSales: Array<{ sale: SaleRecord; status: SaleStatus }> = [];
    const settledSales: Array<{ sale: SaleRecord; status: SaleStatus }> = [];
    for (const sale of sales) {
      const status = getSaleStatus(sale.data.status, sale.data.startTime, sale.data.endTime, chainNow);
      if (status === "LIVE" || status === "UPCOMING") openSales.push({ sale, status });
      else settledSales.push({ sale, status });
    }
    openSales.sort((a, b) => Number((a.status === "LIVE" ? a.sale.data.endTime : a.sale.data.startTime) - (b.status === "LIVE" ? b.sale.data.endTime : b.sale.data.startTime)));
    settledSales.sort((a, b) => Number(b.sale.data.endTime - a.sale.data.endTime));
    return { open: openSales, settled: settledSales };
  }, [chainNow, sales]);
  const featured = open[0];
  const loading = !preview && (query.isLoading || chainTime.isLoading);
 
  return <main className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
    <section className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">{preview ? "Live preview" : "Live now"}</h1>
        {preview && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange">Local only</span>}
      </div>
      <div className="flex items-center gap-3">
        <Link href="/explore?status=CLOSED" className="button-secondary px-4 py-2.5">History</Link>
        <Link href="/create" className="button-primary px-4 py-2.5">Create sale <ArrowUpRight size={15}/></Link>
      </div>
    </section>
 
    {loading && <div className="mt-8 grid gap-10"><FeaturedSkeleton/><LaunchTableSkeleton rows={3}/></div>}
    {!loading && !preview && query.error && <div className="mt-8"><ChainState isLoading={false} error={query.error} onRetry={() => void query.refetch()}/></div>}
    {!loading && (preview || !query.error) && <>
      <section className="mt-6" id="preview-sale">{featured ? <FeaturedLaunch sale={featured.sale} status={featured.status} preview={preview}/> : <NoLiveLaunches/>}</section>
      {open.length > 1 && <section className="mt-10"><div className="mb-4 flex items-end justify-between border-b border-line pb-4"><h2 className="text-xl font-semibold tracking-[-0.03em]">Other live sales</h2><Link href="/explore?status=LIVE" className="inline-flex items-center gap-1 text-xs font-semibold text-moss hover:text-ink">View all <ArrowUpRight size={13}/></Link></div><LaunchGrid sales={open.slice(1).map(({ sale }) => sale)}/></section>}
      {settled.length > 0 && <section className="mt-10"><div className="mb-4 flex items-end justify-between border-b border-line pb-4"><h2 className="text-xl font-semibold tracking-[-0.03em]">Recently closed sales</h2><Link href="/explore?status=CLOSED" className="inline-flex items-center gap-1 text-xs font-semibold text-moss hover:text-ink">View history <ArrowUpRight size={13}/></Link></div><LaunchGrid sales={settled.slice(0, 4).map(({ sale }) => sale)}/></section>}
    </>}
  </main>;
}
 
function getPreviewSale(): SaleRecord {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return {
    address: PREVIEW_ADDRESS,
    fetchedAt: Date.now(),
    metadata: { name: "Cookie Club", symbol: "COOK", image: COOKIE_LOGO_URL },
    data: {
      creator: FAIRBAKE_PROGRAM_ID,
      mint: PREVIEW_MINT,
      creatorTokenAccount: PREVIEW_TREASURY,
      saleSupply: 1_000_000n,
      minimumRaise: 100n * 1_000_000_000n,
      hardCap: 1_000n * 1_000_000_000n,
      maxPerWallet: 100n * 1_000_000_000n,
      startTime: now - 900n,
      endTime: now + 3_600n,
      totalCommitted: 742n * 1_000_000_000n,
      finalAcceptedRaise: 0n,
      creatorProceeds: 0n,
      refundReserve: 0n,
      refundClaimedTotal: 0n,
      acceptedClaimedTotal: 0n,
      nativeRefundDust: 0n,
      tokenAllocationClaimed: 0n,
      buyerCount: 86n,
      claimedBuyerCount: 0n,
      treasuryRentLamports: 0n,
      status: STATUS.ACTIVE,
      bump: 0,
      vaultBump: 0,
      treasuryBump: 0,
      proceedsWithdrawn: false,
      inventoryWithdrawn: false,
    },
  };
}
 
function FeaturedLaunch({ sale, status, preview }: { sale: SaleRecord; status: SaleStatus; preview: boolean }) {
  const now = useTicker();
  const symbol = sale.metadata?.symbol?.trim();
  const title = sale.metadata?.name?.trim() || (symbol ? `$${symbol}` : `Mint ${shorten(sale.data.mint.toBase58(), 6, 4)}`);
  const progress = sale.data.hardCap ? Math.min(100, Number((sale.data.totalCommitted * 10000n) / sale.data.hardCap) / 100) : 0;
  const remaining = Math.max(0, Number((status === "LIVE" ? sale.data.endTime : sale.data.startTime) - BigInt(now)));
  const isLive = status === "LIVE";
  const imageClass = sale.metadata?.image ? "object-cover" : "object-contain p-24 opacity-60";
 
  return <div className={isLive ? "live-panel grid lg:grid-cols-[0.9fr_1.1fr]" : "grid overflow-hidden border border-line bg-paper lg:grid-cols-[0.9fr_1.1fr]"}>
    <div className="relative z-10 flex flex-col justify-between p-6 sm:p-8">
      <div>
        <div className="flex items-center justify-between gap-4">
          <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${isLive ? "text-[#d8ff92]" : "text-moss"}`}>{isLive ? (preview ? "Preview / live state" : "Live") : "Upcoming"}</span>
          <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${isLive ? "text-[#a6b29e]" : "text-moss"}`}>{symbol ? `$${symbol}` : ""}</span>
        </div>
        <h2 className={`mt-8 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl ${isLive ? "text-paper" : "text-ink"}`}>{title}</h2>
        <p className={`mt-2 font-mono text-xs ${isLive ? "text-[#a6b29e]" : "text-moss"}`}>{shorten(sale.data.mint.toBase58(), 10, 6)}</p>
      </div>
      <div className="mt-10">
        <div className={`grid grid-cols-3 border-y py-4 ${isLive ? "border-white/15" : "border-line"}`}>
          <Metric label="Total contributed" value={`${formatUnits(sale.data.totalCommitted, 9)} COOK`} dark={isLive}/>
          <Metric label="Participants" value={sale.data.buyerCount.toString()} dark={isLive}/>
          <Metric label={isLive ? "Ends in" : "Starts in"} value={formatCountdown(remaining)} dark={isLive}/>
        </div>
        <Link href={preview ? "/?preview=live#preview-sale" : `/launch/${sale.address.toBase58()}`} className={`mt-7 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold ${isLive ? "bg-[#c7f36d] text-[#152011] hover:bg-[#d8ff92]" : "button-primary"}`}>{preview ? "Preview action surface" : isLive ? "Open live sale" : "Open sale"} <ArrowUpRight size={15}/></Link>
      </div>
    </div>
    <Link href={preview ? "/?preview=live#preview-sale" : `/launch/${sale.address.toBase58()}`} className={`group relative min-h-[330px] overflow-hidden ${isLive ? "live-stage" : "launch-stage"}`} aria-label={`Open ${title}`}>
      <img src={sale.metadata?.image ?? COOKIE_LOGO_URL} alt="" className={`h-full w-full transition duration-700 group-hover:scale-[1.025] ${imageClass}`}/>
      <div className={`absolute inset-0 ${isLive ? "bg-gradient-to-t from-[#10150f] via-transparent to-[#10150f]/15" : "bg-gradient-to-t from-paper/90 via-transparent to-transparent"}`}/>
      <div className={`absolute inset-x-5 bottom-5 border p-4 backdrop-blur ${isLive ? "border-white/15 bg-[#10150f]/80 text-paper" : "border-line bg-paper/85 text-ink"}`}>
        <div className="flex items-center justify-between text-xs"><span className={isLive ? "text-[#b8c8b1]" : "text-moss"}>Total contributed</span><strong>{progress.toFixed(1)}%</strong></div>
        <div className={`mt-3 h-1.5 overflow-hidden ${isLive ? "bg-white/15" : "bg-cream"}`}><div className={`h-full transition-all duration-700 ${isLive ? "bg-[#c7f36d]" : "bg-ink"}`} style={{ width: `${progress}%` }}/></div>
        <div className={`mt-3 flex justify-between font-mono text-[10px] ${isLive ? "text-[#b8c8b1]" : "text-moss"}`}><span>{formatUnits(sale.data.totalCommitted, 9)} COOK</span><span>{formatUnits(sale.data.hardCap, 9)} COOK cap</span></div>
      </div>
    </Link>
  </div>;
}
 
function NoLiveLaunches() {
  return <div className="live-panel relative min-h-[330px] overflow-hidden">
    <img src={COOKIE_LOGO_URL} alt="" className="absolute -right-[16%] -top-[28%] h-[156%] w-[78%] max-w-none object-cover object-center opacity-80 transition duration-700 hover:scale-[1.025]"/>
    <div className="absolute inset-0 bg-gradient-to-r from-[#10150f] via-[#10150f]/95 via-[42%] to-[#10150f]/10"/>
    <div className="relative z-10 flex min-h-[330px] max-w-full flex-col justify-center p-6 sm:p-8 lg:max-w-[52%]">
      <h2 className="text-3xl font-semibold tracking-[-0.05em] text-paper sm:text-4xl">Nothing live.</h2>
      <p className="mt-3 max-w-sm text-sm leading-6 text-[#c3cdbd]">No sales are live right now.</p>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Link href="/explore?status=CLOSED" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#61705c] px-5 py-3 text-sm font-semibold text-paper transition hover:border-[#c7f36d] hover:text-[#d8ff92]">History <ArrowUpRight size={15}/></Link>
        {process.env.NODE_ENV !== "production" && <Link href="/?preview=live" className="text-xs font-semibold text-[#c7f36d] underline decoration-[#61705c] underline-offset-4">Preview live state</Link>}
      </div>
    </div>
  </div>;
}
 
function FeaturedSkeleton() {
  return <div className="grid overflow-hidden border border-line bg-paper lg:grid-cols-[0.9fr_1.1fr]"><div className="p-6 sm:p-8"><div className="skeleton h-3 w-20"/><div className="skeleton mt-8 h-12 w-64"/><div className="skeleton mt-3 h-3 w-36"/><div className="mt-10 grid grid-cols-3 gap-4 border-y border-line py-4"><span className="skeleton h-9"/><span className="skeleton h-9"/><span className="skeleton h-9"/></div><span className="skeleton mt-7 block h-11 w-32"/></div><div className="launch-stage min-h-[330px] skeleton"/></div>;
}
 
function Metric({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return <div><p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${dark ? "text-[#a6b29e]" : "text-moss"}`}>{label}</p><p className={`mt-2 text-sm font-semibold ${dark ? "text-paper" : "text-ink"}`}>{value}</p></div>;
}
 
function useTicker() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => window.clearInterval(id); }, []);
  return now;
}
 
