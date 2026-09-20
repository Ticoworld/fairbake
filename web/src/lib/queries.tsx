"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { fetchAllSales, fetchBuyerPosition, fetchChainTime, fetchPositionsForBuyer, fetchSale, fetchSalesCreatedBy } from "./rpc";

export function useSales() {
  return useQuery({ queryKey: ["sales"], queryFn: fetchAllSales, staleTime: 15_000, refetchInterval: 30_000, retry: 2 });
}

export function useSale(address: string) {
  let valid = false;
  try { new PublicKey(address); valid = true; } catch { valid = false; }
  return useQuery({ queryKey: ["sale", address], queryFn: () => fetchSale(new PublicKey(address)), enabled: valid, staleTime: 10_000, refetchInterval: 15_000, retry: 2 });
}

export function useBuyerPosition(sale: string | undefined, buyer: PublicKey | null) {
  return useQuery({ queryKey: ["position", sale, buyer?.toBase58()], queryFn: () => fetchBuyerPosition(new PublicKey(sale!), buyer!), enabled: Boolean(sale && buyer), staleTime: 5_000, refetchInterval: 15_000, retry: 2 });
}

export function useMyPositions(buyer: PublicKey | null) {
  return useQuery({ queryKey: ["my-positions", buyer?.toBase58()], queryFn: () => fetchPositionsForBuyer(buyer!), enabled: Boolean(buyer), staleTime: 15_000, refetchInterval: 30_000, retry: 2 });
}

export function useCreatedSales(creator: PublicKey | null) {
  return useQuery({ queryKey: ["created-sales", creator?.toBase58()], queryFn: () => fetchSalesCreatedBy(creator!), enabled: Boolean(creator), staleTime: 15_000, refetchInterval: 30_000, retry: 2 });
}

export function useChainTime() {
  return useQuery({ queryKey: ["chain-time"], queryFn: fetchChainTime, staleTime: 15_000, refetchInterval: 30_000, retry: 2 });
}
