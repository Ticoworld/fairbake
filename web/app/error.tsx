"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 py-20"><div className="panel w-full p-10"><p className="eyebrow">Something went wrong</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">FairBake could not load this view.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-moss">The chain may be temporarily unavailable. Nothing was signed by your wallet.</p><button className="button-primary mt-8" onClick={reset}>Try again</button></div></main>;
}
