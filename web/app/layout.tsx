import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "FairBake — fixed-window token sales on Cookie Chain",
  description: "Contribute during one fixed window. If demand exceeds the hard cap, contributions settle pro-rata and excess COOK is refunded.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProviders><AppShell>{children}</AppShell></AppProviders></body></html>;
}
