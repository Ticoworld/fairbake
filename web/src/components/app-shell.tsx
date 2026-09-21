"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Compass, Home, LayoutDashboard, Menu, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { WalletButton } from "./wallet-button";
import { COOKIE_LOGO_URL } from "@/lib/config";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [search, setSearch] = useState("");
  const links = [
    { label: "Home", href: "/", icon: Home },
    { label: "Explore", href: "/explore", icon: Compass },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  useEffect(() => setNavigating(false), [pathname]);

  function startNavigation(href: string) {
    setOpen(false);
    if (href !== pathname) setNavigating(true);
  }

  function submitSearch(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !search.trim()) return;
    event.preventDefault();
    setNavigating(true);
    router.push(`/explore?q=${encodeURIComponent(search.trim())}`);
  }

  function captureInternalLink(event: React.MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
    const destination = new URL(anchor.href);
    if (destination.pathname !== pathname || destination.search !== window.location.search) setNavigating(true);
  }

  return <div className="min-h-screen bg-paper" onClickCapture={captureInternalLink}>
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[88px] flex-col border-r border-line bg-paper lg:flex">
      <Link href="/" onClick={() => startNavigation("/")} className="mx-auto mt-5 grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-cream" aria-label="FairBake home"><img src={COOKIE_LOGO_URL} alt="FairBake" className="h-8 w-8 object-contain"/></Link>
      <nav className="mt-12 flex flex-1 flex-col items-center gap-2">
        {links.map(({ label, href, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link href={href} key={href} onClick={() => startNavigation(href)} className={`rail-link ${active ? "bg-cream text-ink" : ""}`} title={label} aria-current={active ? "page" : undefined}><Icon size={18}/><span>{label}</span></Link>; })}
      </nav>
    </aside>
    <div className="lg:pl-[88px]">
      <header className="relative sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3"><Link href="/" className="flex items-center gap-3 lg:hidden" onClick={() => startNavigation("/")}><span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-cream"><img src={COOKIE_LOGO_URL} alt="FairBake" className="h-7 w-7 object-contain"/></span><span className="text-[17px] font-bold tracking-[-0.04em]">FairBake</span></Link><div className="hidden text-sm font-semibold lg:block">FairBake</div></div>
          <label className="relative hidden min-w-0 flex-1 md:block md:max-w-[420px]" aria-label="Search sales"><Search size={15} className="absolute left-3 top-3 text-moss"/><input className="field h-10 bg-white/50 pl-9" placeholder="Search sales..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={submitSearch}/></label>
          <div className="flex items-center gap-3"><a href="https://cookiescan.io" target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-xs font-semibold text-moss hover:text-ink sm:inline-flex">CookieScan <ArrowUpRight size={13}/></a><Link href="/create" onClick={() => startNavigation("/create")} className="hidden items-center gap-2 rounded-lg bg-ink px-3.5 py-2.5 text-xs font-semibold text-paper transition hover:bg-orange sm:inline-flex"><Plus size={14}/> Create sale</Link><WalletButton/><button className="grid h-10 w-10 place-items-center rounded-lg border border-line lg:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">{open ? <X size={18}/> : <Menu size={18}/>}</button></div>
        </div>
        {open && <div className="border-t border-line px-5 py-5 lg:hidden"><nav className="grid gap-2">{links.map(({ label, href, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${active ? "bg-cream" : "hover:bg-cream"}`} href={href} key={href} onClick={() => startNavigation(href)} aria-current={active ? "page" : undefined}><Icon size={17}/>{label}</Link>; })}<Link className="flex items-center gap-3 rounded-lg bg-ink px-3 py-3 text-sm font-semibold text-paper" href="/create" onClick={() => startNavigation("/create")}><Plus size={17}/>Create sale</Link></nav></div>}
        {navigating && <div className="route-progress" aria-label="Loading next page"/>}
      </header>
      {children}
      <footer className="border-t border-line"><div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-5 py-8 text-xs text-moss sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><p>Fixed-window sales, settled on-chain.</p><div className="flex gap-5"><Link href="/explore" onClick={() => startNavigation("/explore")}>Explore</Link><Link href="/create" onClick={() => startNavigation("/create")}>Create sale</Link><a href="https://cookiescan.io" target="_blank" rel="noreferrer">CookieScan <ArrowUpRight size={11} className="inline"/></a></div></div></footer>
    </div>
  </div>;
}
