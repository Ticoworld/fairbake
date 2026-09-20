import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "FairBake — fair token launches without the race",
  description: "Fixed-window token launches on Cookie Chain with transparent pro-rata settlement.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProviders><AppShell>{children}</AppShell></AppProviders></body></html>;
}
