import { Suspense } from "react";
import { ExplorePage } from "@/components/explore-page";

export default function Page() { return <Suspense fallback={<main className="mx-auto max-w-7xl px-5 py-14 sm:px-8"><div className="skeleton h-10 w-72"/><div className="skeleton mt-6 h-4 w-96 max-w-full"/></main>}><ExplorePage/></Suspense>; }
